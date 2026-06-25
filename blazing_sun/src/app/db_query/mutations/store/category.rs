//! Store Category Mutation Queries
//!
//! Write operations for the store_categories table.

use sqlx::{Pool, Postgres};

/// Parameters for creating a new store category
pub struct CreateCategoryParams {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: i32,
    pub is_active: bool,
}

/// Parameters for updating a store category
pub struct UpdateCategoryParams {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Create a new category
pub async fn create(db: &Pool<Postgres>, params: &CreateCategoryParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_categories (name, slug, description, cover_image_id, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        params.name,
        params.slug,
        params.description,
        params.cover_image_id,
        params.display_order,
        params.is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update category name
pub async fn update_name(
    db: &Pool<Postgres>,
    category_id: i64,
    name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET name = $1 WHERE id = $2"#,
        name,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category slug
pub async fn update_slug(
    db: &Pool<Postgres>,
    category_id: i64,
    slug: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET slug = $1 WHERE id = $2"#,
        slug,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category description
pub async fn update_description(
    db: &Pool<Postgres>,
    category_id: i64,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET description = $1 WHERE id = $2"#,
        description,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category cover image
pub async fn update_cover_image(
    db: &Pool<Postgres>,
    category_id: i64,
    cover_image_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET cover_image_id = $1 WHERE id = $2"#,
        cover_image_id,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category display order
pub async fn update_display_order(
    db: &Pool<Postgres>,
    category_id: i64,
    display_order: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET display_order = $1 WHERE id = $2"#,
        display_order,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category active status
pub async fn update_is_active(
    db: &Pool<Postgres>,
    category_id: i64,
    is_active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_categories SET is_active = $1 WHERE id = $2"#,
        is_active,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update category (full update with optional fields)
pub async fn update(
    db: &Pool<Postgres>,
    category_id: i64,
    params: &UpdateCategoryParams,
) -> Result<(), sqlx::Error> {
    if let Some(ref name) = params.name {
        update_name(db, category_id, name).await?;
    }

    if let Some(ref slug) = params.slug {
        update_slug(db, category_id, slug).await?;
    }

    if let Some(ref description) = params.description {
        update_description(db, category_id, Some(description)).await?;
    }

    if let Some(cover_image_id) = params.cover_image_id {
        update_cover_image(db, category_id, Some(cover_image_id)).await?;
    }

    if let Some(display_order) = params.display_order {
        update_display_order(db, category_id, display_order).await?;
    }

    if let Some(is_active) = params.is_active {
        update_is_active(db, category_id, is_active).await?;
    }

    Ok(())
}

/// Delete a category
/// Note: Products with this category will have category_id set to NULL (ON DELETE SET NULL)
pub async fn delete(db: &Pool<Postgres>, category_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM store_categories WHERE id = $1"#, category_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Swap display order between two categories (for reordering)
pub async fn swap_display_order(
    db: &Pool<Postgres>,
    category_id_1: i64,
    category_id_2: i64,
) -> Result<(), sqlx::Error> {
    let mut tx = db.begin().await?;

    // Get current display orders
    let cat1 = sqlx::query!(
        r#"SELECT display_order FROM store_categories WHERE id = $1"#,
        category_id_1
    )
    .fetch_one(&mut *tx)
    .await?;

    let cat2 = sqlx::query!(
        r#"SELECT display_order FROM store_categories WHERE id = $1"#,
        category_id_2
    )
    .fetch_one(&mut *tx)
    .await?;

    // Swap display orders
    sqlx::query!(
        r#"UPDATE store_categories SET display_order = $1 WHERE id = $2"#,
        cat2.display_order,
        category_id_1
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"UPDATE store_categories SET display_order = $1 WHERE id = $2"#,
        cat1.display_order,
        category_id_2
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Reorder categories (for drag-and-drop)
/// Takes a list of category IDs in the desired order
pub async fn reorder(db: &Pool<Postgres>, category_ids: &[i64]) -> Result<(), sqlx::Error> {
    let mut tx = db.begin().await?;

    for (index, category_id) in category_ids.iter().enumerate() {
        sqlx::query!(
            r#"UPDATE store_categories SET display_order = $1 WHERE id = $2"#,
            index as i32,
            category_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}
