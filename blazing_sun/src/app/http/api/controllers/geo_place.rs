//! Geo Places API Controller
//!
//! Public and admin endpoints for restaurants, cafes, and lodgings.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateGeoPlaceRequest {
    pub name: String,
    pub place_type: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateGeoPlaceImageRequest {
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tag: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct GeoPlacesQuery {
    pub place_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GeoPlaceResponse {
    pub id: i64,
    pub name: String,
    pub place_type: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub created_at: String,
    pub image_count: i64,
}

#[derive(Debug, Serialize)]
pub struct GeoPlaceImageResponse {
    pub id: i64,
    pub place_id: i64,
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tag: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_at: String,
}

fn build_place_image_url(upload_uuid: uuid::Uuid) -> String {
    format!("/api/v1/upload/download/public/{}", upload_uuid)
}

fn is_valid_place_type(place_type: &str) -> bool {
    matches!(place_type, "restaurant" | "cafe" | "lodging")
}

/// Public: list geo places (optionally filtered by type)
pub async fn list_public(
    state: web::Data<AppState>,
    query: web::Query<GeoPlacesQuery>,
) -> HttpResponse {
    let db = state.db.lock().await;

    let places = match query.place_type.as_deref() {
        Some(place_type) => {
            if !is_valid_place_type(place_type) {
                drop(db);
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Invalid place type"
                }));
            }

            db_read::geo_place::get_by_type(&db, place_type).await
        }
        None => db_read::geo_place::get_all(&db).await,
    };

    match places {
        Ok(places) => {
            let response: Vec<GeoPlaceResponse> = places
                .into_iter()
                .map(|place| GeoPlaceResponse {
                    id: place.id,
                    name: place.name,
                    place_type: place.place_type,
                    description: place.description,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    created_at: place.created_at.to_rfc3339(),
                    image_count: place.image_count,
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "places": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch geo places: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch places"
            }))
        }
    }
}

/// Admin: list all geo places
pub async fn list_admin(state: web::Data<AppState>) -> HttpResponse {
    let db = state.db.lock().await;

    match db_read::geo_place::get_all(&db).await {
        Ok(places) => {
            let response: Vec<GeoPlaceResponse> = places
                .into_iter()
                .map(|place| GeoPlaceResponse {
                    id: place.id,
                    name: place.name,
                    place_type: place.place_type,
                    description: place.description,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    created_at: place.created_at.to_rfc3339(),
                    image_count: place.image_count,
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "places": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch geo places: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch places"
            }))
        }
    }
}

/// Admin: create a new geo place
pub async fn create_place(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateGeoPlaceRequest>,
) -> HttpResponse {
    if body.name.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Name cannot be empty"
        }));
    }

    if !is_valid_place_type(&body.place_type) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid place type"
        }));
    }

    let user_id = req.extensions().get::<i64>().copied();
    let db = state.db.lock().await;

    let params = db_mutations::geo_place::CreateGeoPlaceParams {
        name: body.name.clone(),
        place_type: body.place_type.clone(),
        description: body.description.clone(),
        latitude: body.latitude,
        longitude: body.longitude,
        created_by: user_id,
    };

    match db_mutations::geo_place::create(&db, &params).await {
        Ok(place_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": place_id
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create geo place: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create place"
            }))
        }
    }
}

/// Public: list images for a geo place
pub async fn list_place_images(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let place_id = path.into_inner();
    let db = state.db.lock().await;

    match db_read::geo_place_image::get_by_place(&db, place_id).await {
        Ok(images) => {
            let response: Vec<GeoPlaceImageResponse> = images
                .into_iter()
                .map(|image| GeoPlaceImageResponse {
                    id: image.id,
                    place_id: image.place_id,
                    url: build_place_image_url(image.upload_uuid),
                    title: image.title,
                    description: image.description,
                    tag: image.tag,
                    latitude: image.latitude,
                    longitude: image.longitude,
                    created_at: image.created_at.to_rfc3339(),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "images": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch geo place images: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch place images"
            }))
        }
    }
}

/// Admin: add image to geo place
pub async fn add_place_image(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<CreateGeoPlaceImageRequest>,
) -> HttpResponse {
    let place_id = path.into_inner();
    let user_id = req.extensions().get::<i64>().copied();

    let latitude = body.latitude;
    let longitude = body.longitude;
    if latitude.is_none() || longitude.is_none() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Latitude and longitude are required for place images"
        }));
    }

    if latitude.is_some() ^ longitude.is_some() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Latitude and longitude must be provided together"
        }));
    }

    let db = state.db.lock().await;

    if !db_read::geo_place::exists(&db, place_id).await {
        drop(db);
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Place not found"
        }));
    }

    let upload = match db_read::upload::get_by_id(&db, body.upload_id).await {
        Ok(upload) => upload,
        Err(_) => {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Upload not found"
            }));
        }
    };

    if upload.storage_type != "public" {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Place images must be public uploads"
        }));
    }

    if let Some(owner_id) = user_id {
        if upload.user_id != Some(owner_id) {
            drop(db);
            return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Upload must belong to the requesting admin"
            }));
        }
    }

    let title = body.title.as_ref().map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
    let description = body
        .description
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let tag = body
        .tag
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let params = db_mutations::geo_place_image::CreateGeoPlaceImageParams {
        place_id,
        upload_id: body.upload_id,
        title,
        description,
        tag,
        latitude,
        longitude,
        created_by: user_id,
    };

    match db_mutations::geo_place_image::create(&db, &params).await {
        Ok(image_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": image_id
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to add geo place image: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add place image"
            }))
        }
    }
}
