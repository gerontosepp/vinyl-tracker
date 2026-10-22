-- Label photo inbox (#208): photos of record labels taken in the PWA, identified later by
-- Claude via the MCP server. Images are stored downscaled as JPEG without metadata.

CREATE TABLE label_photo (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    image        BYTEA       NOT NULL,
    mime_type    VARCHAR(50) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'identified', 'failed')),
    discogs_id   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    processed_at TIMESTAMP
);

CREATE INDEX idx_label_photo_user_status ON label_photo (user_id, status, created_at);
