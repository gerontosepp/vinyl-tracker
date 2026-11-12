-- Provider-independent AI connections (#393): a user can keep several OpenAI-compatible
-- connections and mark exactly one as the default for automatic label identification.
CREATE TABLE ai_connection (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    model VARCHAR(200) NOT NULL,
    api_key TEXT,
    auth_style VARCHAR(30) NOT NULL DEFAULT 'bearer'
        CHECK (auth_style IN ('bearer', 'api-key-header', 'none')),
    extra_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX ai_connection_user_id_idx ON ai_connection (user_id);
-- At most one default connection per user, enforced by the database.
CREATE UNIQUE INDEX ai_connection_one_default_per_user
    ON ai_connection (user_id) WHERE is_default;

-- Existing OpenRouter settings become the first (default) connection. The old columns stay in
-- place for one release so a rollback to the previous image keeps working.
INSERT INTO ai_connection (user_id, name, kind, base_url, model, api_key, auth_style, is_default)
SELECT
    id,
    'OpenRouter',
    'openrouter',
    'https://openrouter.ai/api/v1',
    COALESCE(NULLIF(TRIM(openrouter_model), ''), 'anthropic/claude-sonnet-5.5'),
    openrouter_api_key,
    'bearer',
    TRUE
FROM app_user
WHERE (openrouter_api_key IS NOT NULL OR NULLIF(TRIM(openrouter_model), '') IS NOT NULL)
  AND NOT EXISTS (
      SELECT 1 FROM ai_connection c WHERE c.user_id = app_user.id
  );

-- Provider of the identification, shown next to the model in the label inbox.
ALTER TABLE label_photo ADD COLUMN identify_provider VARCHAR(50);
ALTER TABLE label_photo ALTER COLUMN identify_model TYPE VARCHAR(200);
