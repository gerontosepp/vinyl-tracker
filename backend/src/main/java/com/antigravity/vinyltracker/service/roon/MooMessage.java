package com.antigravity.vinyltracker.service.roon;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MooMessage {
    private String verb;
    private String nameOrStatus;
    @Builder.Default
    private Map<String, String> headers = new LinkedHashMap<>();
    private String body;

    public String getHeader(String name) {
        if (headers == null) {
            return null;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(name)) {
                return entry.getValue();
            }
        }
        return null;
    }

    public void setHeader(String name, String value) {
        if (headers == null) {
            headers = new LinkedHashMap<>();
        }
        headers.put(name, value);
    }

    public String getRequestId() {
        return getHeader("Request-Id");
    }

    public int getContentLength() {
        String len = getHeader("Content-Length");
        if (len == null || len.isBlank()) {
            return body != null ? body.getBytes(StandardCharsets.UTF_8).length : 0;
        }
        try {
            return Integer.parseInt(len.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public String toWireString() {
        StringBuilder sb = new StringBuilder();
        sb.append("MOO/1 ").append(verb).append(" ").append(nameOrStatus).append("\n");
        int bodyLength = (body != null) ? body.getBytes(StandardCharsets.UTF_8).length : 0;
        
        Map<String, String> outHeaders = new LinkedHashMap<>();
        if (headers != null) {
            outHeaders.putAll(headers);
        }
        if (bodyLength > 0 && !outHeaders.containsKey("Content-Type")) {
            outHeaders.put("Content-Type", "application/json");
        }
        outHeaders.put("Content-Length", String.valueOf(bodyLength));

        for (Map.Entry<String, String> entry : outHeaders.entrySet()) {
            sb.append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
        }
        sb.append("\n");
        if (body != null) {
            sb.append(body);
        }
        return sb.toString();
    }

    public static MooMessage parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        // Standardize line endings to \n
        String normalized = raw.replace("\r\n", "\n");
        int headerBodySplit = normalized.indexOf("\n\n");
        String headerPart;
        String bodyPart = "";

        if (headerBodySplit != -1) {
            headerPart = normalized.substring(0, headerBodySplit);
            bodyPart = normalized.substring(headerBodySplit + 2);
        } else {
            headerPart = normalized;
        }

        String[] headerLines = headerPart.split("\n");
        if (headerLines.length == 0 || !headerLines[0].startsWith("MOO/1 ")) {
            return null;
        }

        String firstLine = headerLines[0].substring("MOO/1 ".length()).trim();
        int firstSpace = firstLine.indexOf(' ');
        String verb;
        String nameOrStatus;
        if (firstSpace != -1) {
            verb = firstLine.substring(0, firstSpace).trim();
            nameOrStatus = firstLine.substring(firstSpace + 1).trim();
        } else {
            verb = firstLine;
            nameOrStatus = "";
        }

        Map<String, String> headers = new LinkedHashMap<>();
        for (int i = 1; i < headerLines.length; i++) {
            String line = headerLines[i];
            int colonIndex = line.indexOf(':');
            if (colonIndex != -1) {
                String key = line.substring(0, colonIndex).trim();
                String value = line.substring(colonIndex + 1).trim();
                headers.put(key, value);
            }
        }

        return MooMessage.builder()
                .verb(verb)
                .nameOrStatus(nameOrStatus)
                .headers(headers)
                .body(bodyPart)
                .build();
    }
}
