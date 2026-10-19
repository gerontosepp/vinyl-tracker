-- V8__add_conditions_to_collection_item.sql
-- Add media_condition and sleeve_condition to collection_item for Discogs condition tracking (#62)

ALTER TABLE collection_item ADD COLUMN media_condition VARCHAR(50);
ALTER TABLE collection_item ADD COLUMN sleeve_condition VARCHAR(50);
