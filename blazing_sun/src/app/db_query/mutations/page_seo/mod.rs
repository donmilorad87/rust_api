//! Page SEO Mutation Queries
//!
//! Write operations for the page_seo table.

use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Parameters for updating page SEO
#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePageSeoParams {
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<Uuid>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<Uuid>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<serde_json::Value>,
    pub custom_meta: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

/// Update SEO for a specific page by route name
pub async fn update_by_route(
    db: &Pool<Postgres>,
    route_name: &str,
    params: &UpdatePageSeoParams,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE page_seo
        SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            keywords = COALESCE($4, keywords),
            og_title = COALESCE($5, og_title),
            og_description = COALESCE($6, og_description),
            og_image_uuid = $7,
            og_type = COALESCE($8, og_type),
            twitter_card = COALESCE($9, twitter_card),
            twitter_title = COALESCE($10, twitter_title),
            twitter_description = COALESCE($11, twitter_description),
            twitter_image_uuid = $12,
            canonical_url = $13,
            robots = COALESCE($14, robots),
            structured_data = COALESCE($15, structured_data),
            custom_meta = COALESCE($16, custom_meta),
            is_active = COALESCE($17, is_active),
            updated_at = NOW()
        WHERE route_name = $1
        "#,
        route_name,
        params.title,
        params.description,
        params.keywords,
        params.og_title,
        params.og_description,
        params.og_image_uuid,
        params.og_type,
        params.twitter_card,
        params.twitter_title,
        params.twitter_description,
        params.twitter_image_uuid,
        params.canonical_url,
        params.robots,
        params.structured_data,
        params.custom_meta,
        params.is_active
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update SEO by ID
pub async fn update_by_id(
    db: &Pool<Postgres>,
    id: i64,
    params: &UpdatePageSeoParams,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE page_seo
        SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            keywords = COALESCE($4, keywords),
            og_title = COALESCE($5, og_title),
            og_description = COALESCE($6, og_description),
            og_image_uuid = $7,
            og_type = COALESCE($8, og_type),
            twitter_card = COALESCE($9, twitter_card),
            twitter_title = COALESCE($10, twitter_title),
            twitter_description = COALESCE($11, twitter_description),
            twitter_image_uuid = $12,
            canonical_url = $13,
            robots = COALESCE($14, robots),
            structured_data = COALESCE($15, structured_data),
            custom_meta = COALESCE($16, custom_meta),
            is_active = COALESCE($17, is_active),
            updated_at = NOW()
        WHERE id = $1
        "#,
        id,
        params.title,
        params.description,
        params.keywords,
        params.og_title,
        params.og_description,
        params.og_image_uuid,
        params.og_type,
        params.twitter_card,
        params.twitter_title,
        params.twitter_description,
        params.twitter_image_uuid,
        params.canonical_url,
        params.robots,
        params.structured_data,
        params.custom_meta,
        params.is_active
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Parameters for creating a new page SEO entry
#[derive(Debug, Clone, Deserialize)]
pub struct CreatePageSeoParams {
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub robots: Option<String>,
}

/// Create a new page SEO entry
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreatePageSeoParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO page_seo (route_name, page_path, page_label, title, description, robots)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (route_name) DO UPDATE
        SET page_path = EXCLUDED.page_path,
            page_label = EXCLUDED.page_label
        RETURNING id
        "#,
        params.route_name,
        params.page_path,
        params.page_label,
        params.title,
        params.description,
        params.robots
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Delete a page SEO entry by route name
pub async fn delete_by_route(db: &Pool<Postgres>, route_name: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        "DELETE FROM page_seo WHERE route_name = $1",
        route_name
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Toggle active status for a page
pub async fn toggle_active(db: &Pool<Postgres>, route_name: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE page_seo
        SET is_active = NOT is_active,
            updated_at = NOW()
        WHERE route_name = $1
        RETURNING is_active
        "#,
        route_name
    )
    .fetch_one(db)
    .await?;

    Ok(result.is_active.unwrap_or(false))
}
