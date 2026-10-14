use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio_tungstenite::tungstenite::Message;
use crate::{
    error::AppError,
    models::roon::RoonZoneDto,
    services::roon::moo::MooMessage,
};

#[derive(Clone)]
pub struct RoonClient {
    host: String,
    port: i32,
    token: Arc<RwLock<Option<String>>>,
    connected: Arc<AtomicBool>,
    paired: Arc<AtomicBool>,
    core_id: Arc<RwLock<Option<String>>>,
    core_name: Arc<RwLock<Option<String>>>,
    zones: Arc<RwLock<Vec<RoonZoneDto>>>,
    pending_requests: Arc<Mutex<HashMap<String, oneshot::Sender<MooMessage>>>>,
    outgoing_tx: mpsc::Sender<MooMessage>,
    request_counter: Arc<AtomicU64>,
}

impl RoonClient {
    pub async fn connect(
        host: String,
        port: i32,
        initial_token: Option<String>,
        token_saver: Option<mpsc::Sender<String>>,
    ) -> Result<Self, AppError> {
        let ws_url = format!("ws://{host}:{port}/api");
        tracing::info!("Connecting to Roon Core at {ws_url}");

        let connect_fut = tokio_tungstenite::connect_async(&ws_url);
        let (ws_stream, _) = tokio::time::timeout(Duration::from_secs(4), connect_fut)
            .await
            .map_err(|_| AppError::Internal(format!("Timed out connecting to Roon Core at {ws_url}")))?
            .map_err(|e| AppError::Internal(format!("Failed to connect to Roon Core at {ws_url}: {e}")))?;

        let (mut ws_sink, mut ws_source) = ws_stream.split();

        let token = Arc::new(RwLock::new(initial_token.clone()));
        let connected = Arc::new(AtomicBool::new(true));
        let paired = Arc::new(AtomicBool::new(initial_token.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false)));
        let core_id = Arc::new(RwLock::new(None));
        let core_name = Arc::new(RwLock::new(None));
        let zones = Arc::new(RwLock::new(Vec::new()));
        let pending_requests: Arc<Mutex<HashMap<String, oneshot::Sender<MooMessage>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let request_counter = Arc::new(AtomicU64::new(1));

        let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<MooMessage>(32);

        // Spawn sender loop
        tokio::spawn(async move {
            while let Some(msg) = outgoing_rx.recv().await {
                let wire = msg.to_wire_string();
                tracing::debug!("Roon WS sending frame: verb={}, name={}", msg.verb, msg.name_or_status);
                if let Err(e) = ws_sink.send(Message::Binary(wire.into_bytes().into())).await {
                    tracing::warn!("Error sending message to Roon WebSocket: {e}");
                    break;
                }
            }
        });

        let client = Self {
            host,
            port,
            token: token.clone(),
            connected: connected.clone(),
            paired: paired.clone(),
            core_id: core_id.clone(),
            core_name: core_name.clone(),
            zones: zones.clone(),
            pending_requests: pending_requests.clone(),
            outgoing_tx: outgoing_tx.clone(),
            request_counter,
        };

        // Spawn receiver loop
        let client_sender = outgoing_tx.clone();
        tokio::spawn(async move {
            while let Some(res) = ws_source.next().await {
                match res {
                    Ok(Message::Text(text)) => {
                        Self::handle_incoming_text(
                            &text,
                            &client_sender,
                            &token,
                            &paired,
                            &core_id,
                            &core_name,
                            &zones,
                            &pending_requests,
                            &token_saver,
                        )
                        .await;
                    }
                    Ok(Message::Binary(bin)) => {
                        if let Ok(text) = String::from_utf8(bin.into()) {
                            Self::handle_incoming_text(
                                &text,
                                &client_sender,
                                &token,
                                &paired,
                                &core_id,
                                &core_name,
                                &zones,
                                &pending_requests,
                                &token_saver,
                            )
                            .await;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("Roon Core WebSocket connection closed");
                        connected.store(false, Ordering::SeqCst);
                        break;
                    }
                    Err(e) => {
                        tracing::debug!("Roon Core WebSocket read error: {e}");
                        connected.store(false, Ordering::SeqCst);
                        break;
                    }
                    _ => {}
                }
            }
            connected.store(false, Ordering::SeqCst);
        });

        // 1. Send info request
        let _ = client.send_info().await;
        // 2. Send register request
        let _ = client.send_register().await;
        // 3. Subscribe to zones
        let _ = client.subscribe_zones().await;

        Ok(client)
    }

    #[allow(clippy::too_many_arguments)]
    async fn handle_incoming_text(
        text: &str,
        client_sender: &mpsc::Sender<MooMessage>,
        token: &Arc<RwLock<Option<String>>>,
        paired: &Arc<AtomicBool>,
        core_id: &Arc<RwLock<Option<String>>>,
        core_name: &Arc<RwLock<Option<String>>>,
        zones: &Arc<RwLock<Vec<RoonZoneDto>>>,
        pending_requests: &Arc<Mutex<HashMap<String, oneshot::Sender<MooMessage>>>>,
        token_saver: &Option<mpsc::Sender<String>>,
    ) {
        let msg = match MooMessage::parse(text) {
            Some(m) => m,
            None => {
                tracing::debug!("Roon received unparseable message: {text}");
                return;
            }
        };

        tracing::info!(
            "Roon WS incoming: verb={}, status={}, req_id={:?}",
            msg.verb,
            msg.name_or_status,
            msg.request_id()
        );

        // 1. Handle Ping -> send Pong
        if msg.verb == "REQUEST" && msg.name_or_status == "com.roonlabs.ping:1/ping" {
            if let Some(req_id) = msg.request_id() {
                let pong = MooMessage::new("COMPLETE", "Success").with_header("Request-Id", req_id);
                let _ = client_sender.send(pong).await;
            }
            return;
        }

        // 2. Check for token in body (Registration or Pairing confirmation)
        if let Some(v) = msg
            .body
            .as_deref()
            .and_then(|b| serde_json::from_str::<Value>(b).ok())
        {
            if let Some(new_token) = v.get("token").and_then(|t| t.as_str()) {
                let mut tok_guard = token.write().await;
                *tok_guard = Some(new_token.to_string());
                paired.store(true, Ordering::SeqCst);

                if let Some(cid) = v.get("core_id").and_then(|c| c.as_str()) {
                    let mut cid_guard = core_id.write().await;
                    *cid_guard = Some(cid.to_string());
                }
                if let Some(name) = v.get("display_name").and_then(|n| n.as_str()) {
                    let mut name_guard = core_name.write().await;
                    *name_guard = Some(name.to_string());
                }

                tracing::info!("Roon pairing token confirmed: {new_token}");
                if let Some(saver) = token_saver {
                    let _ = saver.send(new_token.to_string()).await;
                }
            }

            // 3. Handle zones
            if let Some(zones_arr) = v.get("zones").and_then(|z| z.as_array()) {
                let mut parsed_zones = Vec::new();
                for z in zones_arr {
                    if let (Some(zone_id), Some(name)) = (
                        z.get("zone_id").and_then(|zid| zid.as_str()),
                        z.get("display_name").and_then(|dn| dn.as_str()),
                    ) {
                        let state = z.get("state").and_then(|s| s.as_str()).unwrap_or("stopped");
                        parsed_zones.push(RoonZoneDto {
                            zone_id: zone_id.to_string(),
                            name: name.to_string(),
                            state: state.to_string(),
                        });
                    }
                }
                let mut zones_guard = zones.write().await;
                *zones_guard = parsed_zones;
            }
        }

        // 4. Resolve pending requests
        if let Some(req_id) = msg.request_id() {
            let mut pending = pending_requests.lock().await;
            if let Some(sender) = pending.remove(req_id) {
                let _ = sender.send(msg);
            }
        }
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    pub fn is_paired(&self) -> bool {
        self.paired.load(Ordering::SeqCst)
    }

    pub async fn get_core_id(&self) -> Option<String> {
        self.core_id.read().await.clone()
    }

    pub async fn get_core_name(&self) -> Option<String> {
        self.core_name.read().await.clone()
    }

    pub fn get_host(&self) -> &str {
        &self.host
    }

    pub fn get_port(&self) -> i32 {
        self.port
    }

    pub async fn get_zones(&self) -> Vec<RoonZoneDto> {
        self.zones.read().await.clone()
    }

    pub async fn send_request(
        &self,
        name: &str,
        body: Option<Value>,
    ) -> Result<MooMessage, AppError> {
        let req_id = self.request_counter.fetch_add(1, Ordering::SeqCst).to_string();
        let mut msg = MooMessage::new("REQUEST", name).with_header("Request-Id", &req_id);

        if let Some(b) = body {
            msg = msg.with_body(b.to_string());
        }

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending_requests.lock().await;
            pending.insert(req_id.clone(), tx);
        }

        tracing::info!("Roon WS sending request: name={name}, req_id={req_id}");
        self.outgoing_tx
            .send(msg)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to queue Roon request: {e}")))?;

        match tokio::time::timeout(Duration::from_secs(10), rx).await {
            Ok(Ok(response)) => {
                tracing::info!("Roon WS response received for {name}: status={}", response.name_or_status);
                Ok(response)
            }
            Ok(Err(_)) => {
                let mut pending = self.pending_requests.lock().await;
                pending.remove(&req_id);
                Err(AppError::Internal("Roon response channel dropped".to_string()))
            }
            Err(_) => {
                let mut pending = self.pending_requests.lock().await;
                pending.remove(&req_id);
                Err(AppError::Internal(format!("Timeout waiting for Roon response to {name}")))
            }
        }
    }

    async fn send_info(&self) -> Result<(), AppError> {
        let resp = self.send_request("com.roonlabs.registry:1/info", None).await?;
        if let Some(v) = resp.body.as_deref().and_then(|b| serde_json::from_str::<Value>(b).ok()) {
            if let Some(cid) = v.get("core_id").and_then(|c| c.as_str()) {
                let mut guard = self.core_id.write().await;
                *guard = Some(cid.to_string());
            }
            if let Some(dn) = v.get("display_name").and_then(|d| d.as_str()) {
                let mut guard = self.core_name.write().await;
                *guard = Some(dn.to_string());
            }
        }
        Ok(())
    }

    async fn send_register(&self) -> Result<(), AppError> {
        let current_tok = self.token.read().await.clone();
        let mut reg_body = json!({
            "extension_id": "com.antigravity.vinyltracker",
            "display_name": "Vinyl Tracker",
            "display_version": "0.7.0",
            "publisher": "Vinyl Tracker",
            "email": "info@vinyltracker.local",
            "required_services": ["com.roonlabs.transport:2", "com.roonlabs.browse:1"],
            "optional_services": [],
            "provided_services": ["com.roonlabs.ping:1", "com.roonlabs.status:1"]
        });

        if let Some(t) = current_tok.filter(|t| !t.trim().is_empty()) {
            reg_body["token"] = json!(t);
        }

        let _ = self.send_request("com.roonlabs.registry:1/register", Some(reg_body)).await;
        Ok(())
    }

    async fn subscribe_zones(&self) -> Result<(), AppError> {
        let body = json!({ "subscription_key": "0" });
        let _ = self.send_request("com.roonlabs.transport:2/subscribe_zones", Some(body)).await;
        Ok(())
    }

    fn clean_artist(artist: &str) -> String {
        let trimmed = artist.trim();
        if let (Some(idx), true) = (trimmed.rfind(" ("), trimmed.ends_with(')')) {
            let inner = &trimmed[idx + 2..trimmed.len() - 1];
            if inner.chars().all(|c| c.is_ascii_digit()) {
                return trimmed[..idx].trim().to_string();
            }
        }
        trimmed.to_string()
    }

    pub async fn play_album(
        &self,
        zone_id: &str,
        artist: &str,
        title: &str,
    ) -> Result<bool, AppError> {
        let clean_artist = Self::clean_artist(artist);
        let clean_title = title.trim();
        let query = format!("{clean_artist} {clean_title}").trim().to_string();
        tracing::info!("Searching and playing album on Roon: query='{query}', zone_id='{zone_id}'");

        // Step 1: Browse search
        let mut browse_search = json!({
            "hierarchy": "search",
            "input": query,
            "pop_all": true
        });
        if !zone_id.trim().is_empty() {
            browse_search["zone_or_output_id"] = json!(zone_id);
        }

        self.send_request("com.roonlabs.browse:1/browse", Some(browse_search)).await?;

        // Step 2: Load search results
        let load_req = json!({
            "hierarchy": "search",
            "offset": 0,
            "set_display_offset": 0,
            "count": 20
        });

        let load_resp = self.send_request("com.roonlabs.browse:1/load", Some(load_req)).await?;
        let body_str = load_resp.body.ok_or_else(|| {
            AppError::Internal(format!("No search results returned by Roon for: {query}"))
        })?;

        let body_val: Value = serde_json::from_str(&body_str)
            .map_err(|e| AppError::Internal(format!("Invalid Roon search response: {e}")))?;

        let items = body_val
            .get("list")
            .and_then(|l| l.get("items"))
            .or_else(|| body_val.get("items"))
            .and_then(|i| i.as_array())
            .ok_or_else(|| AppError::Internal(format!("No results found in Roon for: {query}")))?;

        if items.is_empty() {
            return Err(AppError::NotFound(format!("No results found in Roon for: {query}")));
        }

        // Navigate items up to depth 6 to find direct play action or album list
        let mut current_items = items.clone();
        for _depth in 0..6 {
            if current_items.is_empty() {
                break;
            }

            // 1. Direct Play Action? (hint="action" and title contains "play now" or "play")
            let mut play_key = None;
            for item in &current_items {
                let item_title = item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                let hint = item.get("hint").and_then(|h| h.as_str()).unwrap_or("");
                let item_key = item.get("item_key").and_then(|k| k.as_str());

                let is_play_action = hint.eq_ignore_ascii_case("action")
                    && (item_title.to_lowercase().contains("play now") || item_title.to_lowercase().contains("play"));
                if let (true, Some(key)) = (is_play_action, item_key) {
                    play_key = Some(key.to_string());
                    break;
                }
            }

            if let Some(key) = play_key {
                let mut browse_action = json!({
                    "hierarchy": "search",
                    "item_key": key
                });
                if !zone_id.trim().is_empty() {
                    browse_action["zone_or_output_id"] = json!(zone_id);
                }
                self.send_request("com.roonlabs.browse:1/browse", Some(browse_action)).await?;
                tracing::info!("Successfully executed Roon playback action for zone: {zone_id}");
                return Ok(true);
            }

            // 2. "Play Album" or "Play" action list?
            let mut target_key = None;
            for item in &current_items {
                let item_title = item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                let is_play_category = item_title.to_lowercase().contains("play album") || item_title.to_lowercase().starts_with("play");
                if let (true, Some(key)) = (is_play_category, item.get("item_key").and_then(|k| k.as_str())) {
                    target_key = Some(key.to_string());
                    break;
                }
            }

            // 3. Album match or Albums section
            if target_key.is_none() {
                for item in &current_items {
                    let item_title = item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                    if !clean_title.is_empty() && item_title.eq_ignore_ascii_case(clean_title) {
                        target_key = item.get("item_key").and_then(|k| k.as_str()).map(|k| k.to_string());
                        break;
                    }
                }
            }

            if target_key.is_none() {
                for item in &current_items {
                    let item_title = item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                    if item_title.eq_ignore_ascii_case("Albums") {
                        target_key = item.get("item_key").and_then(|k| k.as_str()).map(|k| k.to_string());
                        break;
                    }
                }
            }

            // Fallback to first item with item_key
            if target_key.is_none() {
                for item in &current_items {
                    if let Some(key) = item.get("item_key").and_then(|k| k.as_str()) {
                        target_key = Some(key.to_string());
                        break;
                    }
                }
            }

            if let Some(key) = target_key {
                let mut browse_into = json!({
                    "hierarchy": "search",
                    "item_key": key
                });
                if !zone_id.trim().is_empty() {
                    browse_into["zone_or_output_id"] = json!(zone_id);
                }
                self.send_request("com.roonlabs.browse:1/browse", Some(browse_into)).await?;

                let load_req = json!({
                    "hierarchy": "search",
                    "offset": 0,
                    "set_display_offset": 0,
                    "count": 20
                });
                let load_resp = self.send_request("com.roonlabs.browse:1/load", Some(load_req)).await?;
                let body_str = load_resp.body.unwrap_or_default();
                let body_val: Value = serde_json::from_str(&body_str).unwrap_or(Value::Null);
                current_items = body_val
                    .get("list")
                    .and_then(|l| l.get("items"))
                    .or_else(|| body_val.get("items"))
                    .and_then(|i| i.as_array())
                    .cloned()
                    .unwrap_or_default();
            } else {
                break;
            }
        }

        Err(AppError::NotFound(format!("Could not find a playable action in Roon for: {query}")))
    }
}
