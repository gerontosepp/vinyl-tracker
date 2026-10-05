-- V3__add_lowest_price_to_record_cache.sql
-- Add lowest_price column to record_cache table for storing estimated/lowest market price

ALTER TABLE record_cache ADD COLUMN IF NOT EXISTS lowest_price NUMERIC(10, 2);
