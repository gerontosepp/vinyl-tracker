-- V4__add_format_to_record_cache.sql
-- Add format column to record_cache table for storing media format (e.g. LP, Double LP, CD)

ALTER TABLE record_cache ADD COLUMN IF NOT EXISTS format VARCHAR(100) DEFAULT 'LP';
