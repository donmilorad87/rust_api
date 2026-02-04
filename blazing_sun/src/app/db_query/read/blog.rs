//! Blog Read Queries
//!
//! Read operations for blog categories, tags, posts, taxonomies, and search analytics.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{Pool, Postgres};

// ============================================================================
// CATEGORY TYPES AND QUERIES
// ============================================================================

/// Blog category record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogCategory {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog category tree node (from sp_get_blog_category_tree)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogCategoryTreeNode {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: i32,
    pub depth: i32,
    pub post_count: i64,
}

/// Get all categories
pub async fn categories_get_all(db: &Pool<Postgres>) -> Result<Vec<BlogCategory>, sqlx::Error> {
    sqlx::query_as!(
        BlogCategory,
        r#"
        SELECT id, name, slug, description, parent_category_id, sort_order, is_active, created_at, updated_at
        FROM blog_categories
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all categories including inactive (for admin)
pub async fn categories_get_all_admin(
    db: &Pool<Postgres>,
) -> Result<Vec<BlogCategory>, sqlx::Error> {
    sqlx::query_as!(
        BlogCategory,
        r#"
        SELECT id, name, slug, description, parent_category_id, sort_order, is_active, created_at, updated_at
        FROM blog_categories
        ORDER BY sort_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get category by ID
pub async fn category_get_by_id(
    db: &Pool<Postgres>,
    category_id: i64,
) -> Result<BlogCategory, sqlx::Error> {
    sqlx::query_as!(
        BlogCategory,
        r#"
        SELECT id, name, slug, description, parent_category_id, sort_order, is_active, created_at, updated_at
        FROM blog_categories
        WHERE id = $1
        "#,
        category_id
    )
    .fetch_one(db)
    .await
}

/// Get category by slug
pub async fn category_get_by_slug(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<BlogCategory, sqlx::Error> {
    sqlx::query_as!(
        BlogCategory,
        r#"
        SELECT id, name, slug, description, parent_category_id, sort_order, is_active, created_at, updated_at
        FROM blog_categories
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get category tree (hierarchical with post counts) using stored procedure
pub async fn categories_get_tree(
    db: &Pool<Postgres>,
) -> Result<Vec<BlogCategoryTreeNode>, sqlx::Error> {
    sqlx::query_as!(
        BlogCategoryTreeNode,
        r#"
        SELECT
            id as "id!",
            name as "name!",
            slug as "slug!",
            description,
            parent_category_id,
            sort_order as "sort_order!",
            depth as "depth!",
            post_count as "post_count!"
        FROM sp_get_blog_category_tree()
        "#
    )
    .fetch_all(db)
    .await
}

/// Check if category slug exists
pub async fn category_slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_categories WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if category slug exists excluding specific category
pub async fn category_slug_exists_except(
    db: &Pool<Postgres>,
    slug: &str,
    category_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_categories WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        category_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total categories
pub async fn categories_count(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM blog_categories WHERE is_active = TRUE"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

// ============================================================================
// TAG TYPES AND QUERIES
// ============================================================================

/// Blog tag record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogTag {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Tag cloud item (from sp_get_blog_tag_cloud)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCloudItem {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub post_count: i64,
}

/// Get all tags
pub async fn tags_get_all(db: &Pool<Postgres>) -> Result<Vec<BlogTag>, sqlx::Error> {
    sqlx::query_as!(
        BlogTag,
        r#"
        SELECT id, name, slug, description, is_active, created_at, updated_at
        FROM blog_tags
        WHERE is_active = TRUE
        ORDER BY name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all tags including inactive (for admin)
pub async fn tags_get_all_admin(db: &Pool<Postgres>) -> Result<Vec<BlogTag>, sqlx::Error> {
    sqlx::query_as!(
        BlogTag,
        r#"
        SELECT id, name, slug, description, is_active, created_at, updated_at
        FROM blog_tags
        ORDER BY name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get tag by ID
pub async fn tag_get_by_id(db: &Pool<Postgres>, tag_id: i64) -> Result<BlogTag, sqlx::Error> {
    sqlx::query_as!(
        BlogTag,
        r#"
        SELECT id, name, slug, description, is_active, created_at, updated_at
        FROM blog_tags
        WHERE id = $1
        "#,
        tag_id
    )
    .fetch_one(db)
    .await
}

/// Get tag by slug
pub async fn tag_get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<BlogTag, sqlx::Error> {
    sqlx::query_as!(
        BlogTag,
        r#"
        SELECT id, name, slug, description, is_active, created_at, updated_at
        FROM blog_tags
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get tag cloud (tags with post counts) using stored procedure
pub async fn tags_get_cloud(
    db: &Pool<Postgres>,
    limit: i32,
) -> Result<Vec<TagCloudItem>, sqlx::Error> {
    sqlx::query_as!(
        TagCloudItem,
        r#"
        SELECT
            id as "id!",
            name as "name!",
            slug as "slug!",
            post_count as "post_count!"
        FROM sp_get_blog_tag_cloud($1)
        "#,
        limit
    )
    .fetch_all(db)
    .await
}

/// Check if tag slug exists
pub async fn tag_slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_tags WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if tag slug exists excluding specific tag
pub async fn tag_slug_exists_except(db: &Pool<Postgres>, slug: &str, tag_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_tags WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        tag_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total tags
pub async fn tags_count(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result =
        sqlx::query_scalar!(r#"SELECT COUNT(*) as "count!" FROM blog_tags WHERE is_active = TRUE"#)
            .fetch_one(db)
            .await?;
    Ok(result)
}

// ============================================================================
// POST TYPES AND QUERIES
// ============================================================================

/// Blog post record (basic)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogPost {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image_id: Option<i64>,
    pub author_id: i64,
    pub status: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog post list item (from stored procedures)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogPostListItem {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub featured_image_id: Option<i64>,
    pub author_id: i64,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub total_count: i64,
}

/// Blog post list item with featured flag (from sp_get_published_posts)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogPostListItemFeatured {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub featured_image_id: Option<i64>,
    pub author_id: i64,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub total_count: i64,
}

/// Blog post detail (from sp_get_blog_post_by_slug)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogPostDetail {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image_id: Option<i64>,
    pub author_id: i64,
    pub author_name: String,
    pub status: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub categories: JsonValue,
    pub tags: JsonValue,
}

/// Admin post list item (from sp_admin_get_blog_posts)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminPostListItem {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub status: String,
    pub author_id: i64,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub total_count: i64,
}

/// Get all posts (basic)
pub async fn posts_get_all(
    db: &Pool<Postgres>,
    limit: i64,
    offset: i64,
) -> Result<Vec<BlogPost>, sqlx::Error> {
    sqlx::query_as!(
        BlogPost,
        r#"
        SELECT id, title, slug, excerpt, content, featured_image_id, author_id, status,
               meta_title, meta_description, published_at, view_count, is_featured,
               allow_comments, is_active, created_at, updated_at
        FROM blog_posts
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get post by ID
pub async fn post_get_by_id(db: &Pool<Postgres>, post_id: i64) -> Result<BlogPost, sqlx::Error> {
    sqlx::query_as!(
        BlogPost,
        r#"
        SELECT id, title, slug, excerpt, content, featured_image_id, author_id, status,
               meta_title, meta_description, published_at, view_count, is_featured,
               allow_comments, is_active, created_at, updated_at
        FROM blog_posts
        WHERE id = $1
        "#,
        post_id
    )
    .fetch_one(db)
    .await
}

/// Get post by slug (basic)
pub async fn post_get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<BlogPost, sqlx::Error> {
    sqlx::query_as!(
        BlogPost,
        r#"
        SELECT id, title, slug, excerpt, content, featured_image_id, author_id, status,
               meta_title, meta_description, published_at, view_count, is_featured,
               allow_comments, is_active, created_at, updated_at
        FROM blog_posts
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get post detail by slug (with categories and tags) using stored procedure
pub async fn post_get_detail_by_slug(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<BlogPostDetail, sqlx::Error> {
    sqlx::query_as!(
        BlogPostDetail,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            content as "content!",
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            status as "status!",
            meta_title,
            meta_description,
            published_at,
            view_count as "view_count!",
            is_featured as "is_featured!",
            allow_comments as "allow_comments!",
            created_at as "created_at!",
            updated_at as "updated_at!",
            categories as "categories!",
            tags as "tags!"
        FROM sp_get_blog_post_by_slug($1)
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get published posts with pagination using stored procedure
pub async fn posts_get_published(
    db: &Pool<Postgres>,
    page: i32,
    per_page: i32,
    featured_only: bool,
) -> Result<Vec<BlogPostListItemFeatured>, sqlx::Error> {
    sqlx::query_as!(
        BlogPostListItemFeatured,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            is_featured as "is_featured!",
            total_count as "total_count!"
        FROM sp_get_published_posts($1, $2, $3)
        "#,
        page,
        per_page,
        featured_only
    )
    .fetch_all(db)
    .await
}

/// Get posts by category slug using stored procedure
pub async fn posts_get_by_category(
    db: &Pool<Postgres>,
    category_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error> {
    sqlx::query_as!(
        BlogPostListItem,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            total_count as "total_count!"
        FROM sp_get_posts_by_category($1, $2, $3)
        "#,
        category_slug,
        page,
        per_page
    )
    .fetch_all(db)
    .await
}

/// Get posts by tag slug using stored procedure
pub async fn posts_get_by_tag(
    db: &Pool<Postgres>,
    tag_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error> {
    sqlx::query_as!(
        BlogPostListItem,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            total_count as "total_count!"
        FROM sp_get_posts_by_tag($1, $2, $3)
        "#,
        tag_slug,
        page,
        per_page
    )
    .fetch_all(db)
    .await
}

/// Archive data item (year/month with post count)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveItem {
    pub year: i32,
    pub month: i32,
    pub post_count: i64,
}

/// Get archive data (years and months with post counts) using stored procedure
pub async fn posts_get_archive_data(db: &Pool<Postgres>) -> Result<Vec<ArchiveItem>, sqlx::Error> {
    sqlx::query_as!(
        ArchiveItem,
        r#"
        SELECT
            year as "year!",
            month as "month!",
            post_count as "post_count!"
        FROM sp_get_blog_archive_data()
        "#
    )
    .fetch_all(db)
    .await
}

/// Get posts by archive period (year/month) using stored procedure
pub async fn posts_get_by_archive(
    db: &Pool<Postgres>,
    year: i32,
    month: i32,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error> {
    sqlx::query_as!(
        BlogPostListItem,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            total_count as "total_count!"
        FROM sp_get_posts_by_archive($1, $2, $3, $4)
        "#,
        year,
        month,
        page,
        per_page
    )
    .fetch_all(db)
    .await
}

/// Get admin posts with filters using stored procedure
pub async fn posts_get_admin(
    db: &Pool<Postgres>,
    page: i32,
    per_page: i32,
    status: Option<&str>,
    search: Option<&str>,
) -> Result<Vec<AdminPostListItem>, sqlx::Error> {
    sqlx::query_as!(
        AdminPostListItem,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            status as "status!",
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            is_featured as "is_featured!",
            is_active as "is_active!",
            created_at as "created_at!",
            updated_at as "updated_at!",
            total_count as "total_count!"
        FROM sp_admin_get_blog_posts($1, $2, $3, $4)
        "#,
        page,
        per_page,
        status,
        search
    )
    .fetch_all(db)
    .await
}

/// Check if post slug exists
pub async fn post_slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_posts WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if post slug exists excluding specific post
pub async fn post_slug_exists_except(db: &Pool<Postgres>, slug: &str, post_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_posts WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        post_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total posts
pub async fn posts_count(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result =
        sqlx::query_scalar!(r#"SELECT COUNT(*) as "count!" FROM blog_posts WHERE is_active = TRUE"#)
            .fetch_one(db)
            .await?;
    Ok(result)
}

/// Count published posts
pub async fn posts_count_published(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM blog_posts WHERE status = 'published' AND is_active = TRUE"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Increment post view count
pub async fn post_increment_view_count(
    db: &Pool<Postgres>,
    post_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1"#,
        post_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Get post categories (for editing)
pub async fn post_get_categories(
    db: &Pool<Postgres>,
    post_id: i64,
) -> Result<Vec<i64>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT category_id FROM blog_post_categories WHERE post_id = $1"#,
        post_id
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|r| r.category_id).collect())
}

/// Get post tags (for editing)
pub async fn post_get_tags(db: &Pool<Postgres>, post_id: i64) -> Result<Vec<i64>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT tag_id FROM blog_post_tags WHERE post_id = $1"#,
        post_id
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|r| r.tag_id).collect())
}

// ============================================================================
// TAXONOMY TYPES AND QUERIES
// ============================================================================

/// Blog taxonomy record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogTaxonomy {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    pub rule_logic: String,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Taxonomy with rules (expanded)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogTaxonomyWithRules {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    pub rule_logic: String,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub required_tag_ids: Vec<i64>,
    pub required_category_ids: Vec<i64>,
    pub explicit_post_ids: Vec<i64>,
}

/// Get all taxonomies
pub async fn taxonomies_get_all(db: &Pool<Postgres>) -> Result<Vec<BlogTaxonomy>, sqlx::Error> {
    sqlx::query_as!(
        BlogTaxonomy,
        r#"
        SELECT id, name, slug, description, display_title, featured_image_id, rule_logic,
               sort_order, is_active, created_at, updated_at
        FROM blog_taxonomies
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all taxonomies including inactive (for admin)
pub async fn taxonomies_get_all_admin(
    db: &Pool<Postgres>,
) -> Result<Vec<BlogTaxonomy>, sqlx::Error> {
    sqlx::query_as!(
        BlogTaxonomy,
        r#"
        SELECT id, name, slug, description, display_title, featured_image_id, rule_logic,
               sort_order, is_active, created_at, updated_at
        FROM blog_taxonomies
        ORDER BY sort_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get taxonomy by ID
pub async fn taxonomy_get_by_id(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
) -> Result<BlogTaxonomy, sqlx::Error> {
    sqlx::query_as!(
        BlogTaxonomy,
        r#"
        SELECT id, name, slug, description, display_title, featured_image_id, rule_logic,
               sort_order, is_active, created_at, updated_at
        FROM blog_taxonomies
        WHERE id = $1
        "#,
        taxonomy_id
    )
    .fetch_one(db)
    .await
}

/// Get taxonomy by slug
pub async fn taxonomy_get_by_slug(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<BlogTaxonomy, sqlx::Error> {
    sqlx::query_as!(
        BlogTaxonomy,
        r#"
        SELECT id, name, slug, description, display_title, featured_image_id, rule_logic,
               sort_order, is_active, created_at, updated_at
        FROM blog_taxonomies
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get taxonomy by ID with rules
pub async fn taxonomy_get_by_id_with_rules(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
) -> Result<BlogTaxonomyWithRules, sqlx::Error> {
    let taxonomy = taxonomy_get_by_id(db, taxonomy_id).await?;

    let required_tag_ids = sqlx::query!(
        r#"SELECT tag_id FROM blog_taxonomy_required_tags WHERE taxonomy_id = $1"#,
        taxonomy_id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|r| r.tag_id)
    .collect();

    let required_category_ids = sqlx::query!(
        r#"SELECT category_id FROM blog_taxonomy_required_categories WHERE taxonomy_id = $1"#,
        taxonomy_id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|r| r.category_id)
    .collect();

    let explicit_post_ids = sqlx::query!(
        r#"SELECT post_id FROM blog_taxonomy_explicit_posts WHERE taxonomy_id = $1"#,
        taxonomy_id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|r| r.post_id)
    .collect();

    Ok(BlogTaxonomyWithRules {
        id: taxonomy.id,
        name: taxonomy.name,
        slug: taxonomy.slug,
        description: taxonomy.description,
        display_title: taxonomy.display_title,
        featured_image_id: taxonomy.featured_image_id,
        rule_logic: taxonomy.rule_logic,
        sort_order: taxonomy.sort_order,
        is_active: taxonomy.is_active,
        created_at: taxonomy.created_at,
        updated_at: taxonomy.updated_at,
        required_tag_ids,
        required_category_ids,
        explicit_post_ids,
    })
}

/// Get posts by taxonomy slug using stored procedure
pub async fn taxonomy_get_posts(
    db: &Pool<Postgres>,
    taxonomy_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error> {
    sqlx::query_as!(
        BlogPostListItem,
        r#"
        SELECT
            id as "id!",
            title as "title!",
            slug as "slug!",
            excerpt,
            featured_image_id,
            author_id as "author_id!",
            author_name as "author_name!",
            published_at,
            view_count as "view_count!",
            total_count as "total_count!"
        FROM sp_get_taxonomy_posts($1, $2, $3)
        "#,
        taxonomy_slug,
        page,
        per_page
    )
    .fetch_all(db)
    .await
}

/// Check if taxonomy slug exists
pub async fn taxonomy_slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_taxonomies WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if taxonomy slug exists excluding specific taxonomy
pub async fn taxonomy_slug_exists_except(
    db: &Pool<Postgres>,
    slug: &str,
    taxonomy_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM blog_taxonomies WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        taxonomy_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total taxonomies
pub async fn taxonomies_count(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM blog_taxonomies WHERE is_active = TRUE"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

// ============================================================================
// SEARCH ANALYTICS TYPES AND QUERIES
// ============================================================================

/// Search analytics summary item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchAnalyticsSummary {
    pub query_normalized: String,
    pub search_count: i64,
    pub avg_results: Option<f64>,
    pub zero_results_count: i64,
    pub click_count: i64,
    pub click_rate: Option<f64>,
}

/// Zero result search item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroResultSearch {
    pub query_normalized: String,
    pub search_count: i64,
    pub last_searched: DateTime<Utc>,
}

/// Get search analytics summary using stored procedure
pub async fn search_analytics_get_summary(
    db: &Pool<Postgres>,
    days: i32,
    limit: i32,
) -> Result<Vec<SearchAnalyticsSummary>, sqlx::Error> {
    // Cast NUMERIC to FLOAT8 in SQL to avoid needing bigdecimal feature
    sqlx::query_as!(
        SearchAnalyticsSummary,
        r#"
        SELECT
            query_normalized as "query_normalized!",
            search_count as "search_count!",
            avg_results::float8 as "avg_results: f64",
            zero_results_count as "zero_results_count!",
            click_count as "click_count!",
            click_rate::float8 as "click_rate: f64"
        FROM sp_get_blog_search_analytics_summary($1, $2)
        "#,
        days,
        limit
    )
    .fetch_all(db)
    .await
}

/// Get zero-result searches using stored procedure
pub async fn search_analytics_get_zero_results(
    db: &Pool<Postgres>,
    days: i32,
    limit: i32,
) -> Result<Vec<ZeroResultSearch>, sqlx::Error> {
    sqlx::query_as!(
        ZeroResultSearch,
        r#"
        SELECT
            query_normalized as "query_normalized!",
            search_count as "search_count!",
            last_searched as "last_searched!"
        FROM sp_get_blog_zero_result_searches($1, $2)
        "#,
        days,
        limit
    )
    .fetch_all(db)
    .await
}
