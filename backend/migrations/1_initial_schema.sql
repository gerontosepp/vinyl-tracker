-- V1__initial_schema.sql
-- Initial Flyway migration: creates the full database schema.
-- Matches the JPA entity definitions as of version 1.7.0.

CREATE TABLE app_user (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    salt        VARCHAR(255) NOT NULL,
    discogs_username VARCHAR(255),
    discogs_token    TEXT
);

CREATE TABLE record_cache (
    id           BIGSERIAL PRIMARY KEY,
    discogs_id   BIGINT NOT NULL UNIQUE,
    title        VARCHAR(255),
    artist       VARCHAR(255),
    release_year VARCHAR(255),
    thumb_url    VARCHAR(255)
);

CREATE TABLE record_genres (
    record_id BIGINT NOT NULL,
    genre     VARCHAR(255),
    CONSTRAINT fk_record_genres_record FOREIGN KEY (record_id) REFERENCES record_cache (id)
);

CREATE TABLE collection_item (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL,
    record_id   BIGINT    NOT NULL,
    instance_id BIGINT    NOT NULL,
    added_at    TIMESTAMP NOT NULL,
    CONSTRAINT fk_collection_item_user   FOREIGN KEY (user_id)   REFERENCES app_user (id),
    CONSTRAINT fk_collection_item_record FOREIGN KEY (record_id) REFERENCES record_cache (id),
    CONSTRAINT uk_collection_item_user_instance UNIQUE (user_id, instance_id)
);

CREATE TABLE listen_event (
    id        BIGSERIAL PRIMARY KEY,
    user_id   BIGINT    NOT NULL,
    record_id BIGINT    NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    CONSTRAINT fk_listen_event_user   FOREIGN KEY (user_id)   REFERENCES app_user (id),
    CONSTRAINT fk_listen_event_record FOREIGN KEY (record_id) REFERENCES record_cache (id)
);
