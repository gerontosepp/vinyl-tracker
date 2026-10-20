//! Request and response types of the Vinyl Tracker REST API.
//!
//! The backend serializes these types and the MCP server deserializes them, so both sides
//! always agree on the JSON contract. Changing a field or `serde` attribute here changes the
//! public API (including the Angular frontend) – keep it backwards compatible.

pub mod analytics;
pub mod collection;
pub mod discogs;
pub mod record;
pub mod roon;
pub mod scan;
pub mod storage;
pub mod user;
