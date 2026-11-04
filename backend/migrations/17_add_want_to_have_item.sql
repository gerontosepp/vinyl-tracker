-- Want-to-Have list (#310): records a user wants to listen to (e.g. found via label recognition)
-- without owning them. Metadata lives in the shared `record_cache`; no copy, no listens.
CREATE TABLE want_to_have_item (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    record_id  BIGINT      NOT NULL REFERENCES record_cache (id),
    created_at TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT uk_want_to_have_user_record UNIQUE (user_id, record_id)
);

CREATE INDEX idx_want_to_have_user ON want_to_have_item (user_id, created_at DESC);
