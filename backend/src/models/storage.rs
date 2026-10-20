use serde::{Deserialize, Serialize};
pub use vinyl_api_types::storage::*;

/// Storage configuration in the JSON backup (format version 3).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct StorageBackup {
    #[serde(default)]
    pub types: Vec<StorageBackupType>,
    #[serde(default)]
    pub units: Vec<StorageBackupUnit>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StorageBackupType {
    pub name: String,
    pub media: String,
    pub rows: i32,
    pub columns: i32,
    pub capacity: i32,
}

/// A shelf with its compartment boundaries (in shelf order).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StorageBackupUnit {
    pub name: String,
    pub type_name: String,
    #[serde(default)]
    pub boundaries: Vec<StorageBackupBoundary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StorageBackupBoundary {
    pub compartment: i32,
    pub artist_key: Option<String>,
    pub year_key: Option<String>,
    pub title_key: String,
    pub instance_id: i64,
}

/// Storage filter of the collection view (`storage_unit`, `compartment`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageFilter {
    Unit {
        unit_id: i64,
        compartment: Option<i32>,
    },
    Unplaced,
}

impl StorageFilter {
    /// Parses `storage_unit` (shelf ID or `unplaced`) and `compartment`; invalid values are
    /// ignored like the other collection filters.
    pub fn parse(storage_unit: Option<&str>, compartment: Option<i32>) -> Option<Self> {
        match storage_unit?.trim() {
            "unplaced" => Some(Self::Unplaced),
            unit => unit.parse().ok().map(|unit_id| Self::Unit {
                unit_id,
                compartment: compartment.filter(|c| *c > 0),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_storage_filter() {
        assert_eq!(StorageFilter::parse(None, Some(2)), None);
        assert_eq!(StorageFilter::parse(Some("abc"), None), None);
        assert_eq!(
            StorageFilter::parse(Some(" unplaced "), Some(3)),
            Some(StorageFilter::Unplaced)
        );
        assert_eq!(
            StorageFilter::parse(Some("7"), Some(2)),
            Some(StorageFilter::Unit {
                unit_id: 7,
                compartment: Some(2)
            })
        );
        assert_eq!(
            StorageFilter::parse(Some("7"), Some(0)),
            Some(StorageFilter::Unit {
                unit_id: 7,
                compartment: None
            })
        );
    }
}
