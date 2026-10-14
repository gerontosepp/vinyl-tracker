use serde::{Deserialize, Serialize};
use crate::models::scan::TrackedRecordDto;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenEventDto {
    pub id: i64,
    pub record: Option<TrackedRecordDto>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopRecordDto {
    pub title: String,
    #[serde(rename = "recordTitle")]
    pub record_title: String,
    pub artist: String,
    #[serde(rename = "thumbUrl")]
    pub thumb_url: Option<String>,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionValueData {
    pub currency: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionValueResponse {
    pub minimum: CollectionValueData,
    pub median: CollectionValueData,
    pub maximum: CollectionValueData,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GenreBreakdownItem {
    pub name: String,
    pub value: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QrCodeRequest {
    pub items: Vec<QrCodeItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrCodeItem {
    pub id: i64,
    pub title: String,
    pub artist: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DateRangeParams {
    pub from: Option<String>,
    pub to: Option<String>,
}

pub fn parse_value_data(raw: Option<&str>) -> CollectionValueData {
    let raw = match raw {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => {
            return CollectionValueData {
                currency: "EUR".to_string(),
                value: 0.0,
            }
        }
    };

    let currency = if raw.contains('$') || raw.to_uppercase().contains("USD") {
        "USD".to_string()
    } else {
        "EUR".to_string()
    };

    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == '-')
        .collect();

    if cleaned.is_empty() {
        return CollectionValueData {
            currency,
            value: 0.0,
        };
    }

    let last_comma = cleaned.rfind(',');
    let last_dot = cleaned.rfind('.');

    let normalized = match (last_comma, last_dot) {
        (Some(c), Some(d)) if c > d => {
            // European format: 11.973,16 -> 11973.16
            cleaned.replace('.', "").replace(',', ".")
        }
        (Some(_), Some(_)) => {
            // US format: 11,973.16 -> 11973.16
            cleaned.replace(',', "")
        }
        (Some(_), None) => cleaned.replace(',', "."),
        _ => cleaned,
    };

    let value = normalized.parse::<f64>().unwrap_or(0.0);
    CollectionValueData { currency, value }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_value_data_euro() {
        let v = parse_value_data(Some("€1.234,56"));
        assert_eq!(v.currency, "EUR");
        assert!((v.value - 1234.56).abs() < f64::EPSILON);

        let v2 = parse_value_data(Some("11.973,16 EUR"));
        assert_eq!(v2.currency, "EUR");
        assert!((v2.value - 11973.16).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_value_data_usd() {
        let v = parse_value_data(Some("$2,500.00"));
        assert_eq!(v.currency, "USD");
        assert!((v.value - 2500.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_value_data_empty() {
        let v = parse_value_data(None);
        assert_eq!(v.currency, "EUR");
        assert_eq!(v.value, 0.0);

        let v2 = parse_value_data(Some(""));
        assert_eq!(v2.currency, "EUR");
        assert_eq!(v2.value, 0.0);
    }
}
