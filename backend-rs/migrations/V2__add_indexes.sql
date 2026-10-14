-- V2__add_indexes.sql
-- Add explicit indexes to frequently queried foreign keys and unique constraints
-- to improve query performance as collection and analytics data scales.

CREATE INDEX idx_listen_event_user ON listen_event(user_id);
CREATE INDEX idx_collection_item_user ON collection_item(user_id);
CREATE INDEX idx_record_cache_discogs ON record_cache(discogs_id);
