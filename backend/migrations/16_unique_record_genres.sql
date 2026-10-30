-- record_genres had no unique constraint, so concurrent or repeated writers (scans, syncs,
-- takeovers) could store the same genre of a record several times (#285). Keep one row per
-- record and genre and make the pair unique, which also makes `ON CONFLICT DO NOTHING` effective.

-- A row without a genre is useless and would escape both the clean-up and the unique index
DELETE FROM record_genres WHERE genre IS NULL;
ALTER TABLE record_genres ALTER COLUMN genre SET NOT NULL;

DELETE FROM record_genres
WHERE ctid IN (
    SELECT ctid FROM (
        SELECT ctid,
               row_number() OVER (PARTITION BY record_id, genre ORDER BY ctid) AS copy
        FROM record_genres
    ) AS numbered
    WHERE copy > 1
);

CREATE UNIQUE INDEX uq_record_genres_record_genre ON record_genres (record_id, genre);
