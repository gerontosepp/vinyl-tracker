-- Manual records without a Discogs entry (#242, ADR-0023). They get negative IDs from their own
-- sequence (`record_cache.discogs_id = collection_item.instance_id = -n`), which never collide
-- with Discogs IDs, so collection, shelves, print and MCP work unchanged. `source` marks them,
-- so all Discogs calls and the sync deletion skip them.
CREATE SEQUENCE manual_record_seq INCREMENT BY -1 START WITH -1 MAXVALUE -1;

ALTER TABLE record_cache ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'discogs'
    CHECK (source IN ('discogs', 'manual'));
-- Stable key of a manual record for backup/restore and the public cover URL
ALTER TABLE record_cache ADD COLUMN manual_uid UUID UNIQUE;
-- record_cache is shared by all users; a manual record belongs to the user who created it
ALTER TABLE record_cache ADD COLUMN owner_id BIGINT REFERENCES app_user (id);
ALTER TABLE record_cache ADD COLUMN label VARCHAR(255);
ALTER TABLE record_cache ADD COLUMN catno VARCHAR(100);
ALTER TABLE record_cache ADD COLUMN country VARCHAR(100);
ALTER TABLE record_cache ADD COLUMN barcode VARCHAR(50);
ALTER TABLE record_cache ADD COLUMN notes TEXT;
ALTER TABLE record_cache ADD CONSTRAINT ck_record_cache_manual
    CHECK (source = 'discogs' OR (discogs_id < 0 AND manual_uid IS NOT NULL AND owner_id IS NOT NULL));

CREATE INDEX idx_record_cache_barcode ON record_cache (barcode) WHERE barcode IS NOT NULL;

-- Cover photo of a manual record, downscaled JPEG without metadata
CREATE TABLE record_cover (
    record_id BIGINT      PRIMARY KEY REFERENCES record_cache (id) ON DELETE CASCADE,
    image     BYTEA       NOT NULL,
    mime_type VARCHAR(50) NOT NULL
);

-- What the automatic identification read from the label, also without a Discogs match; it
-- pre-fills the form for a manual record. `record_id` links a photo resolved as manual record.
ALTER TABLE label_photo ADD COLUMN label_reading JSONB;
ALTER TABLE label_photo ADD COLUMN record_id BIGINT REFERENCES record_cache (id) ON DELETE SET NULL;
