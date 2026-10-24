-- Automatic label photo identification via OpenRouter (#235): per-user API key (encrypted like
-- the Discogs token) and model, plus state and result of the identification per photo.
ALTER TABLE app_user ADD COLUMN openrouter_api_key TEXT;
ALTER TABLE app_user ADD COLUMN openrouter_model VARCHAR(100);

ALTER TABLE label_photo ADD COLUMN identify_state VARCHAR(20)
    CHECK (identify_state IN ('queued', 'running', 'done', 'error'));
ALTER TABLE label_photo ADD COLUMN suggestion JSONB;
ALTER TABLE label_photo ADD COLUMN identify_error TEXT;
ALTER TABLE label_photo ADD COLUMN identify_model VARCHAR(100);
ALTER TABLE label_photo ADD COLUMN identified_at TIMESTAMP;
