//! Shelf order shared by the collection view and the storage layout. Lives in its own module so
//! `collection_query` and `storage` do not depend on each other for these SQL fragments.

/// Shelf sort key columns (custom sort string or automatic artist key, year, title). The
/// storage layout compares the selected values byte-wise, which matches `COLLATE "C"` in
/// [`shelf_order_sql`].
pub const SHELF_ARTIST_KEY_SQL: &str = r#"COALESCE(LOWER(ci.sort_key), REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i'))"#;
pub const SHELF_TITLE_KEY_SQL: &str = "COALESCE(LOWER(rc.title), '')";
/// Shelf order of the collection view ("artist", ascending) and of the storage layout.
pub fn shelf_order_sql() -> String {
    format!(
        r#"{SHELF_ARTIST_KEY_SQL} COLLATE "C" ASC NULLS LAST, rc.release_year COLLATE "C" ASC NULLS LAST, {SHELF_TITLE_KEY_SQL} COLLATE "C" ASC, ci.instance_id ASC"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shelf_order_sql_should_match_pinned_expression() {
        assert_eq!(
            shelf_order_sql(),
            concat!(
                r#"COALESCE(LOWER(ci.sort_key), REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i')) COLLATE "C" ASC NULLS LAST, "#,
                r#"rc.release_year COLLATE "C" ASC NULLS LAST, "#,
                r#"COALESCE(LOWER(rc.title), '') COLLATE "C" ASC, "#,
                "ci.instance_id ASC"
            )
        );
    }

    #[test]
    fn shelf_artist_key_should_prefer_custom_sort_key_over_stripped_artist() {
        assert_eq!(
            SHELF_ARTIST_KEY_SQL,
            r#"COALESCE(LOWER(ci.sort_key), REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i'))"#
        );
    }

    #[test]
    fn shelf_title_key_should_fall_back_to_empty_string() {
        assert_eq!(SHELF_TITLE_KEY_SQL, "COALESCE(LOWER(rc.title), '')");
    }
}
