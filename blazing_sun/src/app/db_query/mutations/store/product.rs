//! Store Product Mutation Queries
//!
//! Write operations for the store_products table.

use chrono::NaiveDate;
use sqlx::{Pool, Postgres};

/// Parameters for creating a new store product
pub struct CreateProductParams {
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_active: bool,
    pub is_featured: bool,
}

/// Parameters for updating a store product
pub struct UpdateProductParams {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub price_cents: Option<i64>,
    pub product_type: Option<String>,
    pub category_id: Option<i64>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_active: Option<bool>,
    pub is_featured: Option<bool>,
}

/// Create a new product
pub async fn create(db: &Pool<Postgres>, params: &CreateProductParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_products (
            title, slug, description, price_cents, product_type, category_id, cover_image_id,
            author_name, city, country, region, nearest_mountain, nearest_river, natural_park,
            altitude_meters, season, weather_conditions, camera_info, date_taken,
            latitude, longitude, tags, is_active, is_featured
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING id
        "#,
        params.title,
        params.slug,
        params.description,
        params.price_cents,
        params.product_type,
        params.category_id,
        params.cover_image_id,
        params.author_name,
        params.city,
        params.country,
        params.region,
        params.nearest_mountain,
        params.nearest_river,
        params.natural_park,
        params.altitude_meters,
        params.season,
        params.weather_conditions,
        params.camera_info,
        params.date_taken,
        params.latitude,
        params.longitude,
        params.tags.as_deref(),
        params.is_active,
        params.is_featured
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update product title
pub async fn update_title(
    db: &Pool<Postgres>,
    product_id: i64,
    title: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET title = $1 WHERE id = $2"#,
        title,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product slug
pub async fn update_slug(
    db: &Pool<Postgres>,
    product_id: i64,
    slug: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET slug = $1 WHERE id = $2"#,
        slug,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product description
pub async fn update_description(
    db: &Pool<Postgres>,
    product_id: i64,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET description = $1 WHERE id = $2"#,
        description,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product price
pub async fn update_price(
    db: &Pool<Postgres>,
    product_id: i64,
    price_cents: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET price_cents = $1 WHERE id = $2"#,
        price_cents,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product category
pub async fn update_category(
    db: &Pool<Postgres>,
    product_id: i64,
    category_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET category_id = $1 WHERE id = $2"#,
        category_id,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product cover image
pub async fn update_cover_image(
    db: &Pool<Postgres>,
    product_id: i64,
    cover_image_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET cover_image_id = $1 WHERE id = $2"#,
        cover_image_id,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product tags
pub async fn update_tags(
    db: &Pool<Postgres>,
    product_id: i64,
    tags: Option<&[String]>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET tags = $1 WHERE id = $2"#,
        tags,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product location
pub async fn update_location(
    db: &Pool<Postgres>,
    product_id: i64,
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET latitude = $1, longitude = $2 WHERE id = $3"#,
        latitude,
        longitude,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product active status
pub async fn update_is_active(
    db: &Pool<Postgres>,
    product_id: i64,
    is_active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET is_active = $1 WHERE id = $2"#,
        is_active,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product featured status
pub async fn update_is_featured(
    db: &Pool<Postgres>,
    product_id: i64,
    is_featured: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET is_featured = $1 WHERE id = $2"#,
        is_featured,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark product as sold
pub async fn mark_as_sold(db: &Pool<Postgres>, product_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_products SET is_sold = TRUE WHERE id = $1"#,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product metadata (rich fields)
pub async fn update_metadata(
    db: &Pool<Postgres>,
    product_id: i64,
    author_name: Option<&str>,
    city: Option<&str>,
    country: Option<&str>,
    region: Option<&str>,
    nearest_mountain: Option<&str>,
    nearest_river: Option<&str>,
    natural_park: Option<&str>,
    altitude_meters: Option<i32>,
    season: Option<&str>,
    weather_conditions: Option<&str>,
    camera_info: Option<&str>,
    date_taken: Option<NaiveDate>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE store_products SET
            author_name = $1,
            city = $2,
            country = $3,
            region = $4,
            nearest_mountain = $5,
            nearest_river = $6,
            natural_park = $7,
            altitude_meters = $8,
            season = $9,
            weather_conditions = $10,
            camera_info = $11,
            date_taken = $12
        WHERE id = $13
        "#,
        author_name,
        city,
        country,
        region,
        nearest_mountain,
        nearest_river,
        natural_park,
        altitude_meters,
        season,
        weather_conditions,
        camera_info,
        date_taken,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update product (full update with optional fields)
pub async fn update(
    db: &Pool<Postgres>,
    product_id: i64,
    params: &UpdateProductParams,
) -> Result<(), sqlx::Error> {
    if let Some(ref title) = params.title {
        update_title(db, product_id, title).await?;
    }

    if let Some(ref slug) = params.slug {
        update_slug(db, product_id, slug).await?;
    }

    if let Some(ref description) = params.description {
        update_description(db, product_id, Some(description)).await?;
    }

    if let Some(price_cents) = params.price_cents {
        update_price(db, product_id, price_cents).await?;
    }

    if let Some(category_id) = params.category_id {
        update_category(db, product_id, Some(category_id)).await?;
    }

    if let Some(cover_image_id) = params.cover_image_id {
        update_cover_image(db, product_id, Some(cover_image_id)).await?;
    }

    if let Some(ref tags) = params.tags {
        update_tags(db, product_id, Some(tags.as_slice())).await?;
    }

    if params.latitude.is_some() || params.longitude.is_some() {
        update_location(db, product_id, params.latitude, params.longitude).await?;
    }

    if let Some(is_active) = params.is_active {
        update_is_active(db, product_id, is_active).await?;
    }

    if let Some(is_featured) = params.is_featured {
        update_is_featured(db, product_id, is_featured).await?;
    }

    // Update metadata fields if any are provided
    if params.author_name.is_some()
        || params.city.is_some()
        || params.country.is_some()
        || params.region.is_some()
        || params.nearest_mountain.is_some()
        || params.nearest_river.is_some()
        || params.natural_park.is_some()
        || params.altitude_meters.is_some()
        || params.season.is_some()
        || params.weather_conditions.is_some()
        || params.camera_info.is_some()
        || params.date_taken.is_some()
    {
        update_metadata(
            db,
            product_id,
            params.author_name.as_deref(),
            params.city.as_deref(),
            params.country.as_deref(),
            params.region.as_deref(),
            params.nearest_mountain.as_deref(),
            params.nearest_river.as_deref(),
            params.natural_park.as_deref(),
            params.altitude_meters,
            params.season.as_deref(),
            params.weather_conditions.as_deref(),
            params.camera_info.as_deref(),
            params.date_taken,
        )
        .await?;
    }

    Ok(())
}

/// Delete a product
/// Note: This will cascade delete all product items and affect purchases
pub async fn delete(db: &Pool<Postgres>, product_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM store_products WHERE id = $1"#, product_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}
