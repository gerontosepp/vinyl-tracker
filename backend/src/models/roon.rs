use serde::Deserialize;
pub use vinyl_api_types::roon::{
    RoonPlayRequestDto, RoonPlayResponseDto, RoonStatusDto, RoonZoneDto,
};

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
