# Blog System Documentation

This document provides comprehensive documentation for the Blog System in the Blazing Sun application, including database schema, API endpoints, Elasticsearch integration, and frontend pages.

---

## Overview

The Blazing Sun Blog System provides a full-featured content management solution with:

- **Hierarchical Categories** - Nested category structure for content organization
- **Tags** - Flexible tagging system with tag cloud support
- **Taxonomies** - Dynamic rule-based content grouping
- **Full-text Search** - Elasticsearch-powered search with fuzzy matching
- **Search Analytics** - Track search queries and click behavior
- **Archive** - Year/month archive navigation
- **Admin Dashboard** - Complete content management interface

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Blog System                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │  PostgreSQL │     │Elasticsearch│     │  RabbitMQ   │                   │
│  │  (Primary)  │────▶│  (Search)   │◀────│  (Indexing) │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                   Rust Application Layer                     │           │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │           │
│  │  │ db_query/read │  │db_query/mutations│  │   API        │    │           │
│  │  │    (blog.rs)  │  │   (blog.rs)   │  │Controllers   │    │           │
│  │  └───────────────┘  └───────────────┘  └───────────────┘    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `blog_categories` | Hierarchical content categories |
| `blog_tags` | Post tags for flexible labeling |
| `blog_posts` | Blog post content and metadata |
| `blog_post_categories` | Many-to-many: posts to categories |
| `blog_post_tags` | Many-to-many: posts to tags |
| `blog_taxonomies` | Dynamic rule-based content groupings |
| `blog_taxonomy_required_tags` | Taxonomy rules: required tags |
| `blog_taxonomy_required_categories` | Taxonomy rules: required categories |
| `blog_taxonomy_explicit_posts` | Taxonomy rules: explicit post inclusion |
| `blog_search_analytics` | Search query tracking and analytics |

### blog_categories

Hierarchical category system with parent-child relationships.

```sql
CREATE TABLE blog_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id BIGINT REFERENCES blog_categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Features:**
- Self-referential for nested categories
- Unique slugs for URL routing
- Sort order for custom ordering
- Soft delete via `is_active` flag

### blog_tags

Simple tagging system for flexible content organization.

```sql
CREATE TABLE blog_tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### blog_posts

Main content table with full metadata support.

```sql
CREATE TABLE blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, published, scheduled, archived
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),
    published_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Status Values:**
- `draft` - Not published, only visible to admin
- `published` - Live and visible to public
- `scheduled` - Set to publish at future date
- `archived` - Removed from public but preserved

### blog_post_categories & blog_post_tags

Junction tables for many-to-many relationships.

```sql
CREATE TABLE blog_post_categories (
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

CREATE TABLE blog_post_tags (
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
```

### blog_taxonomies

Dynamic rule-based content grouping system.

```sql
CREATE TABLE blog_taxonomies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    display_title VARCHAR(255),
    featured_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,
    rule_logic VARCHAR(10) NOT NULL DEFAULT 'all',  -- 'all' or 'any'
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Rule Logic:**
- `all` - Posts must match ALL rules
- `any` - Posts can match ANY rule

### Taxonomy Rule Tables

```sql
-- Required tags for taxonomy
CREATE TABLE blog_taxonomy_required_tags (
    taxonomy_id BIGINT REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (taxonomy_id, tag_id)
);

-- Required categories for taxonomy
CREATE TABLE blog_taxonomy_required_categories (
    taxonomy_id BIGINT REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (taxonomy_id, category_id)
);

-- Explicit post inclusion in taxonomy
CREATE TABLE blog_taxonomy_explicit_posts (
    taxonomy_id BIGINT REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES blog_posts(id) ON DELETE CASCADE,
    PRIMARY KEY (taxonomy_id, post_id)
);
```

### blog_search_analytics

Track search queries for analytics and content gap analysis.

```sql
CREATE TABLE blog_search_analytics (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    query_normalized VARCHAR(255) NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    search_scope VARCHAR(20) NOT NULL DEFAULT 'posts',  -- posts, categories, tags, all
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    clicked_post_id BIGINT REFERENCES blog_posts(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API Endpoints

### Admin API (Requires Admin Permission Level 10+)

All admin endpoints are under `/api/v1/admin/blog/`.

#### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blog/categories` | List all categories (including inactive) |
| POST | `/api/v1/admin/blog/categories` | Create category |
| GET | `/api/v1/admin/blog/categories/{id}` | Get category by ID |
| PUT | `/api/v1/admin/blog/categories/{id}` | Update category |
| DELETE | `/api/v1/admin/blog/categories/{id}` | Soft delete category |

**Create Category Request:**
```json
{
    "name": "Technology",
    "slug": "technology",
    "description": "Posts about technology",
    "parent_category_id": null,
    "sort_order": 0
}
```

#### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blog/tags` | List all tags (including inactive) |
| POST | `/api/v1/admin/blog/tags` | Create tag |
| GET | `/api/v1/admin/blog/tags/{id}` | Get tag by ID |
| PUT | `/api/v1/admin/blog/tags/{id}` | Update tag |
| DELETE | `/api/v1/admin/blog/tags/{id}` | Soft delete tag |

**Create Tag Request:**
```json
{
    "name": "Rust",
    "slug": "rust",
    "description": "Posts about Rust programming"
}
```

#### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blog/posts` | List posts with filters |
| POST | `/api/v1/admin/blog/posts` | Create post |
| GET | `/api/v1/admin/blog/posts/{id}` | Get post by ID |
| PUT | `/api/v1/admin/blog/posts/{id}` | Update post |
| DELETE | `/api/v1/admin/blog/posts/{id}` | Soft delete post |
| POST | `/api/v1/admin/blog/posts/{id}/featured` | Toggle featured status |

**Query Parameters for List:**
- `page` (default: 1)
- `per_page` (default: 16)
- `status` (optional: draft, published, scheduled, archived)
- `search` (optional: search in title)

**Create Post Request:**
```json
{
    "title": "Getting Started with Rust",
    "slug": "getting-started-with-rust",
    "excerpt": "Learn the basics of Rust programming",
    "content": "<p>Full post content here...</p>",
    "featured_image_id": 123,
    "status": "draft",
    "meta_title": "Getting Started with Rust | Blog",
    "meta_description": "A beginner's guide to Rust programming",
    "published_at": "2024-01-15T10:00:00Z",
    "is_featured": false,
    "allow_comments": true,
    "category_ids": [1, 2],
    "tag_ids": [5, 6, 7]
}
```

#### Taxonomies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blog/taxonomies` | List all taxonomies |
| POST | `/api/v1/admin/blog/taxonomies` | Create taxonomy |
| GET | `/api/v1/admin/blog/taxonomies/{id}` | Get taxonomy with rules |
| PUT | `/api/v1/admin/blog/taxonomies/{id}` | Update taxonomy |
| DELETE | `/api/v1/admin/blog/taxonomies/{id}` | Soft delete taxonomy |
| PUT | `/api/v1/admin/blog/taxonomies/{id}/rules` | Update taxonomy rules |

**Create Taxonomy Request:**
```json
{
    "name": "Featured Rust Articles",
    "slug": "featured-rust",
    "description": "Our best Rust programming articles",
    "display_title": "Top Rust Programming Articles",
    "featured_image_id": null,
    "rule_logic": "all",
    "sort_order": 0,
    "required_tag_ids": [5],
    "required_category_ids": [1],
    "explicit_post_ids": [10, 20]
}
```

#### Search Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blog/analytics/search` | Get search analytics summary |
| GET | `/api/v1/admin/blog/analytics/zero-results` | Get zero-result searches |

**Query Parameters:**
- `days` (default: 30) - Number of days to analyze
- `limit` (default: 50) - Maximum results

#### Reindex

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/blog/reindex` | Trigger Elasticsearch reindexing |
| POST | `/api/v1/admin/blog/reindex/{id}` | Reindex single post |

### Public API (No Authentication Required)

All public endpoints are under `/api/v1/blog/`.

#### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/categories` | List active categories |
| GET | `/api/v1/blog/categories/tree` | Get category tree with post counts |
| GET | `/api/v1/blog/categories/{slug}` | Get category by slug |
| GET | `/api/v1/blog/categories/{slug}/posts` | Get posts in category |

#### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/tags` | List active tags |
| GET | `/api/v1/blog/tags/cloud` | Get tag cloud (with post counts) |
| GET | `/api/v1/blog/tags/{slug}` | Get tag by slug |
| GET | `/api/v1/blog/tags/{slug}/posts` | Get posts with tag |

**Tag Cloud Query Parameters:**
- `limit` (default: 50) - Maximum tags to return

#### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/posts` | List published posts |
| GET | `/api/v1/blog/posts/{slug}` | Get post by slug |
| GET | `/api/v1/blog/posts/featured` | Get featured posts |

**Query Parameters:**
- `page` (default: 1)
- `per_page` (default: 16)
- `featured_only` (default: false)

#### Archive

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/archive` | Get archive data (year/month counts) |
| GET | `/api/v1/blog/archive/{year}/{month}` | Get posts for year/month |

#### Taxonomies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/taxonomies` | List active taxonomies |
| GET | `/api/v1/blog/taxonomies/{slug}` | Get taxonomy by slug |
| GET | `/api/v1/blog/taxonomies/{slug}/posts` | Get posts matching taxonomy |

#### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog/search` | Search posts (Elasticsearch) |
| POST | `/api/v1/blog/search/log-click` | Log search result click |

**Search Query Parameters:**
- `q` (required) - Search query
- `page` (default: 1)
- `per_page` (default: 16)
- `category` (optional) - Filter by content type

---

## Database Queries

### Read Operations

Located in: `blazing_sun/src/app/db_query/read/blog.rs`

#### Category Queries

```rust
// Get all active categories
pub async fn categories_get_all(db: &Pool<Postgres>) -> Result<Vec<BlogCategory>, sqlx::Error>

// Get all categories including inactive (admin)
pub async fn categories_get_all_admin(db: &Pool<Postgres>) -> Result<Vec<BlogCategory>, sqlx::Error>

// Get category by ID
pub async fn category_get_by_id(db: &Pool<Postgres>, category_id: i64) -> Result<BlogCategory, sqlx::Error>

// Get category by slug
pub async fn category_get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<BlogCategory, sqlx::Error>

// Get category tree (hierarchical with post counts)
pub async fn categories_get_tree(db: &Pool<Postgres>) -> Result<Vec<BlogCategoryTreeNode>, sqlx::Error>

// Check if slug exists
pub async fn category_slug_exists(db: &Pool<Postgres>, slug: &str) -> bool
```

#### Tag Queries

```rust
// Get all active tags
pub async fn tags_get_all(db: &Pool<Postgres>) -> Result<Vec<BlogTag>, sqlx::Error>

// Get tag cloud (tags with post counts)
pub async fn tags_get_cloud(db: &Pool<Postgres>, limit: i32) -> Result<Vec<TagCloudItem>, sqlx::Error>

// Get tag by slug
pub async fn tag_get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<BlogTag, sqlx::Error>
```

#### Post Queries

```rust
// Get published posts with pagination
pub async fn posts_get_published(
    db: &Pool<Postgres>,
    page: i32,
    per_page: i32,
    featured_only: bool,
) -> Result<Vec<BlogPostListItemFeatured>, sqlx::Error>

// Get post detail by slug (with categories and tags)
pub async fn post_get_detail_by_slug(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<BlogPostDetail, sqlx::Error>

// Get posts by category
pub async fn posts_get_by_category(
    db: &Pool<Postgres>,
    category_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error>

// Get posts by tag
pub async fn posts_get_by_tag(
    db: &Pool<Postgres>,
    tag_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error>

// Get archive data
pub async fn posts_get_archive_data(db: &Pool<Postgres>) -> Result<Vec<ArchiveItem>, sqlx::Error>

// Get posts by archive period
pub async fn posts_get_by_archive(
    db: &Pool<Postgres>,
    year: i32,
    month: i32,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error>

// Increment view count
pub async fn post_increment_view_count(db: &Pool<Postgres>, post_id: i64) -> Result<(), sqlx::Error>
```

#### Taxonomy Queries

```rust
// Get taxonomy posts by slug
pub async fn taxonomy_get_posts(
    db: &Pool<Postgres>,
    taxonomy_slug: &str,
    page: i32,
    per_page: i32,
) -> Result<Vec<BlogPostListItem>, sqlx::Error>

// Get taxonomy with rules
pub async fn taxonomy_get_by_id_with_rules(
    db: &Pool<Postgres>,
    taxonomy_id: i64,
) -> Result<BlogTaxonomyWithRules, sqlx::Error>
```

#### Search Analytics Queries

```rust
// Get search analytics summary
pub async fn search_analytics_get_summary(
    db: &Pool<Postgres>,
    days: i32,
    limit: i32,
) -> Result<Vec<SearchAnalyticsSummary>, sqlx::Error>

// Get zero-result searches
pub async fn search_analytics_get_zero_results(
    db: &Pool<Postgres>,
    days: i32,
    limit: i32,
) -> Result<Vec<ZeroResultSearch>, sqlx::Error>
```

### Mutation Operations

Located in: `blazing_sun/src/app/db_query/mutations/blog.rs`

#### Category Mutations

```rust
// Create category (via stored procedure)
pub async fn category_create(
    db: &Pool<Postgres>,
    params: &CreateCategoryParams,
) -> Result<i64, sqlx::Error>

// Update category (via stored procedure)
pub async fn category_update(
    db: &Pool<Postgres>,
    category_id: i64,
    params: &UpdateCategoryParams,
) -> Result<bool, sqlx::Error>

// Soft delete category (via stored procedure)
pub async fn category_delete(db: &Pool<Postgres>, category_id: i64) -> Result<bool, sqlx::Error>
```

#### Post Mutations

```rust
// Create post (via stored procedure)
pub async fn post_create(
    db: &Pool<Postgres>,
    params: &CreatePostParams,
) -> Result<i64, sqlx::Error>

// Update post (via stored procedure)
pub async fn post_update(
    db: &Pool<Postgres>,
    post_id: i64,
    params: &UpdatePostParams,
) -> Result<bool, sqlx::Error>

// Set post categories (replaces existing)
pub async fn post_set_categories(
    db: &Pool<Postgres>,
    post_id: i64,
    category_ids: &[i64],
) -> Result<(), sqlx::Error>

// Set post tags (replaces existing)
pub async fn post_set_tags(
    db: &Pool<Postgres>,
    post_id: i64,
    tag_ids: &[i64],
) -> Result<(), sqlx::Error>

// Toggle featured status
pub async fn post_toggle_featured(db: &Pool<Postgres>, post_id: i64) -> Result<bool, sqlx::Error>
```

#### Search Analytics Mutations

```rust
// Log a search query
pub async fn search_log(
    db: &Pool<Postgres>,
    params: &LogSearchParams,
) -> Result<i64, sqlx::Error>

// Log a search click
pub async fn search_log_click(
    db: &Pool<Postgres>,
    search_id: i64,
    post_id: i64,
) -> Result<bool, sqlx::Error>

// Cleanup old analytics data
pub async fn search_analytics_cleanup(
    db: &Pool<Postgres>,
    older_than_days: i32,
) -> Result<u64, sqlx::Error>
```

---

## Web Routes

### Public Blog Routes (English)

| Route Name | URL | Description |
|------------|-----|-------------|
| `web.blog` | `/blog` | Blog homepage |
| `web.blog.post` | `/blog/{slug}` | Single post |
| `web.blog.category` | `/blog/category/{slug}` | Category listing |
| `web.blog.tag` | `/blog/tag/{slug}` | Tag listing |
| `web.blog.taxonomy` | `/blog/taxonomy/{slug}` | Taxonomy listing |
| `web.blog.search` | `/blog/search` | Search page |
| `web.blog.archive_index` | `/blog/archive` | Archive index |
| `web.blog.archive` | `/blog/archive/{year}/{month}` | Archive month |

### Public Blog Routes (Serbian)

| Route Name | URL (Serbian) |
|------------|---------------|
| `web.blog` | `/blog` |
| `web.blog.post` | `/blog/{slug}` |
| `web.blog.category` | `/blog/kategorija/{slug}` |
| `web.blog.tag` | `/blog/oznaka/{slug}` |
| `web.blog.taxonomy` | `/blog/taksonomija/{slug}` |
| `web.blog.search` | `/blog/pretraga` |
| `web.blog.archive_index` | `/blog/arhiva` |
| `web.blog.archive` | `/blog/arhiva/{year}/{month}` |

### Admin Blog Routes (English)

| Route Name | URL | Description |
|------------|-----|-------------|
| `admin.blog` | `/admin/blog` | Admin dashboard |
| `admin.blog.categories` | `/admin/blog/categories` | Manage categories |
| `admin.blog.tags` | `/admin/blog/tags` | Manage tags |
| `admin.blog.posts` | `/admin/blog/posts` | Manage posts |
| `admin.blog.posts.new` | `/admin/blog/posts/new` | Create new post |
| `admin.blog.posts.edit` | `/admin/blog/posts/{id}/edit` | Edit post |
| `admin.blog.taxonomies` | `/admin/blog/taxonomies` | Manage taxonomies |
| `admin.blog.analytics` | `/admin/blog/analytics` | Search analytics |

### Admin Blog Routes (Serbian)

| Route Name | URL (Serbian) |
|------------|---------------|
| `admin.blog` | `/admin/blog` |
| `admin.blog.categories` | `/admin/blog/kategorije` |
| `admin.blog.tags` | `/admin/blog/oznake` |
| `admin.blog.posts` | `/admin/blog/clanci` |
| `admin.blog.posts.new` | `/admin/blog/clanci/novi` |
| `admin.blog.posts.edit` | `/admin/blog/clanci/{id}/izmeni` |
| `admin.blog.taxonomies` | `/admin/blog/taksonomije` |
| `admin.blog.analytics` | `/admin/blog/analitika` |

---

## Frontend Pages

### Public Pages

| Page Directory | Purpose | Template |
|----------------|---------|----------|
| `BLOG_HOME` | Blog homepage with featured/recent posts | `blog/home.html` |
| `BLOG_POST` | Single post view | `blog/post.html` |
| `BLOG_CATEGORY` | Posts filtered by category | `blog/category.html` |
| `BLOG_TAG` | Posts filtered by tag | `blog/tag.html` |
| `BLOG_TAXONOMY` | Posts matching taxonomy rules | `blog/taxonomy.html` |
| `BLOG_SEARCH` | Search results page | `blog/search.html` |
| `BLOG_ARCHIVE` | Archive month listing | `blog/archive.html` |
| `BLOG_POSTS` | All posts listing | `blog/posts.html` |
| `BLOG_CATEGORIES` | All categories listing | `blog/categories.html` |
| `BLOG_TAGS` | All tags listing | `blog/tags.html` |
| `BLOG_TAXONOMIES` | All taxonomies listing | `blog/taxonomies.html` |

### Admin Pages

| Page Directory | Purpose | Template |
|----------------|---------|----------|
| `BLOG_ADMIN` | Admin dashboard | `admin/blog/index.html` |
| `BLOG_ANALYTICS` | Search analytics dashboard | `admin/blog/analytics.html` |

### Frontend Build Structure

Each page follows the standard Vite build pattern:

```
src/frontend/pages/BLOG_HOME/
├── src/
│   ├── js/
│   │   └── BlogHome.js    # Main ES6 class
│   └── styles/
│       └── _blog_home.scss
├── package.json
├── vite.config.js
└── index.html
```

**Build Commands:**
```bash
cd src/frontend/pages/BLOG_HOME
npm install
npm run build       # Development build
npm run build:prod  # Production build
npm run watch       # Watch mode
```

---

## Stored Procedures

The blog system uses PostgreSQL stored procedures for complex operations:

| Procedure | Purpose |
|-----------|---------|
| `sp_create_blog_category` | Create category with validation |
| `sp_update_blog_category` | Update category fields |
| `sp_delete_blog_category` | Soft delete category |
| `sp_create_blog_tag` | Create tag with validation |
| `sp_update_blog_tag` | Update tag fields |
| `sp_delete_blog_tag` | Soft delete tag |
| `sp_create_blog_post` | Create post with validation |
| `sp_update_blog_post` | Update post fields |
| `sp_delete_blog_post` | Soft delete post |
| `sp_set_blog_post_categories` | Replace post categories |
| `sp_set_blog_post_tags` | Replace post tags |
| `sp_get_blog_category_tree` | Get hierarchical category tree |
| `sp_get_blog_tag_cloud` | Get tags with post counts |
| `sp_get_published_posts` | Get paginated published posts |
| `sp_get_posts_by_category` | Get posts by category slug |
| `sp_get_posts_by_tag` | Get posts by tag slug |
| `sp_get_blog_archive_data` | Get year/month post counts |
| `sp_get_posts_by_archive` | Get posts for year/month |
| `sp_get_blog_post_by_slug` | Get post detail with categories/tags |
| `sp_admin_get_blog_posts` | Admin post listing with filters |
| `sp_create_blog_taxonomy` | Create taxonomy |
| `sp_update_blog_taxonomy` | Update taxonomy |
| `sp_delete_blog_taxonomy` | Soft delete taxonomy |
| `sp_set_taxonomy_rules` | Set taxonomy rules |
| `sp_get_taxonomy_posts` | Get posts matching taxonomy |
| `sp_log_blog_search_click` | Log search result click |
| `sp_get_blog_search_analytics_summary` | Get search analytics |
| `sp_get_blog_zero_result_searches` | Get zero-result queries |

---

## Related Documentation

- **[Elasticsearch Documentation](../Elasticsearch/ELASTICSEARCH.md)** - Full-text search integration
- **[Database Documentation](../Database/DATABASE.md)** - SQLx patterns and migrations
- **[Frontend Documentation](../Frontend/README.md)** - Vite build system
- **[Controllers Documentation](../Controllers/CONTROLLERS.md)** - API controller patterns

---

## Migration Files

Blog migrations are located in `blazing_sun/migrations/`:

| Migration | Description |
|-----------|-------------|
| `20260201000001_create_blog_categories_table.sql` | Categories table |
| `20260201000002_create_blog_tags_table.sql` | Tags table |
| `20260201000003_create_blog_posts_table.sql` | Posts table |
| `20260201000004_create_blog_post_categories_table.sql` | Post-category junction |
| `20260201000005_create_blog_post_tags_table.sql` | Post-tag junction |
| `20260201000006_create_blog_taxonomies_table.sql` | Taxonomies table |
| `20260201000007_create_blog_taxonomy_rules_tables.sql` | Taxonomy rule tables |
| `20260201000008_create_blog_search_analytics_table.sql` | Search analytics |
| `20260201000009_create_blog_triggers.sql` | Timestamp triggers |
| `20260201000010_create_blog_stored_procedures.sql` | All stored procedures |
