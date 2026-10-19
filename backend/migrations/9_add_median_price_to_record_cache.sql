-- V9__add_median_price_to_record_cache.sql
-- Add median_price column to record_cache table for condition-based market price suggestions

ALTER TABLE record_cache ADD COLUMN IF NOT EXISTS median_price NUMERIC(10, 2);
