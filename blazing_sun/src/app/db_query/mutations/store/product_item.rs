//! Store Product Item Mutation Queries
//!
//! Write operations for the store_product_items table.

use sqlx::{Pool, Postgres};

/// Parameters for adding a picture to a product
pub struct AddPictureToProductParams {
    pub product_id: i64,
    pub picture_id: i64,
    pub display_order: i32,
}

/// Parameters for adding a gallery to a product
pub struct AddGalleryToProductParams {
    pub product_id: i64,
    pub gallery_id: i64,
    pub display_order: i32,
}

/// Add a picture item to a product
pub async fn add_picture(
    db: &Pool<Postgres>,
    params: &AddPictureToProductParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_product_items (product_id, item_type, picture_id, display_order)
        VALUES ($1, 'picture', $2, $3)
        RETURNING id
        "#,
        params.product_id,
        params.picture_id,
        params.display_order
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Add a gallery item to a product
pub async fn add_gallery(
    db: &Pool<Postgres>,
    params: &AddGalleryToProductParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_product_items (product_id, item_type, gallery_id, display_order)
        VALUES ($1, 'gallery', $2, $3)
        RETURNING id
        "#,
        params.product_id,
        params.gallery_id,
        params.display_order
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Remove an item from a product by item ID
pub async fn remove(db: &Pool<Postgres>, item_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM store_product_items WHERE id = $1"#, item_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Remove a picture from a product
pub async fn remove_picture_from_product(
    db: &Pool<Postgres>,
    product_id: i64,
    picture_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM store_product_items WHERE product_id = $1 AND picture_id = $2"#,
        product_id,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Remove a gallery from a product
pub async fn remove_gallery_from_product(
    db: &Pool<Postgres>,
    product_id: i64,
    gallery_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM store_product_items WHERE product_id = $1 AND gallery_id = $2"#,
        product_id,
        gallery_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Remove all items from a product
pub async fn remove_all_from_product(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM store_product_items WHERE product_id = $1"#,
        product_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Update item display order
pub async fn update_display_order(
    db: &Pool<Postgres>,
    item_id: i64,
    display_order: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_product_items SET display_order = $1 WHERE id = $2"#,
        display_order,
        item_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Reorder items in a product (for drag-and-drop)
/// Takes a list of item IDs in the desired order
pub async fn reorder(
    db: &Pool<Postgres>,
    product_id: i64,
    item_ids: &[i64],
) -> Result<(), sqlx::Error> {
    let mut tx = db.begin().await?;

    for (index, item_id) in item_ids.iter().enumerate() {
        sqlx::query!(
            r#"
            UPDATE store_product_items
            SET display_order = $1
            WHERE id = $2 AND product_id = $3
            "#,
            index as i32,
            item_id,
            product_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

/// Add multiple pictures to a product at once
pub async fn add_pictures_bulk(
    db: &Pool<Postgres>,
    product_id: i64,
    picture_ids: &[i64],
    starting_order: i32,
) -> Result<Vec<i64>, sqlx::Error> {
    let mut tx = db.begin().await?;
    let mut inserted_ids = Vec::new();

    for (index, picture_id) in picture_ids.iter().enumerate() {
        let result = sqlx::query!(
            r#"
            INSERT INTO store_product_items (product_id, item_type, picture_id, display_order)
            VALUES ($1, 'picture', $2, $3)
            ON CONFLICT (product_id, picture_id) DO NOTHING
            RETURNING id
            "#,
            product_id,
            picture_id,
            starting_order + index as i32
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = result {
            inserted_ids.push(row.id);
        }
    }

    tx.commit().await?;

    Ok(inserted_ids)
}

/// Replace all items in a product with new pictures
/// Useful for updating single_image products
pub async fn replace_with_pictures(
    db: &Pool<Postgres>,
    product_id: i64,
    picture_ids: &[i64],
) -> Result<Vec<i64>, sqlx::Error> {
    let mut tx = db.begin().await?;

    // Remove all existing items
    sqlx::query!(
        r#"DELETE FROM store_product_items WHERE product_id = $1"#,
        product_id
    )
    .execute(&mut *tx)
    .await?;

    // Add new items
    let mut inserted_ids = Vec::new();
    for (index, picture_id) in picture_ids.iter().enumerate() {
        let result = sqlx::query!(
            r#"
            INSERT INTO store_product_items (product_id, item_type, picture_id, display_order)
            VALUES ($1, 'picture', $2, $3)
            RETURNING id
            "#,
            product_id,
            picture_id,
            index as i32
        )
        .fetch_one(&mut *tx)
        .await?;

        inserted_ids.push(result.id);
    }

    tx.commit().await?;

    Ok(inserted_ids)
}
