//! Page Hreflang Mutation Queries
//!
//! Write operations for the page_hreflangs table.

use serde::Deserialize;
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertPageHreflangParams {
    pub id: Option<i64>,
    pub lang_code: String,
    pub href: String,
    pub is_default: bool,
}

pub async fn upsert(
    db: &Pool<Postgres>,
    page_seo_id: i64,
    params: &UpsertPageHreflangParams,
) -> Result<i64, sqlx::Error> {
    if params.is_default {
        sqlx::query!(
            r#"
            UPDATE page_hreflangs
            SET is_default = false,
                updated_at = NOW()
            WHERE page_seo_id = $1
            "#,
            page_seo_id
        )
        .execute(db)
        .await?;
    }

    if let Some(id) = params.id {
        let result = sqlx::query!(
            r#"
            UPDATE page_hreflangs
            SET
                lang_code = $2,
                url = $3,
                is_default = $4,
                updated_at = NOW()
            WHERE id = $1 AND page_seo_id = $5
            RETURNING id
            "#,
            id,
            params.lang_code,
            params.href,
            params.is_default,
            page_seo_id
        )
        .fetch_one(db)
        .await?;

        return Ok(result.id);
    }

    let result = sqlx::query!(
        r#"
        INSERT INTO page_hreflangs (page_seo_id, lang_code, url, is_default)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (page_seo_id, lang_code)
        DO UPDATE
        SET url = EXCLUDED.url,
            is_default = EXCLUDED.is_default,
            updated_at = NOW()
        RETURNING id
        "#,
        page_seo_id,
        params.lang_code,
        params.href,
        params.is_default
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

pub async fn delete_by_id(db: &Pool<Postgres>, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM page_hreflangs
        WHERE id = $1
        "#,
        id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}
