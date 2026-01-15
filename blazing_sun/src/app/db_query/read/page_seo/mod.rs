//! Page SEO Read Queries
//!
//! Read operations for the page_seo table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Full page SEO record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSeo {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
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
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Lightweight SEO data for rendering pages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSeoMeta {
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
}

/// Page SEO translation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSeoTranslation {
    pub lang_code: String,
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
}

/// List item for SEO admin panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSeoListItem {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub robots: Option<String>,
    pub is_active: Option<bool>,
}

/// Get all page SEO entries for admin list
pub async fn get_all(db: &Pool<Postgres>) -> Result<Vec<PageSeoListItem>, sqlx::Error> {
    sqlx::query_as!(
        PageSeoListItem,
        r#"
        SELECT
            page_seo.id,
            page_seo.route_name,
            page_seo.page_path,
            page_seo.page_label,
            translations.title,
            translations.description,
            COALESCE(translations.robots, page_seo.robots) AS "robots?",
            page_seo.is_active
        FROM page_seo
        LEFT JOIN page_seo_translations translations
            ON translations.page_seo_id = page_seo.id AND translations.lang_code = 'en'
        ORDER BY page_label ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get full SEO data by route name
pub async fn get_by_route(db: &Pool<Postgres>, route_name: &str) -> Result<PageSeo, sqlx::Error> {
    sqlx::query_as!(
        PageSeo,
        r#"
        SELECT
            id,
            route_name,
            page_path,
            page_label,
            title,
            description,
            keywords,
            og_title,
            og_description,
            og_image_uuid,
            og_type,
            twitter_card,
            twitter_title,
            twitter_description,
            twitter_image_uuid,
            canonical_url,
            robots,
            structured_data,
            custom_meta,
            is_active,
            created_at,
            updated_at
        FROM page_seo
        WHERE route_name = $1
        "#,
        route_name
    )
    .fetch_one(db)
    .await
}

/// Get SEO meta for rendering a page (lightweight)
pub async fn get_meta_by_route(
    db: &Pool<Postgres>,
    route_name: &str,
) -> Result<PageSeoMeta, sqlx::Error> {
    sqlx::query_as!(
        PageSeoMeta,
        r#"
        SELECT
            title,
            description,
            keywords,
            og_title,
            og_description,
            og_image_uuid,
            og_type,
            twitter_card,
            twitter_title,
            twitter_description,
            twitter_image_uuid,
            canonical_url,
            robots
        FROM page_seo
        WHERE route_name = $1 AND is_active = true
        "#,
        route_name
    )
    .fetch_one(db)
    .await
}

pub async fn get_translation_by_route_lang(
    db: &Pool<Postgres>,
    route_name: &str,
    lang_code: &str,
) -> Result<Option<PageSeoTranslation>, sqlx::Error> {
    sqlx::query_as!(
        PageSeoTranslation,
        r#"
        SELECT
            translations.lang_code,
            translations.title,
            translations.description,
            translations.keywords,
            translations.og_title,
            translations.og_description,
            translations.og_image_uuid,
            translations.og_type,
            translations.twitter_card,
            translations.twitter_title,
            translations.twitter_description,
            translations.twitter_image_uuid,
            translations.canonical_url,
            translations.robots,
            translations.structured_data,
            translations.custom_meta
        FROM page_seo
        LEFT JOIN page_seo_translations translations
            ON translations.page_seo_id = page_seo.id
        WHERE page_seo.route_name = $1 AND translations.lang_code = $2
        "#,
        route_name,
        lang_code
    )
    .fetch_optional(db)
    .await
}

pub async fn get_translations_by_page_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageSeoTranslation>, sqlx::Error> {
    sqlx::query_as!(
        PageSeoTranslation,
        r#"
        SELECT
            lang_code,
            title,
            description,
            keywords,
            og_title,
            og_description,
            og_image_uuid,
            og_type,
            twitter_card,
            twitter_title,
            twitter_description,
            twitter_image_uuid,
            canonical_url,
            robots,
            structured_data,
            custom_meta
        FROM page_seo_translations
        WHERE page_seo_id = $1
        ORDER BY lang_code ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

/// Get SEO by ID
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<PageSeo, sqlx::Error> {
    sqlx::query_as!(
        PageSeo,
        r#"
        SELECT
            id,
            route_name,
            page_path,
            page_label,
            title,
            description,
            keywords,
            og_title,
            og_description,
            og_image_uuid,
            og_type,
            twitter_card,
            twitter_title,
            twitter_description,
            twitter_image_uuid,
            canonical_url,
            robots,
            structured_data,
            custom_meta,
            is_active,
            created_at,
            updated_at
        FROM page_seo
        WHERE id = $1
        "#,
        id
    )
    .fetch_one(db)
    .await
}

/// Check if SEO entry exists for route
pub async fn exists_by_route(db: &Pool<Postgres>, route_name: &str) -> bool {
    sqlx::query!(
        "SELECT EXISTS(SELECT 1 FROM page_seo WHERE route_name = $1)",
        route_name
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists.unwrap_or(false))
    .unwrap_or(false)
}
