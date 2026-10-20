//! Shelf-based storage (#41). Compartment boundaries are stored, the slot of every copy is
//! computed from them (see ADR 0020 and [`layout`]).

pub mod backup;
pub mod config;
pub mod layout;

use crate::{
    error::AppError,
    models::storage::{
        MediaLayoutDto, RedistributePreviewDto, StorageCompartmentDto, StorageFilter,
        StorageLayoutDto, StorageMedia, StorageMoveDto, StoragePlacementDto, StorageSequenceDto,
        StorageSequenceItemDto, StorageSlotDto, StorageUnitLayoutDto,
    },
    services::collection_query::{SHELF_ARTIST_KEY_SQL, SHELF_TITLE_KEY_SQL},
};
use layout::{Bound, Layout, LayoutItem, ShelfKey, ShelfSpec, assign, compartments_of, distribute};
use sqlx::{PgPool, Row};
use std::collections::HashMap;

/// SQL condition selecting the copies of a medium; matches the collection's category filter.
pub fn media_condition_sql(media: StorageMedia) -> &'static str {
    match media {
        StorageMedia::Cd => "UPPER(rc.format) LIKE '%CD%'",
        StorageMedia::Vinyl => "(rc.format IS NULL OR UPPER(rc.format) NOT LIKE '%CD%')",
    }
}

struct Shelf {
    spec: ShelfSpec,
    type_name: String,
}

/// Computed position of a copy.
#[derive(Debug, Clone)]
pub struct StoragePosition {
    pub slot: StorageSlotDto,
    /// Compartment index over all media in shelf order, `usize::MAX` when unplaced
    pub compartment: usize,
    /// Index of the copy over all media in shelf order
    pub rank: usize,
}

pub struct StorageService;

impl StorageService {
    async fn shelves(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<Vec<Shelf>, AppError> {
        let rows = sqlx::query(
            "SELECT su.id, su.name, st.name AS type_name, st.grid_rows, st.grid_columns, st.capacity
             FROM storage_unit su
             JOIN storage_type st ON st.id = su.type_id
             WHERE su.user_id = $1 AND st.media = $2
             ORDER BY su.sort_order, su.id",
        )
        .bind(user_id)
        .bind(media.as_str())
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| Shelf {
                spec: ShelfSpec {
                    unit_id: row.get("id"),
                    unit_name: row.get("name"),
                    rows: i32::from(row.get::<i16, _>("grid_rows")),
                    columns: i32::from(row.get::<i16, _>("grid_columns")),
                    capacity: row.get::<i32, _>("capacity").max(1) as u32,
                },
                type_name: row.get("type_name"),
            })
            .collect())
    }

    async fn items(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<Vec<LayoutItem>, AppError> {
        let sql = format!(
            "SELECT ci.instance_id, rc.discogs_id, rc.artist, COALESCE(rc.title, '') AS title, rc.thumb_url,
                    {SHELF_ARTIST_KEY_SQL} AS artist_key, rc.release_year AS year_key,
                    {SHELF_TITLE_KEY_SQL} AS title_key,
                    COALESCE(rc.disc_count, CASE WHEN rc.format ILIKE 'double%' THEN 2 ELSE 1 END)::int4 AS discs
             FROM collection_item ci
             JOIN record_cache rc ON rc.id = ci.record_id
             WHERE ci.user_id = $1 AND {}",
            media_condition_sql(media)
        );
        let rows = sqlx::query(&sql).bind(user_id).fetch_all(pool).await?;
        Ok(rows
            .into_iter()
            .map(|row| LayoutItem {
                key: ShelfKey {
                    artist: row.get("artist_key"),
                    year: row.get("year_key"),
                    title: row.get("title_key"),
                    instance_id: row.get("instance_id"),
                },
                discogs_id: row.get("discogs_id"),
                artist: row.get("artist"),
                title: row.get("title"),
                thumb_url: row.get("thumb_url"),
                size: row.get::<i32, _>("discs").max(1) as u32,
            })
            .collect())
    }

    /// Stored boundaries per compartment, or `None` if the medium was never distributed.
    async fn bounds(pool: &PgPool, shelves: &[Shelf]) -> Result<Option<Vec<Bound>>, AppError> {
        let unit_ids: Vec<i64> = shelves.iter().map(|s| s.spec.unit_id).collect();
        let rows = sqlx::query(
            "SELECT unit_id, compartment, artist_key, year_key, title_key, instance_id
             FROM storage_boundary WHERE unit_id = ANY($1)",
        )
        .bind(&unit_ids)
        .fetch_all(pool)
        .await?;
        if rows.is_empty() {
            return Ok(None);
        }
        let mut stored: HashMap<(i64, i32), ShelfKey> = rows
            .into_iter()
            .map(|row| {
                (
                    (
                        row.get::<i64, _>("unit_id"),
                        i32::from(row.get::<i16, _>("compartment")),
                    ),
                    ShelfKey {
                        artist: row.get("artist_key"),
                        year: row.get("year_key"),
                        title: row.get("title_key"),
                        instance_id: row.get("instance_id"),
                    },
                )
            })
            .collect();
        let specs: Vec<ShelfSpec> = shelves.iter().map(|s| s.spec.clone()).collect();
        Ok(Some(
            compartments_of(&specs)
                .iter()
                .enumerate()
                .map(|(index, c)| match stored.remove(&(c.unit_id, c.number)) {
                    _ if index == 0 => Bound::Min,
                    Some(key) => Bound::Key(key),
                    None => Bound::Max,
                })
                .collect(),
        ))
    }

    async fn save_bounds(
        pool: &PgPool,
        shelves: &[Shelf],
        layout: &Layout,
    ) -> Result<(), AppError> {
        let unit_ids: Vec<i64> = shelves.iter().map(|s| s.spec.unit_id).collect();
        let mut tx = pool.begin().await?;
        sqlx::query("DELETE FROM storage_boundary WHERE unit_id = ANY($1)")
            .bind(&unit_ids)
            .execute(&mut *tx)
            .await?;
        for (compartment, bound) in layout.compartments.iter().zip(layout.boundaries()) {
            if let Bound::Key(key) = bound {
                sqlx::query(
                    "INSERT INTO storage_boundary
                         (unit_id, compartment, artist_key, year_key, title_key, instance_id)
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(compartment.unit_id)
                .bind(compartment.number as i16)
                .bind(&key.artist)
                .bind(&key.year)
                .bind(&key.title)
                .bind(key.instance_id)
                .execute(&mut *tx)
                .await?;
            }
        }
        tx.commit().await?;
        Ok(())
    }

    /// Layout of `items` with the stored boundaries (balanced), or an even distribution if the
    /// medium has never been distributed.
    async fn layout_of(
        pool: &PgPool,
        shelves: &[Shelf],
        items: Vec<LayoutItem>,
    ) -> Result<Layout, AppError> {
        let specs: Vec<ShelfSpec> = shelves.iter().map(|s| s.spec.clone()).collect();
        let compartments = compartments_of(&specs);
        Ok(match Self::bounds(pool, shelves).await? {
            Some(bounds) => assign(compartments, &bounds, items),
            None => distribute(compartments, items),
        })
    }

    /// Current layout of a medium, `None` without shelves. Read-only.
    pub async fn current_layout(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<Option<Layout>, AppError> {
        let shelves = Self::shelves(pool, user_id, media).await?;
        if shelves.is_empty() {
            return Ok(None);
        }
        let items = Self::items(pool, user_id, media).await?;
        Ok(Some(Self::layout_of(pool, &shelves, items).await?))
    }

    /// Sorts in changed copies (added, synced, restored) and stores the balanced boundaries.
    pub async fn commit(pool: &PgPool, user_id: i64, media: StorageMedia) -> Result<(), AppError> {
        let shelves = Self::shelves(pool, user_id, media).await?;
        if shelves.is_empty() {
            return Ok(());
        }
        let items = Self::items(pool, user_id, media).await?;
        let layout = Self::layout_of(pool, &shelves, items).await?;
        Self::save_bounds(pool, &shelves, &layout).await
    }

    pub async fn commit_all(pool: &PgPool, user_id: i64) -> Result<(), AppError> {
        for media in StorageMedia::ALL {
            Self::commit(pool, user_id, media).await?;
        }
        Ok(())
    }

    /// Distributes the medium evenly over all its compartments and stores the boundaries.
    pub async fn redistribute(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<(), AppError> {
        let shelves = Self::shelves(pool, user_id, media).await?;
        if shelves.is_empty() {
            return Ok(());
        }
        let specs: Vec<ShelfSpec> = shelves.iter().map(|s| s.spec.clone()).collect();
        let items = Self::items(pool, user_id, media).await?;
        let layout = distribute(compartments_of(&specs), items);
        Self::save_bounds(pool, &shelves, &layout).await
    }

    /// Number of copies that would change their compartment when redistributing.
    pub async fn preview_redistribution(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<RedistributePreviewDto, AppError> {
        let shelves = Self::shelves(pool, user_id, media).await?;
        let moved_count = if shelves.is_empty() {
            0
        } else {
            let specs: Vec<ShelfSpec> = shelves.iter().map(|s| s.spec.clone()).collect();
            let items = Self::items(pool, user_id, media).await?;
            let current = Self::layout_of(pool, &shelves, items.clone()).await?;
            let even = distribute(compartments_of(&specs), items);
            layout::moved_items(&current, &even).len()
        };
        Ok(RedistributePreviewDto { media, moved_count })
    }

    /// Overview of all shelves per medium with fill level and artist range per compartment.
    pub async fn layout_overview(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<StorageLayoutDto, AppError> {
        let mut media_layouts = Vec::new();
        for media in StorageMedia::ALL {
            let shelves = Self::shelves(pool, user_id, media).await?;
            if shelves.is_empty() {
                continue;
            }
            let items = Self::items(pool, user_id, media).await?;
            let layout = Self::layout_of(pool, &shelves, items).await?;
            let used = layout.used();
            let members = layout.members();

            let units = shelves
                .iter()
                .map(|shelf| StorageUnitLayoutDto {
                    id: shelf.spec.unit_id,
                    name: shelf.spec.unit_name.clone(),
                    type_name: shelf.type_name.clone(),
                    rows: shelf.spec.rows,
                    columns: shelf.spec.columns,
                    compartments: layout
                        .compartments
                        .iter()
                        .enumerate()
                        .filter(|(_, c)| c.unit_id == shelf.spec.unit_id)
                        .map(|(index, c)| {
                            let in_compartment = &members[index];
                            let artist_of = |item: Option<&usize>| {
                                item.and_then(|&i| layout.items[i].artist.clone())
                            };
                            StorageCompartmentDto {
                                number: c.number,
                                row: c.row,
                                column: c.column,
                                capacity: c.capacity as i32,
                                used: used[index] as i32,
                                count: in_compartment.len(),
                                first_artist: artist_of(in_compartment.first()),
                                last_artist: artist_of(in_compartment.last()),
                                oversized: in_compartment
                                    .iter()
                                    .any(|&i| layout.items[i].size > c.capacity),
                            }
                        })
                        .collect(),
                })
                .collect();

            media_layouts.push(MediaLayoutDto {
                media,
                units,
                unplaced_count: layout.unplaced_count(),
            });
        }
        Ok(StorageLayoutDto {
            media: media_layouts,
        })
    }

    /// Position of every copy (by instance ID) of the media that have shelves.
    pub async fn positions(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<HashMap<i64, StoragePosition>, AppError> {
        let mut positions = HashMap::new();
        let (mut compartment_offset, mut item_offset) = (0, 0);
        for media in StorageMedia::ALL {
            if let Some(layout) = Self::current_layout(pool, user_id, media).await? {
                for (index, item) in layout.items.iter().enumerate() {
                    let compartment =
                        layout.assignment[index].map_or(usize::MAX, |c| compartment_offset + c);
                    positions.insert(
                        item.key.instance_id,
                        StoragePosition {
                            slot: layout.slot(index),
                            compartment,
                            rank: item_offset + index,
                        },
                    );
                }
                compartment_offset += layout.compartments.len();
                item_offset += layout.items.len();
            }
        }
        Ok(positions)
    }

    /// All copies of a medium in shelf order with their slot (unplaced ones last), for the
    /// sort mode. Empty without shelves for the medium.
    pub async fn sequence(
        pool: &PgPool,
        user_id: i64,
        media: StorageMedia,
    ) -> Result<StorageSequenceDto, AppError> {
        let items = match Self::current_layout(pool, user_id, media).await? {
            Some(layout) => {
                let mut indices: Vec<usize> = (0..layout.items.len()).collect();
                // Unplaced copies go last; within both groups the shelf order is kept
                indices.sort_by_key(|&i| layout.assignment[i].is_none());
                indices
                    .into_iter()
                    .map(|i| {
                        let item = &layout.items[i];
                        StorageSequenceItemDto {
                            discogs_id: item.discogs_id,
                            instance_id: item.key.instance_id,
                            artist: item.artist.clone(),
                            title: item.title.clone(),
                            thumb_url: item.thumb_url.clone(),
                            slot: layout.slot(i),
                        }
                    })
                    .collect()
            }
            None => Vec::new(),
        };
        Ok(StorageSequenceDto { media, items })
    }

    /// Slot of every copy (by instance ID) of the media that have shelves.
    pub async fn slots(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<HashMap<i64, StorageSlotDto>, AppError> {
        Ok(Self::positions(pool, user_id)
            .await?
            .into_iter()
            .map(|(instance_id, position)| (instance_id, position.slot))
            .collect())
    }

    /// Instance IDs matching a storage filter of the collection view. Copies of media without
    /// shelves count as unplaced.
    pub async fn filter_instances(
        pool: &PgPool,
        user_id: i64,
        filter: StorageFilter,
    ) -> Result<Vec<i64>, AppError> {
        let positions = Self::positions(pool, user_id).await?;
        Ok(match filter {
            StorageFilter::Unit {
                unit_id,
                compartment,
            } => positions
                .into_iter()
                .filter(|(_, p)| {
                    p.slot.unit_id == Some(unit_id)
                        && compartment.is_none_or(|c| p.slot.compartment == Some(c))
                })
                .map(|(instance_id, _)| instance_id)
                .collect(),
            StorageFilter::Unplaced => {
                let all: Vec<i64> = sqlx::query_scalar(
                    "SELECT instance_id FROM collection_item WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_all(pool)
                .await?;
                all.into_iter()
                    .filter(|id| positions.get(id).is_none_or(|p| p.slot.unplaced))
                    .collect()
            }
        })
    }

    /// Medium and first copy (lowest instance ID) of a record in the user's collection.
    async fn first_copy(
        pool: &PgPool,
        user_id: i64,
        discogs_id: i64,
    ) -> Result<Option<(i64, StorageMedia)>, AppError> {
        let row = sqlx::query(
            "SELECT ci.instance_id, UPPER(COALESCE(rc.format, '')) LIKE '%CD%' AS is_cd
             FROM collection_item ci
             JOIN record_cache rc ON rc.id = ci.record_id
             WHERE ci.user_id = $1 AND rc.discogs_id = $2
             ORDER BY ci.instance_id
             LIMIT 1",
        )
        .bind(user_id)
        .bind(discogs_id)
        .fetch_optional(pool)
        .await?;
        Ok(row.map(|row| {
            let media = if row.get::<bool, _>("is_cd") {
                StorageMedia::Cd
            } else {
                StorageMedia::Vinyl
            };
            (row.get("instance_id"), media)
        }))
    }

    /// Slot and neighbors of a record's first copy. `Ok(None)` without shelves for its medium,
    /// `NotFound` if the record is not in the collection.
    pub async fn placement_for_record(
        pool: &PgPool,
        user_id: i64,
        discogs_id: i64,
    ) -> Result<Option<StoragePlacementDto>, AppError> {
        let (instance_id, media) = Self::first_copy(pool, user_id, discogs_id)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!("Record {discogs_id} is not in your collection"))
            })?;
        let Some(layout) = Self::current_layout(pool, user_id, media).await? else {
            return Ok(None);
        };
        Ok(layout
            .index_of_instance(instance_id)
            .map(|index| StoragePlacementDto {
                discogs_id,
                slot: layout.slot(index),
                neighbors: layout.neighbors(index),
                moves: Vec::new(),
            }))
    }

    /// Placement hint for a copy that was just added: its slot, neighbors and the copies the
    /// balancing moves because of it. Stores the new boundaries afterwards.
    pub async fn place_new_copy(
        pool: &PgPool,
        user_id: i64,
        discogs_id: i64,
        instance_id: i64,
    ) -> Result<Option<StoragePlacementDto>, AppError> {
        let Some((_, media)) = Self::first_copy(pool, user_id, discogs_id).await? else {
            return Ok(None);
        };
        let shelves = Self::shelves(pool, user_id, media).await?;
        if shelves.is_empty() {
            return Ok(None);
        }
        let items = Self::items(pool, user_id, media).await?;
        let others: Vec<LayoutItem> = items
            .iter()
            .filter(|item| item.key.instance_id != instance_id)
            .cloned()
            .collect();
        let before = Self::layout_of(pool, &shelves, others).await?;
        let after = Self::layout_of(pool, &shelves, items).await?;
        Self::save_bounds(pool, &shelves, &after).await?;

        let Some(index) = after.index_of_instance(instance_id) else {
            return Ok(None);
        };
        let moves = layout::moved_items(&before, &after)
            .into_iter()
            .map(|(before_index, after_index)| StorageMoveDto {
                record: after.items[after_index].record_ref(),
                from: before.slot(before_index),
                to: after.slot(after_index),
            })
            .collect();
        Ok(Some(StoragePlacementDto {
            discogs_id,
            slot: after.slot(index),
            neighbors: after.neighbors(index),
            moves,
        }))
    }
}
