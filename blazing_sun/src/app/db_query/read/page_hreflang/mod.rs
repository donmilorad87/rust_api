//! Page Hreflang Read Queries
//!
//! Read operations for the page_hreflangs table.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageHreflang {
    pub id: i64,
    pub page_seo_id: i64,
    pub lang_code: String,
    pub href: String,
    pub is_default: bool,
}

pub async fn get_by_page_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageHreflang>, sqlx::Error> {
    sqlx::query_as!(
        PageHreflang,
        r#"
        SELECT
            id,
            page_seo_id,
            lang_code,
            url as "href!",
            COALESCE(is_default, false) as "is_default!"
        FROM page_hreflangs
        WHERE page_seo_id = $1
        ORDER BY lang_code ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<Option<PageHreflang>, sqlx::Error> {
    sqlx::query_as!(
        PageHreflang,
        r#"
        SELECT
            id,
            page_seo_id,
            lang_code,
            url as "href!",
            COALESCE(is_default, false) as "is_default!"
        FROM page_hreflangs
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(db)
    .await
}
