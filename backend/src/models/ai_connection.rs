use chrono::{NaiveDateTime, TimeZone, Utc};
use serde_json::Value;

pub use vinyl_api_types::ai::*;

pub const DEFAULT_OPENROUTER_MODEL: &str = "anthropic/claude-sonnet-5.5";
pub const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";

/// How the API key is sent to the provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthStyle {
    Bearer,
    ApiKeyHeader,
    None,
}

impl AuthStyle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bearer => "bearer",
            Self::ApiKeyHeader => "api-key-header",
            Self::None => "none",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "bearer" => Some(Self::Bearer),
            "api-key-header" => Some(Self::ApiKeyHeader),
            "none" => Some(Self::None),
            _ => None,
        }
    }
}

/// Row of `ai_connection`; the API key stays encrypted until it is used for a request.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AiConnectionRecord {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub kind: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub auth_style: String,
    pub extra_headers: Value,
    pub is_default: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl AiConnectionRecord {
    pub fn auth_style(&self) -> AuthStyle {
        AuthStyle::parse(&self.auth_style).unwrap_or(AuthStyle::Bearer)
    }

    /// Human-readable provider name used in the label inbox.
    pub fn provider_label(&self) -> &str {
        find_preset(&self.kind).map_or("Custom", |preset| preset.label)
    }

    pub fn created_at_rfc3339(&self) -> String {
        Utc.from_utc_datetime(&self.created_at)
            .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
    }

    pub fn updated_at_rfc3339(&self) -> String {
        Utc.from_utc_datetime(&self.updated_at)
            .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
    }
}

/// A connection with its decrypted key, ready for a provider request.
pub struct AiCredentials {
    pub record: AiConnectionRecord,
    pub api_key: Option<String>,
}

/// A provider preset. All presets except Azure OpenAI use the OpenAI-compatible
/// `/chat/completions` endpoint; Azure only differs in auth header and URL shape.
pub struct AiPreset {
    pub kind: &'static str,
    pub label: &'static str,
    pub base_url: &'static str,
    pub auth_style: AuthStyle,
    pub requires_api_key: bool,
}

pub const AI_PRESETS: &[AiPreset] = &[
    AiPreset {
        kind: "openrouter",
        label: "OpenRouter",
        base_url: DEFAULT_OPENROUTER_BASE_URL,
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "openai",
        label: "OpenAI",
        base_url: "https://api.openai.com/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "anthropic",
        label: "Anthropic",
        base_url: "https://api.anthropic.com/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "google",
        label: "Google Gemini",
        base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "groq",
        label: "Groq",
        base_url: "https://api.groq.com/openai/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "mistral",
        label: "Mistral",
        base_url: "https://api.mistral.ai/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "deepseek",
        label: "DeepSeek",
        base_url: "https://api.deepseek.com/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "together",
        label: "Together",
        base_url: "https://api.together.xyz/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "fireworks",
        label: "Fireworks",
        base_url: "https://api.fireworks.ai/inference/v1",
        auth_style: AuthStyle::Bearer,
        requires_api_key: true,
    },
    AiPreset {
        kind: "ollama",
        label: "Ollama",
        base_url: "http://localhost:11434/v1",
        auth_style: AuthStyle::None,
        requires_api_key: false,
    },
    AiPreset {
        kind: "lmstudio",
        label: "LM Studio",
        base_url: "http://localhost:1234/v1",
        auth_style: AuthStyle::None,
        requires_api_key: false,
    },
    AiPreset {
        kind: "azure_openai",
        label: "Azure OpenAI",
        base_url: "https://your-resource.openai.azure.com/openai/deployments/your-deployment?api-version=2024-10-21",
        auth_style: AuthStyle::ApiKeyHeader,
        requires_api_key: true,
    },
    AiPreset {
        kind: "custom",
        label: "Custom",
        base_url: "",
        auth_style: AuthStyle::Bearer,
        requires_api_key: false,
    },
];

pub fn find_preset(kind: &str) -> Option<&'static AiPreset> {
    AI_PRESETS.iter().find(|preset| preset.kind == kind)
}

pub fn preset_dtos() -> Vec<AiPresetDto> {
    AI_PRESETS
        .iter()
        .map(|preset| AiPresetDto {
            kind: preset.kind.to_string(),
            label: preset.label.to_string(),
            base_url: preset.base_url.to_string(),
            auth_style: preset.auth_style.as_str().to_string(),
            requires_api_key: preset.requires_api_key,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_preset_has_a_unique_kind_and_label() {
        let mut kinds = std::collections::HashSet::new();
        for preset in AI_PRESETS {
            assert!(kinds.insert(preset.kind), "duplicate kind {}", preset.kind);
            assert!(!preset.label.is_empty());
        }
        assert_eq!(
            find_preset("openrouter").unwrap().auth_style.as_str(),
            "bearer"
        );
        assert_eq!(find_preset("ollama").unwrap().auth_style.as_str(), "none");
        assert!(find_preset("openai").unwrap().requires_api_key);
        assert!(!find_preset("ollama").unwrap().requires_api_key);
        assert!(find_preset("does-not-exist").is_none());
    }

    #[test]
    fn auth_styles_round_trip() {
        for style in [AuthStyle::Bearer, AuthStyle::ApiKeyHeader, AuthStyle::None] {
            assert_eq!(AuthStyle::parse(style.as_str()), Some(style));
        }
        assert_eq!(AuthStyle::parse("unknown"), None);
    }
}
