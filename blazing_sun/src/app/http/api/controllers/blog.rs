//! Blog Controller
//!
//! Handles blog-related API endpoints for both admin and public access.
//!
//! **Admin API** (requires Admin permission level 10+):
//! - Categories: CRUD operations for blog categories
//! - Tags: CRUD operations for blog tags
//! - Posts: CRUD operations for blog posts with filters
//! - Taxonomies: CRUD operations for dynamic taxonomies
//! - Search Analytics: View search query statistics
//! - Reindex: Trigger Elasticsearch reindexing
//!
//! **Public API** (no auth required):
//! - Categories: List active categories and posts by category
//! - Tags: List tags (tag cloud) and posts by tag
//! - Posts: List published posts, get single post, search
//! - Archive: Year/month archive data
//! - Taxonomies: Get posts matching taxonomy rules

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::app::db_query::mutations::blog as blog_mutations;
use crate::app::db_query::read::blog as blog_read;
use crate::app::db_query::read::upload as upload_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::app::mq::jobs::IndexBlogPostParams;
use crate::bootstrap::mq::{self, JobOptions};
use crate::database::AppState;
use sqlx::{Pool, Postgres};

/// Blog Controller
pub struct BlogController;

// ============================================================================
// REQUEST/RESPONSE DTOs
// ============================================================================

// --- Pagination ---

/// Pagination query parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_per_page")]
    pub per_page: i32,
}

fn default_page() -> i32 {
    1
}
fn default_per_page() -> i32 {
    16
}

/// Pagination info for responses
#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: i32,
    pub per_page: i32,
    pub total: i64,
    pub total_pages: i32,
    pub has_next: bool,
    pub has_prev: bool,
}

impl PaginationInfo {
    pub fn new(page: i32, per_page: i32, total: i64) -> Self {
        let total_pages = if total > 0 {
            ((total as f64) / (per_page as f64)).ceil() as i32
        } else {
            0
        };
        Self {
            page,
            per_page,
            total,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        }
    }
}

// --- Category DTOs ---

/// Category response DTO
#[derive(Debug, Serialize)]
pub struct CategoryDto {
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

impl From<blog_read::BlogCategory> for CategoryDto {
    fn from(cat: blog_read::BlogCategory) -> Self {
        Self {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            parent_category_id: cat.parent_category_id,
            sort_order: cat.sort_order,
            is_active: cat.is_active,
            created_at: cat.created_at,
            updated_at: cat.updated_at,
        }
    }
}

/// Category tree node DTO (public)
#[derive(Debug, Serialize)]
pub struct CategoryTreeDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: i32,
    pub depth: i32,
    pub post_count: i64,
}

impl From<blog_read::BlogCategoryTreeNode> for CategoryTreeDto {
    fn from(node: blog_read::BlogCategoryTreeNode) -> Self {
        Self {
            id: node.id,
            name: node.name,
            slug: node.slug,
            description: node.description,
            parent_category_id: node.parent_category_id,
            sort_order: node.sort_order,
            depth: node.depth,
            post_count: node.post_count,
        }
    }
}

/// Search setting update item
#[derive(Debug, Deserialize)]
pub struct SearchSettingUpdate {
    pub content_type: String,
    pub is_enabled: bool,
}

/// Create category request
#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    #[serde(default)]
    pub sort_order: i32,
}

/// Update category request
#[derive(Debug, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub parent_category_id: Option<i64>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

// --- Tag DTOs ---

/// Tag response DTO
#[derive(Debug, Serialize)]
pub struct TagDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<blog_read::BlogTag> for TagDto {
    fn from(tag: blog_read::BlogTag) -> Self {
        Self {
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            is_active: tag.is_active,
            created_at: tag.created_at,
            updated_at: tag.updated_at,
        }
    }
}

/// Tag cloud item DTO (public)
#[derive(Debug, Serialize)]
pub struct TagCloudDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub post_count: i64,
}

impl From<blog_read::TagCloudItem> for TagCloudDto {
    fn from(item: blog_read::TagCloudItem) -> Self {
        Self {
            id: item.id,
            name: item.name,
            slug: item.slug,
            post_count: item.post_count,
        }
    }
}

/// Create tag request
#[derive(Debug, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
}

/// Update tag request
#[derive(Debug, Deserialize)]
pub struct UpdateTagRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

// --- Post DTOs ---

/// Post list item DTO (for lists)
#[derive(Debug, Serialize)]
pub struct PostListDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub featured_image_id: Option<i64>,
    pub featured_image_url: Option<String>,
    pub author_id: i64,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: Option<bool>,
}

impl From<blog_read::BlogPostListItem> for PostListDto {
    fn from(item: blog_read::BlogPostListItem) -> Self {
        Self {
            id: item.id,
            title: item.title,
            slug: item.slug,
            excerpt: item.excerpt,
            featured_image_id: item.featured_image_id,
            featured_image_url: None, // Populated separately via get_image_url
            author_id: item.author_id,
            author_name: item.author_name,
            published_at: item.published_at,
            view_count: item.view_count,
            is_featured: None,
        }
    }
}

impl From<blog_read::BlogPostListItemFeatured> for PostListDto {
    fn from(item: blog_read::BlogPostListItemFeatured) -> Self {
        Self {
            id: item.id,
            title: item.title,
            slug: item.slug,
            excerpt: item.excerpt,
            featured_image_id: item.featured_image_id,
            featured_image_url: None, // Populated separately via get_image_url
            author_id: item.author_id,
            author_name: item.author_name,
            published_at: item.published_at,
            view_count: item.view_count,
            is_featured: Some(item.is_featured),
        }
    }
}

/// Admin post list item DTO
#[derive(Debug, Serialize)]
pub struct AdminPostListDto {
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
}

impl From<blog_read::AdminPostListItem> for AdminPostListDto {
    fn from(item: blog_read::AdminPostListItem) -> Self {
        Self {
            id: item.id,
            title: item.title,
            slug: item.slug,
            status: item.status,
            author_id: item.author_id,
            author_name: item.author_name,
            published_at: item.published_at,
            view_count: item.view_count,
            is_featured: item.is_featured,
            is_active: item.is_active,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }
    }
}

/// Post detail DTO (single post with categories and tags)
#[derive(Debug, Serialize)]
pub struct PostDetailDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image_id: Option<i64>,
    pub featured_image_url: Option<String>,
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
    pub categories: serde_json::Value,
    pub tags: serde_json::Value,
}

impl From<blog_read::BlogPostDetail> for PostDetailDto {
    fn from(detail: blog_read::BlogPostDetail) -> Self {
        Self {
            id: detail.id,
            title: detail.title,
            slug: detail.slug,
            excerpt: detail.excerpt,
            content: detail.content,
            featured_image_id: detail.featured_image_id,
            featured_image_url: None, // Populated separately via get_image_url
            author_id: detail.author_id,
            author_name: detail.author_name,
            status: detail.status,
            meta_title: detail.meta_title,
            meta_description: detail.meta_description,
            published_at: detail.published_at,
            view_count: detail.view_count,
            is_featured: detail.is_featured,
            allow_comments: detail.allow_comments,
            created_at: detail.created_at,
            updated_at: detail.updated_at,
            categories: detail.categories,
            tags: detail.tags,
        }
    }
}

/// Create post request
#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image_id: Option<i64>,
    #[serde(default = "default_status")]
    pub status: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub is_featured: bool,
    #[serde(default = "default_allow_comments")]
    pub allow_comments: bool,
    #[serde(default)]
    pub category_ids: Vec<i64>,
    #[serde(default)]
    pub tag_ids: Vec<i64>,
}

fn default_status() -> String {
    "draft".to_string()
}
fn default_allow_comments() -> bool {
    true
}

/// Update post request
#[derive(Debug, Deserialize)]
pub struct UpdatePostRequest {
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
    pub category_ids: Option<Vec<i64>>,
    pub tag_ids: Option<Vec<i64>>,
}

/// Admin post list query parameters
#[derive(Debug, Deserialize)]
pub struct AdminPostListQuery {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_per_page")]
    pub per_page: i32,
    pub status: Option<String>,
    pub search: Option<String>,
}

/// Public post list query parameters
#[derive(Debug, Deserialize)]
pub struct PublicPostListQuery {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_per_page")]
    pub per_page: i32,
    #[serde(default)]
    pub featured_only: bool,
}

// --- Taxonomy DTOs ---

/// Taxonomy response DTO
#[derive(Debug, Serialize)]
pub struct TaxonomyDto {
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

impl From<blog_read::BlogTaxonomy> for TaxonomyDto {
    fn from(tax: blog_read::BlogTaxonomy) -> Self {
        Self {
            id: tax.id,
            name: tax.name,
            slug: tax.slug,
            description: tax.description,
            display_title: tax.display_title,
            featured_image_id: tax.featured_image_id,
            rule_logic: tax.rule_logic,
            sort_order: tax.sort_order,
            is_active: tax.is_active,
            created_at: tax.created_at,
            updated_at: tax.updated_at,
        }
    }
}

/// Taxonomy with rules DTO
#[derive(Debug, Serialize)]
pub struct TaxonomyWithRulesDto {
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

impl From<blog_read::BlogTaxonomyWithRules> for TaxonomyWithRulesDto {
    fn from(tax: blog_read::BlogTaxonomyWithRules) -> Self {
        Self {
            id: tax.id,
            name: tax.name,
            slug: tax.slug,
            description: tax.description,
            display_title: tax.display_title,
            featured_image_id: tax.featured_image_id,
            rule_logic: tax.rule_logic,
            sort_order: tax.sort_order,
            is_active: tax.is_active,
            created_at: tax.created_at,
            updated_at: tax.updated_at,
            required_tag_ids: tax.required_tag_ids,
            required_category_ids: tax.required_category_ids,
            explicit_post_ids: tax.explicit_post_ids,
        }
    }
}

/// Create taxonomy request
#[derive(Debug, Deserialize)]
pub struct CreateTaxonomyRequest {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    #[serde(default = "default_rule_logic")]
    pub rule_logic: String,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub required_tag_ids: Vec<i64>,
    #[serde(default)]
    pub required_category_ids: Vec<i64>,
    #[serde(default)]
    pub explicit_post_ids: Vec<i64>,
}

fn default_rule_logic() -> String {
    "AND".to_string()
}

/// Update taxonomy request
#[derive(Debug, Deserialize)]
pub struct UpdateTaxonomyRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub display_title: Option<String>,
    pub featured_image_id: Option<i64>,
    pub rule_logic: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub required_tag_ids: Option<Vec<i64>>,
    pub required_category_ids: Option<Vec<i64>>,
    pub explicit_post_ids: Option<Vec<i64>>,
}

// --- Archive DTOs ---

/// Archive item DTO
#[derive(Debug, Serialize)]
pub struct ArchiveItemDto {
    pub year: i32,
    pub month: i32,
    pub post_count: i64,
}

impl From<blog_read::ArchiveItem> for ArchiveItemDto {
    fn from(item: blog_read::ArchiveItem) -> Self {
        Self {
            year: item.year,
            month: item.month,
            post_count: item.post_count,
        }
    }
}

/// Archive path parameters
#[derive(Debug, Deserialize)]
pub struct ArchivePath {
    pub year: i32,
    pub month: i32,
}

// --- Search DTOs ---

/// Search query parameters
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_per_page")]
    pub per_page: i32,
    /// Optional category slug filter (empty = all categories)
    #[serde(default)]
    pub category: Option<String>,
}

/// Search result DTO
#[derive(Debug, Serialize)]
pub struct SearchResultDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub categories: Vec<CategoryRefDto>,
    pub tags: Vec<TagRefDto>,
    pub highlights: SearchHighlightsDto,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct CategoryRefDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Serialize)]
pub struct TagRefDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Serialize)]
pub struct SearchHighlightsDto {
    pub title: Option<Vec<String>>,
    pub excerpt: Option<Vec<String>>,
    pub content: Option<Vec<String>>,
}

/// Search response
#[derive(Debug, Serialize)]
pub struct SearchResponseDto {
    pub results: Vec<SearchResultDto>,
    pub pagination: PaginationInfo,
}

// --- Analytics DTOs ---

/// Search analytics query parameters
#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default = "default_days")]
    pub days: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_days() -> i32 {
    30
}
fn default_limit() -> i32 {
    50
}

/// Search analytics summary DTO
#[derive(Debug, Serialize)]
pub struct SearchAnalyticsDto {
    pub query_normalized: String,
    pub search_count: i64,
    pub avg_results: Option<f64>,
    pub zero_results_count: i64,
    pub click_count: i64,
    pub click_rate: Option<f64>,
}

impl From<blog_read::SearchAnalyticsSummary> for SearchAnalyticsDto {
    fn from(summary: blog_read::SearchAnalyticsSummary) -> Self {
        Self {
            query_normalized: summary.query_normalized,
            search_count: summary.search_count,
            avg_results: summary.avg_results,
            zero_results_count: summary.zero_results_count,
            click_count: summary.click_count,
            click_rate: summary.click_rate,
        }
    }
}

/// Tag cloud query parameters
#[derive(Debug, Deserialize)]
pub struct TagCloudQuery {
    #[serde(default = "default_tag_limit")]
    pub limit: i32,
}

fn default_tag_limit() -> i32 {
    50
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get image URL from image ID by looking up the upload UUID
async fn get_image_url(db: &Pool<Postgres>, image_id: Option<i64>) -> Option<String> {
    let id = image_id?;
    match upload_read::get_by_id(db, id).await {
        Ok(upload) => Some(format!("/api/v1/upload/download/public/{}?variant=medium", upload.uuid)),
        Err(_) => None,
    }
}

/// Populate featured_image_url for a list of posts
async fn populate_image_urls(db: &Pool<Postgres>, posts: &mut [PostListDto]) {
    for post in posts.iter_mut() {
        if post.featured_image_id.is_some() {
            post.featured_image_url = get_image_url(db, post.featured_image_id).await;
        }
    }
}

// ============================================================================
// ADMIN CATEGORY ENDPOINTS
// ============================================================================

impl BlogController {
    /// GET /api/v1/admin/blog/categories - List all categories (including inactive)
    pub async fn admin_list_categories(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match blog_read::categories_get_all_admin(&db).await {
            Ok(categories) => {
                let dtos: Vec<CategoryDto> = categories.into_iter().map(CategoryDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "categories": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list categories: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list categories"))
            }
        }
    }

    /// POST /api/v1/admin/blog/categories - Create category
    pub async fn admin_create_category(
        state: web::Data<AppState>,
        body: web::Json<CreateCategoryRequest>,
    ) -> HttpResponse {
        let db = state.db.lock().await;

        // Validate slug uniqueness
        if blog_read::category_slug_exists(&db, &body.slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Category slug already exists"));
        }

        let params = blog_mutations::CreateCategoryParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            parent_category_id: body.parent_category_id,
            sort_order: body.sort_order,
        };

        match blog_mutations::category_create(&db, &params).await {
            Ok(id) => HttpResponse::Created().json(serde_json::json!({
                "status": "success",
                "message": "Category created",
                "id": id
            })),
            Err(e) => {
                tracing::error!("Failed to create category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create category"))
            }
        }
    }

    /// GET /api/v1/admin/blog/categories/{id} - Get category by ID
    pub async fn admin_get_category(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let category_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_read::category_get_by_id(&db, category_id).await {
            Ok(category) => {
                let dto = CategoryDto::from(category);
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "category": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Category not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get category"))
            }
        }
    }

    /// PUT /api/v1/admin/blog/categories/{id} - Update category
    pub async fn admin_update_category(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateCategoryRequest>,
    ) -> HttpResponse {
        let category_id = path.into_inner();
        let db = state.db.lock().await;

        // Validate slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if blog_read::category_slug_exists_except(&db, slug, category_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Category slug already exists"));
            }
        }

        let params = blog_mutations::UpdateCategoryParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            parent_category_id: body.parent_category_id,
            sort_order: body.sort_order,
            is_active: body.is_active,
        };

        match blog_mutations::category_update(&db, category_id, &params).await {
            Ok(true) => {
                HttpResponse::Ok().json(BaseResponse::success("Category updated"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Category not found"))
            }
            Err(e) => {
                tracing::error!("Failed to update category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update category"))
            }
        }
    }

    /// DELETE /api/v1/admin/blog/categories/{id} - Soft delete category
    pub async fn admin_delete_category(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let category_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_mutations::category_delete(&db, category_id).await {
            Ok(true) => {
                HttpResponse::Ok().json(BaseResponse::success("Category deleted"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Category not found"))
            }
            Err(e) => {
                tracing::error!("Failed to delete category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete category"))
            }
        }
    }

    // ============================================================================
    // ADMIN TAG ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/blog/tags - List all tags (including inactive)
    pub async fn admin_list_tags(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match blog_read::tags_get_all_admin(&db).await {
            Ok(tags) => {
                let dtos: Vec<TagDto> = tags.into_iter().map(TagDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "tags": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list tags: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list tags"))
            }
        }
    }

    /// POST /api/v1/admin/blog/tags - Create tag
    pub async fn admin_create_tag(
        state: web::Data<AppState>,
        body: web::Json<CreateTagRequest>,
    ) -> HttpResponse {
        let db = state.db.lock().await;

        // Validate slug uniqueness
        if blog_read::tag_slug_exists(&db, &body.slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Tag slug already exists"));
        }

        let params = blog_mutations::CreateTagParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
        };

        match blog_mutations::tag_create(&db, &params).await {
            Ok(id) => HttpResponse::Created().json(serde_json::json!({
                "status": "success",
                "message": "Tag created",
                "id": id
            })),
            Err(e) => {
                tracing::error!("Failed to create tag: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create tag"))
            }
        }
    }

    /// GET /api/v1/admin/blog/tags/{id} - Get tag by ID
    pub async fn admin_get_tag(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let tag_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_read::tag_get_by_id(&db, tag_id).await {
            Ok(tag) => {
                let dto = TagDto::from(tag);
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "tag": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Tag not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get tag: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get tag"))
            }
        }
    }

    /// PUT /api/v1/admin/blog/tags/{id} - Update tag
    pub async fn admin_update_tag(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateTagRequest>,
    ) -> HttpResponse {
        let tag_id = path.into_inner();
        let db = state.db.lock().await;

        // Validate slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if blog_read::tag_slug_exists_except(&db, slug, tag_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Tag slug already exists"));
            }
        }

        let params = blog_mutations::UpdateTagParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            is_active: body.is_active,
        };

        match blog_mutations::tag_update(&db, tag_id, &params).await {
            Ok(true) => {
                HttpResponse::Ok().json(BaseResponse::success("Tag updated"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Tag not found"))
            }
            Err(e) => {
                tracing::error!("Failed to update tag: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update tag"))
            }
        }
    }

    /// DELETE /api/v1/admin/blog/tags/{id} - Soft delete tag
    pub async fn admin_delete_tag(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let tag_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_mutations::tag_delete(&db, tag_id).await {
            Ok(true) => {
                HttpResponse::Ok().json(BaseResponse::success("Tag deleted"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Tag not found"))
            }
            Err(e) => {
                tracing::error!("Failed to delete tag: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete tag"))
            }
        }
    }

    // ============================================================================
    // ADMIN POST ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/blog/posts - List posts with filters
    pub async fn admin_list_posts(
        state: web::Data<AppState>,
        query: web::Query<AdminPostListQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        match blog_read::posts_get_admin(
            &db,
            page,
            per_page,
            query.status.as_deref(),
            query.search.as_deref(),
        )
        .await
        {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let dtos: Vec<AdminPostListDto> =
                    posts.into_iter().map(AdminPostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list posts"))
            }
        }
    }

    /// POST /api/v1/admin/blog/posts - Create post
    pub async fn admin_create_post(
        req: HttpRequest,
        state: web::Data<AppState>,
        body: web::Json<CreatePostRequest>,
    ) -> HttpResponse {
        // Get author_id from JWT
        let author_id = match req.extensions().get::<i64>().copied() {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized()
                    .json(BaseResponse::error("Authentication required"));
            }
        };

        let db = state.db.lock().await;

        // Validate slug uniqueness
        if blog_read::post_slug_exists(&db, &body.slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Post slug already exists"));
        }

        // Validate status
        let valid_statuses = ["draft", "published", "scheduled", "archived"];
        if !valid_statuses.contains(&body.status.as_str()) {
            return HttpResponse::BadRequest().json(BaseResponse::error(
                "Invalid status. Must be: draft, published, scheduled, or archived",
            ));
        }

        let params = blog_mutations::CreatePostParams {
            title: body.title.clone(),
            slug: body.slug.clone(),
            excerpt: body.excerpt.clone(),
            content: body.content.clone(),
            author_id,
            featured_image_id: body.featured_image_id,
            status: body.status.clone(),
            meta_title: body.meta_title.clone(),
            meta_description: body.meta_description.clone(),
            published_at: body.published_at,
            is_featured: body.is_featured,
            allow_comments: body.allow_comments,
        };

        match blog_mutations::post_create(&db, &params).await {
            Ok(post_id) => {
                // Set categories if provided
                if !body.category_ids.is_empty() {
                    if let Err(e) =
                        blog_mutations::post_set_categories(&db, post_id, &body.category_ids).await
                    {
                        tracing::warn!("Failed to set post categories: {}", e);
                    }
                }

                // Set tags if provided
                if !body.tag_ids.is_empty() {
                    if let Err(e) =
                        blog_mutations::post_set_tags(&db, post_id, &body.tag_ids).await
                    {
                        tracing::warn!("Failed to set post tags: {}", e);
                    }
                }

                // Index in Elasticsearch asynchronously if published
                if body.status == "published" {
                    Self::enqueue_index_job(&state, post_id, Some(&body.slug)).await;
                }

                HttpResponse::Created().json(serde_json::json!({
                    "status": "success",
                    "message": "Post created",
                    "id": post_id
                }))
            }
            Err(e) => {
                tracing::error!("Failed to create post: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create post"))
            }
        }
    }

    /// GET /api/v1/admin/blog/posts/{id} - Get post with categories/tags
    pub async fn admin_get_post(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let post_id = path.into_inner();
        let db = state.db.lock().await;

        // Get base post
        let post = match blog_read::post_get_by_id(&db, post_id).await {
            Ok(p) => p,
            Err(sqlx::Error::RowNotFound) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Post not found"));
            }
            Err(e) => {
                tracing::error!("Failed to get post: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get post"));
            }
        };

        // Get categories and tags
        let category_ids = blog_read::post_get_categories(&db, post_id).await.unwrap_or_default();
        let tag_ids = blog_read::post_get_tags(&db, post_id).await.unwrap_or_default();

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "post": {
                "id": post.id,
                "title": post.title,
                "slug": post.slug,
                "excerpt": post.excerpt,
                "content": post.content,
                "featured_image_id": post.featured_image_id,
                "author_id": post.author_id,
                "status": post.status,
                "meta_title": post.meta_title,
                "meta_description": post.meta_description,
                "published_at": post.published_at,
                "view_count": post.view_count,
                "is_featured": post.is_featured,
                "allow_comments": post.allow_comments,
                "is_active": post.is_active,
                "created_at": post.created_at,
                "updated_at": post.updated_at,
                "category_ids": category_ids,
                "tag_ids": tag_ids
            }
        }))
    }

    /// PUT /api/v1/admin/blog/posts/{id} - Update post
    pub async fn admin_update_post(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdatePostRequest>,
    ) -> HttpResponse {
        let post_id = path.into_inner();
        let db = state.db.lock().await;

        // Validate slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if blog_read::post_slug_exists_except(&db, slug, post_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Post slug already exists"));
            }
        }

        // Validate status if provided
        if let Some(ref status) = body.status {
            let valid_statuses = ["draft", "published", "scheduled", "archived"];
            if !valid_statuses.contains(&status.as_str()) {
                return HttpResponse::BadRequest().json(BaseResponse::error(
                    "Invalid status. Must be: draft, published, scheduled, or archived",
                ));
            }
        }

        // Get existing post to check if status is changing
        let existing_post = match blog_read::post_get_by_id(&db, post_id).await {
            Ok(p) => p,
            Err(sqlx::Error::RowNotFound) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Post not found"));
            }
            Err(e) => {
                tracing::error!("Failed to get post: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get post"));
            }
        };

        let params = blog_mutations::UpdatePostParams {
            title: body.title.clone(),
            slug: body.slug.clone(),
            excerpt: body.excerpt.clone(),
            content: body.content.clone(),
            featured_image_id: body.featured_image_id,
            status: body.status.clone(),
            meta_title: body.meta_title.clone(),
            meta_description: body.meta_description.clone(),
            published_at: body.published_at,
            is_featured: body.is_featured,
            allow_comments: body.allow_comments,
            is_active: body.is_active,
        };

        match blog_mutations::post_update(&db, post_id, &params).await {
            Ok(true) => {
                // Update categories if provided
                if let Some(ref category_ids) = body.category_ids {
                    if let Err(e) =
                        blog_mutations::post_set_categories(&db, post_id, category_ids).await
                    {
                        tracing::warn!("Failed to update post categories: {}", e);
                    }
                }

                // Update tags if provided
                if let Some(ref tag_ids) = body.tag_ids {
                    if let Err(e) = blog_mutations::post_set_tags(&db, post_id, tag_ids).await {
                        tracing::warn!("Failed to update post tags: {}", e);
                    }
                }

                // Update Elasticsearch index asynchronously
                let new_status = body.status.as_deref().unwrap_or(&existing_post.status);
                if new_status == "published" {
                    // Index or re-index the post
                    Self::enqueue_index_job(&state, post_id, body.slug.as_deref()).await;
                } else if existing_post.status == "published" && new_status != "published" {
                    // Post is being unpublished, remove from index
                    Self::enqueue_delete_job(&state, post_id, body.slug.as_deref()).await;
                }

                HttpResponse::Ok().json(BaseResponse::success("Post updated"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Post not found"))
            }
            Err(e) => {
                tracing::error!("Failed to update post: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update post"))
            }
        }
    }

    /// DELETE /api/v1/admin/blog/posts/{id} - Soft delete post
    pub async fn admin_delete_post(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let post_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_mutations::post_delete(&db, post_id).await {
            Ok(true) => {
                // Remove from Elasticsearch asynchronously
                Self::enqueue_delete_job(&state, post_id, None).await;

                HttpResponse::Ok().json(BaseResponse::success("Post deleted"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Post not found"))
            }
            Err(e) => {
                tracing::error!("Failed to delete post: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete post"))
            }
        }
    }

    // ============================================================================
    // ADMIN TAXONOMY ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/blog/taxonomies - List all taxonomies
    pub async fn admin_list_taxonomies(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match blog_read::taxonomies_get_all_admin(&db).await {
            Ok(taxonomies) => {
                let dtos: Vec<TaxonomyDto> =
                    taxonomies.into_iter().map(TaxonomyDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "taxonomies": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list taxonomies: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list taxonomies"))
            }
        }
    }

    /// POST /api/v1/admin/blog/taxonomies - Create taxonomy
    pub async fn admin_create_taxonomy(
        state: web::Data<AppState>,
        body: web::Json<CreateTaxonomyRequest>,
    ) -> HttpResponse {
        let db = state.db.lock().await;

        // Validate slug uniqueness
        if blog_read::taxonomy_slug_exists(&db, &body.slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Taxonomy slug already exists"));
        }

        // Validate rule_logic
        let valid_logics = ["AND", "OR"];
        if !valid_logics.contains(&body.rule_logic.as_str()) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid rule_logic. Must be: AND or OR"));
        }

        let params = blog_mutations::CreateTaxonomyParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            display_title: body.display_title.clone(),
            featured_image_id: body.featured_image_id,
            rule_logic: body.rule_logic.clone(),
            sort_order: body.sort_order,
        };

        match blog_mutations::taxonomy_create(&db, &params).await {
            Ok(taxonomy_id) => {
                // Set rules if provided
                let rules_params = blog_mutations::SetTaxonomyRulesParams {
                    required_tag_ids: if body.required_tag_ids.is_empty() {
                        None
                    } else {
                        Some(body.required_tag_ids.clone())
                    },
                    required_category_ids: if body.required_category_ids.is_empty() {
                        None
                    } else {
                        Some(body.required_category_ids.clone())
                    },
                    explicit_post_ids: if body.explicit_post_ids.is_empty() {
                        None
                    } else {
                        Some(body.explicit_post_ids.clone())
                    },
                };

                if let Err(e) =
                    blog_mutations::taxonomy_set_rules(&db, taxonomy_id, &rules_params).await
                {
                    tracing::warn!("Failed to set taxonomy rules: {}", e);
                }

                HttpResponse::Created().json(serde_json::json!({
                    "status": "success",
                    "message": "Taxonomy created",
                    "id": taxonomy_id
                }))
            }
            Err(e) => {
                tracing::error!("Failed to create taxonomy: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create taxonomy"))
            }
        }
    }

    /// GET /api/v1/admin/blog/taxonomies/{id} - Get taxonomy with rules
    pub async fn admin_get_taxonomy(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let taxonomy_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_read::taxonomy_get_by_id_with_rules(&db, taxonomy_id).await {
            Ok(taxonomy) => {
                let dto = TaxonomyWithRulesDto::from(taxonomy);
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "taxonomy": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Taxonomy not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get taxonomy: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get taxonomy"))
            }
        }
    }

    /// PUT /api/v1/admin/blog/taxonomies/{id} - Update taxonomy
    pub async fn admin_update_taxonomy(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateTaxonomyRequest>,
    ) -> HttpResponse {
        let taxonomy_id = path.into_inner();
        let db = state.db.lock().await;

        // Validate slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if blog_read::taxonomy_slug_exists_except(&db, slug, taxonomy_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Taxonomy slug already exists"));
            }
        }

        // Validate rule_logic if provided
        if let Some(ref rule_logic) = body.rule_logic {
            let valid_logics = ["AND", "OR"];
            if !valid_logics.contains(&rule_logic.as_str()) {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Invalid rule_logic. Must be: AND or OR"));
            }
        }

        let params = blog_mutations::UpdateTaxonomyParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            display_title: body.display_title.clone(),
            featured_image_id: body.featured_image_id,
            rule_logic: body.rule_logic.clone(),
            sort_order: body.sort_order,
            is_active: body.is_active,
        };

        match blog_mutations::taxonomy_update(&db, taxonomy_id, &params).await {
            Ok(true) => {
                // Update rules if provided
                if body.required_tag_ids.is_some()
                    || body.required_category_ids.is_some()
                    || body.explicit_post_ids.is_some()
                {
                    let rules_params = blog_mutations::SetTaxonomyRulesParams {
                        required_tag_ids: body.required_tag_ids.clone(),
                        required_category_ids: body.required_category_ids.clone(),
                        explicit_post_ids: body.explicit_post_ids.clone(),
                    };

                    if let Err(e) =
                        blog_mutations::taxonomy_set_rules(&db, taxonomy_id, &rules_params).await
                    {
                        tracing::warn!("Failed to update taxonomy rules: {}", e);
                    }
                }

                HttpResponse::Ok().json(BaseResponse::success("Taxonomy updated"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Taxonomy not found"))
            }
            Err(e) => {
                tracing::error!("Failed to update taxonomy: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update taxonomy"))
            }
        }
    }

    /// DELETE /api/v1/admin/blog/taxonomies/{id} - Soft delete taxonomy
    pub async fn admin_delete_taxonomy(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let taxonomy_id = path.into_inner();
        let db = state.db.lock().await;

        match blog_mutations::taxonomy_delete(&db, taxonomy_id).await {
            Ok(true) => {
                HttpResponse::Ok().json(BaseResponse::success("Taxonomy deleted"))
            }
            Ok(false) => {
                HttpResponse::NotFound().json(BaseResponse::error("Taxonomy not found"))
            }
            Err(e) => {
                tracing::error!("Failed to delete taxonomy: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete taxonomy"))
            }
        }
    }

    // ============================================================================
    // ADMIN ANALYTICS ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/blog/search-analytics - Get search analytics summary
    pub async fn admin_search_analytics(
        state: web::Data<AppState>,
        query: web::Query<AnalyticsQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;
        let days = query.days.clamp(1, 365);
        let limit = query.limit.clamp(1, 500);

        match blog_read::search_analytics_get_summary(&db, days, limit).await {
            Ok(summary) => {
                let dtos: Vec<SearchAnalyticsDto> =
                    summary.into_iter().map(SearchAnalyticsDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "analytics": dtos,
                    "days": days,
                    "limit": limit
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get search analytics: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get search analytics"))
            }
        }
    }

    // ============================================================================
    // ADMIN REINDEX ENDPOINT
    // ============================================================================

    /// POST /api/v1/admin/blog/reindex - Reindex all posts in Elasticsearch
    ///
    /// Dispatches an async job to reindex all published posts.
    /// The job runs in the background and doesn't block the API response.
    pub async fn admin_reindex(state: web::Data<AppState>) -> HttpResponse {
        // Check if Elasticsearch is available
        if state.elasticsearch().is_none() {
            return HttpResponse::ServiceUnavailable()
                .json(BaseResponse::error("Elasticsearch not available"));
        }

        // Dispatch reindex job
        let mq = match &state.mq {
            Some(mq) => mq,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Message queue not available"));
            }
        };
        let params = IndexBlogPostParams::reindex_all();
        let options = JobOptions::new()
            .priority(2) // Normal priority
            .fault_tolerance(3);

        match mq::enqueue_job_dyn(mq, "index_blog_post", &params, options).await {
            Ok(job_id) => {
                tracing::info!("Reindex job dispatched: {}", job_id);
                HttpResponse::Accepted().json(serde_json::json!({
                    "status": "success",
                    "message": "Reindex job dispatched. The index will be updated in the background.",
                    "job_id": job_id
                }))
            }
            Err(e) => {
                tracing::error!("Failed to dispatch reindex job: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to dispatch reindex job"))
            }
        }
    }

    // ============================================================================
    // ADMIN SEARCH INDEX MANAGEMENT ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/search/stats - Get search index statistics
    pub async fn admin_search_stats(state: web::Data<AppState>) -> HttpResponse {
        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Elasticsearch not available"));
            }
        };

        match es.get_index_stats().await {
            Ok(stats) => HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "stats": stats
            })),
            Err(e) => {
                tracing::error!("Failed to get index stats: {:?}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get index statistics"))
            }
        }
    }

    /// GET /api/v1/admin/search/items - List indexed items with pagination
    pub async fn admin_search_list_indexed(
        state: web::Data<AppState>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Elasticsearch not available"));
            }
        };

        let page = query.page.max(1) as u32;
        let per_page = query.per_page.clamp(1, 50) as u32;

        match es.list_indexed_documents(page, per_page).await {
            Ok(response) => {
                let pagination = PaginationInfo::new(
                    page as i32,
                    per_page as i32,
                    response.total as i64,
                );
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "items": response.documents,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list indexed documents: {:?}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list indexed documents"))
            }
        }
    }

    /// GET /api/v1/admin/search/blogs - List blogs with their index status
    pub async fn admin_search_blogs_index_status(
        state: web::Data<AppState>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Elasticsearch not available"));
            }
        };

        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        // Get all blog posts from database (admin view)
        let posts = match blog_read::posts_get_admin(&db, page, per_page, None, None).await {
            Ok(posts) => posts,
            Err(e) => {
                tracing::error!("Failed to get blog posts: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get blog posts"));
            }
        };

        // Get total count from first result (stored procedure returns it)
        let total_count = posts.first().map(|p| p.total_count).unwrap_or(0);

        drop(db);

        // Get indexed IDs from Elasticsearch
        let indexed_ids = match es.get_indexed_post_ids().await {
            Ok(ids) => ids,
            Err(e) => {
                tracing::warn!("Failed to get indexed IDs, treating all as not indexed: {:?}", e);
                vec![]
            }
        };

        // Build response with index status
        let items: Vec<serde_json::Value> = posts
            .into_iter()
            .map(|post| {
                let is_indexed = indexed_ids.contains(&post.id);
                serde_json::json!({
                    "id": post.id,
                    "title": post.title,
                    "slug": post.slug,
                    "status": post.status,
                    "published_at": post.published_at,
                    "updated_at": post.updated_at,
                    "is_indexed": is_indexed
                })
            })
            .collect();

        let pagination = PaginationInfo::new(page, per_page, total_count);

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "blogs": items,
            "pagination": pagination
        }))
    }

    /// POST /api/v1/admin/search/index/blog/{id} - Index a specific blog post
    pub async fn admin_search_index_single_blog(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let post_id = path.into_inner();

        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Elasticsearch not available"));
            }
        };

        let db = state.db.lock().await;

        // Get the basic blog post info first
        let basic_post = match blog_read::post_get_by_id(&db, post_id).await {
            Ok(post) => post,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Blog post not found"));
            }
        };

        // Get full post detail by slug (includes categories and tags)
        let post = match blog_read::post_get_detail_by_slug(&db, &basic_post.slug).await {
            Ok(post) => post,
            Err(e) => {
                tracing::error!("Failed to get post detail: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get post details"));
            }
        };

        // Build document for indexing
        let categories: Vec<crate::bootstrap::elasticsearch::CategoryRef> =
            serde_json::from_value(post.categories.clone()).unwrap_or_default();
        let tags: Vec<crate::bootstrap::elasticsearch::TagRef> =
            serde_json::from_value(post.tags.clone()).unwrap_or_default();

        let doc = crate::bootstrap::elasticsearch::BlogPostDocument {
            id: post.id,
            title: post.title.clone(),
            slug: post.slug.clone(),
            excerpt: post.excerpt.clone(),
            content: post.content.clone(),
            author_id: post.author_id,
            author_name: post.author_name.clone(),
            categories,
            tags,
            status: post.status.clone(),
            published_at: post.published_at,
            created_at: post.created_at,
            updated_at: post.updated_at,
            view_count: post.view_count,
            is_featured: post.is_featured,
            content_type: "blog".to_string(),
        };

        drop(db);

        match es.index_blog_post(&doc).await {
            Ok(_) => {
                // Refresh index to make searchable immediately
                if let Err(e) = es.refresh_blog_index().await {
                    tracing::warn!("Failed to refresh index: {:?}", e);
                }
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "message": format!("Blog post '{}' indexed successfully", post.title)
                }))
            }
            Err(e) => {
                tracing::error!("Failed to index blog post {}: {:?}", post_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to index blog post"))
            }
        }
    }

    /// POST /api/v1/admin/search/index/blogs/all - Index all published blogs
    pub async fn admin_search_index_all_blogs(state: web::Data<AppState>) -> HttpResponse {
        if state.elasticsearch().is_none() {
            return HttpResponse::ServiceUnavailable()
                .json(BaseResponse::error("Elasticsearch not available"));
        }

        // Dispatch reindex job (same as admin_reindex)
        let mq = match &state.mq {
            Some(mq) => mq,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Message queue not available"));
            }
        };

        let params = IndexBlogPostParams::reindex_all();
        let options = JobOptions::new().priority(2).fault_tolerance(3);

        match mq::enqueue_job_dyn(mq, "index_blog_post", &params, options).await {
            Ok(job_id) => {
                HttpResponse::Accepted().json(serde_json::json!({
                    "status": "success",
                    "message": "Reindexing all blogs started. This runs in the background.",
                    "job_id": job_id
                }))
            }
            Err(e) => {
                tracing::error!("Failed to dispatch reindex job: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to start reindex job"))
            }
        }
    }

    /// POST /api/v1/admin/search/index/blogs/not-indexed - Index only blogs not yet indexed
    pub async fn admin_search_index_not_indexed_blogs(
        state: web::Data<AppState>,
    ) -> HttpResponse {
        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Elasticsearch not available"));
            }
        };

        let db = state.db.lock().await;

        // Get all published blog posts (using admin list)
        let all_posts = match blog_read::posts_get_admin(&db, 1, 10000, Some("published"), None).await {
            Ok(posts) => posts,
            Err(e) => {
                tracing::error!("Failed to get blog posts: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get blog posts"));
            }
        };

        // Get indexed IDs
        let indexed_ids = match es.get_indexed_post_ids().await {
            Ok(ids) => ids,
            Err(e) => {
                tracing::warn!("Failed to get indexed IDs: {:?}", e);
                vec![]
            }
        };

        // Find not indexed posts
        let not_indexed_posts: Vec<_> = all_posts
            .into_iter()
            .filter(|p| !indexed_ids.contains(&p.id))
            .collect();

        if not_indexed_posts.is_empty() {
            drop(db);
            return HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "message": "All published blogs are already indexed",
                "indexed_count": 0
            }));
        }

        let count = not_indexed_posts.len();
        let mut indexed_count = 0;
        let mut errors: Vec<i64> = Vec::new();

        // Index each not-indexed post
        for admin_post in not_indexed_posts {
            // Get full post detail by slug
            let post = match blog_read::post_get_detail_by_slug(&db, &admin_post.slug).await {
                Ok(post) => post,
                Err(e) => {
                    tracing::error!("Failed to get post {} detail: {}", admin_post.id, e);
                    errors.push(admin_post.id);
                    continue;
                }
            };

            // Build document
            let categories: Vec<crate::bootstrap::elasticsearch::CategoryRef> =
                serde_json::from_value(post.categories.clone()).unwrap_or_default();
            let tags: Vec<crate::bootstrap::elasticsearch::TagRef> =
                serde_json::from_value(post.tags.clone()).unwrap_or_default();

            let doc = crate::bootstrap::elasticsearch::BlogPostDocument {
                id: post.id,
                title: post.title.clone(),
                slug: post.slug.clone(),
                excerpt: post.excerpt.clone(),
                content: post.content.clone(),
                author_id: post.author_id,
                author_name: post.author_name.clone(),
                categories,
                tags,
                status: post.status.clone(),
                published_at: post.published_at,
                created_at: post.created_at,
                updated_at: post.updated_at,
                view_count: post.view_count,
                is_featured: post.is_featured,
                content_type: "blog".to_string(),
            };

            match es.index_blog_post(&doc).await {
                Ok(_) => indexed_count += 1,
                Err(e) => {
                    tracing::error!("Failed to index post {}: {:?}", post.id, e);
                    errors.push(post.id);
                }
            }
        }

        drop(db);

        // Refresh index
        if indexed_count > 0 {
            if let Err(e) = es.refresh_blog_index().await {
                tracing::warn!("Failed to refresh index: {:?}", e);
            }
        }

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": format!("Indexed {} of {} blogs", indexed_count, count),
            "indexed_count": indexed_count,
            "total_to_index": count,
            "errors": errors
        }))
    }

    // ============================================================================
    // ADMIN SEARCH INDEX SETTINGS ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/search/settings - Get all search index settings
    pub async fn admin_search_settings_get(state: web::Data<AppState>) -> HttpResponse {
        use crate::app::db_query::read::search_settings;

        let db = state.db.lock().await;

        match search_settings::get_all_settings(&db).await {
            Ok(settings) => HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "settings": settings
            })),
            Err(e) => {
                tracing::error!("Failed to get search settings: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get search settings"))
            }
        }
    }

    /// PUT /api/v1/admin/search/settings - Update search index settings
    pub async fn admin_search_settings_update(
        state: web::Data<AppState>,
        body: web::Json<Vec<SearchSettingUpdate>>,
    ) -> HttpResponse {
        use crate::app::db_query::mutations::search_settings;

        let db = state.db.lock().await;
        let settings: Vec<(String, bool)> = body
            .into_inner()
            .into_iter()
            .map(|s| (s.content_type, s.is_enabled))
            .collect();

        match search_settings::update_settings_batch(&db, &settings).await {
            Ok(_) => HttpResponse::Ok().json(BaseResponse::success("Settings updated")),
            Err(e) => {
                tracing::error!("Failed to update search settings: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update settings"))
            }
        }
    }

    /// GET /api/v1/admin/search/settings/enabled - Get enabled content types
    pub async fn admin_search_settings_enabled(state: web::Data<AppState>) -> HttpResponse {
        use crate::app::db_query::read::search_settings;

        let db = state.db.lock().await;

        match search_settings::get_enabled_content_types(&db).await {
            Ok(types) => HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "enabled_types": types
            })),
            Err(e) => {
                tracing::error!("Failed to get enabled content types: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get enabled types"))
            }
        }
    }

    // ============================================================================
    // PUBLIC CATEGORY ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/categories - List active categories (tree structure)
    pub async fn public_list_categories(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match blog_read::categories_get_tree(&db).await {
            Ok(categories) => {
                let dtos: Vec<CategoryTreeDto> =
                    categories.into_iter().map(CategoryTreeDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "categories": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list categories: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list categories"))
            }
        }
    }

    /// GET /api/v1/blog/categories/{slug}/posts - Posts in category
    pub async fn public_get_category_posts(
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let slug = path.into_inner();
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        // Verify category exists
        if let Err(_) = blog_read::category_get_by_slug(&db, &slug).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Category not found"));
        }

        match blog_read::posts_get_by_category(&db, &slug, page, per_page).await {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let mut dtos: Vec<PostListDto> = posts.into_iter().map(PostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                // Populate featured image URLs
                populate_image_urls(&db, &mut dtos).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get category posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get category posts"))
            }
        }
    }

    // ============================================================================
    // PUBLIC TAG ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/tags - List tags (tag cloud data)
    pub async fn public_list_tags(
        state: web::Data<AppState>,
        query: web::Query<TagCloudQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;
        let limit = query.limit.clamp(1, 200);

        match blog_read::tags_get_cloud(&db, limit).await {
            Ok(tags) => {
                let dtos: Vec<TagCloudDto> = tags.into_iter().map(TagCloudDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "tags": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list tags: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list tags"))
            }
        }
    }

    /// GET /api/v1/blog/tags/{slug}/posts - Posts with tag
    pub async fn public_get_tag_posts(
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let slug = path.into_inner();
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        // Verify tag exists
        if let Err(_) = blog_read::tag_get_by_slug(&db, &slug).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Tag not found"));
        }

        match blog_read::posts_get_by_tag(&db, &slug, page, per_page).await {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let mut dtos: Vec<PostListDto> = posts.into_iter().map(PostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                // Populate featured image URLs
                populate_image_urls(&db, &mut dtos).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get tag posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get tag posts"))
            }
        }
    }

    // ============================================================================
    // PUBLIC TAXONOMY ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/taxonomies/{slug}/posts - Posts matching taxonomy
    pub async fn public_get_taxonomy_posts(
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let slug = path.into_inner();
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        // Verify taxonomy exists
        if let Err(_) = blog_read::taxonomy_get_by_slug(&db, &slug).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Taxonomy not found"));
        }

        match blog_read::taxonomy_get_posts(&db, &slug, page, per_page).await {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let mut dtos: Vec<PostListDto> = posts.into_iter().map(PostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                // Populate featured image URLs
                populate_image_urls(&db, &mut dtos).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get taxonomy posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get taxonomy posts"))
            }
        }
    }

    // ============================================================================
    // PUBLIC POST ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/posts/{slug} - Single post (increments view count)
    pub async fn public_get_post(
        state: web::Data<AppState>,
        path: web::Path<String>,
    ) -> HttpResponse {
        let slug = path.into_inner();
        let db = state.db.lock().await;

        match blog_read::post_get_detail_by_slug(&db, &slug).await {
            Ok(post) => {
                // Increment view count (fire and forget)
                let _ = blog_read::post_increment_view_count(&db, post.id).await;

                let mut dto = PostDetailDto::from(post);

                // Populate featured image URL
                dto.featured_image_url = get_image_url(&db, dto.featured_image_id).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "post": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Post not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get post: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get post"))
            }
        }
    }

    /// GET /api/v1/blog/posts - Published posts with pagination
    pub async fn public_list_posts(
        state: web::Data<AppState>,
        query: web::Query<PublicPostListQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        match blog_read::posts_get_published(&db, page, per_page, query.featured_only).await {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let mut dtos: Vec<PostListDto> = posts.into_iter().map(PostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                // Populate featured image URLs
                populate_image_urls(&db, &mut dtos).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list posts"))
            }
        }
    }

    // ============================================================================
    // PUBLIC ARCHIVE ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/archive - Years/months with counts
    pub async fn public_get_archive(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match blog_read::posts_get_archive_data(&db).await {
            Ok(archive) => {
                let dtos: Vec<ArchiveItemDto> =
                    archive.into_iter().map(ArchiveItemDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "archive": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get archive: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get archive"))
            }
        }
    }

    /// GET /api/v1/blog/archive/{year}/{month} - Posts for month
    pub async fn public_get_archive_posts(
        state: web::Data<AppState>,
        path: web::Path<ArchivePath>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let archive_path = path.into_inner();
        let db = state.db.lock().await;
        let page = query.page.max(1);
        let per_page = query.per_page.clamp(1, 50);

        // Validate month
        if archive_path.month < 1 || archive_path.month > 12 {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid month (must be 1-12)"));
        }

        match blog_read::posts_get_by_archive(
            &db,
            archive_path.year,
            archive_path.month,
            page,
            per_page,
        )
        .await
        {
            Ok(posts) => {
                let total = posts.first().map(|p| p.total_count).unwrap_or(0);
                let mut dtos: Vec<PostListDto> = posts.into_iter().map(PostListDto::from).collect();
                let pagination = PaginationInfo::new(page, per_page, total);

                // Populate featured image URLs
                populate_image_urls(&db, &mut dtos).await;

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "year": archive_path.year,
                    "month": archive_path.month,
                    "posts": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to get archive posts: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get archive posts"))
            }
        }
    }

    // ============================================================================
    // PUBLIC SEARCH ENDPOINTS
    // ============================================================================

    /// GET /api/v1/blog/search?q=&page=&per_page= - Search posts (uses Elasticsearch)
    pub async fn public_search(
        req: HttpRequest,
        state: web::Data<AppState>,
        query: web::Query<SearchQuery>,
    ) -> HttpResponse {
        let search_query = query.q.trim();

        if search_query.is_empty() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Search query is required"));
        }

        if search_query.len() > 200 {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Search query too long (max 200 characters)"));
        }

        let es = match state.elasticsearch() {
            Some(es) => es,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Search not available"));
            }
        };

        let page = (query.page.max(1)) as u32;
        let per_page = (query.per_page.clamp(1, 50)) as u32;
        let category = query.category.as_deref().filter(|s| !s.is_empty());

        match es.search_blog_posts(search_query, page, per_page, category).await {
            Ok(response) => {
                // Log search query to analytics
                let db = state.db.lock().await;

                // Get user_id if authenticated (optional)
                let user_id = req.extensions().get::<i64>().copied();

                // Get IP address
                let ip_address = req
                    .connection_info()
                    .realip_remote_addr()
                    .map(|s| s.to_string());

                // Get user agent
                let user_agent = req
                    .headers()
                    .get("user-agent")
                    .and_then(|h| h.to_str().ok())
                    .map(|s| s.to_string());

                let log_params = blog_mutations::LogSearchParams {
                    query: search_query.to_string(),
                    results_count: response.total as i32,
                    search_scope: "all".to_string(),
                    user_id,
                    ip_address,
                    user_agent,
                };

                if let Err(e) = blog_mutations::search_log(&db, &log_params).await {
                    tracing::warn!("Failed to log search: {}", e);
                }

                // Convert to DTOs
                let results: Vec<SearchResultDto> = response
                    .results
                    .into_iter()
                    .map(|r| SearchResultDto {
                        id: r.id,
                        title: r.title,
                        slug: r.slug,
                        excerpt: r.excerpt,
                        author_name: r.author_name,
                        published_at: r.published_at,
                        view_count: r.view_count,
                        is_featured: r.is_featured,
                        categories: r
                            .categories
                            .into_iter()
                            .map(|c| CategoryRefDto {
                                id: c.id,
                                name: c.name,
                                slug: c.slug,
                            })
                            .collect(),
                        tags: r
                            .tags
                            .into_iter()
                            .map(|t| TagRefDto {
                                id: t.id,
                                name: t.name,
                                slug: t.slug,
                            })
                            .collect(),
                        highlights: SearchHighlightsDto {
                            title: r.highlights.title,
                            excerpt: r.highlights.excerpt,
                            content: r.highlights.content,
                        },
                        score: r.score,
                    })
                    .collect();

                let pagination = PaginationInfo::new(
                    page as i32,
                    per_page as i32,
                    response.total as i64,
                );

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "results": results,
                    "pagination": pagination,
                    "query": search_query
                }))
            }
            Err(e) => {
                tracing::error!("Search failed: {:?}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Search failed"))
            }
        }
    }

    // ============================================================================
    // HELPER METHODS - ASYNC INDEXING
    // ============================================================================

    /// Enqueue an index job for a blog post
    ///
    /// This dispatches an async job to RabbitMQ for indexing the post in Elasticsearch.
    /// The job runs in the background, keeping the API response fast.
    async fn enqueue_index_job(state: &web::Data<AppState>, post_id: i64, slug: Option<&str>) {
        let mq = match &state.mq {
            Some(mq) => mq,
            None => {
                tracing::warn!("MQ not available, skipping index job for post {}", post_id);
                return;
            }
        };
        let params = IndexBlogPostParams::index(post_id, slug);
        let options = JobOptions::new()
            .priority(3) // Medium priority
            .fault_tolerance(3);

        if let Err(e) = mq::enqueue_job_dyn(mq, "index_blog_post", &params, options).await {
            tracing::warn!(
                "Failed to enqueue index job for post {}: {}",
                post_id,
                e
            );
        } else {
            tracing::debug!("Index job enqueued for post {}", post_id);
        }
    }

    /// Enqueue a delete job for a blog post
    ///
    /// This dispatches an async job to RabbitMQ for removing the post from Elasticsearch.
    async fn enqueue_delete_job(state: &web::Data<AppState>, post_id: i64, slug: Option<&str>) {
        let mq = match &state.mq {
            Some(mq) => mq,
            None => {
                tracing::warn!("MQ not available, skipping delete job for post {}", post_id);
                return;
            }
        };
        let params = IndexBlogPostParams::delete(post_id, slug);
        let options = JobOptions::new()
            .priority(3) // Medium priority
            .fault_tolerance(3);

        if let Err(e) = mq::enqueue_job_dyn(mq, "index_blog_post", &params, options).await {
            tracing::warn!(
                "Failed to enqueue delete job for post {}: {}",
                post_id,
                e
            );
        } else {
            tracing::debug!("Delete job enqueued for post {}", post_id);
        }
    }
}
