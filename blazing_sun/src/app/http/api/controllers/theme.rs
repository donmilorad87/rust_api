//!
//! Theme Controller
//!
//! Handles theme configuration operations:
//! - GET /admin/theme: Get current theme configuration
//! - PUT /admin/theme: Update theme variables (triggers build)
//! - PUT /admin/theme/branding: Update branding (name, description, logo, favicon)
//! - POST /admin/theme/build: Trigger manual rebuild
//! - GET /admin/theme/build/status: Get build status
//!

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tracing::{error, info};
use uuid::Uuid;

use crate::app::db_query::mutations::page_hreflang as hreflang_mutations;
use crate::app::db_query::mutations::page_schema as schema_mutations;
use crate::app::db_query::mutations::page_seo as seo_mutations;
use crate::app::db_query::mutations::schema_entity as schema_entity_mutations;
use crate::app::db_query::mutations::site_config as db_mutations;
use crate::app::db_query::read::page_hreflang as hreflang_read;
use crate::app::db_query::read::page_schema as schema_read;
use crate::app::db_query::read::page_seo as seo_read;
use crate::app::db_query::read::schema_entity as schema_entity_read;
use crate::app::db_query::read::site_config as db_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::includes::theme::ThemeService;
use crate::bootstrap::routes::controller::api::{
    get_route_registry_snapshot, route_with_lang, DEFAULT_LANG,
};
use crate::database::AppState;
use std::future::Future;
use std::pin::Pin;

/// Theme Controller
pub struct ThemeController;

/// Theme configuration response
#[derive(Debug, Serialize)]
pub struct ThemeConfigResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub config: ThemeConfigDto,
}

/// Theme configuration DTO
#[derive(Debug, Serialize, Deserialize)]
pub struct ThemeConfigDto {
    // Identity/Branding
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
    pub logo_uuid: Option<String>,
    pub logo_storage_type: Option<String>,
    pub favicon_uuid: Option<String>,
    pub favicon_storage_type: Option<String>,
    // Theme variables
    pub scss_variables: Value,
    pub theme_light: Value,
    pub theme_dark: Value,
    // Build info
    pub assets_version: String,
    pub last_build_status: Option<String>,
    pub last_build_at: Option<String>,
    pub last_build_error: Option<String>,
}

/// Theme update request
#[derive(Debug, Deserialize)]
pub struct ThemeUpdateRequest {
    pub logo_uuid: Option<String>,
    pub favicon_uuid: Option<String>,
    pub scss_variables: Option<Value>,
    pub theme_light: Option<Value>,
    pub theme_dark: Option<Value>,
}

/// Branding update request
#[derive(Debug, Deserialize)]
pub struct BrandingUpdateRequest {
    pub site_name: Option<String>,
    pub show_site_name: Option<bool>,
    pub identity_color_start: Option<String>,
    pub identity_color_end: Option<String>,
    pub identity_size: Option<String>,
    pub logo_uuid: Option<String>,
    pub favicon_uuid: Option<String>,
}

/// Build status response
#[derive(Debug, Serialize)]
pub struct BuildStatusResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub status: String,
    pub error: Option<String>,
    pub version: String,
}

/// Build result response
#[derive(Debug, Serialize)]
pub struct BuildResultResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub success: bool,
    pub new_version: Option<String>,
    pub build_output: Option<String>,
    pub error: Option<String>,
}

// ============================================
// SEO DTOs and Responses
// ============================================

/// SEO list response
#[derive(Debug, Serialize)]
pub struct SeoListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub pages: Vec<SeoListItemDto>,
}

/// SEO list item DTO
#[derive(Debug, Serialize)]
pub struct SeoListItemDto {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub robots: Option<String>,
    pub is_active: Option<bool>,
}

/// Full SEO response
#[derive(Debug, Serialize)]
pub struct SeoResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub seo: SeoDto,
}

/// Full SEO DTO
#[derive(Debug, Serialize)]
pub struct SeoDto {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<String>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<String>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<Value>,
    pub custom_meta: Option<Value>,
    pub is_active: Option<bool>,
    pub translations: Vec<SeoTranslationDto>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SeoTranslationDto {
    pub lang_code: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<String>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<String>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<Value>,
    pub custom_meta: Option<Value>,
}

/// SEO update request
#[derive(Debug, Deserialize)]
pub struct SeoUpdateRequest {
    pub lang_code: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<String>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<String>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<Value>,
    pub custom_meta: Option<Value>,
    pub is_active: Option<bool>,
}

/// SEO create request
#[derive(Debug, Deserialize)]
pub struct SeoCreateRequest {
    pub route_name: String,
    pub page_label: Option<String>,
}

/// Hreflang list response
#[derive(Debug, Serialize)]
pub struct HreflangListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub entries: Vec<HreflangDto>,
}

/// Hreflang DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HreflangDto {
    pub id: i64,
    pub lang_code: String,
    pub href: String,
    pub is_default: bool,
}

/// Hreflang upsert request
#[derive(Debug, Deserialize)]
pub struct HreflangUpsertRequest {
    pub id: Option<i64>,
    pub lang_code: String,
    pub href: String,
    pub is_default: Option<bool>,
}

// ============================================
// Schema DTOs and Responses
// ============================================

/// Schema list response
#[derive(Debug, Serialize)]
pub struct SchemaListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub schemas: Vec<SchemaDto>,
}

/// Single schema response
#[derive(Debug, Serialize)]
pub struct SchemaResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub schema: SchemaDto,
}

/// Schema DTO
#[derive(Debug, Serialize)]
pub struct SchemaDto {
    pub id: i64,
    pub page_seo_id: i64,
    pub lang_code: String,
    pub schema_type: String,
    pub schema_data: Value,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Create schema request
#[derive(Debug, Deserialize)]
pub struct CreateSchemaRequest {
    pub lang_code: Option<String>,
    pub schema_type: String,
    pub schema_data: Value,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Update schema request
#[derive(Debug, Deserialize)]
pub struct UpdateSchemaRequest {
    pub schema_type: Option<String>,
    pub schema_data: Option<Value>,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SchemaQueryParams {
    pub lang_code: Option<String>,
}

// ============================================
// Schema Entity DTOs and Requests
// ============================================

#[derive(Debug, Serialize)]
pub struct SchemaEntityDto {
    pub id: i64,
    pub schema_id: String,
    pub lang_code: String,
    pub schema_type: String,
    pub schema_data: Value,
}

#[derive(Debug, Serialize)]
pub struct SchemaEntityListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub entities: Vec<SchemaEntityDto>,
}

#[derive(Debug, Serialize)]
pub struct SchemaEntityResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub entity: SchemaEntityDto,
}

#[derive(Debug, Deserialize)]
pub struct SchemaEntityUpsertRequest {
    pub lang_code: Option<String>,
    pub schema_id: Option<String>,
    pub schema_type: String,
    pub schema_data: Value,
}

#[derive(Debug, Deserialize)]
pub struct SchemaEntityQueryParams {
    pub lang_code: Option<String>,
    pub schema_type: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SchemaEntityGetParams {
    pub lang_code: Option<String>,
    pub expand: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct LangCodeParam {
    pub lang_code: Option<String>,
}

#[derive(Debug, Clone)]
struct CollectedEntity {
    schema_id: String,
    schema_type: String,
    schema_data: Value,
}

#[derive(Debug, Clone)]
struct CollectedRelation {
    from_schema_id: String,
    property: String,
    to_schema_id: String,
}

impl ThemeController {
    /// Check if user has admin permissions (level 10+)
    fn check_admin_permission(req: &HttpRequest) -> Option<HttpResponse> {
        // Get user permissions from JWT extensions
        let permissions = req.extensions().get::<i16>().copied().unwrap_or(0);

        if permissions < 10 {
            return Some(
                HttpResponse::Forbidden().json(BaseResponse::error("Admin permission required")),
            );
        }
        None
    }

    fn normalize_lang_code(lang: &str) -> String {
        lang.trim().to_lowercase()
    }

    fn normalize_schema_id(schema_id: &str) -> String {
        if schema_id.to_lowercase().starts_with("urn:") {
            return schema_id.to_lowercase();
        }
        schema_id.to_string()
    }

    fn generate_urn_id(lang_code: &str, schema_type: &str) -> String {
        format!(
            "urn:{}:entity:{}:{}",
            lang_code.to_lowercase(),
            schema_type.to_lowercase(),
            Uuid::new_v4()
        )
    }

    fn ensure_schema_ids(value: &mut Value, lang_code: &str) {
        match value {
            Value::Object(map) => {
                let schema_type = map
                    .get("@type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let has_id = map.get("@id").and_then(|v| v.as_str()).is_some();
                if let (Some(schema_type), false) = (schema_type, has_id) {
                    let schema_id = Self::generate_urn_id(lang_code, &schema_type);
                    map.insert("@id".to_string(), Value::String(schema_id));
                }

                for (_, val) in map.iter_mut() {
                    Self::ensure_schema_ids(val, lang_code);
                }
            }
            Value::Array(values) => {
                for val in values.iter_mut() {
                    Self::ensure_schema_ids(val, lang_code);
                }
            }
            _ => {}
        }
    }

    fn normalize_value_for_hash(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut entries: Vec<_> = map
                    .iter()
                    .filter(|(k, _)| *k != "@id" && *k != "@context")
                    .map(|(k, v)| (k.clone(), Self::normalize_value_for_hash(v)))
                    .collect();
                entries.sort_by(|a, b| a.0.cmp(&b.0));
                let mut normalized = serde_json::Map::new();
                for (key, val) in entries {
                    normalized.insert(key, val);
                }
                Value::Object(normalized)
            }
            Value::Array(values) => {
                Value::Array(values.iter().map(Self::normalize_value_for_hash).collect())
            }
            other => other.clone(),
        }
    }

    fn hash_schema_data(value: &Value) -> String {
        let normalized = Self::normalize_value_for_hash(value);
        let json = serde_json::to_string(&normalized).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        let digest = hasher.finalize();
        format!("{:x}", digest)
    }

    fn collect_entities_and_relations(
        value: &Value,
        entities: &mut Vec<CollectedEntity>,
        relations: &mut Vec<CollectedRelation>,
        owner_id: Option<&str>,
    ) {
        match value {
            Value::Object(map) => {
                let schema_id = map
                    .get("@id")
                    .and_then(|v| v.as_str())
                    .map(|id| Self::normalize_schema_id(id));
                let schema_type = map
                    .get("@type")
                    .and_then(|v| v.as_str())
                    .map(|t| t.to_string());

                let mut current_owner = owner_id.map(|s| s.to_string());
                if let (Some(id), Some(schema_type)) = (schema_id.clone(), schema_type.clone()) {
                    let mut normalized_map = map.clone();
                    normalized_map.insert("@id".to_string(), Value::String(id.clone()));
                    entities.push(CollectedEntity {
                        schema_id: id.clone(),
                        schema_type,
                        schema_data: Value::Object(normalized_map),
                    });
                    current_owner = Some(id);
                }

                for (key, val) in map {
                    if key.starts_with('@') {
                        continue;
                    }
                    match val {
                        Value::Object(obj) => {
                            if let Some(target_id) = obj.get("@id").and_then(|v| v.as_str()) {
                                if let Some(ref owner) = current_owner {
                                    relations.push(CollectedRelation {
                                        from_schema_id: owner.clone(),
                                        property: key.clone(),
                                        to_schema_id: Self::normalize_schema_id(target_id),
                                    });
                                }
                            }
                            Self::collect_entities_and_relations(
                                val,
                                entities,
                                relations,
                                current_owner.as_deref(),
                            );
                        }
                        Value::Array(items) => {
                            for item in items {
                                if let Value::Object(obj) = item {
                                    if let Some(target_id) = obj.get("@id").and_then(|v| v.as_str())
                                    {
                                        if let Some(ref owner) = current_owner {
                                            relations.push(CollectedRelation {
                                                from_schema_id: owner.clone(),
                                                property: key.clone(),
                                                to_schema_id: Self::normalize_schema_id(target_id),
                                            });
                                        }
                                    }
                                }
                                Self::collect_entities_and_relations(
                                    item,
                                    entities,
                                    relations,
                                    current_owner.as_deref(),
                                );
                            }
                        }
                        _ => {}
                    }
                }
            }
            Value::Array(values) => {
                for item in values {
                    Self::collect_entities_and_relations(item, entities, relations, owner_id);
                }
            }
            _ => {}
        }
    }

    fn replace_schema_ids(
        value: &mut Value,
        replacements: &std::collections::HashMap<String, String>,
    ) {
        match value {
            Value::Object(map) => {
                if let Some(Value::String(id)) = map.get_mut("@id") {
                    if let Some(new_id) = replacements.get(id) {
                        *id = new_id.clone();
                    }
                }
                for (_, val) in map.iter_mut() {
                    Self::replace_schema_ids(val, replacements);
                }
            }
            Value::Array(values) => {
                for val in values.iter_mut() {
                    Self::replace_schema_ids(val, replacements);
                }
            }
            _ => {}
        }
    }

    fn load_schema_entity_tree<'a>(
        db: &'a sqlx::Pool<sqlx::Postgres>,
        lang_code: &'a str,
        schema_id: &'a str,
        visited: &'a mut std::collections::HashSet<String>,
        entities: &'a mut std::collections::HashMap<String, Value>,
    ) -> Pin<Box<dyn Future<Output = Result<(), sqlx::Error>> + 'a>> {
        Box::pin(async move {
            let normalized_id = Self::normalize_schema_id(schema_id);
            if visited.contains(&normalized_id) {
                return Ok(());
            }

            visited.insert(normalized_id.clone());
            let entity =
                schema_entity_read::get_by_schema_id_lang(db, &normalized_id, lang_code).await?;
            entities.insert(normalized_id.clone(), entity.schema_data.clone());

            let relations =
                schema_entity_read::get_relations_by_from_id(db, &normalized_id, lang_code).await?;
            for relation in relations {
                let target_id = Self::normalize_schema_id(&relation.to_schema_id);
                if !visited.contains(&target_id) {
                    Self::load_schema_entity_tree(db, lang_code, &target_id, visited, entities)
                        .await?;
                }
            }

            Ok(())
        })
    }

    fn expand_schema_references(
        value: &mut Value,
        entities: &std::collections::HashMap<String, Value>,
    ) {
        match value {
            Value::Object(map) => {
                if let Some(Value::String(id)) = map.get("@id") {
                    let normalized = Self::normalize_schema_id(id);
                    if let Some(expanded) = entities.get(&normalized) {
                        let replace = map.len() <= 2;
                        if replace {
                            *value = expanded.clone();
                            return;
                        }
                    }
                }

                for val in map.values_mut() {
                    Self::expand_schema_references(val, entities);
                }
            }
            Value::Array(values) => {
                for val in values.iter_mut() {
                    Self::expand_schema_references(val, entities);
                }
            }
            _ => {}
        }
    }

    async fn resolve_dedupe_ids(
        db: &sqlx::Pool<sqlx::Postgres>,
        lang_code: &str,
        schema_data: &Value,
    ) -> Result<std::collections::HashMap<String, String>, sqlx::Error> {
        let mut entities = Vec::new();
        let mut relations = Vec::new();
        Self::collect_entities_and_relations(schema_data, &mut entities, &mut relations, None);

        let mut replacements = std::collections::HashMap::new();
        for entity in entities {
            let schema_hash = Self::hash_schema_data(&entity.schema_data);
            if let Ok(Some(existing_id)) = schema_entity_mutations::find_by_hash(
                db,
                lang_code,
                &entity.schema_type,
                &schema_hash,
            )
            .await
            {
                if existing_id != entity.schema_id {
                    replacements.insert(entity.schema_id, existing_id);
                }
            }
        }
        Ok(replacements)
    }

    async fn persist_entities_and_relations(
        db: &sqlx::Pool<sqlx::Postgres>,
        lang_code: &str,
        schema_data: &Value,
    ) -> Result<(), sqlx::Error> {
        let mut entities: Vec<CollectedEntity> = Vec::new();
        let mut relations: Vec<CollectedRelation> = Vec::new();

        Self::collect_entities_and_relations(schema_data, &mut entities, &mut relations, None);

        let mut entity_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        for entity in &entities {
            if entity.schema_id.is_empty() {
                continue;
            }
            let schema_hash = Self::hash_schema_data(&entity.schema_data);
            let params = schema_entity_mutations::UpsertSchemaEntityParams {
                schema_id: entity.schema_id.clone(),
                lang_code: lang_code.to_string(),
                schema_type: entity.schema_type.clone(),
                schema_data: entity.schema_data.clone(),
                schema_hash,
            };
            schema_entity_mutations::upsert(db, &params).await?;
            entity_ids.insert(entity.schema_id.clone());
        }

        let mut referenced_ids: Vec<String> = relations
            .iter()
            .map(|rel| rel.to_schema_id.clone())
            .filter(|id| !entity_ids.contains(id))
            .collect();
        referenced_ids.sort();
        referenced_ids.dedup();

        let mut existing_ids: std::collections::HashSet<String> = entity_ids.clone();
        if !referenced_ids.is_empty() {
            if let Ok(existing) =
                schema_entity_read::get_by_schema_ids_lang(db, &referenced_ids, lang_code).await
            {
                for entity in existing {
                    existing_ids.insert(entity.schema_id);
                }
            }
        }

        let mut from_ids: std::collections::HashSet<String> = relations
            .iter()
            .map(|rel| rel.from_schema_id.clone())
            .collect();
        for from_id in from_ids.drain() {
            let _ =
                schema_entity_mutations::delete_relations_by_from_id(db, lang_code, &from_id).await;
        }

        for relation in relations {
            if !existing_ids.contains(&relation.to_schema_id) {
                continue;
            }
            let params = schema_entity_mutations::CreateEntityRelationParams {
                lang_code: lang_code.to_string(),
                from_schema_id: relation.from_schema_id,
                property: relation.property,
                to_schema_id: relation.to_schema_id,
            };
            let _ = schema_entity_mutations::create_relation(db, &params).await?;
        }

        Ok(())
    }

    fn is_web_route(route_name: &str) -> bool {
        route_name.starts_with("web.")
            || route_name.starts_with("admin.")
            || route_name.starts_with("superadmin.")
            || route_name.starts_with("oauth.")
    }

    fn format_page_label(route_name: &str) -> String {
        let key = route_name.split('.').last().unwrap_or(route_name);
        key.split(|c: char| c == '_' || c == '-')
            .filter(|part| !part.is_empty())
            .map(|part| {
                let mut chars = part.chars();
                match chars.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    None => String::new(),
                }
            })
            .collect::<Vec<String>>()
            .join(" ")
    }

    /// GET /api/v1/admin/theme - Get current theme configuration
    pub async fn get(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;
        match db_read::get(&db).await {
            Ok(config) => HttpResponse::Ok().json(ThemeConfigResponse {
                base: BaseResponse::success("Theme configuration retrieved"),
                config: ThemeConfigDto {
                    // Identity/Branding
                    site_name: config.site_name,
                    show_site_name: config.show_site_name,
                    identity_color_start: config.identity_color_start,
                    identity_color_end: config.identity_color_end,
                    identity_size: config.identity_size,
                    logo_uuid: config.logo_uuid.map(|u| u.to_string()),
                    logo_storage_type: config.logo_storage_type,
                    favicon_uuid: config.favicon_uuid.map(|u| u.to_string()),
                    favicon_storage_type: config.favicon_storage_type,
                    // Theme variables
                    scss_variables: config.scss_variables,
                    theme_light: config.theme_light,
                    theme_dark: config.theme_dark,
                    // Build info
                    assets_version: config.assets_version,
                    last_build_status: config.last_build_status,
                    last_build_at: config.last_build_at.map(|t| t.to_rfc3339()),
                    last_build_error: config.last_build_error,
                },
            }),
            Err(e) => {
                error!("Failed to get theme config: {}", e);
                HttpResponse::InternalServerError().json(BaseResponse::error(
                    "Failed to retrieve theme configuration",
                ))
            }
        }
    }

    /// PUT /api/v1/admin/theme - Update theme variables and trigger build
    pub async fn update(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<ThemeUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Theme update requested");
        info!("Received theme_light: {:?}", body.theme_light);
        info!("Received theme_dark: {:?}", body.theme_dark);

        // Mark build as started in database
        {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Update database first
        {
            let db = state.db.lock().await;

            // Update logo if provided
            if let Some(ref logo_str) = body.logo_uuid {
                let logo_uuid = if logo_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(logo_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid logo UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_logo(&db, logo_uuid).await {
                    error!("Failed to update logo: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update logo"));
                }
            }

            // Update favicon if provided
            if let Some(ref favicon_str) = body.favicon_uuid {
                let favicon_uuid = if favicon_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(favicon_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid favicon UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_favicon(&db, favicon_uuid).await {
                    error!("Failed to update favicon: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update favicon"));
                }
            }

            // Update theme variables
            if let Err(e) = db_mutations::update_themes(
                &db,
                body.scss_variables.as_ref(),
                body.theme_light.as_ref(),
                body.theme_dark.as_ref(),
            )
            .await
            {
                error!("Failed to update themes in database: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save theme configuration"));
            }
        }

        // Run the update and build
        match ThemeService::update_and_build(
            body.scss_variables.clone(),
            body.theme_light.clone(),
            body.theme_dark.clone(),
        )
        .await
        {
            Ok(result) => {
                // Update database with result
                let db = state.db.lock().await;
                if result.success {
                    if let Some(ref version) = result.new_version {
                        let _ = db_mutations::set_build_success(&db, version).await;
                    }
                } else {
                    let error_msg = result.error.as_deref().unwrap_or("Build failed");
                    let _ = db_mutations::set_build_failed(&db, error_msg).await;
                }

                HttpResponse::Ok().json(BuildResultResponse {
                    base: if result.success {
                        BaseResponse::success("Theme updated and built successfully")
                    } else {
                        BaseResponse::error("Build failed - changes rolled back")
                    },
                    success: result.success,
                    new_version: result.new_version,
                    build_output: result.build_output.map(|b| b.stdout),
                    error: result.error,
                })
            }
            Err(e) => {
                error!("Theme update failed: {}", e);

                // Update database with failure
                let db = state.db.lock().await;
                let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                HttpResponse::InternalServerError().json(BuildResultResponse {
                    base: BaseResponse::error("Theme update failed"),
                    success: false,
                    new_version: None,
                    build_output: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }

    /// PUT /api/v1/admin/theme/branding - Update branding (identity changes trigger rebuild)
    pub async fn update_branding(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<BrandingUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Branding update requested");

        // Check if identity fields changed (these require rebuild)
        let needs_rebuild = body.identity_color_start.is_some()
            || body.identity_color_end.is_some()
            || body.identity_size.is_some();

        // Mark build as started if rebuild needed
        if needs_rebuild {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Update database
        {
            let db = state.db.lock().await;

            // Update identity if any identity field provided
            if body.site_name.is_some()
                || body.show_site_name.is_some()
                || body.identity_color_start.is_some()
                || body.identity_color_end.is_some()
                || body.identity_size.is_some()
            {
                // Get current config for defaults
                let current = match db_read::get(&db).await {
                    Ok(c) => c,
                    Err(e) => {
                        error!("Failed to get current config: {}", e);
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to get current configuration"));
                    }
                };

                let params = db_mutations::UpdateIdentityParams {
                    site_name: body.site_name.clone().unwrap_or(current.site_name),
                    show_site_name: body.show_site_name.unwrap_or(current.show_site_name),
                    identity_color_start: body
                        .identity_color_start
                        .clone()
                        .unwrap_or(current.identity_color_start),
                    identity_color_end: body
                        .identity_color_end
                        .clone()
                        .unwrap_or(current.identity_color_end),
                    identity_size: body.identity_size.clone().unwrap_or(current.identity_size),
                };

                if let Err(e) = db_mutations::update_identity(&db, &params).await {
                    error!("Failed to update identity: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update identity"));
                }
            }

            // Update logo
            if let Some(ref logo_str) = body.logo_uuid {
                let logo_uuid = if logo_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(logo_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid logo UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_logo(&db, logo_uuid).await {
                    error!("Failed to update logo: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update logo"));
                }
            }

            // Update favicon
            if let Some(ref favicon_str) = body.favicon_uuid {
                let favicon_uuid = if favicon_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(favicon_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid favicon UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_favicon(&db, favicon_uuid).await {
                    error!("Failed to update favicon: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update favicon"));
                }
            }
        }

        // If identity colors/size changed, trigger rebuild with SCSS variables
        if needs_rebuild {
            // Build SCSS variables JSON with identity values
            let scss_vars = serde_json::json!({
                "identity_color_start": body.identity_color_start.as_deref().unwrap_or("#3498db"),
                "identity_color_end": body.identity_color_end.as_deref().unwrap_or("#764ba2"),
                "identity_size": body.identity_size.as_deref().unwrap_or("1.375rem"),
            });

            match ThemeService::update_and_build(Some(scss_vars), None, None).await {
                Ok(result) => {
                    // Update database with result
                    let db = state.db.lock().await;
                    if result.success {
                        if let Some(ref version) = result.new_version {
                            let _ = db_mutations::set_build_success(&db, version).await;
                        }
                    } else {
                        let error_msg = result.error.as_deref().unwrap_or("Build failed");
                        let _ = db_mutations::set_build_failed(&db, error_msg).await;
                    }

                    HttpResponse::Ok().json(BuildResultResponse {
                        base: if result.success {
                            BaseResponse::success("Branding saved and theme rebuilt successfully")
                        } else {
                            BaseResponse::error("Build failed - changes rolled back")
                        },
                        success: result.success,
                        new_version: result.new_version,
                        build_output: result.build_output.map(|b| b.stdout),
                        error: result.error,
                    })
                }
                Err(e) => {
                    error!("Theme build failed: {}", e);

                    let db = state.db.lock().await;
                    let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                    HttpResponse::InternalServerError().json(BuildResultResponse {
                        base: BaseResponse::error("Theme build failed"),
                        success: false,
                        new_version: None,
                        build_output: None,
                        error: Some(e.to_string()),
                    })
                }
            }
        } else {
            // No rebuild needed - just logo/favicon/site_name text change
            HttpResponse::Ok().json(BaseResponse::success("Branding updated successfully"))
        }
    }

    /// POST /api/v1/admin/theme/build - Trigger manual rebuild
    pub async fn trigger_build(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Manual theme build triggered");

        // Mark build as started
        {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Run rebuild
        match ThemeService::rebuild().await {
            Ok(result) => {
                // Update database
                let db = state.db.lock().await;
                if result.success {
                    if let Some(ref version) = result.new_version {
                        let _ = db_mutations::set_build_success(&db, version).await;
                    }
                } else {
                    let error_msg = result.error.as_deref().unwrap_or("Build failed");
                    let _ = db_mutations::set_build_failed(&db, error_msg).await;
                }

                HttpResponse::Ok().json(BuildResultResponse {
                    base: if result.success {
                        BaseResponse::success("Build completed successfully")
                    } else {
                        BaseResponse::error("Build failed")
                    },
                    success: result.success,
                    new_version: result.new_version,
                    build_output: result.build_output.map(|b| b.stdout),
                    error: result.error,
                })
            }
            Err(e) => {
                error!("Build failed: {}", e);

                let db = state.db.lock().await;
                let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                HttpResponse::InternalServerError().json(BuildResultResponse {
                    base: BaseResponse::error("Build failed"),
                    success: false,
                    new_version: None,
                    build_output: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }

    /// GET /api/v1/admin/theme/build/status - Get build status
    pub async fn build_status(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;

        match db_read::get(&db).await {
            Ok(config) => HttpResponse::Ok().json(BuildStatusResponse {
                base: BaseResponse::success("Build status retrieved"),
                status: config
                    .last_build_status
                    .unwrap_or_else(|| "pending".to_string()),
                error: config.last_build_error,
                version: config.assets_version,
            }),
            Err(e) => {
                error!("Failed to get build status: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve build status"))
            }
        }
    }

    // ============================================
    // SEO Endpoints
    // ============================================

    /// GET /api/v1/admin/seo - Get all page SEO entries
    pub async fn seo_list(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;

        match seo_read::get_all(&db).await {
            Ok(pages) => {
                let items: Vec<SeoListItemDto> = pages
                    .into_iter()
                    .map(|p| SeoListItemDto {
                        id: p.id,
                        route_name: p.route_name,
                        page_path: p.page_path,
                        page_label: p.page_label,
                        title: p.title,
                        description: p.description,
                        robots: p.robots,
                        is_active: p.is_active,
                    })
                    .collect();

                HttpResponse::Ok().json(SeoListResponse {
                    base: BaseResponse::success("SEO pages retrieved"),
                    pages: items,
                })
            }
            Err(e) => {
                error!("Failed to get SEO pages: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve SEO pages"))
            }
        }
    }

    /// POST /api/v1/admin/seo - Create SEO page entry
    pub async fn seo_create(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<SeoCreateRequest>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = body.route_name.trim();
        if route_name.is_empty() {
            return HttpResponse::BadRequest().json(BaseResponse::error("Route name is required"));
        }

        if !Self::is_web_route(route_name) {
            return HttpResponse::BadRequest().json(BaseResponse::error("Route is not a web page"));
        }

        let registry = get_route_registry_snapshot().unwrap_or_default();
        if !registry.contains_key(route_name) {
            return HttpResponse::BadRequest().json(BaseResponse::error("Route not found"));
        }

        let page_path = match route_with_lang(route_name, DEFAULT_LANG, None) {
            Some(path) => path,
            None => {
                return HttpResponse::BadRequest().json(BaseResponse::error(
                    "Route does not have a default language path",
                ));
            }
        };

        let page_label = body
            .page_label
            .as_ref()
            .map(|label| label.trim().to_string())
            .filter(|label| !label.is_empty())
            .unwrap_or_else(|| Self::format_page_label(route_name));

        let db = state.db.lock().await;
        let page_id = match seo_mutations::create(
            &db,
            &seo_mutations::CreatePageSeoParams {
                route_name: route_name.to_string(),
                page_path,
                page_label,
                title: None,
                description: None,
                robots: None,
            },
        )
        .await
        {
            Ok(id) => id,
            Err(e) => {
                error!("Failed to create SEO page {}: {}", route_name, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create SEO page"));
            }
        };

        let translation_params = seo_mutations::UpdatePageSeoTranslationParams {
            lang_code: DEFAULT_LANG.to_string(),
            title: None,
            description: None,
            keywords: None,
            og_title: None,
            og_description: None,
            og_image_uuid: None,
            og_type: None,
            twitter_card: None,
            twitter_title: None,
            twitter_description: None,
            twitter_image_uuid: None,
            canonical_url: None,
            robots: None,
            structured_data: None,
            custom_meta: None,
        };

        if let Err(e) = seo_mutations::upsert_translation(&db, page_id, &translation_params).await {
            error!("Failed to seed SEO translation for {}: {}", route_name, e);
        }

        HttpResponse::Ok().json(BaseResponse::success("SEO page created"))
    }

    /// GET /api/v1/admin/seo/{route_name} - Get SEO for specific page
    pub async fn seo_get(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let db = state.db.lock().await;

        match seo_read::get_by_route(&db, &route_name).await {
            Ok(seo) => {
                let translations = match seo_read::get_translations_by_page_id(&db, seo.id).await {
                    Ok(list) => list
                        .into_iter()
                        .map(|t| SeoTranslationDto {
                            lang_code: t.lang_code,
                            title: t.title,
                            description: t.description,
                            keywords: t.keywords,
                            og_title: t.og_title,
                            og_description: t.og_description,
                            og_image_uuid: t.og_image_uuid.map(|u| u.to_string()),
                            og_type: t.og_type,
                            twitter_card: t.twitter_card,
                            twitter_title: t.twitter_title,
                            twitter_description: t.twitter_description,
                            twitter_image_uuid: t.twitter_image_uuid.map(|u| u.to_string()),
                            canonical_url: t.canonical_url,
                            robots: t.robots,
                            structured_data: t.structured_data,
                            custom_meta: t.custom_meta,
                        })
                        .collect::<Vec<_>>(),
                    Err(_) => Vec::new(),
                };

                let english = translations
                    .iter()
                    .find(|t| t.lang_code == DEFAULT_LANG)
                    .cloned();

                HttpResponse::Ok().json(SeoResponse {
                    base: BaseResponse::success("SEO data retrieved"),
                    seo: SeoDto {
                        id: seo.id,
                        route_name: seo.route_name,
                        page_path: seo.page_path,
                        page_label: seo.page_label,
                        title: english.as_ref().and_then(|t| t.title.clone()),
                        description: english.as_ref().and_then(|t| t.description.clone()),
                        keywords: english.as_ref().and_then(|t| t.keywords.clone()),
                        og_title: english.as_ref().and_then(|t| t.og_title.clone()),
                        og_description: english.as_ref().and_then(|t| t.og_description.clone()),
                        og_image_uuid: english.as_ref().and_then(|t| t.og_image_uuid.clone()),
                        og_type: english.as_ref().and_then(|t| t.og_type.clone()),
                        twitter_card: english.as_ref().and_then(|t| t.twitter_card.clone()),
                        twitter_title: english.as_ref().and_then(|t| t.twitter_title.clone()),
                        twitter_description: english
                            .as_ref()
                            .and_then(|t| t.twitter_description.clone()),
                        twitter_image_uuid: english
                            .as_ref()
                            .and_then(|t| t.twitter_image_uuid.clone()),
                        canonical_url: english.as_ref().and_then(|t| t.canonical_url.clone()),
                        robots: english.as_ref().and_then(|t| t.robots.clone()),
                        structured_data: english.as_ref().and_then(|t| t.structured_data.clone()),
                        custom_meta: english.as_ref().and_then(|t| t.custom_meta.clone()),
                        is_active: seo.is_active,
                        translations,
                    },
                })
            }
            Err(e) => {
                error!("Failed to get SEO for route {}: {}", route_name, e);
                HttpResponse::NotFound().json(BaseResponse::error("Page SEO not found"))
            }
        }
    }

    /// PUT /api/v1/admin/seo/{route_name} - Update SEO for specific page
    pub async fn seo_update(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
        body: web::Json<SeoUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let lang_code = body
            .lang_code
            .clone()
            .unwrap_or_else(|| DEFAULT_LANG.to_string());
        let db = state.db.lock().await;

        // Check if page exists
        if !seo_read::exists_by_route(&db, &route_name).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Page SEO not found"));
        }

        // Parse UUIDs if provided
        let og_image_uuid = match &body.og_image_uuid {
            Some(s) if s.is_empty() => Some(None),
            Some(s) => match Uuid::parse_str(s) {
                Ok(uuid) => Some(Some(uuid)),
                Err(_) => {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Invalid og_image_uuid format"));
                }
            },
            None => None,
        };

        let twitter_image_uuid = match &body.twitter_image_uuid {
            Some(s) if s.is_empty() => Some(None),
            Some(s) => match Uuid::parse_str(s) {
                Ok(uuid) => Some(Some(uuid)),
                Err(_) => {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Invalid twitter_image_uuid format"));
                }
            },
            None => None,
        };

        // Build update params
        let params = seo_mutations::UpdatePageSeoTranslationParams {
            lang_code: lang_code.clone(),
            title: body.title.clone(),
            description: body.description.clone(),
            keywords: body.keywords.clone(),
            og_title: body.og_title.clone(),
            og_description: body.og_description.clone(),
            og_image_uuid: og_image_uuid.unwrap_or(None),
            og_type: body.og_type.clone(),
            twitter_card: body.twitter_card.clone(),
            twitter_title: body.twitter_title.clone(),
            twitter_description: body.twitter_description.clone(),
            twitter_image_uuid: twitter_image_uuid.unwrap_or(None),
            canonical_url: body.canonical_url.clone(),
            robots: body.robots.clone(),
            structured_data: body.structured_data.clone(),
            custom_meta: body.custom_meta.clone(),
        };

        let page = match seo_read::get_by_route(&db, &route_name).await {
            Ok(page) => page,
            Err(e) => {
                error!("Failed to get SEO page {}: {}", route_name, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update SEO"));
            }
        };

        if let Err(e) = seo_mutations::upsert_translation(&db, page.id, &params).await {
            error!("Failed to update SEO for route {}: {}", route_name, e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to update SEO"));
        }

        if lang_code == DEFAULT_LANG {
            let legacy_params = seo_mutations::UpdatePageSeoParams {
                title: body.title.clone(),
                description: body.description.clone(),
                keywords: body.keywords.clone(),
                og_title: body.og_title.clone(),
                og_description: body.og_description.clone(),
                og_image_uuid: og_image_uuid.unwrap_or(None),
                og_type: body.og_type.clone(),
                twitter_card: body.twitter_card.clone(),
                twitter_title: body.twitter_title.clone(),
                twitter_description: body.twitter_description.clone(),
                twitter_image_uuid: twitter_image_uuid.unwrap_or(None),
                canonical_url: body.canonical_url.clone(),
                robots: body.robots.clone(),
                structured_data: body.structured_data.clone(),
                custom_meta: body.custom_meta.clone(),
                is_active: body.is_active,
            };
            if let Err(e) = seo_mutations::update_by_route(&db, &route_name, &legacy_params).await {
                error!(
                    "Failed to update legacy SEO for route {}: {}",
                    route_name, e
                );
            }
        } else if body.is_active.is_some() {
            let legacy_params = seo_mutations::UpdatePageSeoParams {
                title: None,
                description: None,
                keywords: None,
                og_title: None,
                og_description: None,
                og_image_uuid: None,
                og_type: None,
                twitter_card: None,
                twitter_title: None,
                twitter_description: None,
                twitter_image_uuid: None,
                canonical_url: None,
                robots: None,
                structured_data: None,
                custom_meta: None,
                is_active: body.is_active,
            };
            if let Err(e) = seo_mutations::update_by_route(&db, &route_name, &legacy_params).await {
                error!(
                    "Failed to update SEO active flag for route {}: {}",
                    route_name, e
                );
            }
        }

        info!("SEO updated for route: {} ({})", route_name, lang_code);
        HttpResponse::Ok().json(BaseResponse::success("SEO updated successfully"))
    }

    /// PATCH /api/v1/admin/seo/{route_name}/toggle - Toggle active status
    pub async fn seo_toggle_active(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let db = state.db.lock().await;

        match seo_mutations::toggle_active(&db, &route_name).await {
            Ok(new_status) => {
                info!(
                    "SEO active status toggled for {}: {}",
                    route_name, new_status
                );
                HttpResponse::Ok().json(serde_json::json!({
                    "success": true,
                    "message": "Active status toggled",
                    "is_active": new_status
                }))
            }
            Err(e) => {
                error!("Failed to toggle SEO active for {}: {}", route_name, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to toggle active status"))
            }
        }
    }

    /// GET /api/v1/admin/seo/page/{id}/hreflang - List hreflang entries for a page
    pub async fn hreflang_list(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let db = state.db.lock().await;

        match hreflang_read::get_by_page_id(&db, page_seo_id).await {
            Ok(entries) => {
                let items = entries
                    .into_iter()
                    .map(|entry| HreflangDto {
                        id: entry.id,
                        lang_code: entry.lang_code,
                        href: entry.href,
                        is_default: entry.is_default,
                    })
                    .collect::<Vec<_>>();

                HttpResponse::Ok().json(HreflangListResponse {
                    base: BaseResponse::success("Hreflang entries retrieved"),
                    entries: items,
                })
            }
            Err(e) => {
                error!(
                    "Failed to fetch hreflang entries for page {}: {}",
                    page_seo_id, e
                );
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load hreflang entries"))
            }
        }
    }

    /// POST /api/v1/admin/seo/page/{id}/hreflang - Upsert hreflang entry
    pub async fn hreflang_upsert(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        body: web::Json<HreflangUpsertRequest>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let lang_code = body.lang_code.trim();
        let href = body.href.trim();

        if lang_code.is_empty() || href.is_empty() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Language code and URL are required"));
        }

        if !href.starts_with('/') && !href.starts_with("http://") && !href.starts_with("https://") {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("URL must start with / or http(s)://"));
        }

        let db = state.db.lock().await;
        let params = hreflang_mutations::UpsertPageHreflangParams {
            id: body.id,
            lang_code: lang_code.to_string(),
            href: href.to_string(),
            is_default: body.is_default.unwrap_or(false),
        };

        match hreflang_mutations::upsert(&db, page_seo_id, &params).await {
            Ok(_) => HttpResponse::Ok().json(BaseResponse::success("Hreflang entry saved")),
            Err(e) => {
                error!("Failed to upsert hreflang entry: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save hreflang entry"))
            }
        }
    }

    /// DELETE /api/v1/admin/seo/hreflang/{id} - Delete hreflang entry
    pub async fn hreflang_delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let id = path.into_inner();
        let db = state.db.lock().await;

        match hreflang_mutations::delete_by_id(&db, id).await {
            Ok(true) => HttpResponse::Ok().json(BaseResponse::success("Hreflang entry deleted")),
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Hreflang entry not found"))
            }
            Err(e) => {
                error!("Failed to delete hreflang entry {}: {}", id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete hreflang entry"))
            }
        }
    }

    // ============================================
    // Schema Endpoints
    // ============================================

    /// GET /api/v1/admin/seo/page/{id}/schemas - Get all schemas for a page
    pub async fn schema_list(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        query: web::Query<SchemaQueryParams>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let lang_code = query
            .lang_code
            .clone()
            .unwrap_or_else(|| DEFAULT_LANG.to_string());
        let db = state.db.lock().await;

        match schema_read::get_by_page_seo_id_lang(&db, page_seo_id, &lang_code).await {
            Ok(schemas) => {
                let items: Vec<SchemaDto> = schemas
                    .into_iter()
                    .map(|s| SchemaDto {
                        id: s.id,
                        page_seo_id: s.page_seo_id,
                        lang_code: s.lang_code,
                        schema_type: s.schema_type,
                        schema_data: s.schema_data.unwrap_or(serde_json::json!({})),
                        position: s.position,
                        is_active: s.is_active,
                    })
                    .collect();

                HttpResponse::Ok().json(SchemaListResponse {
                    base: BaseResponse::success("Schemas retrieved"),
                    schemas: items,
                })
            }
            Err(e) => {
                error!("Failed to get schemas for page {}: {}", page_seo_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve schemas"))
            }
        }
    }

    /// POST /api/v1/admin/seo/page/{id}/schemas - Create a new schema for a page
    pub async fn schema_create(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        body: web::Json<CreateSchemaRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if page exists
        match seo_read::get_by_id(&db, page_seo_id).await {
            Ok(_) => {}
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Page not found"));
            }
        }

        let lang_code = Self::normalize_lang_code(
            &body
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );

        let mut schema_data = body.schema_data.clone();
        if let Value::Object(ref mut map) = schema_data {
            if !map.contains_key("@type") {
                map.insert("@type".to_string(), Value::String(body.schema_type.clone()));
            }
        }
        Self::ensure_schema_ids(&mut schema_data, &lang_code);
        if let Ok(replacements) = Self::resolve_dedupe_ids(&db, &lang_code, &schema_data).await {
            if !replacements.is_empty() {
                Self::replace_schema_ids(&mut schema_data, &replacements);
            }
        }

        if let Err(e) = Self::persist_entities_and_relations(&db, &lang_code, &schema_data).await {
            error!("Failed to persist schema entities: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to persist schema entities"));
        }

        // Extract the @id from schema_data to use as entity_schema_id reference
        let entity_schema_id = match schema_data.get("@id").and_then(|v| v.as_str()) {
            Some(id) => id.to_string(),
            None => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Schema must have an @id"));
            }
        };

        let params = schema_mutations::CreatePageSchemaParams {
            page_seo_id,
            lang_code,
            schema_type: body.schema_type.clone(),
            entity_schema_id,
            position: body.position,
            is_active: body.is_active,
        };

        match schema_mutations::create(&db, &params).await {
            Ok(id) => {
                info!("Schema created: {} for page {}", id, page_seo_id);

                // Fetch the created schema to return
                match schema_read::get_by_id(&db, id).await {
                    Ok(schema) => HttpResponse::Created().json(SchemaResponse {
                        base: BaseResponse::success("Schema created successfully"),
                        schema: SchemaDto {
                            id: schema.id,
                            page_seo_id: schema.page_seo_id,
                            lang_code: schema.lang_code,
                            schema_type: schema.schema_type,
                            schema_data: schema.schema_data.unwrap_or(serde_json::json!({})),
                            position: schema.position,
                            is_active: schema.is_active,
                        },
                    }),
                    Err(_) => HttpResponse::Created().json(serde_json::json!({
                        "success": true,
                        "message": "Schema created successfully",
                        "id": id
                    })),
                }
            }
            Err(e) => {
                error!("Failed to create schema: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save schema"))
            }
        }
    }

    /// PUT /api/v1/admin/seo/schema/{id} - Update a schema
    pub async fn schema_update(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        body: web::Json<UpdateSchemaRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        let existing_schema = match schema_read::get_by_id(&db, schema_id).await {
            Ok(schema) => schema,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Schema not found"));
            }
        };

        if let Some(ref schema_data) = body.schema_data {
            let lang_code = Self::normalize_lang_code(&existing_schema.lang_code);
            let mut enriched = schema_data.clone();
            if let Value::Object(ref mut map) = enriched {
                if !map.contains_key("@type") {
                    map.insert(
                        "@type".to_string(),
                        Value::String(existing_schema.schema_type.clone()),
                    );
                }
            }
            Self::ensure_schema_ids(&mut enriched, &lang_code);
            if let Ok(replacements) = Self::resolve_dedupe_ids(&db, &lang_code, &enriched).await {
                if !replacements.is_empty() {
                    Self::replace_schema_ids(&mut enriched, &replacements);
                }
            }
            if let Err(e) = Self::persist_entities_and_relations(&db, &lang_code, &enriched).await {
                error!("Failed to persist schema entities: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to persist schema entities"));
            }
        }

        // Extract entity_schema_id from updated schema_data if provided
        let entity_schema_id = if let Some(ref schema_data) = body.schema_data {
            schema_data.get("@id").and_then(|v| v.as_str()).map(|s| s.to_string())
        } else {
            None
        };

        let params = schema_mutations::UpdatePageSchemaParams {
            schema_type: body.schema_type.clone(),
            entity_schema_id,
            position: body.position,
            is_active: body.is_active,
        };

        match schema_mutations::update(&db, schema_id, &params).await {
            Ok(_) => {
                info!("Schema updated: {}", schema_id);

                // Fetch updated schema
                match schema_read::get_by_id(&db, schema_id).await {
                    Ok(schema) => HttpResponse::Ok().json(SchemaResponse {
                        base: BaseResponse::success("Schema updated successfully"),
                        schema: SchemaDto {
                            id: schema.id,
                            page_seo_id: schema.page_seo_id,
                            lang_code: schema.lang_code,
                            schema_type: schema.schema_type,
                            schema_data: schema.schema_data.unwrap_or(serde_json::json!({})),
                            position: schema.position,
                            is_active: schema.is_active,
                        },
                    }),
                    Err(_) => HttpResponse::Ok()
                        .json(BaseResponse::success("Schema updated successfully")),
                }
            }
            Err(e) => {
                error!("Failed to update schema {}: {}", schema_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update schema"))
            }
        }
    }

    /// DELETE /api/v1/admin/seo/schema/{id} - Delete a schema
    pub async fn schema_delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        match schema_mutations::delete(&db, schema_id).await {
            Ok(deleted) => {
                if deleted {
                    info!("Schema deleted: {}", schema_id);
                    HttpResponse::Ok().json(BaseResponse::success("Schema deleted successfully"))
                } else {
                    HttpResponse::NotFound().json(BaseResponse::error("Schema not found"))
                }
            }
            Err(e) => {
                error!("Failed to delete schema {}: {}", schema_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete schema"))
            }
        }
    }

    /// GET /api/v1/admin/seo/schema/{id} - Get a single schema
    pub async fn schema_get(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        match schema_read::get_by_id(&db, schema_id).await {
            Ok(schema) => HttpResponse::Ok().json(SchemaResponse {
                base: BaseResponse::success("Schema retrieved"),
                schema: SchemaDto {
                    id: schema.id,
                    page_seo_id: schema.page_seo_id,
                    lang_code: schema.lang_code,
                    schema_type: schema.schema_type,
                    schema_data: schema.schema_data.unwrap_or(serde_json::json!({})),
                    position: schema.position,
                    is_active: schema.is_active,
                },
            }),
            Err(e) => {
                error!("Failed to get schema {}: {}", schema_id, e);
                HttpResponse::NotFound().json(BaseResponse::error("Schema not found"))
            }
        }
    }

    /// GET /api/v1/admin/seo/schema-catalog - Get schema.org catalog
    pub async fn schema_catalog(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let _ = state;
        let path = format!(
            "{}/src/resources/schema/schema_catalog.json",
            env!("CARGO_MANIFEST_DIR")
        );

        match std::fs::read_to_string(path) {
            Ok(contents) => HttpResponse::Ok()
                .content_type("application/json")
                .body(contents),
            Err(e) => {
                error!("Failed to read schema catalog: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to read schema catalog"))
            }
        }
    }

    /// GET /api/v1/admin/seo/entities - Search schema entities
    /// Query params:
    /// - lang_code: Language code (default: "en")
    /// - schema_type: Filter by schema type (e.g., "PostalAddress", "Person")
    /// - q: Search query for schema_id
    /// - limit: Max results (1-200, default: 50)
    pub async fn schema_entity_list(
        state: web::Data<AppState>,
        req: HttpRequest,
        query: web::Query<SchemaEntityQueryParams>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let lang_code = Self::normalize_lang_code(
            &query
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );
        let search = query.q.clone();
        let limit = query.limit.unwrap_or(50).max(1).min(200);
        let db = state.db.lock().await;

        // If schema_type is specified, filter by type
        let result = if let Some(schema_type) = &query.schema_type {
            schema_entity_read::list_by_type_lang(
                &db,
                schema_type,
                &lang_code,
                search.as_deref(),
                limit,
            )
            .await
        } else {
            // Otherwise, search by schema_id pattern
            schema_entity_read::search_by_schema_id_lang(
                &db,
                &search.unwrap_or_default(),
                &lang_code,
                limit,
            )
            .await
        };

        match result {
            Ok(entities) => {
                let items = entities
                    .into_iter()
                    .map(|entity| SchemaEntityDto {
                        id: entity.id,
                        schema_id: entity.schema_id,
                        lang_code: entity.lang_code,
                        schema_type: entity.schema_type,
                        schema_data: entity.schema_data,
                    })
                    .collect();

                HttpResponse::Ok().json(SchemaEntityListResponse {
                    base: BaseResponse::success("Schema entities retrieved"),
                    entities: items,
                })
            }
            Err(e) => {
                error!("Failed to search schema entities: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to search schema entities"))
            }
        }
    }

    /// GET /api/v1/admin/seo/entities/{schema_id} - Get schema entity by @id
    pub async fn schema_entity_get(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
        query: web::Query<SchemaEntityGetParams>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let lang_code = Self::normalize_lang_code(
            &query
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );
        let db = state.db.lock().await;
        let expand = query.expand.unwrap_or(true);

        match schema_entity_read::get_by_schema_id_lang(&db, &schema_id, &lang_code).await {
            Ok(entity) => {
                let mut schema_data = entity.schema_data.clone();

                if expand {
                    let mut visited = std::collections::HashSet::new();
                    let mut entities = std::collections::HashMap::new();
                    if let Err(e) = Self::load_schema_entity_tree(
                        &db,
                        &lang_code,
                        &entity.schema_id,
                        &mut visited,
                        &mut entities,
                    )
                    .await
                    {
                        error!("Failed to expand schema entity {}: {}", schema_id, e);
                    } else {
                        Self::expand_schema_references(&mut schema_data, &entities);
                    }
                }

                HttpResponse::Ok().json(SchemaEntityResponse {
                    base: BaseResponse::success("Schema entity retrieved"),
                    entity: SchemaEntityDto {
                        id: entity.id,
                        schema_id: entity.schema_id,
                        lang_code: entity.lang_code,
                        schema_type: entity.schema_type,
                        schema_data,
                    },
                })
            }
            Err(e) => {
                error!("Failed to get schema entity {}: {}", schema_id, e);
                HttpResponse::NotFound().json(BaseResponse::error("Schema entity not found"))
            }
        }
    }

    /// POST /api/v1/admin/seo/entities - Create or update schema entity
    pub async fn schema_entity_upsert(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<SchemaEntityUpsertRequest>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let lang_code = Self::normalize_lang_code(
            &body
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );
        let mut schema_data = body.schema_data.clone();
        let schema_id = body.schema_id.clone().or_else(|| {
            schema_data
                .get("@id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

        let schema_id = match schema_id {
            Some(id) => Self::normalize_schema_id(&id),
            None => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("schema_id or @id is required"));
            }
        };

        if let Value::Object(ref mut map) = schema_data {
            map.insert("@id".to_string(), Value::String(schema_id.clone()));
            if !map.contains_key("@type") {
                map.insert("@type".to_string(), Value::String(body.schema_type.clone()));
            }
        }
        Self::ensure_schema_ids(&mut schema_data, &lang_code);

        let schema_hash = Self::hash_schema_data(&schema_data);
        let params = schema_entity_mutations::UpsertSchemaEntityParams {
            schema_id: schema_id.clone(),
            lang_code: lang_code.clone(),
            schema_type: body.schema_type.clone(),
            schema_data: schema_data.clone(),
            schema_hash,
        };

        let db = state.db.lock().await;
        match schema_entity_mutations::upsert(&db, &params).await {
            Ok(id) => HttpResponse::Ok().json(SchemaEntityResponse {
                base: BaseResponse::success("Schema entity saved"),
                entity: SchemaEntityDto {
                    id,
                    schema_id,
                    lang_code,
                    schema_type: body.schema_type.clone(),
                    schema_data,
                },
            }),
            Err(e) => {
                error!("Failed to upsert schema entity: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save schema entity"))
            }
        }
    }

    /// DELETE /api/v1/admin/seo/entities/{schema_id} - Delete schema entity
    /// This will also cascade delete all page_schemas that reference this entity
    pub async fn schema_entity_delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
        query: web::Query<LangCodeParam>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let lang_code = Self::normalize_lang_code(
            &query
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );

        let db = state.db.lock().await;

        match schema_entity_mutations::delete_by_schema_id_lang(&db, &schema_id, &lang_code).await {
            Ok(true) => {
                info!(
                    "Schema entity deleted: {} ({}), cascade deleted page_schemas",
                    schema_id, lang_code
                );
                HttpResponse::Ok().json(BaseResponse::success(
                    "Schema entity deleted (page assignments removed)",
                ))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Schema entity not found"))
            }
            Err(e) => {
                error!(
                    "Failed to delete schema entity {} ({}): {}",
                    schema_id, lang_code, e
                );
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete schema entity"))
            }
        }
    }

    /// GET /api/v1/admin/seo/entity-types - Get list of available schema entity types
    /// Query params:
    /// - lang_code: Language code (default: "en")
    pub async fn schema_entity_types(
        state: web::Data<AppState>,
        req: HttpRequest,
        query: web::Query<LangCodeParam>,
    ) -> HttpResponse {
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let lang_code = Self::normalize_lang_code(
            &query
                .lang_code
                .clone()
                .unwrap_or_else(|| DEFAULT_LANG.to_string()),
        );
        let db = state.db.lock().await;

        match schema_entity_read::list_types_by_lang(&db, &lang_code).await {
            Ok(types) => HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "message": "Entity types retrieved",
                "types": types
            })),
            Err(e) => {
                error!("Failed to list schema entity types: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list entity types"))
            }
        }
    }
}
