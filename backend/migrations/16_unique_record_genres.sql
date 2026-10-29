-- record_genres had no unique constraint, so concurrent or repeated writers (scans, syncs,
-- takeovers) could store the same genre of a record several times (#285). Keep one row per
-- record and genre and make the pair unique, which also makes `ON CONFLICT DO NOTHING` effective.
DELETE FROM record_genres a
    USING record_genres b
    WHERE a.record_id = b.record_id
      AND a.genre = b.genre
      AND a.ctid > b.ctid;

CREATE UNIQUE INDEX uq_record_genres_record_genre ON record_genres (record_id, genre);
