//! Shelf order shared by the collection view and the storage layout. Lives in its own module so
//! `collection_query` and `storage` do not depend on each other for these SQL fragments.
//!
//! The fragments reference the table aliases `ci` (`collection_item`) and `rc` (`record_cache`);
//! queries using them must join both under these names. The storage layout compares the selected
//! keys byte-wise in Rust, so the order must stay `COLLATE "C"`.

/// Single definition of the automatic artist key: artist without a leading article, lowercase.
/// Ignored articles: The, A, An, Der, Die, Das, Le, La, Les ("Die Sterne" sorts under S).
/// `concat!` only accepts literals, hence a macro instead of a const.
macro_rules! default_artist_key_sql {
    () => {
        r"REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i')"
    };
}

pub const DEFAULT_ARTIST_KEY_SQL: &str = default_artist_key_sql!();

/// Shelf sort key columns (custom sort string or [`DEFAULT_ARTIST_KEY_SQL`], year, title). The
/// storage layout compares the selected values byte-wise, which matches `COLLATE "C"` in
/// [`shelf_order_sql`].
pub const SHELF_ARTIST_KEY_SQL: &str = concat!(
    "COALESCE(LOWER(ci.sort_key), ",
    default_artist_key_sql!(),
    ")"
);
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
}
