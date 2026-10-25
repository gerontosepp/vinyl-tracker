-- Old negative ID of a manual record that was taken over to Discogs or merged into an existing
-- copy (#243). Printed QR labels `discogs-id:-n` keep resolving to the copy it became. Points to
-- the instance, not the record, so two copies of one release stay apart.
CREATE TABLE manual_record_alias (
    user_id     BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    old_id      BIGINT NOT NULL CHECK (old_id < 0),
    instance_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, old_id)
);
