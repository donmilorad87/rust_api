//! Localization Read Queries
//!
//! Read operations for languages, locales, localization keys, and translations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Language {
    pub id: i64,
    pub native_name: String,
    pub iso2: String,
    pub iso3: String,
    pub icon_uuid: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Locale {
    pub id: i64,
    pub language_id: i64,
    pub locale_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizationKey {
    pub id: i64,
    pub key: String,
    pub context: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizationTranslation {
    pub id: i64,
    pub localization_key_id: i64,
    pub locale_id: i64,
    pub singular: String,
    pub plural: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationWithLocale {
    pub locale_id: i64,
    pub locale_code: String,
    pub singular: String,
    pub plural: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRow {
    pub key: String,
    pub context: Option<String>,
    pub singular: String,
    pub plural: String,
}

pub async fn get_languages(db: &Pool<Postgres>) -> Result<Vec<Language>, sqlx::Error> {
    sqlx::query_as!(
        Language,
        r#"
        SELECT id, native_name, iso2, iso3, icon_uuid, created_at, updated_at
        FROM languages
        ORDER BY native_name ASC
        "#
    )
    .fetch_all(db)
    .await
}

pub async fn get_locales(db: &Pool<Postgres>) -> Result<Vec<Locale>, sqlx::Error> {
    sqlx::query_as!(
        Locale,
        r#"
        SELECT id, language_id, locale_code, created_at, updated_at
        FROM locales
        ORDER BY locale_code ASC
        "#
    )
    .fetch_all(db)
    .await
}

pub async fn get_locales_for_language(
    db: &Pool<Postgres>,
    language_id: i64,
) -> Result<Vec<Locale>, sqlx::Error> {
    sqlx::query_as!(
        Locale,
        r#"
        SELECT id, language_id, locale_code, created_at, updated_at
        FROM locales
        WHERE language_id = $1
        ORDER BY locale_code ASC
        "#,
        language_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_locales_by_code(
    db: &Pool<Postgres>,
    locale_code: &str,
) -> Result<Option<Locale>, sqlx::Error> {
    sqlx::query_as!(
        Locale,
        r#"
        SELECT id, language_id, locale_code, created_at, updated_at
        FROM locales
        WHERE locale_code = $1
        "#,
        locale_code
    )
    .fetch_optional(db)
    .await
}

pub async fn get_locale_by_id(
    db: &Pool<Postgres>,
    locale_id: i64,
) -> Result<Option<Locale>, sqlx::Error> {
    sqlx::query_as!(
        Locale,
        r#"
        SELECT id, language_id, locale_code, created_at, updated_at
        FROM locales
        WHERE id = $1
        "#,
        locale_id
    )
    .fetch_optional(db)
    .await
}

pub async fn get_language_by_id(
    db: &Pool<Postgres>,
    language_id: i64,
) -> Result<Option<Language>, sqlx::Error> {
    sqlx::query_as!(
        Language,
        r#"
        SELECT id, native_name, iso2, iso3, icon_uuid, created_at, updated_at
        FROM languages
        WHERE id = $1
        "#,
        language_id
    )
    .fetch_optional(db)
    .await
}

pub async fn get_language_by_iso2(
    db: &Pool<Postgres>,
    iso2: &str,
) -> Result<Option<Language>, sqlx::Error> {
    sqlx::query_as!(
        Language,
        r#"
        SELECT id, native_name, iso2, iso3, icon_uuid, created_at, updated_at
        FROM languages
        WHERE iso2 = $1
        "#,
        iso2
    )
    .fetch_optional(db)
    .await
}

pub async fn get_keys(db: &Pool<Postgres>) -> Result<Vec<LocalizationKey>, sqlx::Error> {
    sqlx::query_as!(
        LocalizationKey,
        r#"
        SELECT id, key, context, created_at, updated_at
        FROM localization_keys
        ORDER BY key ASC
        "#
    )
    .fetch_all(db)
    .await
}

pub async fn get_key_by_id(
    db: &Pool<Postgres>,
    key_id: i64,
) -> Result<Option<LocalizationKey>, sqlx::Error> {
    sqlx::query_as!(
        LocalizationKey,
        r#"
        SELECT id, key, context, created_at, updated_at
        FROM localization_keys
        WHERE id = $1
        "#,
        key_id
    )
    .fetch_optional(db)
    .await
}

pub async fn get_translations_for_key(
    db: &Pool<Postgres>,
    key_id: i64,
) -> Result<Vec<LocalizationTranslation>, sqlx::Error> {
    sqlx::query_as!(
        LocalizationTranslation,
        r#"
        SELECT id, localization_key_id, locale_id, singular, plural, created_at, updated_at
        FROM localization_translations
        WHERE localization_key_id = $1
        "#,
        key_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_translations_with_locale(
    db: &Pool<Postgres>,
    key_id: i64,
) -> Result<Vec<TranslationWithLocale>, sqlx::Error> {
    sqlx::query_as!(
        TranslationWithLocale,
        r#"
        SELECT
            l.id as locale_id,
            l.locale_code,
            lt.singular,
            lt.plural
        FROM localization_translations lt
        INNER JOIN locales l ON l.id = lt.locale_id
        WHERE lt.localization_key_id = $1
        ORDER BY l.locale_code ASC
        "#,
        key_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_translations_for_locale(
    db: &Pool<Postgres>,
    locale_code: &str,
) -> Result<Vec<TranslationRow>, sqlx::Error> {
    sqlx::query_as!(
        TranslationRow,
        r#"
        SELECT
            lk.key,
            lk.context,
            lt.singular,
            lt.plural
        FROM localization_translations lt
        INNER JOIN localization_keys lk ON lk.id = lt.localization_key_id
        INNER JOIN locales l ON l.id = lt.locale_id
        WHERE l.locale_code = $1
        ORDER BY lk.key ASC
        "#,
        locale_code
    )
    .fetch_all(db)
    .await
}

pub async fn get_locale_codes(db: &Pool<Postgres>) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT locale_code
        FROM locales
        ORDER BY locale_code ASC
        "#
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|row| row.locale_code).collect())
}

/// Language dropdown item for frontend rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageDropdownItem {
    pub code: String,           // locale_code (e.g., "en_US", "sr_RS")
    pub name: String,           // native_name (e.g., "English", "Srpski")
    pub flag: String,           // iso2 country code for fallback flag emoji (e.g., "us", "rs")
    pub icon_url: Option<String>, // URL to the language icon image
}

/// Raw query result for language dropdown
#[derive(Debug)]
struct LanguageDropdownRow {
    locale_code: String,
    native_name: String,
    iso2: String,
    icon_uuid: Option<Uuid>,
}

/// Get all languages with their locales for the language dropdown
///
/// Returns language data formatted for frontend dropdown component.
/// Includes icon_url from the uploads table if the language has an icon_uuid.
pub async fn get_languages_for_dropdown(db: &Pool<Postgres>) -> Result<Vec<LanguageDropdownItem>, sqlx::Error> {
    let rows = sqlx::query_as!(
        LanguageDropdownRow,
        r#"
        SELECT
            loc.locale_code,
            lang.native_name,
            lang.iso2,
            lang.icon_uuid
        FROM locales loc
        INNER JOIN languages lang ON lang.id = loc.language_id
        ORDER BY lang.native_name ASC
        "#
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|row| {
        // Extract country code from locale_code (e.g., "en_US" -> "US" -> "us")
        let flag = row.locale_code
            .split('_')
            .nth(1)
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| row.iso2.to_lowercase());

        // Generate icon URL if icon_uuid exists
        // Uses the public download endpoint with small variant for icons
        let icon_url = row.icon_uuid.map(|uuid| {
            format!("/api/v1/upload/download/public/{}?variant=thumb", uuid)
        });

        LanguageDropdownItem {
            code: row.locale_code,
            name: row.native_name,
            flag,
            icon_url,
        }
    }).collect())
}
