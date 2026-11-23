//! Generic client for OpenAI-compatible chat completions endpoints. OpenRouter, OpenAI,
//! Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Together, Fireworks, Azure OpenAI and
//! local servers (Ollama, LM Studio) all speak this protocol (#393).

use crate::{error::AppError, models::ai_connection::AuthStyle};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{Duration, Instant};
use url::Url;

/// Vision models with tool calling may take a while for an image plus several tool rounds.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_ERROR_BODY_CHARS: usize = 200;
/// Anthropic's OpenAI-compatible endpoint requires `max_tokens`; a moderate cap also keeps
/// label identification costs predictable.
const DEFAULT_MAX_TOKENS: u32 = 4096;

/// Everything a request needs besides the message list; the key is already decrypted.
pub struct AiTarget<'a> {
    pub kind: &'a str,
    pub base_url: &'a str,
    pub api_key: Option<&'a str>,
    pub auth_style: AuthStyle,
    pub extra_headers: &'a Value,
}

/// One chat message; the content is either text or a list of parts (text, image).
#[derive(Debug, Clone, Serialize)]
pub struct ChatMessage {
    pub role: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn system(text: &str) -> Self {
        Self::with_content("system", Value::String(text.to_string()))
    }

    pub fn user(text: &str) -> Self {
        Self::with_content("user", Value::String(text.to_string()))
    }

    /// User message with a text and an image (JPEG as data URL).
    pub fn user_with_image(text: &str, jpeg_base64: &str) -> Self {
        Self::with_content(
            "user",
            serde_json::json!([
                { "type": "text", "text": text },
                { "type": "image_url", "image_url": { "url": format!("data:image/jpeg;base64,{jpeg_base64}") } }
            ]),
        )
    }

    pub fn tool_result(tool_call_id: &str, content: String) -> Self {
        Self {
            role: "tool",
            content: Some(Value::String(content)),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.to_string()),
        }
    }

    pub fn assistant(message: &AssistantMessage) -> Self {
        Self {
            role: "assistant",
            content: message.content.clone().map(Value::String),
            tool_calls: message.tool_calls.clone(),
            tool_call_id: None,
        }
    }

    fn with_content(role: &'static str, content: Value) -> Self {
        Self {
            role,
            content: Some(content),
            tool_calls: None,
            tool_call_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type", default = "function_type")]
    pub type_name: String,
    pub function: FunctionCall,
}

fn function_type() -> String {
    "function".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FunctionCall {
    pub name: String,
    /// JSON-encoded arguments as produced by the model.
    pub arguments: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantMessage {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: AssistantMessage,
}

/// Token counts as reported by the provider; absent for some providers.
#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: Option<Usage>,
}

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    tools: &'a Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    #[serde(default)]
    data: Vec<ModelEntry>,
    #[serde(default)]
    models: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
}

pub struct AiClient {
    http: reqwest::Client,
}

impl AiClient {
    pub fn new() -> Self {
        let http = crate::tls::http_client_builder()
            .timeout(REQUEST_TIMEOUT)
            // A provider must not redirect us to an internal/metadata host that bypassed the
            // base-URL validation in `ai_connection_service`.
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to build HTTP client");
        Self { http }
    }

    /// Sends one chat completion request and returns the assistant message of the first choice.
    pub async fn chat(
        &self,
        target: &AiTarget<'_>,
        model: &str,
        messages: &[ChatMessage],
        tools: &Value,
    ) -> Result<AssistantMessage, AppError> {
        let url = endpoint(target.base_url, "chat/completions")?;
        let started = Instant::now();
        let res = self
            .request(target, self.http.post(url))
            .json(&ChatRequest {
                model,
                messages,
                tools,
                max_tokens: Some(DEFAULT_MAX_TOKENS),
            })
            .send()
            .await
            .map_err(|e| transport_error(target, model, e))?;

        let status = res.status();
        if !status.is_success() {
            let body: String = res
                .text()
                .await
                .unwrap_or_default()
                .chars()
                .take(MAX_ERROR_BODY_CHARS)
                .collect();
            tracing::warn!(
                "AI provider '{}' returned {status} for model '{model}': {body}",
                target.kind
            );
            return Err(status_error(status.as_u16()));
        }

        let parsed: ChatResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid AI provider response: {e}")))?;
        let usage = parsed.usage.as_ref();
        tracing::debug!(
            "AI provider '{}' model '{model}' answered in {} ms (prompt tokens: {:?}, completion tokens: {:?})",
            target.kind,
            started.elapsed().as_millis(),
            usage.and_then(|u| u.prompt_tokens),
            usage.and_then(|u| u.completion_tokens),
        );
        parsed
            .choices
            .into_iter()
            .next()
            .map(|choice| choice.message)
            .ok_or_else(|| AppError::Internal("The AI provider returned no choices".to_string()))
    }

    /// Minimal request for the settings test button: proves endpoint, auth and model work.
    pub async fn test(&self, target: &AiTarget<'_>, model: &str) -> Result<(), AppError> {
        let url = endpoint(target.base_url, "chat/completions")?;
        let messages = [ChatMessage::user("Reply with OK.")];
        let tools = serde_json::json!([]);
        let res = self
            .request(target, self.http.post(url))
            .json(&ChatRequest {
                model,
                messages: &messages,
                tools: &tools,
                max_tokens: Some(1),
            })
            .send()
            .await
            .map_err(|e| transport_error(target, model, e))?;

        if res.status().is_success() {
            return Ok(());
        }
        let status = res.status();
        let body: String = res
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(MAX_ERROR_BODY_CHARS)
            .collect();
        tracing::warn!(
            "AI provider '{}' test returned {status} for model '{model}': {body}",
            target.kind
        );
        Err(status_error(status.as_u16()))
    }

    /// Model IDs from an OpenAI-compatible `/models` endpoint; `None` if the provider does not
    /// offer it. Authentication and rate-limit errors are still surfaced.
    pub async fn list_models(
        &self,
        target: &AiTarget<'_>,
    ) -> Result<Option<Vec<String>>, AppError> {
        let url = endpoint(target.base_url, "models")?;
        let res = self
            .request(target, self.http.get(url))
            .send()
            .await
            .map_err(|e| transport_error(target, "models", e))?;

        let status = res.status();
        if status == reqwest::StatusCode::NOT_FOUND
            || status == reqwest::StatusCode::METHOD_NOT_ALLOWED
        {
            return Ok(None);
        }
        if !status.is_success() {
            let body: String = res
                .text()
                .await
                .unwrap_or_default()
                .chars()
                .take(MAX_ERROR_BODY_CHARS)
                .collect();
            tracing::warn!(
                "AI provider '{}' models endpoint returned {status}: {body}",
                target.kind
            );
            return Err(status_error(status.as_u16()));
        }

        let parsed: ModelsResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid AI provider response: {e}")))?;
        let mut ids: Vec<String> = parsed
            .data
            .into_iter()
            .chain(parsed.models)
            .map(|entry| entry.id)
            .collect();
        ids.sort();
        ids.dedup();
        Ok(Some(ids))
    }

    fn request(
        &self,
        target: &AiTarget<'_>,
        mut req: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        match target.auth_style {
            AuthStyle::Bearer => {
                if let Some(key) = target.api_key {
                    req = req.bearer_auth(key);
                }
            }
            AuthStyle::ApiKeyHeader => {
                if let Some(key) = target.api_key {
                    req = req.header("api-key", key);
                }
            }
            AuthStyle::None => {}
        }

        // OpenRouter uses these optional headers for attribution, never for authentication.
        if target.kind == "openrouter" {
            req = req
                .header(
                    "HTTP-Referer",
                    "https://github.com/gerontosepp/vinyl-tracker",
                )
                .header("X-Title", "Vinyl Tracker");
        }

        if let Value::Object(headers) = target.extra_headers {
            for (name, value) in headers {
                if let Some(value) = value.as_str() {
                    req = req.header(name.as_str(), value);
                }
            }
        }
        req
    }
}

impl Default for AiClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Builds `<base>/<path>` while preserving an optional query string (Azure `api-version`).
fn endpoint(base_url: &str, path: &str) -> Result<Url, AppError> {
    let mut url = Url::parse(base_url)
        .map_err(|e| AppError::BadRequest(format!("Invalid AI base URL: {e}")))?;
    let query = url.query().map(str::to_owned);
    let base_path = url.path().trim_end_matches('/');
    url.set_path(&format!("{base_path}/{path}"));
    if let Some(query) = query {
        url.set_query(Some(&query));
    }
    Ok(url)
}

fn transport_error(target: &AiTarget<'_>, model: &str, error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        tracing::warn!(
            "AI provider '{}' timed out for model '{model}'",
            target.kind
        );
        return AppError::Timeout("The AI provider did not respond in time".to_string());
    }
    tracing::warn!(
        "AI provider '{}' request for model '{model}' failed: {error}",
        target.kind
    );
    AppError::Internal("The AI provider could not be reached".to_string())
}

fn status_error(status: u16) -> AppError {
    match status {
        400 | 422 => AppError::BadRequest(
            "The AI provider rejected the request; check the model, image and tool support"
                .to_string(),
        ),
        401 | 403 => AppError::BadRequest("The AI provider rejected the API key".to_string()),
        402 => AppError::BadRequest("The AI provider reports insufficient credits".to_string()),
        404 | 405 => {
            AppError::BadRequest("The AI provider did not find the model or endpoint".to_string())
        }
        429 => AppError::TooManyRequests("The AI provider rate limit was reached".to_string()),
        _ => AppError::Internal(format!("The AI provider returned HTTP {status}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_message_carries_the_image_as_data_url() {
        let message =
            serde_json::to_value(ChatMessage::user_with_image("Identify", "QUJD")).unwrap();
        assert_eq!(
            message["content"][1]["image_url"]["url"],
            "data:image/jpeg;base64,QUJD"
        );
    }

    #[test]
    fn chat_response_parses_with_and_without_usage() {
        let with_usage: ChatResponse = serde_json::from_value(serde_json::json!({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "hello",
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": { "name": "search_discogs", "arguments": "{}" }
                    }]
                }
            }],
            "usage": { "prompt_tokens": 10, "completion_tokens": 5 }
        }))
        .unwrap();
        assert_eq!(with_usage.usage.unwrap().prompt_tokens, Some(10));
        assert_eq!(
            with_usage.choices[0].message.tool_calls.as_ref().unwrap()[0]
                .function
                .name,
            "search_discogs"
        );

        let without_usage: ChatResponse = serde_json::from_value(serde_json::json!({
            "choices": [{ "message": { "role": "assistant", "content": "hi" } }]
        }))
        .unwrap();
        assert!(without_usage.usage.is_none());
    }

    #[test]
    fn endpoint_preserves_path_and_query() {
        let url = endpoint(
            "https://example.com/v1?api-version=2024-10-21",
            "chat/completions",
        )
        .unwrap();
        assert_eq!(url.path(), "/v1/chat/completions");
        assert_eq!(url.query(), Some("api-version=2024-10-21"));

        let url = endpoint("http://localhost:11434/v1", "models").unwrap();
        assert_eq!(url.as_str(), "http://localhost:11434/v1/models");
    }

    #[test]
    fn status_errors_are_provider_neutral() {
        assert!(matches!(status_error(401), AppError::BadRequest(_)));
        assert!(matches!(status_error(404), AppError::BadRequest(_)));
        assert!(matches!(status_error(429), AppError::TooManyRequests(_)));
        assert!(matches!(status_error(500), AppError::Internal(_)));
    }
}
