use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MooMessage {
    pub verb: String,
    pub name_or_status: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

impl MooMessage {
    pub fn new(verb: impl Into<String>, name_or_status: impl Into<String>) -> Self {
        Self {
            verb: verb.into(),
            name_or_status: name_or_status.into(),
            headers: HashMap::new(),
            body: None,
        }
    }

    pub fn with_body(mut self, body: impl Into<String>) -> Self {
        self.body = Some(body.into());
        self
    }

    pub fn with_header(mut self, key: impl Into<String>, val: impl Into<String>) -> Self {
        self.headers.insert(key.into(), val.into());
        self
    }

    pub fn get_header(&self, key: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .map(|(_, v)| v.as_str())
    }

    pub fn request_id(&self) -> Option<&str> {
        self.get_header("Request-Id")
    }

    pub fn to_wire_string(&self) -> String {
        let mut wire = format!("MOO/1 {} {}\n", self.verb, self.name_or_status);

        let body_bytes = self.body.as_deref().unwrap_or("").as_bytes();
        let body_len = body_bytes.len();

        let mut headers = self.headers.clone();
        if body_len > 0 && !headers.keys().any(|k| k.eq_ignore_ascii_case("Content-Type")) {
            headers.insert("Content-Type".to_string(), "application/json".to_string());
        }
        headers.insert("Content-Length".to_string(), body_len.to_string());

        for (k, v) in headers {
            wire.push_str(&format!("{k}: {v}\n"));
        }
        wire.push('\n');

        if let Some(ref body) = self.body {
            wire.push_str(body);
        }

        wire
    }

    pub fn parse(raw: &str) -> Option<Self> {
        let trimmed = raw.trim_start();
        if !trimmed.starts_with("MOO/1 ") {
            return None;
        }

        let normalized = raw.replace("\r\n", "\n");
        let (header_part, body_part) = match normalized.find("\n\n") {
            Some(idx) => (&normalized[..idx], Some(&normalized[idx + 2..])),
            None => (normalized.as_str(), None),
        };

        let mut lines = header_part.lines();
        let first_line = lines.next()?;
        let first_line = first_line.strip_prefix("MOO/1 ")?.trim();

        let (verb, name_or_status) = match first_line.find(' ') {
            Some(idx) => (
                first_line[..idx].trim().to_string(),
                first_line[idx + 1..].trim().to_string(),
            ),
            None => (first_line.to_string(), String::new()),
        };

        let mut headers = HashMap::new();
        for line in lines {
            if let Some(idx) = line.find(':') {
                let key = line[..idx].trim().to_string();
                let val = line[idx + 1..].trim().to_string();
                headers.insert(key, val);
            }
        }

        let body = match body_part {
            Some(b) if !b.is_empty() => Some(b.to_string()),
            _ => None,
        };

        Some(Self {
            verb,
            name_or_status,
            headers,
            body,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_moo_message_roundtrip() {
        let msg = MooMessage::new("REQUEST", "com.roonlabs.registry:1/info")
            .with_header("Request-Id", "42")
            .with_body(r#"{"test":"data"}"#);

        let wire = msg.to_wire_string();
        assert!(wire.starts_with("MOO/1 REQUEST com.roonlabs.registry:1/info\n"));
        assert!(wire.contains("Request-Id: 42\n"));
        assert!(wire.contains("Content-Length: 15\n"));
        assert!(wire.ends_with(r#"{"test":"data"}"#));

        let parsed = MooMessage::parse(&wire).expect("Failed to parse MOO message");
        assert_eq!(parsed.verb, "REQUEST");
        assert_eq!(parsed.name_or_status, "com.roonlabs.registry:1/info");
        assert_eq!(parsed.request_id(), Some("42"));
        assert_eq!(parsed.body.as_deref(), Some(r#"{"test":"data"}"#));
    }

    #[test]
    fn test_parse_ping_and_format_pong() {
        let ping_raw = "MOO/1 REQUEST com.roonlabs.ping:1/ping\nRequest-Id: 99\nContent-Length: 0\n\n";
        let parsed = MooMessage::parse(ping_raw).unwrap();
        assert_eq!(parsed.verb, "REQUEST");
        assert_eq!(parsed.name_or_status, "com.roonlabs.ping:1/ping");
        assert_eq!(parsed.request_id(), Some("99"));

        let pong = MooMessage::new("COMPLETE", "Success")
            .with_header("Request-Id", parsed.request_id().unwrap());
        let wire = pong.to_wire_string();
        assert!(wire.starts_with("MOO/1 COMPLETE Success\n"));
        assert!(wire.contains("Request-Id: 99\n"));
    }
}
