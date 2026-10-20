-- Shelf-based storage (#41): storage types (e.g. IKEA Kallax), shelves and the stored
-- compartment boundaries from which the position of every record is computed.

CREATE TABLE storage_type (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    media        VARCHAR(10)  NOT NULL CHECK (media IN ('vinyl', 'cd')),
    grid_rows    SMALLINT     NOT NULL CHECK (grid_rows BETWEEN 1 AND 12),
    grid_columns SMALLINT     NOT NULL CHECK (grid_columns BETWEEN 1 AND 12),
    capacity     INTEGER      NOT NULL CHECK (capacity BETWEEN 1 AND 500),
    created_at   TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uk_storage_type_user_name UNIQUE (user_id, name)
);

CREATE TABLE storage_unit (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    type_id    BIGINT       NOT NULL REFERENCES storage_type (id),
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uk_storage_unit_user_name UNIQUE (user_id, name)
);

CREATE INDEX idx_storage_unit_type ON storage_unit (type_id);

-- Shelf sort key of the first record in a compartment. The first compartment of a medium has
-- no row (everything before), a missing row of any other compartment means "after everything".
CREATE TABLE storage_boundary (
    unit_id     BIGINT   NOT NULL REFERENCES storage_unit (id) ON DELETE CASCADE,
    compartment SMALLINT NOT NULL,
    artist_key  TEXT,
    year_key    TEXT,
    title_key   TEXT     NOT NULL,
    instance_id BIGINT   NOT NULL,
    PRIMARY KEY (unit_id, compartment)
);

ALTER TABLE record_cache ADD COLUMN disc_count SMALLINT;
