//! Automatic label photo identification via OpenRouter (#235).
//!
//! A vision model reads the label photo and searches Discogs through read-only tools until it
//! submits a match. It cannot change the collection: the suggestion is only stored and the user
//! confirms it in the label inbox. Suggested releases must have come back from a tool call in
//! the same run, so the model cannot invent release IDs.

use crate::{
    clients::{
        discogs::DiscogsClient,
        openrouter::{ChatMessage, OpenRouterClient},
    },
    error::AppError,
    models::{
        discogs::{DiscogsRelease, DiscogsSearchFilter},
        label_photo::{
            LABEL_READING_STEPS, LabelCandidate, LabelMatchConfidence, LabelReading,
            LabelSuggestion,
        },
        user::AppUser,
    },
    services::{
        label_photo_service::{IdentifyOutcome, LabelPhotoService},
        openrouter_settings_service::OpenRouterSettingsService,
    },
    state::AppState,
};
use base64::Engine;
use futures_util::future::join_all;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::HashSet;

/// Model turns per photo; a match usually needs 2-4 (search, details, submit).
const MAX_ROUNDS: usize = 8;
const MAX_SEARCH_RESULTS: usize = 10;
const MAX_ALTERNATIVES: usize = 3;
const MAX_TRACKS: usize = 20;
const MAX_NOTES_CHARS: usize = 600;

/// Everything the identification needs besides the photo.
pub struct IdentifyContext<'a> {
    pub openrouter: &'a OpenRouterClient,
    pub discogs: &'a DiscogsClient,
    pub api_key: &'a str,
    pub model: &'a str,
    pub discogs_token: &'a str,
}

/// Validated `submit_identification` arguments before enrichment.
#[derive(Debug, PartialEq)]
pub struct Submission {
    pub best: CandidateArgs,
    pub alternatives: Vec<CandidateArgs>,
    pub hint: Option<String>,
    pub reading: Option<LabelReading>,
}

/// Why a `submit_identification` call was not accepted.
#[derive(Debug, PartialEq)]
pub enum SubmissionError {
    /// Malformed or unverified answer; the model gets the reason and may correct it.
    Retry(String),
    /// The model found no matching release: hint for the user and what it read from the label.
    NoMatch {
        hint: String,
        reading: Option<Box<LabelReading>>,
    },
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CandidateArgs {
    pub discogs_id: i64,
    pub confidence: LabelMatchConfidence,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
struct SubmitArgs {
    best: Option<CandidateArgs>,
    #[serde(default)]
    alternatives: Vec<CandidateArgs>,
    hint: Option<String>,
    label_text: Option<LabelReading>,
}

#[derive(Debug, Deserialize)]
struct SearchArgs {
    query: Option<String>,
    catno: Option<String>,
    label: Option<String>,
    artist: Option<String>,
    release_title: Option<String>,
    year: Option<String>,
    country: Option<String>,
    format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DetailsArgs {
    release_id: i64,
}

pub struct LabelIdentificationService;

impl LabelIdentificationService {
    /// Runs the identification of a queued photo in the background, at most
    /// `MAX_PARALLEL_IDENTIFICATIONS` at a time.
    pub fn spawn(state: &AppState, user: &AppUser, photo_id: i64) {
        let state = state.clone();
        let user_id = user.id;
        let discogs_token = user
            .discogs_token
            .as_deref()
            .and_then(|enc| state.crypto.decrypt(enc))
            .filter(|token| !token.trim().is_empty());
        tokio::spawn(async move {
            let Ok(_slot) = state.identify_slots.clone().acquire_owned().await else {
                return;
            };
            // A separate task, so that even a panic ends in an error state instead of a photo
            // that stays "running" until the next restart
            let job = tokio::spawn({
                let state = state.clone();
                async move { Self::run(&state, user_id, photo_id, discogs_token).await }
            });
            let failure = match job.await {
                Ok(Ok(())) => return,
                Ok(Err(e)) => user_message(&e),
                Err(e) => format!("Identification aborted: {e}"),
            };
            tracing::error!("Label identification of photo {photo_id} failed: {failure}");
            if let Err(e) =
                LabelPhotoService::abort_identification(&state.pool, photo_id, &failure).await
            {
                tracing::error!("Could not mark label photo {photo_id} as failed: {e}");
            }
        });
    }

    async fn run(
        state: &AppState,
        user_id: i64,
        photo_id: i64,
        discogs_token: Option<String>,
    ) -> Result<(), AppError> {
        if !LabelPhotoService::start_identification(&state.pool, photo_id).await? {
            return Ok(());
        }
        match Self::identify_photo(state, user_id, photo_id, discogs_token).await {
            Ok((model, outcome)) => {
                LabelPhotoService::finish_identification(
                    &state.pool,
                    photo_id,
                    &model,
                    Ok(&outcome),
                )
                .await
            }
            Err((model, error)) => {
                tracing::warn!("Label photo {photo_id} not identified with '{model}': {error}");
                LabelPhotoService::finish_identification(
                    &state.pool,
                    photo_id,
                    &model,
                    Err(&user_message(&error)),
                )
                .await
            }
        }
    }

    /// Returns the model used plus the outcome, or the model plus the error.
    async fn identify_photo(
        state: &AppState,
        user_id: i64,
        photo_id: i64,
        discogs_token: Option<String>,
    ) -> Result<(String, IdentifyOutcome), (String, AppError)> {
        let credentials =
            OpenRouterSettingsService::credentials(&state.pool, &state.crypto, user_id)
                .await
                .map_err(|e| (String::new(), e))?
                .ok_or_else(|| {
                    (
                        String::new(),
                        AppError::BadRequest("No OpenRouter API key configured".to_string()),
                    )
                })?;
        let model = credentials.model.clone();
        let with_model = |e: AppError| (model.clone(), e);

        let discogs_token = discogs_token
            .ok_or_else(|| AppError::BadRequest("No Discogs token configured".to_string()))
            .map_err(with_model)?;
        let (jpeg, _) = LabelPhotoService::image(&state.pool, user_id, photo_id)
            .await
            .map_err(with_model)?;
        let ctx = IdentifyContext {
            openrouter: &state.openrouter,
            discogs: &state.discogs_client,
            api_key: &credentials.api_key,
            model: &credentials.model,
            discogs_token: &discogs_token,
        };
        let outcome = Self::identify(&ctx, &state.pool, user_id, &jpeg)
            .await
            .map_err(with_model)?;
        Ok((model, outcome))
    }

    /// Lets the model identify the photo and returns the enriched suggestion, or no suggestion
    /// with the model's hint when no release matched.
    pub async fn identify(
        ctx: &IdentifyContext<'_>,
        pool: &PgPool,
        user_id: i64,
        jpeg: &[u8],
    ) -> Result<IdentifyOutcome, AppError> {
        let image = base64::engine::general_purpose::STANDARD.encode(jpeg);
        let tools = tool_definitions();
        let mut messages = vec![
            ChatMessage::system(&system_prompt()),
            ChatMessage::user_with_image("Identify the record on this photo.", &image),
        ];
        let mut seen_ids = HashSet::new();
        let mut last_rejection = None;

        for _ in 0..MAX_ROUNDS {
            let reply = ctx
                .openrouter
                .chat(ctx.api_key, ctx.model, &messages, &tools)
                .await?;
            messages.push(ChatMessage::assistant(&reply));
            let calls = reply.tool_calls.unwrap_or_default();
            if calls.is_empty() {
                messages.push(ChatMessage::user(
                    "Use the tools and finish with `submit_identification`.",
                ));
                continue;
            }
            for call in calls {
                let args = call.function.arguments.as_str();
                let result = match call.function.name.as_str() {
                    "submit_identification" => match parse_submission(args, &seen_ids) {
                        Ok(submission) => {
                            let reading = submission.reading.clone();
                            return Ok(IdentifyOutcome {
                                suggestion: Some(enrich(ctx, pool, user_id, submission).await?),
                                reading,
                                no_match_hint: None,
                            });
                        }
                        Err(SubmissionError::NoMatch { hint, reading }) => {
                            return Ok(IdentifyOutcome {
                                suggestion: None,
                                reading: reading.map(|r| *r),
                                no_match_hint: Some(hint),
                            });
                        }
                        Err(SubmissionError::Retry(reason)) => {
                            let feedback = format!(
                                "{reason}. Submit a release ID returned by search_discogs or get_record_details."
                            );
                            last_rejection = Some(reason);
                            Err(feedback)
                        }
                    },
                    "search_discogs" => search(ctx, args, &mut seen_ids).await,
                    "get_record_details" => details(ctx, args, &mut seen_ids).await,
                    other => Err(format!("Unknown tool '{other}'")),
                };
                let content = result.unwrap_or_else(|e| json!({ "error": e }).to_string());
                messages.push(ChatMessage::tool_result(&call.id, content));
            }
        }
        Err(AppError::Internal(match last_rejection {
            Some(reason) => format!("No identification after {MAX_ROUNDS} model turns: {reason}"),
            None => format!("No identification after {MAX_ROUNDS} model turns"),
        }))
    }
}

fn system_prompt() -> String {
    format!(
        "You identify vinyl records and CDs for a record collection app from a photo of the record label \
         (sometimes the back cover or the run-out groove). Use the tools; never guess Discogs release IDs.\n\
         {LABEL_READING_STEPS}\n\
         4. Finish by calling `submit_identification` exactly once with `label_text` (what you read: artist, title, \
         label, catalog number, year, country, format), the best match, its confidence and a short \
         reason in German, plus up to {MAX_ALTERNATIVES} close alternatives (other pressings of the same release). \
         Confidence: high = catalog number, label and details match one pressing; medium = right release but the exact \
         pressing is uncertain; low = plausible but unconfirmed. If another photo would settle it, set `hint` (German, \
         e.g. which side or the run-out groove). If nothing matches, omit `best` and explain in `hint`."
    )
}

/// Tool definitions in the OpenAI function calling format.
pub fn tool_definitions() -> Value {
    let candidate = json!({
        "type": "object",
        "properties": {
            "discogs_id": { "type": "integer", "description": "Discogs release ID from a tool result" },
            "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
            "reason": { "type": "string", "description": "Short reason in German" }
        },
        "required": ["discogs_id", "confidence", "reason"]
    });
    let text = |description: &str| json!({ "type": "string", "description": description });
    json!([
        {
            "type": "function",
            "function": {
                "name": "search_discogs",
                "description": "Searches Discogs releases. Prefer `catno` plus `label` as printed on the label.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": text("Free text"),
                        "catno": text("Catalog number, e.g. \"SHVL 804\""),
                        "label": text("Record label, e.g. \"Harvest\""),
                        "artist": text("Artist"),
                        "release_title": text("Album title"),
                        "year": text("Release year"),
                        "country": text("Country, e.g. \"Germany\""),
                        "format": text("Format, e.g. \"Vinyl\"")
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_record_details",
                "description": "Details of a Discogs release: labels, catalog numbers, formats, country, year, identifiers (matrix / runout, rights society, label code), tracklist and notes.",
                "parameters": {
                    "type": "object",
                    "properties": { "release_id": { "type": "integer" } },
                    "required": ["release_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "submit_identification",
                "description": "Final answer: best match, close alternatives and an optional hint for a further photo.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "best": candidate,
                        "alternatives": { "type": "array", "items": candidate },
                        "hint": text("German hint, e.g. which further photo would help"),
                        "label_text": {
                            "type": "object",
                            "description": "What is printed on the photo, also without a match",
                            "properties": {
                                "artist": text("Artist"),
                                "title": text("Album title"),
                                "label": text("Record label"),
                                "catno": text("Catalog number"),
                                "year": text("Year (4 digits)"),
                                "country": text("Country"),
                                "format": text("LP, Double LP, CD or Double CD")
                            }
                        }
                    },
                    "required": ["label_text"]
                }
            }
        }
    ])
}

/// Parses the final answer. The best match must be a release a tool returned in this run;
/// unverified or duplicate alternatives are dropped.
pub fn parse_submission(
    arguments: &str,
    seen_ids: &HashSet<i64>,
) -> Result<Submission, SubmissionError> {
    let args: SubmitArgs = serde_json::from_str(arguments).map_err(|e| {
        SubmissionError::Retry(format!("Invalid submit_identification arguments: {e}"))
    })?;
    let hint = args
        .hint
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty());
    let reading = args
        .label_text
        .map(clean_reading)
        .filter(|r| *r != LabelReading::default());
    let Some(best) = args.best else {
        return Err(SubmissionError::NoMatch {
            hint: hint.unwrap_or_else(|| "No matching release found".to_string()),
            reading: reading.map(Box::new),
        });
    };
    if !seen_ids.contains(&best.discogs_id) {
        return Err(SubmissionError::Retry(format!(
            "Suggested release {} was not returned by a Discogs lookup",
            best.discogs_id
        )));
    }
    let mut taken = HashSet::from([best.discogs_id]);
    let alternatives = args
        .alternatives
        .into_iter()
        .filter(|alt| seen_ids.contains(&alt.discogs_id) && taken.insert(alt.discogs_id))
        .take(MAX_ALTERNATIVES)
        .collect();
    Ok(Submission {
        best,
        alternatives,
        hint,
        reading,
    })
}

/// Trims the fields and drops empty ones; the model sometimes sends "" or "unknown".
fn clean_reading(reading: LabelReading) -> LabelReading {
    let clean = |value: Option<String>| {
        value
            .map(|v| v.trim().chars().take(255).collect::<String>())
            .filter(|v| !v.is_empty() && !v.eq_ignore_ascii_case("unknown"))
    };
    LabelReading {
        artist: clean(reading.artist),
        title: clean(reading.title),
        label: clean(reading.label),
        catno: clean(reading.catno),
        year: clean(reading.year),
        country: clean(reading.country),
        format: clean(reading.format),
    }
}

async fn search(
    ctx: &IdentifyContext<'_>,
    arguments: &str,
    seen_ids: &mut HashSet<i64>,
) -> Result<String, String> {
    let args: SearchArgs =
        serde_json::from_str(arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
    let filter = DiscogsSearchFilter {
        query: args.query,
        catno: args.catno,
        label: args.label,
        artist: args.artist,
        release_title: args.release_title,
        year: args.year,
        country: args.country,
        format: args.format,
    };
    if filter.is_empty() {
        return Err("Provide at least one search field".to_string());
    }
    let response = ctx
        .discogs
        .search(
            &filter,
            Some("release"),
            1,
            MAX_SEARCH_RESULTS as u32,
            ctx.discogs_token,
        )
        .await
        .map_err(|e| e.to_string())?;
    let results: Vec<Value> = response
        .results
        .into_iter()
        .take(MAX_SEARCH_RESULTS)
        .map(|r| {
            seen_ids.insert(r.id);
            json!({
                "id": r.id, "title": r.title, "label": r.label, "catno": r.catno,
                "country": r.country, "year": r.year, "format": r.format
            })
        })
        .collect();
    Ok(json!({ "results": results }).to_string())
}

async fn details(
    ctx: &IdentifyContext<'_>,
    arguments: &str,
    seen_ids: &mut HashSet<i64>,
) -> Result<String, String> {
    let args: DetailsArgs =
        serde_json::from_str(arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
    let release = ctx
        .discogs
        .get_release(args.release_id, ctx.discogs_token)
        .await
        .map_err(|e| e.to_string())?;
    seen_ids.insert(release.id);
    Ok(release_summary(&release).to_string())
}

/// The release fields that tell pressings apart; tracklist and notes shortened.
fn release_summary(release: &DiscogsRelease) -> Value {
    let notes = release
        .notes
        .as_deref()
        .map(|n| n.chars().take(MAX_NOTES_CHARS).collect::<String>());
    json!({
        "id": release.id,
        "title": release.title,
        "artists": release.artists.iter().flatten().map(|a| &a.name).collect::<Vec<_>>(),
        "year": release.year,
        "released": release.released,
        "country": release.country,
        "labels": release.labels.iter().flatten()
            .map(|l| json!({ "name": l.name, "catno": l.catno }))
            .collect::<Vec<_>>(),
        "formats": release.formats,
        "identifiers": release.identifiers,
        "tracklist": release.tracklist.iter().flatten().take(MAX_TRACKS)
            .map(|t| format!("{} {}", t.position.as_deref().unwrap_or(""), t.title))
            .collect::<Vec<_>>(),
        "notes": notes,
    })
}

/// Adds the release data shown in the inbox and whether the user already owns the release.
async fn enrich(
    ctx: &IdentifyContext<'_>,
    pool: &PgPool,
    user_id: i64,
    submission: Submission,
) -> Result<LabelSuggestion, AppError> {
    let best = submission.best;
    let ids: Vec<i64> = std::iter::once(best.discogs_id)
        .chain(submission.alternatives.iter().map(|a| a.discogs_id))
        .collect();
    let owned: HashSet<i64> = sqlx::query_scalar(
        "SELECT DISTINCT rc.discogs_id FROM collection_item ci
         JOIN record_cache rc ON rc.id = ci.record_id
         WHERE ci.user_id = $1 AND rc.discogs_id = ANY($2)",
    )
    .bind(user_id)
    .bind(&ids)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?
    .into_iter()
    .collect();

    // Releases checked during the run come from the cache; the others are fetched in parallel
    let all: Vec<CandidateArgs> = std::iter::once(best)
        .chain(submission.alternatives)
        .collect();
    let releases = join_all(
        all.iter()
            .map(|args| ctx.discogs.get_release(args.discogs_id, ctx.discogs_token)),
    )
    .await;
    let mut candidates: Vec<LabelCandidate> = all
        .into_iter()
        .zip(releases)
        .map(|(args, release)| candidate(args, release.ok().as_deref(), &owned))
        .collect();
    let best = candidates.remove(0);
    Ok(LabelSuggestion {
        best,
        alternatives: candidates,
        hint: submission.hint,
    })
}

fn candidate(
    args: CandidateArgs,
    release: Option<&DiscogsRelease>,
    owned: &HashSet<i64>,
) -> LabelCandidate {
    let label = release
        .and_then(|r| r.labels.as_ref())
        .and_then(|l| l.first());
    LabelCandidate {
        discogs_id: args.discogs_id,
        confidence: args.confidence,
        reason: args.reason,
        artist: release
            .and_then(|r| r.artists.as_ref())
            .and_then(|a| a.first())
            .map(|a| a.name.clone()),
        title: release.map(|r| r.title.clone()),
        // Discogs reports unknown years as 0
        year: release
            .and_then(|r| r.year)
            .filter(|y| *y > 0)
            .map(|y| y.to_string()),
        country: release.and_then(|r| r.country.clone()),
        label: label.map(|l| l.name.clone()),
        catno: label.and_then(|l| l.catno.clone()),
        thumb_url: release.and_then(|r| r.thumb.clone()),
        in_collection: owned.contains(&args.discogs_id),
    }
}

/// The error text shown in the inbox, without the technical prefix of `Display`.
fn user_message(error: &AppError) -> String {
    match error {
        AppError::Database(_) => "Database error".to_string(),
        AppError::Migration(m)
        | AppError::Config(m)
        | AppError::BadRequest(m)
        | AppError::Unauthorized(m)
        | AppError::Forbidden(m)
        | AppError::NotFound(m)
        | AppError::Conflict(m)
        | AppError::TooManyRequests(m)
        | AppError::Internal(m)
        | AppError::Timeout(m) => m.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seen(ids: &[i64]) -> HashSet<i64> {
        ids.iter().copied().collect()
    }

    #[test]
    fn submission_accepts_a_verified_best_match() {
        let args =
            r#"{"best":{"discogs_id":1622788,"confidence":"high","reason":"Katalognummer passt"}}"#;
        let submission = parse_submission(args, &seen(&[1622788])).unwrap();
        assert_eq!(submission.best.discogs_id, 1622788);
        assert_eq!(submission.reading, None);
    }

    #[test]
    fn submission_rejects_an_unverified_best_match() {
        let args = r#"{"best":{"discogs_id":99,"confidence":"high","reason":"geraten"}}"#;
        let error = parse_submission(args, &seen(&[1622788])).unwrap_err();
        assert!(
            matches!(&error, SubmissionError::Retry(reason) if reason.contains("not returned by a Discogs lookup")),
            "{error:?}"
        );
    }

    #[test]
    fn submission_drops_unverified_and_duplicate_alternatives() {
        let args = r#"{"best":{"discogs_id":1,"confidence":"medium","reason":"a"},
            "alternatives":[{"discogs_id":1,"confidence":"low","reason":"dup"},
                            {"discogs_id":2,"confidence":"low","reason":"ok"},
                            {"discogs_id":3,"confidence":"low","reason":"unseen"}]}"#;
        let submission = parse_submission(args, &seen(&[1, 2])).unwrap();
        let ids: Vec<i64> = submission
            .alternatives
            .iter()
            .map(|a| a.discogs_id)
            .collect();
        assert_eq!(ids, vec![2]);
    }

    #[test]
    fn submission_without_best_match_reports_the_hint_and_reading() {
        let args = r#"{"hint":"Bitte die Auslaufrille fotografieren",
            "label_text":{"artist":" Die Sterne ","title":"","catno":"unknown","year":"1996"}}"#;
        let error = parse_submission(args, &seen(&[])).unwrap_err();
        assert_eq!(
            error,
            SubmissionError::NoMatch {
                hint: "Bitte die Auslaufrille fotografieren".to_string(),
                reading: Some(Box::new(LabelReading {
                    artist: Some("Die Sterne".to_string()),
                    year: Some("1996".to_string()),
                    ..Default::default()
                })),
            }
        );
    }

    #[test]
    fn submission_drops_an_empty_reading() {
        let args = r#"{"label_text":{"artist":" ","format":""}}"#;
        let error = parse_submission(args, &seen(&[])).unwrap_err();
        assert!(
            matches!(error, SubmissionError::NoMatch { reading: None, .. }),
            "{error:?}"
        );
    }

    #[test]
    fn submission_rejects_malformed_arguments() {
        let error = parse_submission("{not json", &seen(&[])).unwrap_err();
        assert!(
            matches!(&error, SubmissionError::Retry(reason) if reason.starts_with("Invalid submit_identification arguments")),
            "{error:?}"
        );
    }

    #[test]
    fn tools_cover_search_details_and_submit() {
        let names: Vec<String> = tool_definitions()
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["function"]["name"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(
            names,
            vec![
                "search_discogs",
                "get_record_details",
                "submit_identification"
            ]
        );
    }

    #[test]
    fn system_prompt_includes_the_shared_reading_steps() {
        assert!(system_prompt().contains(LABEL_READING_STEPS));
    }
}
