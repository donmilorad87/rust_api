//! Picture Mutation Queries
//!
//! Write operations for the pictures table.

use sqlx::{Pool, Postgres};

/// Parameters for adding a picture to a gallery
pub struct AddPictureParams {
    pub gallery_id: i64,
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub display_order: i32,
}

/// Parameters for updating a picture
pub struct UpdatePictureParams {
    pub title: Option<String>,
    pub description: Option<String>,
    pub display_order: Option<i32>,
}

/// Add a picture to a gallery
pub async fn add_to_gallery(
    db: &Pool<Postgres>,
    params: &AddPictureParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO pictures (gallery_id, upload_id, title, description, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
        params.gallery_id,
        params.upload_id,
        params.title,
        params.description,
        params.display_order
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update picture title
pub async fn update_title(
    db: &Pool<Postgres>,
    picture_id: i64,
    title: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE pictures SET title = $1 WHERE id = $2"#,
        title,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update picture description
pub async fn update_description(
    db: &Pool<Postgres>,
    picture_id: i64,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE pictures SET description = $1 WHERE id = $2"#,
        description,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update picture display order
pub async fn update_display_order(
    db: &Pool<Postgres>,
    picture_id: i64,
    display_order: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE pictures SET display_order = $1 WHERE id = $2"#,
        display_order,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update picture (full update with optional fields)
pub async fn update(
    db: &Pool<Postgres>,
    picture_id: i64,
    params: &UpdatePictureParams,
) -> Result<(), sqlx::Error> {
    // Update title if provided (can be set to NULL)
    if let Some(ref title) = params.title {
        update_title(db, picture_id, Some(title)).await?;
    }

    // Update description if provided (can be set to NULL)
    if let Some(ref description) = params.description {
        update_description(db, picture_id, Some(description)).await?;
    }

    // Update display order if provided
    if let Some(display_order) = params.display_order {
        update_display_order(db, picture_id, display_order).await?;
    }

    Ok(())
}

/// Remove a picture from a gallery
pub async fn remove_from_gallery(
    db: &Pool<Postgres>,
    picture_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM pictures WHERE id = $1"#,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Remove all pictures from a gallery
pub async fn remove_all_from_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM pictures WHERE gallery_id = $1"#,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Remove a specific upload from a gallery
pub async fn remove_upload_from_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
    upload_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM pictures WHERE gallery_id = $1 AND upload_id = $2"#,
        gallery_id,
        upload_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Swap display order between two pictures (for reordering)
pub async fn swap_display_order(
    db: &Pool<Postgres>,
    picture_id_1: i64,
    picture_id_2: i64,
) -> Result<(), sqlx::Error> {
    // Use a transaction to swap display orders atomically
    let mut tx = db.begin().await?;

    // Get current display orders
    let picture1 = sqlx::query!(
        r#"SELECT display_order FROM pictures WHERE id = $1"#,
        picture_id_1
    )
    .fetch_one(&mut *tx)
    .await?;

    let picture2 = sqlx::query!(
        r#"SELECT display_order FROM pictures WHERE id = $1"#,
        picture_id_2
    )
    .fetch_one(&mut *tx)
    .await?;

    // Swap display orders
    sqlx::query!(
        r#"UPDATE pictures SET display_order = $1 WHERE id = $2"#,
        picture2.display_order,
        picture_id_1
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"UPDATE pictures SET display_order = $1 WHERE id = $2"#,
        picture1.display_order,
        picture_id_2
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Reorder all pictures in a gallery (for drag-and-drop)
/// Takes a list of picture IDs in the desired order
pub async fn reorder_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
    picture_ids: &[i64],
) -> Result<(), sqlx::Error> {
    let mut tx = db.begin().await?;

    // Update display_order for each picture based on position in array
    for (index, picture_id) in picture_ids.iter().enumerate() {
        sqlx::query!(
            r#"
            UPDATE pictures
            SET display_order = $1
            WHERE id = $2 AND gallery_id = $3
            "#,
            index as i32,
            picture_id,
            gallery_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}
