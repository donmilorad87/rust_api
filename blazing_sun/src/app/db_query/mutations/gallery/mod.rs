//! Gallery Mutation Queries
//!
//! Write operations for the galleries table.

use sqlx::{Pool, Postgres};

/// Parameters for creating a new gallery
pub struct CreateGalleryParams {
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub gallery_type: String,
    pub display_order: i32,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_id: Option<i64>,
    pub cover_image_uuid: Option<uuid::Uuid>,
}

/// Parameters for updating a gallery
pub struct UpdateGalleryParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub gallery_type: Option<String>,
    pub display_order: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_id: Option<i64>,
    pub cover_image_uuid: Option<uuid::Uuid>,
}

/// Create a new gallery
pub async fn create(db: &Pool<Postgres>, params: &CreateGalleryParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO galleries (user_id, name, description, is_public, gallery_type, display_order, latitude, longitude, tags, cover_image_id, cover_image_uuid)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        "#,
        params.user_id,
        params.name,
        params.description,
        params.is_public,
        params.gallery_type,
        params.display_order,
        params.latitude,
        params.longitude,
        params.tags.as_deref(),
        params.cover_image_id,
        params.cover_image_uuid
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update gallery name
pub async fn update_name(
    db: &Pool<Postgres>,
    gallery_id: i64,
    name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET name = $1 WHERE id = $2"#,
        name,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery description
pub async fn update_description(
    db: &Pool<Postgres>,
    gallery_id: i64,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET description = $1 WHERE id = $2"#,
        description,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery visibility
pub async fn update_visibility(
    db: &Pool<Postgres>,
    gallery_id: i64,
    is_public: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET is_public = $1 WHERE id = $2"#,
        is_public,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery type
pub async fn update_gallery_type(
    db: &Pool<Postgres>,
    gallery_id: i64,
    gallery_type: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET gallery_type = $1 WHERE id = $2"#,
        gallery_type,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery primary location
pub async fn update_location(
    db: &Pool<Postgres>,
    gallery_id: i64,
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<(), sqlx::Error> {
    if let Some(lat) = latitude {
        sqlx::query!(
            r#"UPDATE galleries SET latitude = $1 WHERE id = $2"#,
            lat,
            gallery_id
        )
        .execute(db)
        .await?;
    }

    if let Some(lng) = longitude {
        sqlx::query!(
            r#"UPDATE galleries SET longitude = $1 WHERE id = $2"#,
            lng,
            gallery_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}

/// Update gallery tags
pub async fn update_tags(
    db: &Pool<Postgres>,
    gallery_id: i64,
    tags: Option<&[String]>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET tags = $1 WHERE id = $2"#,
        tags,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery display order
pub async fn update_display_order(
    db: &Pool<Postgres>,
    gallery_id: i64,
    display_order: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET display_order = $1 WHERE id = $2"#,
        display_order,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery cover image
pub async fn update_cover_image(
    db: &Pool<Postgres>,
    gallery_id: i64,
    cover_image_id: Option<i64>,
    cover_image_uuid: Option<uuid::Uuid>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE galleries SET cover_image_id = $1, cover_image_uuid = $2 WHERE id = $3"#,
        cover_image_id,
        cover_image_uuid,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update gallery (full update with optional fields)
pub async fn update(
    db: &Pool<Postgres>,
    gallery_id: i64,
    params: &UpdateGalleryParams,
) -> Result<(), sqlx::Error> {
    // Update name if provided
    if let Some(ref name) = params.name {
        update_name(db, gallery_id, name).await?;
    }

    // Update description if provided (can be set to NULL)
    if let Some(ref description) = params.description {
        update_description(db, gallery_id, Some(description)).await?;
    }

    // Update visibility if provided
    if let Some(is_public) = params.is_public {
        update_visibility(db, gallery_id, is_public).await?;
    }

    // Update display order if provided
    if let Some(display_order) = params.display_order {
        update_display_order(db, gallery_id, display_order).await?;
    }

    // Update gallery type if provided
    if let Some(ref gallery_type) = params.gallery_type {
        update_gallery_type(db, gallery_id, gallery_type).await?;
    }

    // Update location if provided
    if params.latitude.is_some() || params.longitude.is_some() {
        update_location(db, gallery_id, params.latitude, params.longitude).await?;
    }

    // Update tags if provided
    if let Some(ref tags) = params.tags {
        update_tags(db, gallery_id, Some(tags.as_slice())).await?;
    }

    // Update cover image if provided
    if params.cover_image_id.is_some() || params.cover_image_uuid.is_some() {
        update_cover_image(
            db,
            gallery_id,
            params.cover_image_id,
            params.cover_image_uuid,
        )
        .await?;
    }

    Ok(())
}

/// Delete a gallery (cascade deletes all pictures in it)
pub async fn delete(db: &Pool<Postgres>, gallery_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM galleries WHERE id = $1"#, gallery_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Delete all galleries for a user
pub async fn delete_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM galleries WHERE user_id = $1"#, user_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Swap display order between two galleries (for reordering)
pub async fn swap_display_order(
    db: &Pool<Postgres>,
    gallery_id_1: i64,
    gallery_id_2: i64,
) -> Result<(), sqlx::Error> {
    // Use a transaction to swap display orders atomically
    let mut tx = db.begin().await?;

    // Get current display orders
    let gallery1 = sqlx::query!(
        r#"SELECT display_order FROM galleries WHERE id = $1"#,
        gallery_id_1
    )
    .fetch_one(&mut *tx)
    .await?;

    let gallery2 = sqlx::query!(
        r#"SELECT display_order FROM galleries WHERE id = $1"#,
        gallery_id_2
    )
    .fetch_one(&mut *tx)
    .await?;

    // Swap display orders
    sqlx::query!(
        r#"UPDATE galleries SET display_order = $1 WHERE id = $2"#,
        gallery2.display_order,
        gallery_id_1
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"UPDATE galleries SET display_order = $1 WHERE id = $2"#,
        gallery1.display_order,
        gallery_id_2
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}
