//!
//! Localization Controller
//!
//! Admin endpoints for managing languages, locales, and translation keys.

use actix_web::{web, HttpResponse};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::Postgres;
use uuid::Uuid;

use crate::app::db_query::mutations::localization as localization_mutations;
use crate::app::db_query::read::localization as localization_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::includes::localization::LocalizationExporter;
use crate::database::AppState;

pub struct LocalizationController;

#[derive(Debug, Serialize)]
pub struct LanguagesResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub languages: Vec<LanguageDto>,
}

#[derive(Debug, Serialize)]
pub struct LanguageDto {
    pub id: i64,
    pub native_name: String,
    pub iso2: String,
    pub iso3: String,
    pub icon_uuid: Option<String>,
    pub locales: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LocalesResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub locales: Vec<LocaleDto>,
}

#[derive(Debug, Serialize)]
pub struct LocaleDto {
    pub id: i64,
    pub language_id: i64,
    pub language_iso2: String,
    pub locale_code: String,
}

#[derive(Debug, Serialize)]
pub struct LocalizationKeysResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub keys: Vec<LocalizationKeyDto>,
}

#[derive(Debug, Serialize)]
pub struct LocalizationKeyDto {
    pub id: i64,
    pub key: String,
    pub context: Option<String>,
    pub translations: Vec<TranslationDto>,
}

#[derive(Debug, Serialize)]
pub struct TranslationDto {
    pub locale_code: String,
    pub singular: String,
    pub plural: String,
}

#[derive(Debug, Serialize)]
pub struct IdResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateLanguageRequest {
    pub native_name: String,
    pub iso2: String,
    pub iso3: String,
    pub icon_uuid: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLanguageRequest {
    pub native_name: Option<String>,
    pub iso2: Option<String>,
    pub iso3: Option<String>,
    pub icon_uuid: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLocaleRequest {
    pub language_id: i64,
    pub locale_code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLocaleRequest {
    pub language_id: Option<i64>,
    pub locale_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TranslationInput {
    pub locale_code: String,
    pub singular: String,
    pub plural: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateLocalizationKeyRequest {
    pub key: String,
    pub context: Option<String>,
    pub translations: Option<Vec<TranslationInput>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLocalizationKeyRequest {
    pub key: Option<String>,
    pub context: Option<Option<String>>,
    pub translations: Option<Vec<TranslationInput>>,
}

impl LocalizationController {
    pub async fn list_languages(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        let languages = match localization_read::get_languages(&db).await {
            Ok(languages) => languages,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load languages"));
            }
        };

        let locales = match localization_read::get_locales(&db).await {
            Ok(locales) => locales,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load locales"));
            }
        };

        let mut locales_by_language: std::collections::HashMap<i64, Vec<String>> =
            std::collections::HashMap::new();
        for locale in locales {
            locales_by_language
                .entry(locale.language_id)
                .or_default()
                .push(locale.locale_code);
        }

        let response = languages
            .into_iter()
            .map(|language| LanguageDto {
                id: language.id,
                native_name: language.native_name,
                iso2: language.iso2,
                iso3: language.iso3,
                icon_uuid: language.icon_uuid.map(|uuid| uuid.to_string()),
                locales: locales_by_language.remove(&language.id).unwrap_or_default(),
            })
            .collect();

        HttpResponse::Ok().json(LanguagesResponse {
            base: BaseResponse::success("Languages loaded"),
            languages: response,
        })
    }

    pub async fn create_language(
        state: web::Data<AppState>,
        body: web::Json<CreateLanguageRequest>,
    ) -> HttpResponse {
        let data = body.into_inner();
        let iso2 = data.iso2.trim().to_lowercase();
        let iso3 = data.iso3.trim().to_lowercase();

        if !is_valid_iso2(&iso2) || !is_valid_iso3(&iso3) {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid ISO codes"));
        }

        let icon_uuid = match parse_optional_uuid(data.icon_uuid) {
            Ok(uuid) => uuid,
            Err(message) => return HttpResponse::BadRequest().json(json_error(&message)),
        };

        let db = state.db.lock().await;

        let params = localization_mutations::CreateLanguageParams {
            native_name: data.native_name.trim().to_string(),
            iso2,
            iso3,
            icon_uuid,
        };

        let language_id = match localization_mutations::create_language(&db, &params).await {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Failed to create language"));
            }
        };

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(IdResponse {
            base: BaseResponse::success("Language created"),
            id: language_id,
        })
    }

    pub async fn update_language(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateLanguageRequest>,
    ) -> HttpResponse {
        let language_id = path.into_inner();
        let data = body.into_inner();

        let mut params = localization_mutations::UpdateLanguageParams {
            native_name: data.native_name.map(|value| value.trim().to_string()),
            iso2: None,
            iso3: None,
            icon_uuid: None,
        };

        if let Some(iso2) = data.iso2 {
            let iso2 = iso2.trim().to_lowercase();
            if !is_valid_iso2(&iso2) {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid ISO-2 code"));
            }
            params.iso2 = Some(iso2);
        }

        if let Some(iso3) = data.iso3 {
            let iso3 = iso3.trim().to_lowercase();
            if !is_valid_iso3(&iso3) {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid ISO-3 code"));
            }
            params.iso3 = Some(iso3);
        }

        if let Some(icon_uuid) = data.icon_uuid {
            params.icon_uuid = Some(match parse_optional_uuid(icon_uuid) {
                Ok(uuid) => uuid,
                Err(message) => return HttpResponse::BadRequest().json(json_error(&message)),
            });
        }

        let db = state.db.lock().await;

        if let Err(_) = localization_mutations::update_language(&db, language_id, &params).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to update language"));
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Language updated"))
    }

    pub async fn delete_language(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let language_id = path.into_inner();
        let db = state.db.lock().await;

        match localization_mutations::delete_language(&db, language_id).await {
            Ok(true) => {}
            Ok(false) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Language not found"));
            }
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete language"));
            }
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Language deleted"))
    }

    pub async fn list_locales(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        let locales = match localization_read::get_locales(&db).await {
            Ok(locales) => locales,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load locales"));
            }
        };

        let languages = match localization_read::get_languages(&db).await {
            Ok(languages) => languages,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load languages"));
            }
        };

        let mut iso2_lookup = std::collections::HashMap::new();
        for language in languages {
            iso2_lookup.insert(language.id, language.iso2);
        }

        let response = locales
            .into_iter()
            .filter_map(|locale| {
                iso2_lookup.get(&locale.language_id).map(|iso2| LocaleDto {
                    id: locale.id,
                    language_id: locale.language_id,
                    language_iso2: iso2.clone(),
                    locale_code: locale.locale_code,
                })
            })
            .collect();

        HttpResponse::Ok().json(LocalesResponse {
            base: BaseResponse::success("Locales loaded"),
            locales: response,
        })
    }

    pub async fn create_locale(
        state: web::Data<AppState>,
        body: web::Json<CreateLocaleRequest>,
    ) -> HttpResponse {
        let data = body.into_inner();
        let locale_code = data.locale_code.trim().to_string();

        if !is_valid_locale_code(&locale_code) {
            return HttpResponse::BadRequest().json(json_error(
                "Locale format must be <iso2>_<REGION> (e.g., en_US)",
            ));
        }

        let db = state.db.lock().await;
        let language = match localization_read::get_language_by_id(&db, data.language_id).await {
            Ok(Some(language)) => language,
            Ok(None) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Language not found"));
            }
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load language"));
            }
        };

        if !locale_code.starts_with(&language.iso2) {
            return HttpResponse::BadRequest().json(json_error(
                "Locale code must start with the language ISO-2 code",
            ));
        }

        let params = localization_mutations::CreateLocaleParams {
            language_id: data.language_id,
            locale_code: locale_code.clone(),
        };

        let locale_id = match localization_mutations::create_locale(&db, &params).await {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Failed to create locale"));
            }
        };

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(IdResponse {
            base: BaseResponse::success("Locale created"),
            id: locale_id,
        })
    }

    pub async fn update_locale(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateLocaleRequest>,
    ) -> HttpResponse {
        let locale_id = path.into_inner();
        let data = body.into_inner();

        let mut params = localization_mutations::UpdateLocaleParams {
            language_id: data.language_id,
            locale_code: None,
        };

        if let Some(code) = data.locale_code {
            let code = code.trim().to_string();
            if !is_valid_locale_code(&code) {
                return HttpResponse::BadRequest().json(json_error(
                    "Locale format must be <iso2>_<REGION> (e.g., en_US)",
                ));
            }
            params.locale_code = Some(code);
        }

        let db = state.db.lock().await;

        let mut language_id = params.language_id;
        if language_id.is_none() && params.locale_code.is_some() {
            language_id = match localization_read::get_locale_by_id(&db, locale_id).await {
                Ok(Some(locale)) => Some(locale.language_id),
                Ok(None) => {
                    return HttpResponse::NotFound().json(BaseResponse::error("Locale not found"));
                }
                Err(_) => {
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to load locale"));
                }
            };
        }

        if let Some(language_id) = language_id {
            let language = match localization_read::get_language_by_id(&db, language_id).await {
                Ok(Some(language)) => language,
                Ok(None) => {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Language not found"));
                }
                Err(_) => {
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to load language"));
                }
            };

            if let Some(ref locale_code) = params.locale_code {
                if !locale_code.starts_with(&language.iso2) {
                    return HttpResponse::BadRequest().json(json_error(
                        "Locale code must start with the language ISO-2 code",
                    ));
                }
            }
        }

        if let Err(_) = localization_mutations::update_locale(&db, locale_id, &params).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to update locale"));
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Locale updated"))
    }

    pub async fn delete_locale(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let locale_id = path.into_inner();
        let db = state.db.lock().await;

        match localization_mutations::delete_locale(&db, locale_id).await {
            Ok(true) => {}
            Ok(false) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Locale not found"));
            }
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete locale"));
            }
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Locale deleted"))
    }

    pub async fn list_keys(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        let keys = match localization_read::get_keys(&db).await {
            Ok(keys) => keys,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load localization keys"));
            }
        };

        let mut key_responses = Vec::new();
        for key in keys {
            let translations =
                match localization_read::get_translations_with_locale(&db, key.id).await {
                    Ok(rows) => rows
                        .into_iter()
                        .map(|row| TranslationDto {
                            locale_code: row.locale_code,
                            singular: row.singular,
                            plural: row.plural,
                        })
                        .collect(),
                    Err(_) => {
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to load translations"));
                    }
                };

            key_responses.push(LocalizationKeyDto {
                id: key.id,
                key: key.key,
                context: key.context,
                translations,
            });
        }

        HttpResponse::Ok().json(LocalizationKeysResponse {
            base: BaseResponse::success("Localization keys loaded"),
            keys: key_responses,
        })
    }

    pub async fn create_key(
        state: web::Data<AppState>,
        body: web::Json<CreateLocalizationKeyRequest>,
    ) -> HttpResponse {
        let data = body.into_inner();
        let key_name = data.key.trim().to_string();

        if key_name.is_empty() {
            return HttpResponse::BadRequest().json(BaseResponse::error("Key is required"));
        }

        let db = state.db.lock().await;
        let params = localization_mutations::CreateLocalizationKeyParams {
            key: key_name,
            context: data.context.map(|value| value.trim().to_string()),
        };

        let key_id = match localization_mutations::create_key(&db, &params).await {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Failed to create localization key"));
            }
        };

        if let Some(translations) = data.translations {
            if let Err(response) = upsert_translations(&db, key_id, translations).await {
                return response;
            }
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(IdResponse {
            base: BaseResponse::success("Localization key created"),
            id: key_id,
        })
    }

    pub async fn update_key(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateLocalizationKeyRequest>,
    ) -> HttpResponse {
        let key_id = path.into_inner();
        let data = body.into_inner();

        if data
            .key
            .as_ref()
            .map(|value| value.trim().is_empty())
            .unwrap_or(false)
        {
            return HttpResponse::BadRequest().json(BaseResponse::error("Key cannot be empty"));
        }

        let params = localization_mutations::UpdateLocalizationKeyParams {
            key: data.key.map(|value| value.trim().to_string()),
            context: data
                .context
                .map(|value| value.map(|text| text.trim().to_string())),
        };

        let db = state.db.lock().await;

        if let Err(_) = localization_mutations::update_key(&db, key_id, &params).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to update localization key"));
        }

        if let Some(translations) = data.translations {
            if let Err(response) = upsert_translations(&db, key_id, translations).await {
                return response;
            }
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Localization key updated"))
    }

    pub async fn delete_key(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let key_id = path.into_inner();
        let db = state.db.lock().await;

        match localization_mutations::delete_key(&db, key_id).await {
            Ok(true) => {}
            Ok(false) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Localization key not found"));
            }
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete localization key"));
            }
        }

        if let Err(_) = LocalizationExporter::export_all(&db).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to export localization files"));
        }

        HttpResponse::Ok().json(BaseResponse::success("Localization key deleted"))
    }
}

fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({
        "status": "error",
        "message": message
    })
}

fn is_valid_iso2(value: &str) -> bool {
    value.len() == 2 && value.chars().all(|c| c.is_ascii_lowercase())
}

fn is_valid_iso3(value: &str) -> bool {
    value.len() == 3 && value.chars().all(|c| c.is_ascii_lowercase())
}

fn is_valid_locale_code(locale: &str) -> bool {
    let regex = Regex::new(r"^[a-z]{2}_[A-Z]{2}$").unwrap();
    regex.is_match(locale)
}

fn parse_optional_uuid(value: Option<String>) -> Result<Option<Uuid>, String> {
    match value {
        Some(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            Uuid::parse_str(trimmed)
                .map(Some)
                .map_err(|_| "Invalid UUID format".to_string())
        }
        None => Ok(None),
    }
}

async fn upsert_translations(
    db: &sqlx::Pool<Postgres>,
    key_id: i64,
    translations: Vec<TranslationInput>,
) -> Result<(), HttpResponse> {
    for translation in translations {
        let locale_code = translation.locale_code.trim().to_string();
        if !is_valid_locale_code(&locale_code) {
            return Err(HttpResponse::BadRequest().json(json_error("Invalid locale code format")));
        }

        let locale = match localization_read::get_locales_by_code(db, &locale_code).await {
            Ok(Some(locale)) => locale,
            Ok(None) => {
                return Err(
                    HttpResponse::BadRequest().json(BaseResponse::error("Locale not found"))
                );
            }
            Err(_) => {
                return Err(HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load locale")));
            }
        };

        let singular = translation.singular.trim().to_string();
        let plural = translation.plural.trim().to_string();

        if singular.is_empty() || plural.is_empty() {
            return Err(HttpResponse::BadRequest()
                .json(BaseResponse::error("Singular and plural are required")));
        }

        let params = localization_mutations::UpsertTranslationParams {
            localization_key_id: key_id,
            locale_id: locale.id,
            singular,
            plural,
        };

        if let Err(_) = localization_mutations::upsert_translation(db, &params).await {
            return Err(HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to save translation")));
        }
    }

    Ok(())
}
