//! Blog Mutation Queries
//!
//! Write operations for blog categories, tags, posts, taxonomies, and search analytics.
//! Uses stored procedures where available.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

// ============================================================================
// CATEGORY MUTATIONS
// ============================================================================

/// Parameters for creating a blog category
pub struct CreateCategoryParams {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: i32,
}

/// Create a new blog category using stored procedure
pub async fn category_create(
    db: &Pool<Postgres>,
    params: &CreateCategoryParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_create_blog_category($1, $2, $3, $4, $5) as "id!"
        "#,
        params.name,
        params.slug,
        params.description,
        params.parent_category_id,
        params.sort_order
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Parameters for updating a blog category
pub struct UpdateCategoryParams {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Update a blog category using stored procedure
pub async fn category_update(
    db: &Pool<Postgres>,
    category_id: i64,
    params: &UpdateCategoryParams,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_update_blog_category($1, $2, $3, $4, $5, $6, $7) as "success!"
        "#,
        category_id,
        params.name,
        params.slug,
        params.description,
        params.parent_category_id,
        params.sort_order,
        params.is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete (soft delete) a blog category using stored procedure
pub async fn category_delete(db: &Pool<Postgres>, category_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_delete_blog_category($1) as "success!"
        "#,
        category_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Hard delete a blog category (admin only, permanent)
pub async fn category_hard_delete(
    db: &Pool<Postgres>,
    category_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM blog_categories WHERE id = $1"#,
        category_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

// ============================================================================
// TAG MUTATIONS
// ============================================================================

/// Parameters for creating a blog tag
pub struct CreateTagParams {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
}

/// Create a new blog tag using stored procedure
pub async fn tag_create(db: &Pool<Postgres>, params: &CreateTagParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_create_blog_tag($1, $2, $3) as "id!"
        "#,
        params.name,
        params.slug,
        params.description
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Parameters for updating a blog tag
pub struct UpdateTagParams {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

/// Update a blog tag using stored procedure
pub async fn tag_update(
    db: &Pool<Postgres>,
    tag_id: i64,
    params: &UpdateTagParams,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_update_blog_tag($1, $2, $3, $4, $5) as "success!"
        "#,
        tag_id,
        params.name,
        params.slug,
        params.description,
        params.is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete (soft delete) a blog tag using stored procedure
pub async fn tag_delete(db: &Pool<Postgres>, tag_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_delete_blog_tag($1) as "success!"
        "#,
        tag_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Hard delete a blog tag (admin only, permanent)
pub async fn tag_hard_delete(db: &Pool<Postgres>, tag_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM blog_tags WHERE id = $1"#, tag_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

// ============================================================================
// POST MUTATIONS
// ============================================================================

/// Parameters for creating a blog post
pub struct CreatePostParams {
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub author_id: i64,
    pub featured_image_id: Option<i64>,
    pub status: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub is_featured: bool,
    pub allow_comments: bool,
}

/// Create a new blog post using stored procedure
pub async fn post_create(
    db: &Pool<Postgres>,
    params: &CreatePostParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_create_blog_post($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) as "id!"
        "#,
        params.title,
        params.slug,
        params.excerpt,
        params.content,
        params.author_id,
        params.featured_image_id,
        params.status,
        params.meta_title,
        params.meta_description,
        params.published_at,
        params.is_featured,
        params.allow_comments
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Parameters for updating a blog post
pub struct UpdatePostParams {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub excerpt: Option<String>,
    pub content: Option<String>,
    pub featured_image_id: Option<i64>,
    pub status: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub is_featured: Option<bool>,
    pub allow_comments: Option<bool>,
    pub is_active: Option<bool>,
}

/// Update a blog post using stored procedure
pub async fn post_update(
    db: &Pool<Postgres>,
    post_id: i64,
    params: &UpdatePostParams,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_update_blog_post($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) as "success!"
        "#,
        post_id,
        params.title,
        params.slug,
        params.excerpt,
        params.content,
        params.featured_image_id,
        params.status,
        params.meta_title,
        params.meta_description,
        params.published_at,
        params.is_featured,
        params.allow_comments,
        params.is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete (soft delete) a blog post using stored procedure
pub async fn post_delete(db: &Pool<Postgres>, post_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_delete_blog_post($1) as "success!"
        "#,
        post_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Hard delete a blog post (admin only, permanent)
pub async fn post_hard_delete(db: &Pool<Postgres>, post_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM blog_posts WHERE id = $1"#, post_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Set post categories (replaces existing) using stored procedure
pub async fn post_set_categories(
    db: &Pool<Postgres>,
    post_id: i64,
    category_ids: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        SELECT sp_set_blog_post_categories($1, $2)
        "#,
        post_id,
        category_ids
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Set post tags (replaces existing) using stored procedure
pub async fn post_set_tags(
    db: &Pool<Postgres>,
    post_id: i64,
    tag_ids: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        SELECT sp_set_blog_post_tags($1, $2)
        "#,
        post_id,
        tag_ids
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add single category to post
pub async fn post_add_category(
    db: &Pool<Postgres>,
    post_id: i64,
    category_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO blog_post_categories (post_id, category_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        post_id,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove single category from post
pub async fn post_remove_category(
    db: &Pool<Postgres>,
    post_id: i64,
    category_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM blog_post_categories
        WHERE post_id = $1 AND category_id = $2
        "#,
        post_id,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add single tag to post
pub async fn post_add_tag(
    db: &Pool<Postgres>,
    post_id: i64,
    tag_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO blog_post_tags (post_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        post_id,
        tag_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove single tag from post
pub async fn post_remove_tag(
    db: &Pool<Postgres>,
    post_id: i64,
    tag_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM blog_post_tags
        WHERE post_id = $1 AND tag_id = $2
        "#,
        post_id,
        tag_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update post status
pub async fn post_update_status(
    db: &Pool<Postgres>,
    post_id: i64,
    status: &str,
) -> Result<(), sqlx::Error> {
    // If transitioning to published, set published_at if not already set
    if status == "published" {
        sqlx::query!(
            r#"
            UPDATE blog_posts
            SET status = $1, published_at = COALESCE(published_at, NOW())
            WHERE id = $2
            "#,
            status,
            post_id
        )
        .execute(db)
        .await?;
    } else {
        sqlx::query!(
            r#"UPDATE blog_posts SET status = $1 WHERE id = $2"#,
            status,
            post_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}

/// Toggle post featured status
pub async fn post_toggle_featured(
    db: &Pool<Postgres>,
    post_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE blog_posts
        SET is_featured = NOT is_featured
        WHERE id = $1
        RETURNING is_featured
        "#,
        post_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.is_featured)
}

// ============================================================================
// TAXONOMY MUTATIONS
// ============================================================================

/// Parameters for creating a blog taxonomy
pub struct CreateTaxonomyParams {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    pub rule_logic: String,
    pub sort_order: i32,
}

/// Create a new blog taxonomy using stored procedure
pub async fn taxonomy_create(
    db: &Pool<Postgres>,
    params: &CreateTaxonomyParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_create_blog_taxonomy($1, $2, $3, $4, $5, $6, $7) as "id!"
        "#,
        params.name,
        params.slug,
        params.description,
        params.display_title,
        params.featured_image_id,
        params.rule_logic,
        params.sort_order
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Parameters for updating a blog taxonomy
pub struct UpdateTaxonomyParams {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    pub rule_logic: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Update a blog taxonomy using stored procedure
pub async fn taxonomy_update(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    params: &UpdateTaxonomyParams,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_update_blog_taxonomy($1, $2, $3, $4, $5, $6, $7, $8, $9) as "success!"
        "#,
        taxonomy_id,
        params.name,
        params.slug,
        params.description,
        params.display_title,
        params.featured_image_id,
        params.rule_logic,
        params.sort_order,
        params.is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete (soft delete) a blog taxonomy using stored procedure
pub async fn taxonomy_delete(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_delete_blog_taxonomy($1) as "success!"
        "#,
        taxonomy_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Hard delete a blog taxonomy (admin only, permanent)
pub async fn taxonomy_hard_delete(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM blog_taxonomies WHERE id = $1"#,
        taxonomy_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Parameters for setting taxonomy rules
pub struct SetTaxonomyRulesParams {
    pub required_tag_ids: Option<Vec<i64>>,
    pub required_category_ids: Option<Vec<i64>>,
    pub explicit_post_ids: Option<Vec<i64>>,
}

/// Set taxonomy rules using stored procedure
pub async fn taxonomy_set_rules(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    params: &SetTaxonomyRulesParams,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        SELECT sp_set_taxonomy_rules($1, $2, $3, $4)
        "#,
        taxonomy_id,
        params.required_tag_ids.as_deref(),
        params.required_category_ids.as_deref(),
        params.explicit_post_ids.as_deref()
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add required tag to taxonomy
pub async fn taxonomy_add_required_tag(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    tag_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO blog_taxonomy_required_tags (taxonomy_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        taxonomy_id,
        tag_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove required tag from taxonomy
pub async fn taxonomy_remove_required_tag(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    tag_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM blog_taxonomy_required_tags
        WHERE taxonomy_id = $1 AND tag_id = $2
        "#,
        taxonomy_id,
        tag_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add required category to taxonomy
pub async fn taxonomy_add_required_category(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    category_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO blog_taxonomy_required_categories (taxonomy_id, category_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        taxonomy_id,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove required category from taxonomy
pub async fn taxonomy_remove_required_category(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    category_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM blog_taxonomy_required_categories
        WHERE taxonomy_id = $1 AND category_id = $2
        "#,
        taxonomy_id,
        category_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add explicit post to taxonomy
pub async fn taxonomy_add_explicit_post(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    post_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO blog_taxonomy_explicit_posts (taxonomy_id, post_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        taxonomy_id,
        post_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove explicit post from taxonomy
pub async fn taxonomy_remove_explicit_post(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
    post_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM blog_taxonomy_explicit_posts
        WHERE taxonomy_id = $1 AND post_id = $2
        "#,
        taxonomy_id,
        post_id
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================================================
// SEARCH ANALYTICS MUTATIONS
// ============================================================================

/// Parameters for logging a blog search
pub struct LogSearchParams {
    pub query: String,
    pub results_count: i32,
    pub search_scope: String,
    pub user_id: Option<i64>,
    pub ip_address: Option<String>, // IP address as string (e.g., "192.168.1.1")
    pub user_agent: Option<String>,
}

/// Log a blog search
/// Note: Uses unchecked query to handle INET type without requiring ipnetwork feature
pub async fn search_log(
    db: &Pool<Postgres>,
    params: &LogSearchParams,
) -> Result<i64, sqlx::Error> {
    // Normalize query for analytics (lowercase, trimmed, limited length)
    let query_normalized: String = params
        .query
        .to_lowercase()
        .trim()
        .chars()
        .take(255)
        .collect();

    // Use unchecked query to avoid sqlx requiring ipnetwork feature for INET type
    let row: (i64,) = sqlx::query_as(
        r#"
        INSERT INTO blog_search_analytics (
            query, query_normalized, results_count, search_scope,
            user_id, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6::inet, $7)
        RETURNING id
        "#,
    )
    .bind(&params.query)
    .bind(&query_normalized)
    .bind(params.results_count)
    .bind(&params.search_scope)
    .bind(params.user_id)
    .bind(&params.ip_address)
    .bind(&params.user_agent)
    .fetch_one(db)
    .await?;

    Ok(row.0)
}

/// Log a search click using stored procedure
pub async fn search_log_click(
    db: &Pool<Postgres>,
    search_id: i64,
    post_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT sp_log_blog_search_click($1, $2) as "success!"
        "#,
        search_id,
        post_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete old search analytics (cleanup job)
pub async fn search_analytics_cleanup(
    db: &Pool<Postgres>,
    older_than_days: i32,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM blog_search_analytics
        WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
        "#,
        older_than_days.to_string()
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
