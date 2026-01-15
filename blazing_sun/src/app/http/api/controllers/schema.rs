//! Schema Catalog Controller
//!
//! Public endpoints for Schema.org catalog navigation and schema definitions.

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use crate::app::db_query::read::schema_catalog as schema_catalog_read;
use crate::app::db_query::read::schema_entity as schema_entity_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::database::AppState;

pub struct SchemaController;

#[derive(Serialize)]
pub struct SchemaCategoryDto {
    #[serde(rename = "type")]
    pub type_name: String,
    pub label: String,
    pub description: String,
    pub has_children: bool,
}

#[derive(Serialize)]
pub struct SchemaCategoriesResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub categories: Vec<SchemaCategoryDto>,
}

#[derive(Serialize)]
pub struct SchemaChildrenResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub parent: String,
    pub children: Vec<SchemaCategoryDto>,
}

#[derive(Serialize)]
pub struct ExpectedTypeDto {
    #[serde(rename = "type")]
    pub type_name: String,
    pub kind: String,
}

#[derive(Serialize)]
pub struct SchemaPropertyDto {
    pub name: String,
    pub label: String,
    pub description: String,
    pub expected_types: Vec<ExpectedTypeDto>,
    pub defined_on: String,
    pub is_inherited: bool,
}

#[derive(Serialize)]
pub struct SchemaDefinitionDto {
    #[serde(rename = "type")]
    pub type_name: String,
    pub label: String,
    pub description: String,
    pub parents: Vec<String>,
    pub path: Vec<String>,
    pub properties: Vec<SchemaPropertyDto>,
}

#[derive(Serialize)]
pub struct SchemaDefinitionResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub schema: SchemaDefinitionDto,
}

impl SchemaController {
    /// GET /api/v1/schemas/categories
    pub async fn categories(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;
        let allowed: HashSet<&'static str> = [
            "Action",
            "BioChemEntity",
            "CreativeWork",
            "Event",
            "Intangible",
            "MedicalEntity",
            "Organization",
            "Person",
            "Place",
            "Product",
            "Taxon",
        ]
        .into_iter()
        .collect();

        match schema_catalog_read::get_top_level_categories(&db).await {
            Ok(categories) => {
                let items = categories
                    .into_iter()
                    .filter(|category| allowed.contains(category.name.as_str()))
                    .map(|category| SchemaCategoryDto {
                        type_name: category.name,
                        label: category.label,
                        description: category.description,
                        has_children: category.has_children,
                    })
                    .collect();

                HttpResponse::Ok().json(SchemaCategoriesResponse {
                    base: BaseResponse::success("Schema categories retrieved"),
                    categories: items,
                })
            }
            Err(e) => {
                tracing::error!("Failed to load schema categories: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema categories"))
            }
        }
    }

    /// GET /api/v1/schemas/children/{type}
    pub async fn children(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
        let parent_name = path.into_inner();
        let db = state.db.lock().await;

        match schema_catalog_read::get_type_by_name(&db, &parent_name).await {
            Ok(Some(_)) => {}
            Ok(None) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Schema type not found"));
            }
            Err(e) => {
                tracing::error!("Failed to lookup schema type {}: {}", parent_name, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema type"));
            }
        }

        match schema_catalog_read::get_children(&db, &parent_name).await {
            Ok(children) => {
                let items = children
                    .into_iter()
                    .map(|child| SchemaCategoryDto {
                        type_name: child.name,
                        label: child.label,
                        description: child.description,
                        has_children: child.has_children,
                    })
                    .collect();

                HttpResponse::Ok().json(SchemaChildrenResponse {
                    base: BaseResponse::success("Schema children retrieved"),
                    parent: parent_name,
                    children: items,
                })
            }
            Err(e) => {
                tracing::error!("Failed to load schema children: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema children"))
            }
        }
    }

    /// GET /api/v1/schemas/{type}
    /// Returns schema definition with ALL properties including inherited ones from parent types.
    /// For example, Gene (Thing → BioChemEntity → Gene) returns properties from all three types.
    pub async fn schema(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
        let type_name = path.into_inner();
        let db = state.db.lock().await;

        let type_row = match schema_catalog_read::get_type_by_name(&db, &type_name).await {
            Ok(Some(row)) => row,
            Ok(None) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Schema type not found"));
            }
            Err(e) => {
                tracing::error!("Failed to load schema type {}: {}", type_name, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema type"));
            }
        };

        let parents = schema_catalog_read::get_type_parents(&db, &type_name)
            .await
            .unwrap_or_default();
        let schema_path = schema_catalog_read::get_schema_path(&db, &type_name)
            .await
            .unwrap_or_else(|_| vec![type_name.clone()]);

        // Use inheritance query to get ALL properties including from parent types
        let mut property_map: HashMap<String, SchemaPropertyDto> = HashMap::new();
        match schema_catalog_read::get_schema_properties_with_inheritance(&db, &type_name).await {
            Ok(rows) => {
                for row in rows {
                    let is_inherited = row.defined_on != type_name;

                    let entry = property_map
                        .entry(row.property_name.clone())
                        .or_insert_with(|| SchemaPropertyDto {
                            name: row.property_name.clone(),
                            label: row.property_label.clone(),
                            description: row.property_description.clone(),
                            expected_types: Vec::new(),
                            defined_on: row.defined_on.clone(),
                            is_inherited,
                        });

                    if let Some(expected_type) = row.expected_type {
                        let kind = if row.expected_is_data_type.unwrap_or(false) {
                            "data_type"
                        } else {
                            "entity"
                        };
                        entry.expected_types.push(ExpectedTypeDto {
                            type_name: expected_type,
                            kind: kind.to_string(),
                        });
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to load schema properties: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema properties"));
            }
        }

        let mut properties: Vec<SchemaPropertyDto> = property_map.into_values().collect();
        // Sort: own properties first, then inherited, then alphabetically within each group
        properties.sort_by(|a, b| {
            match (a.is_inherited, b.is_inherited) {
                (false, true) => std::cmp::Ordering::Less,
                (true, false) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });

        HttpResponse::Ok().json(SchemaDefinitionResponse {
            base: BaseResponse::success("Schema definition retrieved"),
            schema: SchemaDefinitionDto {
                type_name: type_row.0,
                label: type_row.1,
                description: type_row.2,
                parents,
                path: schema_path,
                properties,
            },
        })
    }

    /// GET /api/v1/schemas/entity/{schema_id}?lang={lang_code}
    /// Resolves a schema entity by its @id, recursively expanding all nested @id references.
    pub async fn resolve_entity(
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<EntityResolveQuery>,
    ) -> HttpResponse {
        let schema_id = path.into_inner();
        let lang_code = query.lang.as_deref().unwrap_or("en");
        let max_depth = query.max_depth.unwrap_or(5).min(10);

        let db = state.db.lock().await;

        // Fetch the root entity
        let entity = match schema_entity_read::get_by_schema_id_lang(&db, &schema_id, lang_code).await
        {
            Ok(entity) => entity,
            Err(sqlx::Error::RowNotFound) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Schema entity not found"));
            }
            Err(e) => {
                tracing::error!("Failed to load schema entity {}: {}", schema_id, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to load schema entity"));
            }
        };

        // Recursively expand @id references
        let mut visited: HashSet<String> = HashSet::new();
        visited.insert(schema_id.clone());

        let expanded_data =
            expand_entity_references(&db, entity.schema_data.clone(), lang_code, &mut visited, 0, max_depth)
                .await;

        HttpResponse::Ok().json(SchemaEntityResponse {
            base: BaseResponse::success("Schema entity resolved"),
            entity: SchemaEntityDto {
                schema_id: entity.schema_id,
                schema_type: entity.schema_type,
                lang_code: entity.lang_code,
                data: expanded_data,
            },
        })
    }
}

#[derive(Deserialize)]
pub struct EntityResolveQuery {
    pub lang: Option<String>,
    pub max_depth: Option<usize>,
}

#[derive(Serialize)]
pub struct SchemaEntityDto {
    pub schema_id: String,
    pub schema_type: String,
    pub lang_code: String,
    pub data: serde_json::Value,
}

#[derive(Serialize)]
pub struct SchemaEntityResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub entity: SchemaEntityDto,
}

/// Recursively expand @id references in a JSON value.
/// Replaces {"@id": "some-id"} with the full entity data.
/// Tracks visited IDs to prevent circular reference infinite loops.
async fn expand_entity_references(
    db: &sqlx::Pool<sqlx::Postgres>,
    value: serde_json::Value,
    lang_code: &str,
    visited: &mut HashSet<String>,
    depth: usize,
    max_depth: usize,
) -> serde_json::Value {
    if depth >= max_depth {
        return value;
    }

    match value {
        serde_json::Value::Object(mut map) => {
            // Check if this is an @id reference
            if map.len() == 1 {
                if let Some(serde_json::Value::String(ref_id)) = map.get("@id") {
                    // If already visited, return as-is to prevent circular refs
                    if visited.contains(ref_id) {
                        return serde_json::Value::Object(map);
                    }

                    // Try to expand this reference
                    if let Ok(referenced_entity) =
                        schema_entity_read::get_by_schema_id_lang(db, ref_id, lang_code).await
                    {
                        visited.insert(ref_id.clone());
                        // Recursively expand the referenced entity's data
                        let expanded = Box::pin(expand_entity_references(
                            db,
                            referenced_entity.schema_data,
                            lang_code,
                            visited,
                            depth + 1,
                            max_depth,
                        ))
                        .await;

                        // Add @id and @type to the expanded data
                        if let serde_json::Value::Object(mut expanded_map) = expanded {
                            expanded_map.insert(
                                "@id".to_string(),
                                serde_json::Value::String(ref_id.clone()),
                            );
                            expanded_map.insert(
                                "@type".to_string(),
                                serde_json::Value::String(referenced_entity.schema_type),
                            );
                            return serde_json::Value::Object(expanded_map);
                        }
                        return expanded;
                    }
                }
            }

            // Recursively process all values in the object
            for (key, val) in map.clone() {
                let expanded = Box::pin(expand_entity_references(
                    db,
                    val,
                    lang_code,
                    visited,
                    depth + 1,
                    max_depth,
                ))
                .await;
                map.insert(key, expanded);
            }
            serde_json::Value::Object(map)
        }
        serde_json::Value::Array(arr) => {
            let mut expanded_arr = Vec::with_capacity(arr.len());
            for item in arr {
                let expanded = Box::pin(expand_entity_references(
                    db,
                    item,
                    lang_code,
                    visited,
                    depth + 1,
                    max_depth,
                ))
                .await;
                expanded_arr.push(expanded);
            }
            serde_json::Value::Array(expanded_arr)
        }
        // Primitives pass through unchanged
        other => other,
    }
}
