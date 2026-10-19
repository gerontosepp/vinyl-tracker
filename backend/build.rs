// Embedded migrations (`sqlx::migrate!`) must be recompiled whenever a migration file changes.
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
