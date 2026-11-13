use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A configured AI connection. The API key is write-only: responses only expose `hasApiKey`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionDto {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,
    pub auth_style: String,
    pub extra_headers: Value,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// `apiKey`: missing keeps the stored key, an empty string removes it (same semantics as the
/// former OpenRouter settings).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiConnectionRequest {
    pub name: String,
    pub kind: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub auth_style: Option<String>,
    #[serde(default)]
    pub extra_headers: Option<Value>,
}

/// Defaults and auth details of a provider preset; the frontend uses them to prefill the form.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPresetDto {
    pub kind: String,
    pub label: String,
    pub base_url: String,
    pub auth_style: String,
    pub requires_api_key: bool,
}

/// Result of a connection test (a minimal chat request).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestDto {
    pub ok: bool,
    pub provider: String,
    pub model: String,
}

/// Models reported by an OpenAI-compatible `/models` endpoint. `supported` is `false` when
/// the provider does not offer the endpoint (manual model entry remains possible).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelsDto {
    pub models: Vec<String>,
    pub supported: bool,
}
