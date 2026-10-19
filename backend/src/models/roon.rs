use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonZoneDto {
    pub zone_id: String,
    pub name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonStatusDto {
    pub connected: bool,
    pub paired: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    pub selected_zone_id: Option<String>,
    pub selected_zone_name: Option<String>,
    pub zones: Vec<RoonZoneDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoonSettingsDto {
    #[serde(alias = "host", alias = "roon_host")]
    pub roon_host: Option<String>,
    #[serde(alias = "port", alias = "roon_port")]
    pub roon_port: Option<i32>,
    #[serde(alias = "zone_id", alias = "zoneId", alias = "roon_zone_id")]
    pub roon_zone_id: Option<String>,
    #[serde(alias = "zone_name", alias = "zoneName", alias = "roon_zone_name")]
    pub roon_zone_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoonPlayRequestDto {
    pub artist: String,
    pub title: String,
    #[serde(alias = "zone_id")]
    pub zone_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoonPlayResponseDto {
    pub success: bool,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roon_play_request_dto_deserialization() {
        // CamelCase with zoneId
        let json1 = r#"{"artist": "Pink Floyd", "title": "The Wall", "zoneId": "zone-123"}"#;
        let req1: RoonPlayRequestDto = serde_json::from_str(json1).expect("deserialize camelCase");
        assert_eq!(req1.artist, "Pink Floyd");
        assert_eq!(req1.title, "The Wall");
        assert_eq!(req1.zone_id.as_deref(), Some("zone-123"));

        // Snake_case alias zone_id
        let json2 = r#"{"artist": "Miles Davis", "title": "Kind of Blue", "zone_id": "zone-456"}"#;
        let req2: RoonPlayRequestDto = serde_json::from_str(json2).expect("deserialize snake_case");
        assert_eq!(req2.zone_id.as_deref(), Some("zone-456"));

        // Without zoneId
        let json3 = r#"{"artist": "The Beatles", "title": "Abbey Road"}"#;
        let req3: RoonPlayRequestDto =
            serde_json::from_str(json3).expect("deserialize without zone");
        assert_eq!(req3.zone_id, None);
    }

    #[test]
    fn test_roon_zone_dto_serialization() {
        let zone = RoonZoneDto {
            zone_id: "zone-1".to_string(),
            name: "Living Room".to_string(),
            state: "playing".to_string(),
        };
        let json = serde_json::to_string(&zone).expect("serialize zone");
        assert!(json.contains("\"zoneId\":\"zone-1\""));
        assert!(json.contains("\"name\":\"Living Room\""));
        assert!(json.contains("\"state\":\"playing\""));
    }
}
