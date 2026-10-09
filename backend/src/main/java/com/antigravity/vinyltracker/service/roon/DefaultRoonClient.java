package com.antigravity.vinyltracker.service.roon;

import com.antigravity.vinyltracker.exception.RoonApiException;
import com.antigravity.vinyltracker.model.dto.RoonZoneDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

@Slf4j
public class DefaultRoonClient implements RoonClient, WebSocket.Listener {

    private final String host;
    private final int port;
    private String token;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private WebSocket webSocket;
    private final AtomicLong requestIdCounter = new AtomicLong(0);
    private final Map<String, CompletableFuture<MooMessage>> pendingRequests = new ConcurrentHashMap<>();
    private final Map<String, RoonZoneDto> zonesCache = new ConcurrentHashMap<>();

    private volatile boolean connected = false;
    private volatile boolean paired = false;
    private volatile String coreId;
    private volatile String coreName;

    private Consumer<String> tokenUpdateListener;
    private final StringBuilder messageBuffer = new StringBuilder();

    public DefaultRoonClient(String host, int port, String token) {
        this.host = host;
        this.port = port;
        this.token = token;
    }

    @Override
    public void setTokenUpdateListener(Consumer<String> listener) {
        this.tokenUpdateListener = listener;
    }

    @Override
    public synchronized void connect(long timeoutSeconds) {
        if (connected && webSocket != null) {
            return;
        }

        try {
            String wsUrl = String.format("ws://%s:%d/api", host, port);
            log.info("Connecting to Roon Core at {}", wsUrl);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(timeoutSeconds))
                    .build();

            CompletableFuture<WebSocket> wsFuture = client.newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(timeoutSeconds))
                    .buildAsync(URI.create(wsUrl), this);

            this.webSocket = wsFuture.get(timeoutSeconds, TimeUnit.SECONDS);
            this.connected = true;

            // Send info first, and when info resolves, send register
            sendInfo().thenRun(this::sendRegister);

        } catch (Exception e) {
            this.connected = false;
            log.error("Failed to connect to Roon Core at {}:{}", host, port, e);
            throw new RoonApiException("Failed to connect to Roon Core at " + host + ":" + port + ": " + e.getMessage(), e);
        }
    }

    private CompletableFuture<Void> sendInfo() {
        return sendRequest("com.roonlabs.registry:1/info", null)
                .thenAccept(msg -> {
                    try {
                        if (msg.getBody() != null && !msg.getBody().isBlank()) {
                            JsonNode node = objectMapper.readTree(msg.getBody());
                            if (node.has("core_id")) {
                                this.coreId = node.get("core_id").asText();
                            }
                            if (node.has("display_name")) {
                                this.coreName = node.get("display_name").asText();
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse Roon info response", e);
                    }
                })
                .exceptionally(ex -> {
                    log.warn("Error sending info request to Roon Core: {}", ex.getMessage());
                    return null;
                });
    }

    private void sendRegister() {
        try {
            Map<String, Object> registerBody = new LinkedHashMap<>();
            registerBody.put("extension_id", "com.antigravity.vinyltracker");
            registerBody.put("display_name", "Vinyl Tracker");
            registerBody.put("display_version", "0.4.0");
            registerBody.put("publisher", "Vinyl Tracker");
            registerBody.put("email", "info@vinyltracker.local");
            registerBody.put("required_services", List.of("com.roonlabs.transport:2", "com.roonlabs.browse:1"));
            registerBody.put("optional_services", List.of());
            registerBody.put("provided_services", List.of("com.roonlabs.ping:1", "com.roonlabs.status:1"));
            if (this.token != null && !this.token.isBlank()) {
                registerBody.put("token", this.token);
            }

            String json = objectMapper.writeValueAsString(registerBody);
            sendRequest("com.roonlabs.registry:1/register", json);
        } catch (Exception e) {
            log.warn("Error sending register request to Roon Core", e);
        }
    }

    private void subscribeZones() {
        try {
            Map<String, Object> body = Map.of("subscription_key", "0");
            sendRequest("com.roonlabs.transport:2/subscribe_zones", objectMapper.writeValueAsString(body));
        } catch (Exception e) {
            log.warn("Error subscribing to Roon zones", e);
        }
    }

    public CompletableFuture<MooMessage> sendRequest(String name, String jsonBody) {
        String reqId = String.valueOf(requestIdCounter.getAndIncrement());
        CompletableFuture<MooMessage> future = new CompletableFuture<>();
        pendingRequests.put(reqId, future);

        MooMessage msg = MooMessage.builder()
                .verb("REQUEST")
                .nameOrStatus(name)
                .body(jsonBody)
                .build();
        msg.setHeader("Request-Id", reqId);

        String wire = msg.toWireString();
        if (webSocket != null) {
            webSocket.sendBinary(ByteBuffer.wrap(wire.getBytes(StandardCharsets.UTF_8)), true);
        } else {
            future.completeExceptionally(new RoonApiException("WebSocket is not connected"));
        }

        return future;
    }

    @Override
    public void onOpen(WebSocket ws) {
        ws.request(1);
    }

    @Override
    public CompletionStage<?> onBinary(WebSocket ws, ByteBuffer data, boolean last) {
        byte[] bytes = new byte[data.remaining()];
        data.get(bytes);
        String chunk = new String(bytes, StandardCharsets.UTF_8);
        synchronized (messageBuffer) {
            messageBuffer.append(chunk);
            if (last) {
                String completeRaw = messageBuffer.toString();
                messageBuffer.setLength(0);
                processIncomingRaw(completeRaw);
            }
        }
        ws.request(1);
        return null;
    }

    @Override
    public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
        synchronized (messageBuffer) {
            messageBuffer.append(data);
            if (last) {
                String completeRaw = messageBuffer.toString();
                messageBuffer.setLength(0);
                processIncomingRaw(completeRaw);
            }
        }
        ws.request(1);
        return null;
    }

    private void processIncomingRaw(String raw) {
        try {
            MooMessage msg = MooMessage.parse(raw);
            if (msg == null) {
                return;
            }

            // Handle ping
            if ("REQUEST".equals(msg.getVerb()) && "com.roonlabs.ping:1/ping".equals(msg.getNameOrStatus())) {
                sendPong(msg.getRequestId());
                return;
            }

            // Handle registration callback / token
            handlePotentialRegistration(msg);

            // Handle zones update
            handlePotentialZones(msg);

            // Complete any pending future
            String reqId = msg.getRequestId();
            if (reqId != null) {
                CompletableFuture<MooMessage> future = pendingRequests.get(reqId);
                if (future != null) {
                    if ("COMPLETE".equals(msg.getVerb())) {
                        pendingRequests.remove(reqId);
                        future.complete(msg);
                    } else if ("CONTINUE".equals(msg.getVerb())) {
                        if (!future.isDone()) {
                            future.complete(msg);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error processing incoming Roon message: {}", e.getMessage());
        }
    }

    private void sendPong(String requestId) {
        if (webSocket != null) {
            MooMessage pong = MooMessage.builder()
                    .verb("COMPLETE")
                    .nameOrStatus("Success")
                    .build();
            pong.setHeader("Request-Id", requestId);
            String wire = pong.toWireString();
            webSocket.sendBinary(ByteBuffer.wrap(wire.getBytes(StandardCharsets.UTF_8)), true);
        }
    }

    private void handlePotentialRegistration(MooMessage msg) {
        try {
            if (msg.getBody() != null && !msg.getBody().isBlank()) {
                JsonNode root = objectMapper.readTree(msg.getBody());
                if (root.has("token")) {
                    String newToken = root.get("token").asText();
                    this.token = newToken;
                    this.paired = true;
                    if (root.has("core_id")) {
                        this.coreId = root.get("core_id").asText();
                    }
                    if (root.has("display_name")) {
                        this.coreName = root.get("display_name").asText();
                    }
                    log.info("Roon pairing confirmed! Core: {}, Name: {}", this.coreId, this.coreName);
                    if (tokenUpdateListener != null) {
                        tokenUpdateListener.accept(newToken);
                    }
                    subscribeZones();
                }
            }
        } catch (Exception e) {
            // ignore non-json or irrelevant messages
        }
    }

    private void handlePotentialZones(MooMessage msg) {
        try {
            if (msg.getBody() == null || msg.getBody().isBlank()) {
                return;
            }
            JsonNode root = objectMapper.readTree(msg.getBody());

            if (root.has("zones") && root.get("zones").isArray()) {
                for (JsonNode zNode : root.get("zones")) {
                    addOrUpdateZoneNode(zNode);
                }
            }
            if (root.has("zones_added") && root.get("zones_added").isArray()) {
                for (JsonNode zNode : root.get("zones_added")) {
                    addOrUpdateZoneNode(zNode);
                }
            }
            if (root.has("zones_changed") && root.get("zones_changed").isArray()) {
                for (JsonNode zNode : root.get("zones_changed")) {
                    addOrUpdateZoneNode(zNode);
                }
            }
            if (root.has("zones_removed") && root.get("zones_removed").isArray()) {
                for (JsonNode zNode : root.get("zones_removed")) {
                    String zid = zNode.isTextual() ? zNode.asText() : zNode.path("zone_id").asText();
                    if (zid != null && !zid.isBlank()) {
                        zonesCache.remove(zid);
                    }
                }
            }
        } catch (Exception e) {
            // ignore non-zone JSON
        }
    }

    private void addOrUpdateZoneNode(JsonNode zNode) {
        String zoneId = zNode.path("zone_id").asText(null);
        String name = zNode.path("display_name").asText(null);
        String state = zNode.path("state").asText("stopped");

        if (zoneId != null && !zoneId.isBlank()) {
            zonesCache.put(zoneId, RoonZoneDto.builder()
                    .zoneId(zoneId)
                    .name(name != null ? name : "Unknown Zone")
                    .state(state)
                    .build());
        }
    }

    private String cleanArtist(String artist) {
        if (artist == null) return "";
        return artist.replaceAll("\\s*\\(\\d+\\)$", "").trim();
    }

    @Override
    public boolean playAlbum(String zoneId, String artist, String title) {
        if (!connected) {
            throw new RoonApiException("Roon Core is not connected");
        }
        if (!paired) {
            throw new RoonApiException("Vinyl Tracker is not paired with Roon. Please enable the extension in Roon -> Settings -> Extensions.");
        }

        try {
            String cleanArtist = cleanArtist(artist);
            String cleanTitle = (title != null) ? title.trim() : "";
            String query = (cleanArtist + " " + cleanTitle).trim();
            log.info("Searching and playing album on Roon: query='{}', zoneId='{}'", query, zoneId);

            // Step 1: Browse search
            Map<String, Object> browseSearch = new LinkedHashMap<>();
            browseSearch.put("hierarchy", "search");
            browseSearch.put("input", query);
            browseSearch.put("pop_all", true);
            if (zoneId != null && !zoneId.isBlank()) {
                browseSearch.put("zone_or_output_id", zoneId);
            }

            sendRequest("com.roonlabs.browse:1/browse", objectMapper.writeValueAsString(browseSearch))
                    .get(5, TimeUnit.SECONDS);

            // Step 2: Load search results
            JsonNode items = loadCurrentList(20);
            if (!items.isArray() || items.isEmpty()) {
                throw new RoonApiException("No results found in Roon for: " + query);
            }

            return navigateToPlay(items, zoneId, cleanTitle, 0);

        } catch (RoonApiException rae) {
            throw rae;
        } catch (Exception e) {
            log.error("Failed to play album on Roon", e);
            throw new RoonApiException("Failed to play album on Roon: " + e.getMessage(), e);
        }
    }

    private boolean navigateToPlay(JsonNode items, String zoneId, String expectedTitle, int depth) throws Exception {
        if (depth > 6 || items == null || !items.isArray() || items.isEmpty()) {
            throw new RoonApiException("Could not find a playable action in Roon");
        }

        // 1. Direct Play Action? (hint="action" and title contains "play now" or "play")
        for (JsonNode item : items) {
            String itemTitle = item.path("title").asText("");
            String hint = item.path("hint").asText("");
            if ("action".equalsIgnoreCase(hint) && (itemTitle.toLowerCase().contains("play now") || itemTitle.toLowerCase().contains("play"))) {
                String key = item.path("item_key").asText(null);
                if (key != null) {
                    return executeBrowseItem(key, zoneId);
                }
            }
        }

        // 2. "Play Album" or "Play" action list? (hint="action_list" or title contains "play album" / "play")
        for (JsonNode item : items) {
            String itemTitle = item.path("title").asText("");
            if (itemTitle.toLowerCase().contains("play album") || itemTitle.toLowerCase().startsWith("play")) {
                String key = item.path("item_key").asText(null);
                if (key != null) {
                    browseInto(key, zoneId);
                    JsonNode subItems = loadCurrentList(20);
                    return navigateToPlay(subItems, zoneId, expectedTitle, depth + 1);
                }
            }
        }

        // 3. Album match or Albums list
        String targetKey = null;

        // Try exact/partial title match among items
        for (JsonNode item : items) {
            String itemTitle = item.path("title").asText("");
            if (!expectedTitle.isBlank() && itemTitle.equalsIgnoreCase(expectedTitle)) {
                targetKey = item.path("item_key").asText(null);
                break;
            }
        }

        // Try "Albums" section
        if (targetKey == null) {
            for (JsonNode item : items) {
                String itemTitle = item.path("title").asText("");
                if ("Albums".equalsIgnoreCase(itemTitle)) {
                    targetKey = item.path("item_key").asText(null);
                    break;
                }
            }
        }

        // Fallback to the first item with item_key if it's a list
        if (targetKey == null) {
            for (JsonNode item : items) {
                String key = item.path("item_key").asText(null);
                if (key != null) {
                    targetKey = key;
                    break;
                }
            }
        }

        if (targetKey != null) {
            browseInto(targetKey, zoneId);
            JsonNode subItems = loadCurrentList(20);
            return navigateToPlay(subItems, zoneId, expectedTitle, depth + 1);
        }

        throw new RoonApiException("Could not find a playable action in Roon");
    }

    private void browseInto(String itemKey, String zoneId) throws Exception {
        Map<String, Object> browse = new LinkedHashMap<>();
        browse.put("hierarchy", "search");
        browse.put("item_key", itemKey);
        if (zoneId != null && !zoneId.isBlank()) {
            browse.put("zone_or_output_id", zoneId);
        }
        sendRequest("com.roonlabs.browse:1/browse", objectMapper.writeValueAsString(browse))
                .get(5, TimeUnit.SECONDS);
    }

    private JsonNode loadCurrentList(int count) throws Exception {
        Map<String, Object> load = Map.of("hierarchy", "search", "offset", 0, "count", count);
        MooMessage resp = sendRequest("com.roonlabs.browse:1/load", objectMapper.writeValueAsString(load))
                .get(5, TimeUnit.SECONDS);
        JsonNode root = objectMapper.readTree(resp.getBody());
        return root.path("items");
    }

    private boolean executeBrowseItem(String itemKey, String zoneId) throws Exception {
        Map<String, Object> browse = new LinkedHashMap<>();
        browse.put("hierarchy", "search");
        browse.put("item_key", itemKey);
        if (zoneId != null && !zoneId.isBlank()) {
            browse.put("zone_or_output_id", zoneId);
        }
        sendRequest("com.roonlabs.browse:1/browse", objectMapper.writeValueAsString(browse))
                .get(5, TimeUnit.SECONDS);
        log.info("Successfully executed Roon playback action for zone {}", zoneId);
        return true;
    }

    @Override
    public boolean isConnected() {
        return connected;
    }

    @Override
    public boolean isPaired() {
        return paired;
    }

    @Override
    public String getCoreId() {
        return coreId;
    }

    @Override
    public String getCoreName() {
        return coreName;
    }

    @Override
    public List<RoonZoneDto> getZones() {
        return new ArrayList<>(zonesCache.values());
    }

    @Override
    public synchronized void close() {
        this.connected = false;
        if (webSocket != null) {
            try {
                webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Closing connection");
            } catch (Exception e) {
                // ignore
            }
            this.webSocket = null;
        }
        pendingRequests.clear();
        zonesCache.clear();
    }

    @Override
    public void onError(WebSocket ws, Throwable error) {
        log.warn("WebSocket error with Roon Core: {}", error.getMessage());
        this.connected = false;
    }

    @Override
    public CompletionStage<?> onClose(WebSocket ws, int statusCode, String reason) {
        log.info("WebSocket connection to Roon Core closed (code={}, reason={})", statusCode, reason);
        this.connected = false;
        return null;
    }
}
