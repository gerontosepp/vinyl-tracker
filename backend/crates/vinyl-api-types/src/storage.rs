//! Shelf-based storage (#41): storage types, shelves, the computed layout and the placement
//! hint shown when a record is added. Field names are camelCase.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageMedia {
    Vinyl,
    Cd,
}

impl StorageMedia {
    pub const ALL: [StorageMedia; 2] = [StorageMedia::Vinyl, StorageMedia::Cd];

    pub fn as_str(self) -> &'static str {
        match self {
            StorageMedia::Vinyl => "vinyl",
            StorageMedia::Cd => "cd",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "vinyl" => Some(StorageMedia::Vinyl),
            "cd" => Some(StorageMedia::Cd),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTypeDto {
    pub id: i64,
    pub name: String,
    pub media: StorageMedia,
    pub rows: i32,
    pub columns: i32,
    /// Capacity of one compartment in discs.
    pub capacity: i32,
    #[serde(default)]
    pub unit_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStorageTypeRequest {
    pub name: String,
    pub media: StorageMedia,
    pub rows: i32,
    pub columns: i32,
    pub capacity: i32,
}

/// The medium of a type cannot be changed after creation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStorageTypeRequest {
    pub name: String,
    pub rows: i32,
    pub columns: i32,
    pub capacity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTypesDto {
    pub types: Vec<StorageTypeDto>,
    /// Media whose records were redistributed because the change altered their compartments.
    #[serde(default)]
    pub redistributed: Vec<StorageMedia>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUnitDto {
    pub id: i64,
    pub name: String,
    pub type_id: i64,
    pub media: StorageMedia,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUnitRequest {
    pub name: String,
    pub type_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderStorageUnitsRequest {
    pub media: StorageMedia,
    /// All shelf IDs of the medium in their new order.
    pub unit_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUnitsDto {
    pub units: Vec<StorageUnitDto>,
    #[serde(default)]
    pub redistributed: Vec<StorageMedia>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedistributeRequest {
    pub media: StorageMedia,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedistributePreviewDto {
    pub media: StorageMedia,
    /// Number of copies that would change their compartment.
    pub moved_count: usize,
}

/// Where a copy is stored. `unplaced` copies did not fit into any compartment of their medium.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSlotDto {
    pub unit_id: Option<i64>,
    pub unit_name: Option<String>,
    /// Compartment number within the shelf (1-based, counted row by row from top left).
    pub compartment: Option<i32>,
    pub row: Option<i32>,
    pub column: Option<i32>,
    #[serde(default)]
    pub oversized: bool,
    #[serde(default)]
    pub unplaced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageRecordRefDto {
    pub discogs_id: i64,
    pub artist: Option<String>,
    pub title: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageNeighborsDto {
    pub previous: Option<StorageRecordRefDto>,
    pub next: Option<StorageRecordRefDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageMoveDto {
    pub record: StorageRecordRefDto,
    pub from: StorageSlotDto,
    pub to: StorageSlotDto,
}

/// Placement hint for a record: its slot, neighbors and the copies that move because of it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePlacementDto {
    pub discogs_id: i64,
    pub slot: StorageSlotDto,
    pub neighbors: StorageNeighborsDto,
    #[serde(default)]
    pub moves: Vec<StorageMoveDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCompartmentDto {
    pub number: i32,
    pub row: i32,
    pub column: i32,
    pub capacity: i32,
    /// Occupied space in discs.
    pub used: i32,
    pub count: usize,
    pub first_artist: Option<String>,
    pub last_artist: Option<String>,
    #[serde(default)]
    pub oversized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUnitLayoutDto {
    pub id: i64,
    pub name: String,
    pub type_name: String,
    pub rows: i32,
    pub columns: i32,
    pub compartments: Vec<StorageCompartmentDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLayoutDto {
    pub media: StorageMedia,
    pub units: Vec<StorageUnitLayoutDto>,
    pub unplaced_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLayoutDto {
    /// One entry per medium that has at least one shelf.
    pub media: Vec<MediaLayoutDto>,
}

/// A copy in the sort mode sequence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSequenceItemDto {
    pub discogs_id: i64,
    pub instance_id: i64,
    pub artist: Option<String>,
    pub title: String,
    pub thumb_url: Option<String>,
    pub slot: StorageSlotDto,
}

/// All copies of a medium in shelf order, copies without a place last
/// (`GET /api/storage/sequence`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSequenceDto {
    pub media: StorageMedia,
    pub items: Vec<StorageSequenceItemDto>,
}
