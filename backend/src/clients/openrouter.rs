//! Minimal client for the OpenAI-compatible chat completions API of OpenRouter, used for the
//! automatic label photo identification (#235).

use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// Default model of the label identification (vision + tool calling).
pub const DEFAULT_OPENROUTER_MODEL: &str = "anthropic/claude-sonnet-5.5";
/// Vision models with tool calling may take a while for an image plus several tool rounds.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_ERROR_BODY_CHARS: usize = 200;

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

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    tools: &'a Value,
}

pub struct OpenRouterClient {
    http: reqwest::Client,
    base_url: String,
}

impl OpenRouterClient {
    pub fn new(base_url: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("Failed to build HTTP client");
        Self { http, base_url }
    }

    /// Sends one chat completion request and returns the assistant message of the first choice.
    pub async fn chat(
        &self,
        api_key: &str,
        model: &str,
        messages: &[ChatMessage],
        tools: &Value,
    ) -> Result<AssistantMessage, AppError> {
        let res = self
            .http
            .post(format!("{}/chat/completions", self.base_url))
            .bearer_auth(api_key)
            .header("X-Title", "Vinyl Tracker")
            .json(&ChatRequest {
                model,
                messages,
                tools,
            })
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("OpenRouter request failed: {e}")))?;

        let status = res.status();
        if !status.is_success() {
            // Error pages (e.g. HTML from a proxy) end up in the inbox; keep only the beginning
            let body: String = res
                .text()
                .await
                .unwrap_or_default()
                .chars()
                .take(MAX_ERROR_BODY_CHARS)
                .collect();
            return Err(match status.as_u16() {
                401 | 403 => AppError::BadRequest("OpenRouter rejected the API key".to_string()),
                402 => AppError::BadRequest("OpenRouter: insufficient credits".to_string()),
                429 => AppError::TooManyRequests("OpenRouter rate limit reached".to_string()),
                _ => AppError::Internal(format!("OpenRouter returned {status}: {body}")),
            });
        }

        let parsed: ChatResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid OpenRouter response: {e}")))?;
        parsed
            .choices
            .into_iter()
            .next()
            .map(|choice| choice.message)
            .ok_or_else(|| AppError::Internal("OpenRouter returned no choices".to_string()))
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
    fn assistant_message_echoes_tool_calls() {
        let assistant = AssistantMessage {
            content: None,
            tool_calls: Some(vec![ToolCall {
                id: "call_1".into(),
                type_name: "function".into(),
                function: FunctionCall {
                    name: "search_discogs".into(),
                    arguments: "{}".into(),
                },
            }]),
        };
        let message = serde_json::to_value(ChatMessage::assistant(&assistant)).unwrap();
        assert_eq!(message["role"], "assistant");
        assert_eq!(message["tool_calls"][0]["type"], "function");
        assert!(message.get("content").is_none());
    }
}
