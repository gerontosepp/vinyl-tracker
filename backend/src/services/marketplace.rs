use crate::{error::AppError, models::discogs::DiscogsPriceSuggestion};
use std::collections::HashMap;

pub const GOLDMINE_CONDITIONS: [&str; 8] = [
    "Mint (M)",
    "Near Mint (NM or M-)",
    "Very Good Plus (VG+)",
    "Very Good (VG)",
    "Good Plus (G+)",
    "Good (G)",
    "Fair (F)",
    "Poor (P)",
];

/// Normalizes any common Goldmine condition representation to canonical string
pub fn normalize_goldmine_condition(input: &str) -> Option<&'static str> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Direct exact match
    for canonical in GOLDMINE_CONDITIONS {
        if canonical.eq_ignore_ascii_case(trimmed) {
            return Some(canonical);
        }
    }

    // Extract inside parenthesis e.g. "Near Mint (NM)" -> "NM"
    let code = match (trimmed.find('('), trimmed.find(')')) {
        (Some(start), Some(end)) if end > start => &trimmed[start + 1..end],
        _ => trimmed,
    };

    let upper = code.trim().to_uppercase();
    match upper.as_str() {
        "M" | "MINT" => Some("Mint (M)"),
        "NM" | "M-" | "NEAR MINT" => Some("Near Mint (NM or M-)"),
        "VG+" | "VERY GOOD PLUS" => Some("Very Good Plus (VG+)"),
        "VG" | "VERY GOOD" => Some("Very Good (VG)"),
        "G+" | "GOOD PLUS" => Some("Good Plus (G+)"),
        "G" | "GOOD" => Some("Good (G)"),
        "F" | "FAIR" => Some("Fair (F)"),
        "P" | "POOR" => Some("Poor (P)"),
        _ => None,
    }
}

pub fn validate_goldmine_condition(input: &str) -> Result<&'static str, AppError> {
    normalize_goldmine_condition(input).ok_or_else(|| {
        AppError::BadRequest(format!(
            "Invalid Goldmine condition: '{input}'. Allowed values: Mint (M), Near Mint (NM or M-), Very Good Plus (VG+), Very Good (VG), Good Plus (G+), Good (G), Fair (F), Poor (P)"
        ))
    })
}

pub fn extract_suggested_price(
    suggestions: &HashMap<String, DiscogsPriceSuggestion>,
    condition: Option<&str>,
) -> Option<f64> {
    if suggestions.is_empty() {
        return None;
    }

    if let Some(val) = condition
        .and_then(normalize_goldmine_condition)
        .and_then(|c| suggestions.get(c))
        .map(|s| s.value)
        .filter(|&v| v > 0.0)
    {
        return Some(val);
    }

    // Fallback 1: Very Good Plus (VG+)
    if let Some(val) = suggestions
        .get("Very Good Plus (VG+)")
        .map(|s| s.value)
        .filter(|&v| v > 0.0)
    {
        return Some(val);
    }

    // Fallback 2: Any first positive value in standard condition order
    for canonical in GOLDMINE_CONDITIONS {
        if let Some(val) = suggestions
            .get(canonical)
            .map(|s| s.value)
            .filter(|&v| v > 0.0)
        {
            return Some(val);
        }
    }

    suggestions.values().map(|s| s.value).find(|&v| v > 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_goldmine_condition() {
        assert_eq!(normalize_goldmine_condition("Mint (M)"), Some("Mint (M)"));
        assert_eq!(normalize_goldmine_condition("m"), Some("Mint (M)"));
        assert_eq!(
            normalize_goldmine_condition("VG+"),
            Some("Very Good Plus (VG+)")
        );
        assert_eq!(
            normalize_goldmine_condition("very good plus"),
            Some("Very Good Plus (VG+)")
        );
        assert_eq!(
            normalize_goldmine_condition("Near Mint (NM)"),
            Some("Near Mint (NM or M-)")
        );
        assert_eq!(
            normalize_goldmine_condition("NM"),
            Some("Near Mint (NM or M-)")
        );
        assert_eq!(normalize_goldmine_condition("G+"), Some("Good Plus (G+)"));
        assert_eq!(normalize_goldmine_condition("poor"), Some("Poor (P)"));
        assert_eq!(normalize_goldmine_condition("unknown_string"), None);
    }

    #[test]
    fn test_validate_goldmine_condition() {
        assert!(validate_goldmine_condition("Mint (M)").is_ok());
        assert!(validate_goldmine_condition("VG+").is_ok());
        assert!(validate_goldmine_condition("fantasy_grade").is_err());
    }

    #[test]
    fn test_extract_suggested_price() {
        let mut map = HashMap::new();
        assert_eq!(extract_suggested_price(&map, None), None);

        map.insert(
            "Very Good Plus (VG+)".to_string(),
            DiscogsPriceSuggestion {
                currency: "EUR".to_string(),
                value: 25.50,
            },
        );
        map.insert(
            "Near Mint (NM or M-)".to_string(),
            DiscogsPriceSuggestion {
                currency: "EUR".to_string(),
                value: 40.00,
            },
        );

        // Exact condition match
        assert_eq!(extract_suggested_price(&map, Some("NM")), Some(40.00));

        // Fallback to VG+
        assert_eq!(extract_suggested_price(&map, Some("Fair (F)")), Some(25.50));

        // Remove VG+ and test next canonical fallback
        map.remove("Very Good Plus (VG+)");
        assert_eq!(extract_suggested_price(&map, Some("Fair (F)")), Some(40.00));

        // Test non-canonical key with positive value
        let mut custom_map = HashMap::new();
        custom_map.insert(
            "CustomGrade".to_string(),
            DiscogsPriceSuggestion {
                currency: "USD".to_string(),
                value: 12.00,
            },
        );
        assert_eq!(extract_suggested_price(&custom_map, None), Some(12.00));
    }
}
