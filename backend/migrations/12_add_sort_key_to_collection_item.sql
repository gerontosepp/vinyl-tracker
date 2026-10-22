-- Custom sort string of a record (#213): replaces the automatic artist sort key in the
-- collection's artist sort and the shelf layout. Set for all copies of a release of a user.
ALTER TABLE collection_item ADD COLUMN sort_key VARCHAR(200);
