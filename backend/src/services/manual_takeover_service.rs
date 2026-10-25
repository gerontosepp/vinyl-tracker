//! Taking over a manual record to Discogs (#243, ADR-0023).
//!
//! "Check on Discogs" searches for the release of a manual record; after the user confirmed a
//! candidate, the record becomes a Discogs record. The manual `record_cache` row is never turned
//! into a Discogs row (the cache is shared and `discogs_id` is unique): everything is moved to
//! the Discogs row and the manual row is deleted. The old negative ID stays resolvable through
//! `manual_record_alias`, so printed QR labels keep working.

use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        collection::ManualAliasBackup,
        discogs::{DiscogsSearchFilter, DiscogsSearchResult},
        record::{
            CandidateMatch, DiscogsCandidateDto, TakeoverMode, TakeoverRequest, TakeoverResultDto,
        },
        user::AppUser,
    },
    services::{
        collection_sync::upsert_release,
        crypto_service::CryptoService,
        record_service::{RecordService, push_conditions},
        scan_service::barcode_variants,
        storage::StorageService,
    },
};
use sqlx::{PgPool, Row};
use std::collections::{HashMap, HashSet};

/// Most candidates shown for one manual record.
pub const MAX_CANDIDATES: usize = 10;

/// A manual record of the user with the fields the searches and the takeover need.
struct ManualRecord {
    record_id: i64,
    instance_id: i64,
    artist: Option<String>,
    title: String,
    label: Option<String>,
    catno: Option<String>,
    barcode: Option<String>,
    media_condition: Option<String>,
    sleeve_condition: Option<String>,
}

pub struct ManualTakeoverService;

impl ManualTakeoverService {
    /// Searches Discogs by barcode, catalog number + label and artist + title (each only when
    /// its fields are set) and returns the merged candidates. Changes nothing.
    pub async fn candidates(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
    ) -> Result<Vec<DiscogsCandidateDto>, AppError> {
        let record = manual_record(pool, user.id, id).await?;
        let token = discogs_token(crypto, user)?;

        let mut results: Vec<(CandidateMatch, Vec<DiscogsSearchResult>)> = Vec::new();
        let mut last_error = None;
        let mut searched = 0;

        if let Some(barcode) = &record.barcode {
            searched += 1;
            let mut found = None;
            for variant in barcode_variants(barcode) {
                match discogs_client.search_by_barcode(&variant, &token).await {
                    Ok(res) => {
                        let hit = !res.results.is_empty();
                        found = Some(res.results);
                        if hit {
                            break;
                        }
                    }
                    Err(e) => last_error = Some(e),
                }
            }
            if let Some(hits) = found {
                results.push((CandidateMatch::Barcode, hits));
            }
        }

        let mut filters = Vec::new();
        if record.catno.is_some() {
            filters.push((
                CandidateMatch::Catno,
                DiscogsSearchFilter {
                    catno: record.catno.clone(),
                    label: record.label.clone(),
                    ..DiscogsSearchFilter::default()
                },
            ));
        }
        filters.push((
            CandidateMatch::ArtistTitle,
            DiscogsSearchFilter {
                artist: record.artist.clone(),
                release_title: Some(record.title.clone()),
                ..DiscogsSearchFilter::default()
            },
        ));
        for (matched_by, filter) in filters {
            searched += 1;
            match discogs_client
                .search(&filter, Some("release"), 1, MAX_CANDIDATES as u32, &token)
                .await
            {
                Ok(res) => results.push((matched_by, res.results)),
                Err(e) => last_error = Some(e),
            }
        }

        // Only when every search failed is it an error; otherwise show what was found
        if results.is_empty()
            && searched > 0
            && let Some(e) = last_error
        {
            return Err(e);
        }

        let mut candidates = merge_candidates(results);
        let ids: Vec<i64> = candidates.iter().map(|c| c.discogs_id).collect();
        let mut owned = owned_copies(pool, user.id, &ids).await?;
        for candidate in &mut candidates {
            candidate.in_collection = owned.remove(&candidate.discogs_id).unwrap_or_default();
        }
        Ok(candidates)
    }

    /// Turns a manual record into a Discogs record after the user confirmed `req.release_id`.
    /// Listens, shelf slot, conditions and the custom sort string are kept; on any failure the
    /// record stays manual.
    pub async fn take_over(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
        req: TakeoverRequest,
    ) -> Result<TakeoverResultDto, AppError> {
        if req.release_id <= 0 {
            return Err(AppError::BadRequest(
                "A Discogs release ID is required".to_string(),
            ));
        }
        let record = manual_record(pool, user.id, id).await?;
        let token = discogs_token(crypto, user)?;
        let discogs_user = user.discogs_username.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a linked Discogs username".to_string())
        })?;
        let copies = owned_copies(pool, user.id, &[req.release_id])
            .await?
            .remove(&req.release_id)
            .unwrap_or_default();

        let instance_id = match req.mode {
            TakeoverMode::Merge => {
                let target = merge_target(&copies, req.target_instance_id)?;
                let record_id: i64 =
                    sqlx::query_scalar("SELECT id FROM record_cache WHERE discogs_id = $1")
                        .bind(req.release_id)
                        .fetch_one(pool)
                        .await
                        .map_err(AppError::Database)?;
                move_to(pool, user.id, &record, record_id, target, false).await?;
                target
            }
            TakeoverMode::NewCopy => {
                let added = discogs_client
                    .add_release_to_folder(discogs_user, 0, req.release_id, &token)
                    .await?;
                let instance_id = added.instance_id;
                let moved = async {
                    let release = discogs_client.get_release(req.release_id, &token).await?;
                    let mut tx = pool.begin().await.map_err(AppError::Database)?;
                    let record_id = upsert_release(&mut tx, &release).await?;
                    tx.commit().await.map_err(AppError::Database)?;
                    move_to(pool, user.id, &record, record_id, instance_id, true).await
                }
                .await;
                if let Err(e) = moved {
                    // Without the local takeover the next sync would add the copy a second time
                    if let Err(undo) = discogs_client
                        .delete_release_instance(
                            discogs_user,
                            0,
                            req.release_id,
                            instance_id,
                            &token,
                        )
                        .await
                    {
                        tracing::error!(
                            "Takeover of manual record {id} failed and Discogs instance {instance_id} could not be removed: {undo}"
                        );
                    }
                    return Err(e);
                }
                push_conditions(
                    discogs_client,
                    discogs_user,
                    &token,
                    req.release_id,
                    instance_id,
                    record.media_condition.as_deref(),
                    record.sleeve_condition.as_deref(),
                )
                .await;
                instance_id
            }
        };

        tracing::info!(
            "Took over manual record {} of user {} as release {} (instance {instance_id}, {:?})",
            record.instance_id,
            user.id,
            req.release_id,
            req.mode
        );

        let placement = match req.mode {
            TakeoverMode::NewCopy => {
                StorageService::place_new_copy(pool, user.id, req.release_id, instance_id).await?
            }
            TakeoverMode::Merge => {
                StorageService::commit_all(pool, user.id).await?;
                None
            }
        };
        // Loads the Discogs price when the release has none yet
        let mut detail =
            RecordService::get_record_details(pool, discogs_client, crypto, user, req.release_id)
                .await?;
        // With several copies of the release the details show any of them; show this one
        if detail.instance_id != Some(instance_id) {
            let copy = sqlx::query(
                "SELECT added_at, media_condition, sleeve_condition, sort_key
                 FROM collection_item WHERE user_id = $1 AND instance_id = $2",
            )
            .bind(user.id)
            .bind(instance_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
            detail.instance_id = Some(instance_id);
            detail.added_at = Some(copy.get::<chrono::NaiveDateTime, _>("added_at").to_string());
            detail.media_condition = copy.get("media_condition");
            detail.sleeve_condition = copy.get("sleeve_condition");
            detail.sort_key = copy.get("sort_key");
            match &placement {
                Some(p) => {
                    detail.storage = Some(p.slot.clone());
                    detail.storage_neighbors = Some(p.neighbors.clone());
                }
                None => {
                    detail.storage = StorageService::slots(pool, user.id)
                        .await?
                        .remove(&instance_id);
                    detail.storage_neighbors = None;
                }
            }
        }
        Ok(TakeoverResultDto {
            record: detail,
            instance_id,
            mode: req.mode,
            placement,
        })
    }

    /// Old IDs of the user's taken-over manual records for the JSON backup.
    pub async fn backup_aliases(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<Vec<ManualAliasBackup>, AppError> {
        sqlx::query_as::<_, (i64, i64)>(
            "SELECT old_id, instance_id FROM manual_record_alias
             WHERE user_id = $1 ORDER BY old_id DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
        .map(|rows| {
            rows.into_iter()
                .map(|(old_id, instance_id)| ManualAliasBackup {
                    old_id,
                    instance_id,
                })
                .collect()
        })
    }
}

/// Moves everything of the manual record to the Discogs record `record_id` and the copy
/// `instance_id` in one transaction, then deletes the manual record (its cover cascades).
/// `keep_copy` turns the manual copy into the new Discogs copy; otherwise it is merged away.
async fn move_to(
    pool: &PgPool,
    user_id: i64,
    record: &ManualRecord,
    record_id: i64,
    instance_id: i64,
    keep_copy: bool,
) -> Result<(), AppError> {
    let old_record = record.record_id;
    let old_instance = record.instance_id;
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let release_id: i64 = sqlx::query_scalar("SELECT discogs_id FROM record_cache WHERE id = $1")
        .bind(record_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;

    sqlx::query("UPDATE listen_event SET record_id = $3 WHERE user_id = $1 AND record_id = $2")
        .bind(user_id)
        .bind(old_record)
        .bind(record_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(
        "UPDATE label_photo SET record_id = $3, discogs_id = $4
         WHERE user_id = $1 AND record_id = $2",
    )
    .bind(user_id)
    .bind(old_record)
    .bind(record_id)
    .bind(release_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let copy = if keep_copy {
        sqlx::query(
            "UPDATE collection_item SET record_id = $3, instance_id = $4
             WHERE user_id = $1 AND instance_id = $2",
        )
        .bind(user_id)
        .bind(old_instance)
        .bind(record_id)
        .bind(instance_id)
        .execute(&mut *tx)
        .await
    } else {
        sqlx::query("DELETE FROM collection_item WHERE user_id = $1 AND instance_id = $2")
            .bind(user_id)
            .bind(old_instance)
            .execute(&mut *tx)
            .await
    }
    .map_err(AppError::Database)?;
    // A concurrent takeover or delete got there first
    if copy.rows_affected() != 1 {
        return Err(AppError::Conflict(
            "The manual record has changed in the meantime".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE storage_boundary SET instance_id = $3
         WHERE instance_id = $2
           AND unit_id IN (SELECT id FROM storage_unit WHERE user_id = $1)",
    )
    .bind(user_id)
    .bind(old_instance)
    .bind(instance_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO manual_record_alias (user_id, old_id, instance_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, old_id) DO UPDATE SET instance_id = EXCLUDED.instance_id",
    )
    .bind(user_id)
    .bind(old_instance)
    .bind(instance_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
        .bind(old_record)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM record_cache WHERE id = $1 AND source = 'manual'")
        .bind(old_record)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

    tx.commit().await.map_err(AppError::Database)
}

/// The manual record `id` (its negative ID) in the user's collection; 404 for Discogs records
/// and manual records of other users.
async fn manual_record(pool: &PgPool, user_id: i64, id: i64) -> Result<ManualRecord, AppError> {
    let row = sqlx::query(
        "SELECT rc.id, ci.instance_id, rc.artist, rc.title, rc.label, rc.catno, rc.barcode,
                ci.media_condition, ci.sleeve_condition
         FROM record_cache rc
         JOIN collection_item ci ON ci.record_id = rc.id AND ci.user_id = $1
         WHERE rc.discogs_id = $2 AND rc.source = 'manual' AND rc.owner_id = $1",
    )
    .bind(user_id)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Manual record not found with ID: {id}")))?;
    Ok(ManualRecord {
        record_id: row.get("id"),
        instance_id: row.get("instance_id"),
        artist: row.get("artist"),
        title: row.get("title"),
        label: row.get("label"),
        catno: row.get("catno"),
        barcode: row.get("barcode"),
        media_condition: row.get("media_condition"),
        sleeve_condition: row.get("sleeve_condition"),
    })
}

fn discogs_token(crypto: &CryptoService, user: &AppUser) -> Result<String, AppError> {
    let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
        AppError::BadRequest("User does not have a configured Discogs token".to_string())
    })?;
    crypto
        .decrypt(enc_token)
        .ok_or_else(|| AppError::Internal("Failed to decrypt user Discogs token".to_string()))
}

/// Instance IDs of the user's copies per release, in ascending order.
async fn owned_copies(
    pool: &PgPool,
    user_id: i64,
    release_ids: &[i64],
) -> Result<HashMap<i64, Vec<i64>>, AppError> {
    let rows = sqlx::query(
        "SELECT rc.discogs_id, ci.instance_id
         FROM collection_item ci
         JOIN record_cache rc ON rc.id = ci.record_id
         WHERE ci.user_id = $1 AND rc.discogs_id = ANY($2)
         ORDER BY ci.instance_id",
    )
    .bind(user_id)
    .bind(release_ids)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut copies: HashMap<i64, Vec<i64>> = HashMap::new();
    for row in rows {
        copies
            .entry(row.get("discogs_id"))
            .or_default()
            .push(row.get("instance_id"));
    }
    Ok(copies)
}

/// The copy to merge into: the requested one, or the only copy of the release.
fn merge_target(copies: &[i64], requested: Option<i64>) -> Result<i64, AppError> {
    match (requested, copies) {
        (Some(target), _) if copies.contains(&target) => Ok(target),
        (Some(target), _) => Err(AppError::BadRequest(format!(
            "Instance {target} is not a copy of this release in the collection"
        ))),
        (None, []) => Err(AppError::BadRequest(
            "The release is not in the collection; nothing to merge into".to_string(),
        )),
        (None, [only]) => Ok(*only),
        (None, _) => Err(AppError::BadRequest(format!(
            "The release is in the collection several times; choose one of the instances {}",
            copies
                .iter()
                .map(i64::to_string)
                .collect::<Vec<_>>()
                .join(", ")
        ))),
    }
}

/// Merges the search hits in search order, without duplicates, limited to `MAX_CANDIDATES`.
fn merge_candidates(
    results: Vec<(CandidateMatch, Vec<DiscogsSearchResult>)>,
) -> Vec<DiscogsCandidateDto> {
    let mut seen = HashSet::new();
    results
        .into_iter()
        .flat_map(|(matched_by, hits)| hits.into_iter().map(move |hit| (matched_by, hit)))
        .filter(|(_, hit)| hit.type_name.as_deref().is_none_or(|t| t == "release"))
        .filter(|(_, hit)| seen.insert(hit.id))
        .take(MAX_CANDIDATES)
        .map(|(matched_by, hit)| candidate(matched_by, hit))
        .collect()
}

/// Search results name a release "Artist - Title".
fn candidate(matched_by: CandidateMatch, hit: DiscogsSearchResult) -> DiscogsCandidateDto {
    let (artist, title) = match hit.title.split_once(" - ") {
        Some((artist, title)) => (Some(artist.trim().to_string()), title.trim().to_string()),
        None => (None, hit.title.clone()),
    };
    DiscogsCandidateDto {
        discogs_id: hit.id,
        artist,
        title,
        // Discogs reports unknown years as 0
        year: hit.year.filter(|y| !y.is_empty() && y != "0"),
        country: hit.country,
        label: hit.label.and_then(|l| l.into_iter().next()),
        catno: hit.catno.filter(|c| !c.is_empty() && c != "none"),
        format: hit.format.map(|f| f.join(", ")).filter(|f| !f.is_empty()),
        thumb_url: hit.thumb.filter(|t| !t.is_empty()),
        matched_by,
        in_collection: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(id: i64, title: &str) -> DiscogsSearchResult {
        DiscogsSearchResult {
            id,
            title: title.to_string(),
            thumb: None,
            cover_image: None,
            year: Some("1971".to_string()),
            format: Some(vec!["Vinyl".to_string(), "LP".to_string()]),
            genre: None,
            style: None,
            barcode: None,
            catno: Some("SHVL 804".to_string()),
            label: Some(vec!["Harvest".to_string(), "EMI".to_string()]),
            country: Some("UK".to_string()),
            type_name: Some("release".to_string()),
        }
    }

    #[test]
    fn candidates_are_merged_in_search_order_without_duplicates() {
        let mut master = hit(9, "Pink Floyd - Meddle");
        master.type_name = Some("master".to_string());
        let merged = merge_candidates(vec![
            (CandidateMatch::Barcode, vec![hit(1, "Pink Floyd - Meddle")]),
            (
                CandidateMatch::Catno,
                vec![hit(2, "Pink Floyd - Meddle"), hit(1, "Pink Floyd - Meddle")],
            ),
            (CandidateMatch::ArtistTitle, vec![master, hit(3, "Meddle")]),
        ]);
        let ids: Vec<(i64, CandidateMatch)> = merged
            .iter()
            .map(|c| (c.discogs_id, c.matched_by))
            .collect();
        assert_eq!(
            ids,
            [
                (1, CandidateMatch::Barcode),
                (2, CandidateMatch::Catno),
                (3, CandidateMatch::ArtistTitle)
            ]
        );
    }

    #[test]
    fn candidates_are_limited() {
        let hits = (1..=15).map(|i| hit(i, "A - B")).collect();
        assert_eq!(
            merge_candidates(vec![(CandidateMatch::ArtistTitle, hits)]).len(),
            MAX_CANDIDATES
        );
    }

    #[test]
    fn candidate_splits_artist_and_title_and_drops_unknown_values() {
        let mut raw = hit(1, "Pink Floyd - Meddle - Remastered");
        raw.year = Some("0".to_string());
        raw.catno = Some("none".to_string());
        let c = candidate(CandidateMatch::Barcode, raw);
        assert_eq!(c.artist.as_deref(), Some("Pink Floyd"));
        assert_eq!(c.title, "Meddle - Remastered");
        assert_eq!(c.year, None);
        assert_eq!(c.catno, None);
        assert_eq!(c.label.as_deref(), Some("Harvest"));
        assert_eq!(c.format.as_deref(), Some("Vinyl, LP"));

        let untitled = candidate(CandidateMatch::Barcode, hit(2, "Meddle"));
        assert_eq!(untitled.artist, None);
        assert_eq!(untitled.title, "Meddle");
    }

    #[test]
    fn merge_target_takes_the_requested_or_the_only_copy() {
        assert_eq!(merge_target(&[11, 12], Some(12)).unwrap(), 12);
        assert_eq!(merge_target(&[11], None).unwrap(), 11);
        assert!(matches!(
            merge_target(&[11], Some(99)),
            Err(AppError::BadRequest(_))
        ));
        assert!(matches!(
            merge_target(&[], None),
            Err(AppError::BadRequest(_))
        ));
        let Err(AppError::BadRequest(message)) = merge_target(&[11, 12], None) else {
            panic!("ambiguous merge target must fail");
        };
        assert!(message.contains("11, 12"), "{message}");
    }
}
