//! Blog Post Elasticsearch Indexing Job
//!
//! This job handles async indexing of blog posts to Elasticsearch.
//! Supports index, reindex, and delete operations.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::{error, info};

use crate::bootstrap::elasticsearch::{BlogPostDocument, CategoryRef, ElasticsearchClient, TagRef};

/// The action to perform on the blog post index
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IndexAction {
    /// Index a new post or update existing
    Index,
    /// Delete a post from the index
    Delete,
    /// Reindex all published posts (bulk operation)
    ReindexAll,
}

/// Parameters for the index_blog_post job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexBlogPostParams {
    /// The action to perform
    pub action: IndexAction,
    /// Post ID (required for Index/Delete, ignored for ReindexAll)
    pub post_id: Option<i64>,
    /// Post slug (for logging, optional)
    pub post_slug: Option<String>,
}

impl IndexBlogPostParams {
    /// Create params for indexing a single post
    pub fn index(post_id: i64, post_slug: Option<&str>) -> Self {
        Self {
            action: IndexAction::Index,
            post_id: Some(post_id),
            post_slug: post_slug.map(|s| s.to_string()),
        }
    }

    /// Create params for deleting a post from the index
    pub fn delete(post_id: i64, post_slug: Option<&str>) -> Self {
        Self {
            action: IndexAction::Delete,
            post_id: Some(post_id),
            post_slug: post_slug.map(|s| s.to_string()),
        }
    }

    /// Create params for reindexing all posts
    pub fn reindex_all() -> Self {
        Self {
            action: IndexAction::ReindexAll,
            post_id: None,
            post_slug: None,
        }
    }
}

/// Execute the blog post indexing job
pub async fn execute(
    db: &Pool<Postgres>,
    es_client: &ElasticsearchClient,
    params: &IndexBlogPostParams,
) -> Result<bool, String> {
    match params.action {
        IndexAction::Index => {
            let post_id = params.post_id.ok_or("Post ID is required for Index action")?;
            index_single_post(db, es_client, post_id, params.post_slug.as_deref()).await
        }
        IndexAction::Delete => {
            let post_id = params.post_id.ok_or("Post ID is required for Delete action")?;
            delete_single_post(es_client, post_id, params.post_slug.as_deref()).await
        }
        IndexAction::ReindexAll => reindex_all_posts(db, es_client).await,
    }
}

/// Index a single blog post
async fn index_single_post(
    db: &Pool<Postgres>,
    es_client: &ElasticsearchClient,
    post_id: i64,
    post_slug: Option<&str>,
) -> Result<bool, String> {
    let slug_info = post_slug.map(|s| format!(" ({})", s)).unwrap_or_default();
    info!("=== INDEXING SINGLE POST {} {} ===", post_id, slug_info);

    // Get post data with categories and tags
    let post = sqlx::query_as::<_, PostForIndex>(
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.excerpt,
            p.content,
            p.status,
            p.is_featured,
            p.view_count,
            p.published_at,
            p.created_at,
            p.updated_at,
            p.author_id,
            COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS author_name,
            COALESCE(
                (SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'slug', c.slug))
                 FROM blog_post_categories pc
                 JOIN blog_categories c ON c.id = pc.category_id
                 WHERE pc.post_id = p.id AND c.is_active = TRUE),
                '[]'::json
            ) AS categories_json,
            COALESCE(
                (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
                 FROM blog_post_tags pt
                 JOIN blog_tags t ON t.id = pt.tag_id
                 WHERE pt.post_id = p.id AND t.is_active = TRUE),
                '[]'::json
            ) AS tags_json
        FROM blog_posts p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE p.id = $1 AND p.is_active = TRUE
        "#,
    )
    .bind(post_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let post = match post {
        Some(p) => p,
        None => {
            info!("Post {} not found or inactive, skipping indexing", post_id);
            return Ok(true);
        }
    };

    // Only index published posts
    if post.status != "published" {
        info!(
            "Post {} is not published ({}), removing from index",
            post_id, post.status
        );
        return delete_single_post(es_client, post_id, post_slug).await;
    }

    // Build the document
    let categories: Vec<CategoryRef> =
        serde_json::from_value(post.categories_json).unwrap_or_default();
    let tags: Vec<TagRef> = serde_json::from_value(post.tags_json).unwrap_or_default();

    let document = BlogPostDocument {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        status: post.status,
        is_featured: post.is_featured,
        view_count: post.view_count,
        published_at: post.published_at,
        created_at: post.created_at,
        updated_at: post.updated_at,
        author_id: post.author_id,
        author_name: post.author_name,
        categories,
        tags,
        content_type: "blog".to_string(), // Content type for search filtering
    };

    // Index the document
    info!(
        "Sending document to Elasticsearch - post_id: {}, title: {}, categories: {}, tags: {}",
        document.id,
        document.title,
        document.categories.len(),
        document.tags.len()
    );

    es_client
        .index_blog_post(&document)
        .await
        .map_err(|e| {
            error!("Elasticsearch indexing error for post {}: {}", post_id, e);
            format!("Elasticsearch indexing error: {}", e)
        })?;

    info!("=== SUCCESSFULLY INDEXED blog post {} {} ===", post_id, slug_info);
    Ok(true)
}

/// Delete a single blog post from the index
async fn delete_single_post(
    es_client: &ElasticsearchClient,
    post_id: i64,
    post_slug: Option<&str>,
) -> Result<bool, String> {
    let slug_info = post_slug.map(|s| format!(" ({})", s)).unwrap_or_default();
    info!("Deleting blog post {} from index{}", post_id, slug_info);

    es_client
        .delete_blog_post(post_id)
        .await
        .map_err(|e| format!("Elasticsearch delete error: {}", e))?;

    info!("Successfully deleted blog post {} from index", post_id);
    Ok(true)
}

/// Reindex all published blog posts
async fn reindex_all_posts(
    db: &Pool<Postgres>,
    es_client: &ElasticsearchClient,
) -> Result<bool, String> {
    info!("=== REINDEX ALL POSTS JOB STARTED ===");

    // First verify ES connection
    match es_client.health_check().await {
        Ok(true) => info!("Elasticsearch health check: OK"),
        Ok(false) => {
            error!("Elasticsearch health check: FAILED (not healthy)");
            return Err("Elasticsearch is not healthy".to_string());
        }
        Err(e) => {
            error!("Elasticsearch health check ERROR: {}", e);
            return Err(format!("Elasticsearch connection error: {}", e));
        }
    }

    // Get all published post IDs
    info!("Querying database for published posts...");
    let post_ids: Vec<i64> = sqlx::query_scalar(
        r#"
        SELECT id FROM blog_posts
        WHERE status = 'published' AND is_active = TRUE
        ORDER BY id
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("Database error fetching post IDs: {}", e))?;

    let total = post_ids.len();
    info!("Found {} published posts to reindex", total);

    if total == 0 {
        info!("No published posts found - nothing to index");
        return Ok(true);
    }

    let mut success_count = 0;
    let mut error_count = 0;

    for (idx, post_id) in post_ids.iter().enumerate() {
        match index_single_post(db, es_client, *post_id, None).await {
            Ok(_) => {
                success_count += 1;
            }
            Err(e) => {
                error!("Failed to index post {}: {}", post_id, e);
                error_count += 1;
            }
        }

        // Log progress every 100 posts
        if (idx + 1) % 100 == 0 {
            info!("Reindex progress: {}/{} posts", idx + 1, total);
        }
    }

    // Refresh the index to make documents searchable immediately
    if let Err(e) = es_client.refresh_blog_index().await {
        error!("Failed to refresh index after reindex: {}", e);
    }

    info!(
        "Reindex complete: {} successful, {} failed out of {} total",
        success_count, error_count, total
    );

    if error_count > 0 {
        Err(format!(
            "Reindex completed with {} errors out of {} posts",
            error_count, total
        ))
    } else {
        Ok(true)
    }
}

// Internal struct for database query
#[derive(Debug, sqlx::FromRow)]
struct PostForIndex {
    id: i64,
    title: String,
    slug: String,
    excerpt: Option<String>,
    content: String,
    status: String,
    is_featured: bool,
    view_count: i32,
    published_at: Option<chrono::DateTime<Utc>>,
    created_at: chrono::DateTime<Utc>,
    updated_at: chrono::DateTime<Utc>,
    author_id: i64,
    author_name: String,
    categories_json: serde_json::Value,
    tags_json: serde_json::Value,
}
