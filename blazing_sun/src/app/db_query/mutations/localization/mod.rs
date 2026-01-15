//! Localization Mutation Queries
//!
//! Write operations for languages, locales, localization keys, and translations.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLanguageParams {
    pub native_name: String,
    pub iso2: String,
    pub iso3: String,
    pub icon_uuid: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLanguageParams {
    pub native_name: Option<String>,
    pub iso2: Option<String>,
    pub iso3: Option<String>,
    pub icon_uuid: Option<Option<Uuid>>,
}

pub async fn create_language(
    db: &Pool<Postgres>,
    params: &CreateLanguageParams,
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO languages (native_name, iso2, iso3, icon_uuid)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
        params.native_name,
        params.iso2,
        params.iso3,
        params.icon_uuid
    )
    .fetch_one(db)
    .await?;

    Ok(row.id)
}

pub async fn update_language(
    db: &Pool<Postgres>,
    language_id: i64,
    params: &UpdateLanguageParams,
) -> Result<bool, sqlx::Error> {
    if let Some(ref name) = params.native_name {
        sqlx::query!(
            r#"UPDATE languages SET native_name = $1 WHERE id = $2"#,
            name,
            language_id
        )
        .execute(db)
        .await?;
    }

    if let Some(ref iso2) = params.iso2 {
        sqlx::query!(
            r#"UPDATE languages SET iso2 = $1 WHERE id = $2"#,
            iso2,
            language_id
        )
        .execute(db)
        .await?;
    }

    if let Some(ref iso3) = params.iso3 {
        sqlx::query!(
            r#"UPDATE languages SET iso3 = $1 WHERE id = $2"#,
            iso3,
            language_id
        )
        .execute(db)
        .await?;
    }

    if let Some(icon) = params.icon_uuid {
        sqlx::query!(
            r#"UPDATE languages SET icon_uuid = $1 WHERE id = $2"#,
            icon,
            language_id
        )
        .execute(db)
        .await?;
    }

    Ok(true)
}

pub async fn delete_language(db: &Pool<Postgres>, language_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM languages WHERE id = $1"#, language_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLocaleParams {
    pub language_id: i64,
    pub locale_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLocaleParams {
    pub language_id: Option<i64>,
    pub locale_code: Option<String>,
}

pub async fn create_locale(
    db: &Pool<Postgres>,
    params: &CreateLocaleParams,
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO locales (language_id, locale_code)
        VALUES ($1, $2)
        RETURNING id
        "#,
        params.language_id,
        params.locale_code
    )
    .fetch_one(db)
    .await?;

    Ok(row.id)
}

pub async fn update_locale(
    db: &Pool<Postgres>,
    locale_id: i64,
    params: &UpdateLocaleParams,
) -> Result<bool, sqlx::Error> {
    if let Some(language_id) = params.language_id {
        sqlx::query!(
            r#"UPDATE locales SET language_id = $1 WHERE id = $2"#,
            language_id,
            locale_id
        )
        .execute(db)
        .await?;
    }

    if let Some(ref locale_code) = params.locale_code {
        sqlx::query!(
            r#"UPDATE locales SET locale_code = $1 WHERE id = $2"#,
            locale_code,
            locale_id
        )
        .execute(db)
        .await?;
    }

    Ok(true)
}

pub async fn delete_locale(db: &Pool<Postgres>, locale_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM locales WHERE id = $1"#, locale_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLocalizationKeyParams {
    pub key: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLocalizationKeyParams {
    pub key: Option<String>,
    pub context: Option<Option<String>>,
}

pub async fn create_key(
    db: &Pool<Postgres>,
    params: &CreateLocalizationKeyParams,
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO localization_keys (key, context)
        VALUES ($1, $2)
        RETURNING id
        "#,
        params.key,
        params.context
    )
    .fetch_one(db)
    .await?;

    Ok(row.id)
}

pub async fn update_key(
    db: &Pool<Postgres>,
    key_id: i64,
    params: &UpdateLocalizationKeyParams,
) -> Result<bool, sqlx::Error> {
    if let Some(ref key) = params.key {
        sqlx::query!(
            r#"UPDATE localization_keys SET key = $1 WHERE id = $2"#,
            key,
            key_id
        )
        .execute(db)
        .await?;
    }

    if let Some(context) = &params.context {
        sqlx::query!(
            r#"UPDATE localization_keys SET context = $1 WHERE id = $2"#,
            context.as_deref(),
            key_id
        )
        .execute(db)
        .await?;
    }

    Ok(true)
}

pub async fn delete_key(db: &Pool<Postgres>, key_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM localization_keys WHERE id = $1"#, key_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertTranslationParams {
    pub localization_key_id: i64,
    pub locale_id: i64,
    pub singular: String,
    pub plural: String,
}

pub async fn upsert_translation(
    db: &Pool<Postgres>,
    params: &UpsertTranslationParams,
) -> Result<bool, sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO localization_translations (localization_key_id, locale_id, singular, plural)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (localization_key_id, locale_id)
        DO UPDATE SET singular = EXCLUDED.singular, plural = EXCLUDED.plural
        "#,
        params.localization_key_id,
        params.locale_id,
        params.singular,
        params.plural
    )
    .execute(db)
    .await?;

    Ok(true)
}

pub async fn delete_translation(
    db: &Pool<Postgres>,
    localization_key_id: i64,
    locale_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM localization_translations WHERE localization_key_id = $1 AND locale_id = $2"#,
        localization_key_id,
        locale_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}
