# Elasticsearch Documentation

This document provides comprehensive documentation for the Elasticsearch integration in the Blazing Sun application, including Docker setup, Rust client implementation, search functionality, and indexing jobs.

---

## Overview

Elasticsearch provides full-text search capabilities for the blog system:

- **Full-text Search** - Advanced search with fuzzy matching and typo tolerance
- **Multi-field Search** - Search across title, excerpt, content, and author
- **Highlighting** - Mark matched terms in search results
- **Autocomplete** - Search suggestions for better UX
- **Analytics** - Search query tracking and content gap analysis

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Elasticsearch Integration                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │  PostgreSQL │────▶│  RabbitMQ   │────▶│Elasticsearch│                   │
│  │ (Source of  │     │ (Indexing   │     │  (Search    │                   │
│  │   Truth)    │     │    Jobs)    │     │   Index)    │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│         │                   │                   │                           │
│         └──────────┬───────┴───────────────────┘                           │
│                    ▼                                                        │
│         ┌─────────────────────────────────────────────┐                    │
│         │              Rust Application               │                    │
│         │  ┌─────────────┐    ┌─────────────────────┐ │                    │
│         │  │ES Client    │    │index_blog_post Job  │ │                    │
│         │  │(bootstrap/  │    │(mq/jobs/workers)    │ │                    │
│         │  │elasticsearch)│    │                     │ │                    │
│         │  └─────────────┘    └─────────────────────┘ │                    │
│         └─────────────────────────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Docker Setup

### Network Configuration

| Property | Value |
|----------|-------|
| **Service** | elasticsearch |
| **IP Address** | 172.28.0.27 |
| **HTTP Port** | 9200 |
| **Transport Port** | 9300 |
| **Network** | devnet |
| **Container** | elasticsearch |

### Docker Compose Configuration

```yaml
elasticsearch:
  build:
    context: ./elasticsearch
    dockerfile: Dockerfile
    args:
      ELASTICSEARCH_PORT: ${ELASTICSEARCH_PORT:-9200}
      ELASTICSEARCH_HEAP_SIZE: ${ELASTICSEARCH_HEAP_SIZE:-512m}
  image: elasticsearch-search
  pull_policy: build
  container_name: elasticsearch
  hostname: elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms${ELASTICSEARCH_HEAP_SIZE:-512m} -Xmx${ELASTICSEARCH_HEAP_SIZE:-512m}"
    - cluster.name=blazing-sun-cluster
    - node.name=elasticsearch-node-1
    - bootstrap.memory_lock=true
    - xpack.ml.enabled=false
  ulimits:
    memlock:
      soft: -1
      hard: -1
    nofile:
      soft: 65536
      hard: 65536
  volumes:
    - esdata:/usr/share/elasticsearch/data
  ports:
    - "${ELASTICSEARCH_PORT:-9200}:9200"
    - "9300:9300"
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "/usr/local/bin/elasticsearch-healthcheck.sh"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s
  networks:
    devnet:
      ipv4_address: ${ELASTICSEARCH_IP:-172.28.0.27}
```

### Dockerfile

Located at: `/home/milner/Desktop/rust/elasticsearch/Dockerfile`

```dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Build arguments from docker-compose
ARG ELASTICSEARCH_PORT
ARG ELASTICSEARCH_HEAP_SIZE

USER root

# Set environment variables
ENV ELASTICSEARCH_PORT=${ELASTICSEARCH_PORT:-9200}
ENV ES_JAVA_OPTS="-Xms${ELASTICSEARCH_HEAP_SIZE:-512m} -Xmx${ELASTICSEARCH_HEAP_SIZE:-512m}"

# Cluster configuration
ENV discovery.type=single-node
ENV xpack.security.enabled=false
ENV xpack.security.enrollment.enabled=false
ENV cluster.name=blazing-sun-cluster
ENV node.name=elasticsearch-node-1

# Performance tuning
ENV bootstrap.memory_lock=true
ENV indices.memory.index_buffer_size=20%
ENV indices.queries.cache.size=20%

# Disable ML features (reduces memory usage)
ENV xpack.ml.enabled=false

# Copy configuration files
COPY --chmod=644 elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY --chmod=755 entrypoint.sh /custom-entrypoint.sh
COPY --chmod=755 healthcheck.sh /usr/local/bin/elasticsearch-healthcheck.sh

# Create data directory with proper permissions
RUN mkdir -p /usr/share/elasticsearch/data && \
    chown -R elasticsearch:elasticsearch /usr/share/elasticsearch/data

VOLUME /usr/share/elasticsearch/data

EXPOSE 9200 9300

USER elasticsearch

ENTRYPOINT ["/custom-entrypoint.sh"]
```

### Configuration File (elasticsearch.yml)

Located at: `/home/milner/Desktop/rust/elasticsearch/elasticsearch.yml`

```yaml
# Cluster
cluster.name: blazing-sun-cluster
node.name: elasticsearch-node-1

# Network
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300

# Discovery (single-node)
discovery.type: single-node

# Security (disabled for development)
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false

# Memory
bootstrap.memory_lock: true
indices.memory.index_buffer_size: 20%
indices.queries.cache.size: 20%

# Machine Learning (disabled to save memory)
xpack.ml.enabled: false

# Monitoring (disabled)
xpack.monitoring.collection.enabled: false

# Logging
logger.level: INFO
logger.org.elasticsearch.discovery: DEBUG

# Action
action.destructive_requires_name: true

# HTTP (CORS for development)
http.cors.enabled: true
http.cors.allow-origin: "*"
http.cors.allow-methods: OPTIONS, HEAD, GET, POST, PUT, DELETE
http.cors.allow-headers: X-Requested-With, Content-Type, Content-Length, Authorization
http.max_content_length: 100mb
```

### Entrypoint Script

Located at: `/home/milner/Desktop/rust/elasticsearch/entrypoint.sh`

```bash
#!/bin/bash
set -e

echo "=============================================="
echo "  Elasticsearch Container Starting"
echo "=============================================="

echo "Configuration:"
echo "  - Cluster Name: blazing-sun-cluster"
echo "  - Node Name: elasticsearch-node-1"
echo "  - HTTP Port: ${ELASTICSEARCH_PORT:-9200}"
echo "  - Transport Port: 9300"
echo "  - Heap Size: ${ES_JAVA_OPTS}"
echo "  - Discovery Type: single-node"
echo "  - Security: disabled"

# Set JVM options if not already set
if [ -z "$ES_JAVA_OPTS" ]; then
    export ES_JAVA_OPTS="-Xms512m -Xmx512m"
fi

echo "Starting Elasticsearch..."
exec /usr/local/bin/docker-entrypoint.sh elasticsearch
```

### Health Check Script

Located at: `/home/milner/Desktop/rust/elasticsearch/healthcheck.sh`

```bash
#!/bin/bash
set -e

ES_HOST="${ELASTICSEARCH_HOST:-localhost}"
ES_PORT="${ELASTICSEARCH_PORT:-9200}"
ES_URL="http://${ES_HOST}:${ES_PORT}"

# Check if Elasticsearch is responding
if ! curl -s "${ES_URL}" > /dev/null 2>&1; then
    echo "Elasticsearch is not responding at ${ES_URL}"
    exit 1
fi

# Check cluster health
HEALTH_RESPONSE=$(curl -s "${ES_URL}/_cluster/health" 2>/dev/null)

if [ -z "$HEALTH_RESPONSE" ]; then
    echo "Failed to get cluster health"
    exit 1
fi

STATUS=$(echo "$HEALTH_RESPONSE" | grep -oP '"status"\s*:\s*"\K[^"]+')

if [ "$STATUS" = "green" ] || [ "$STATUS" = "yellow" ]; then
    echo "Elasticsearch is healthy (status: $STATUS)"
    exit 0
else
    echo "Elasticsearch cluster is unhealthy (status: $STATUS)"
    exit 1
fi
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ELASTICSEARCH_HOST` | `elasticsearch` | Elasticsearch hostname |
| `ELASTICSEARCH_PORT` | `9200` | HTTP API port |
| `ELASTICSEARCH_HEAP_SIZE` | `512m` | JVM heap size |
| `ELASTICSEARCH_INDEX_PREFIX` | `blazing_sun_` | Index name prefix |
| `ELASTICSEARCH_IP` | `172.28.0.27` | Docker network IP |

### Configuration in Rust

Located at: `blazing_sun/src/config/elasticsearch.rs`

```rust
pub struct ElasticsearchConfig {
    pub host: String,
    pub port: u16,
    pub url: String,
    pub index_prefix: String,
}

impl ElasticsearchConfig {
    pub fn host() -> &'static str { &ELASTICSEARCH.host }
    pub fn port() -> u16 { ELASTICSEARCH.port }
    pub fn url() -> &'static str { &ELASTICSEARCH.url }
    pub fn index_prefix() -> &'static str { &ELASTICSEARCH.index_prefix }

    /// Get the full index name with prefix
    pub fn index_name(name: &str) -> String {
        format!("{}{}", ELASTICSEARCH.index_prefix, name)
    }

    /// Blog posts index name
    pub fn blog_posts_index() -> String {
        Self::index_name("blog_posts")
    }
}
```

---

## Rust Client Implementation

### Client Module

Located at: `blazing_sun/src/bootstrap/elasticsearch/`

```
bootstrap/elasticsearch/
├── mod.rs       # Module exports
├── client.rs    # Client wrapper and initialization
└── search.rs    # Search and indexing operations
```

### Client Initialization

```rust
// Create shared Elasticsearch client
pub async fn create_elasticsearch() -> Result<SharedElasticsearch, elasticsearch::Error> {
    let client = ElasticsearchClient::new().await?;

    // Initialize blog index
    if let Err(e) = client.initialize_blog_index().await {
        tracing::warn!("Failed to initialize blog index: {:?}", e);
    }

    Ok(Arc::new(client))
}
```

### Index Initialization

The client automatically creates the blog posts index with mappings:

```rust
pub async fn initialize_blog_index(&self) -> Result<(), elasticsearch::Error> {
    let index_name = ElasticsearchConfig::blog_posts_index();

    // Check if index exists
    let exists = self.client.indices()
        .exists(IndicesExistsParts::Index(&[&index_name]))
        .send().await?;

    if exists.status_code().is_success() {
        return Ok(());
    }

    // Create index with mappings
    let mappings = json!({
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "analysis": {
                "analyzer": {
                    "blog_analyzer": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase", "asciifolding", "blog_stemmer"]
                    }
                },
                "filter": {
                    "blog_stemmer": {
                        "type": "stemmer",
                        "language": "english"
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "id": { "type": "long" },
                "title": {
                    "type": "text",
                    "analyzer": "blog_analyzer",
                    "fields": {
                        "keyword": { "type": "keyword" },
                        "suggest": { "type": "completion", "analyzer": "simple" }
                    }
                },
                "slug": { "type": "keyword" },
                "excerpt": { "type": "text", "analyzer": "blog_analyzer" },
                "content": { "type": "text", "analyzer": "blog_analyzer" },
                "author_id": { "type": "long" },
                "author_name": {
                    "type": "text",
                    "fields": { "keyword": { "type": "keyword" } }
                },
                "categories": {
                    "type": "nested",
                    "properties": {
                        "id": { "type": "long" },
                        "name": { "type": "keyword" },
                        "slug": { "type": "keyword" }
                    }
                },
                "tags": {
                    "type": "nested",
                    "properties": {
                        "id": { "type": "long" },
                        "name": { "type": "keyword" },
                        "slug": { "type": "keyword" }
                    }
                },
                "status": { "type": "keyword" },
                "published_at": { "type": "date" },
                "created_at": { "type": "date" },
                "updated_at": { "type": "date" },
                "view_count": { "type": "integer" },
                "is_featured": { "type": "boolean" }
            }
        }
    });

    self.client.indices()
        .create(IndicesCreateParts::Index(&index_name))
        .body(mappings)
        .send().await?;

    Ok(())
}
```

---

## Search Functionality

### Search Method

The search implementation uses multiple strategies for comprehensive matching:

1. **Fuzzy multi-match** - Handles typos with AUTO fuzziness
2. **Cross-fields** - Multi-word queries spanning fields
3. **Phrase prefix** - Partial word completion
4. **Wildcard** - Flexible partial matching
5. **Individual term fuzzy** - Single typo tolerance

```rust
pub async fn search_blog_posts(
    &self,
    query: &str,
    page: u32,
    per_page: u32,
    category: Option<&str>,
) -> Result<BlogSearchResponse, elasticsearch::Error> {
    let index_name = ElasticsearchConfig::blog_posts_index();
    let from = (page.saturating_sub(1)) * per_page;

    // Build filter array
    let mut filters = vec![json!({ "term": { "status": "published" } })];

    // Add content type filter if specified
    if let Some(content_type) = category {
        if !content_type.is_empty() {
            filters.push(json!({ "term": { "content_type": content_type } }));
        }
    }

    let search_body = json!({
        "from": from,
        "size": per_page,
        "query": {
            "bool": {
                "filter": filters,
                "should": [
                    // Strategy 1: Fuzzy multi-match
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^4", "excerpt^2", "content", "author_name"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                            "prefix_length": 1,
                            "boost": 3
                        }
                    },
                    // Strategy 2: Cross-fields
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "excerpt^2", "content"],
                            "type": "cross_fields",
                            "operator": "or",
                            "boost": 2
                        }
                    },
                    // Strategy 3: Phrase prefix
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "excerpt^2", "content"],
                            "type": "phrase_prefix",
                            "boost": 2.5
                        }
                    },
                    // Strategy 4: Wildcard
                    {
                        "query_string": {
                            "query": format!("*{}*", query.replace(" ", "* *")),
                            "fields": ["title^3", "excerpt^2", "content"],
                            "analyze_wildcard": true,
                            "boost": 1.5
                        }
                    },
                    // Strategy 5: High fuzziness
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "excerpt^2", "content"],
                            "fuzziness": 2,
                            "prefix_length": 0,
                            "boost": 1
                        }
                    }
                ],
                "minimum_should_match": 1
            }
        },
        "highlight": {
            "fields": {
                "title": { "number_of_fragments": 1, "fragment_size": 200 },
                "excerpt": { "number_of_fragments": 2, "fragment_size": 200 },
                "content": { "number_of_fragments": 3, "fragment_size": 200 }
            },
            "pre_tags": ["<mark>"],
            "post_tags": ["</mark>"]
        },
        "sort": [
            { "_score": "desc" },
            { "published_at": "desc" }
        ]
    });

    // Execute and parse response...
}
```

### Search Response Structure

```rust
pub struct BlogSearchResponse {
    pub results: Vec<BlogSearchResult>,
    pub total: u64,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}

pub struct BlogSearchResult {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub author_name: String,
    pub published_at: Option<DateTime<Utc>>,
    pub view_count: i32,
    pub is_featured: bool,
    pub categories: Vec<CategoryRef>,
    pub tags: Vec<TagRef>,
    pub highlights: SearchHighlights,
    pub score: f32,
}

pub struct SearchHighlights {
    pub title: Option<Vec<String>>,
    pub excerpt: Option<Vec<String>>,
    pub content: Option<Vec<String>>,
}
```

### Additional Search Methods

```rust
// Index a blog post
pub async fn index_blog_post(&self, post: &BlogPostDocument) -> Result<(), Error>

// Update a blog post
pub async fn update_blog_post(&self, post: &BlogPostDocument) -> Result<(), Error>

// Delete a blog post from index
pub async fn delete_blog_post(&self, post_id: i64) -> Result<(), Error>

// Get a blog post by ID
pub async fn get_blog_post(&self, post_id: i64) -> Result<Option<BlogPostDocument>, Error>

// Get search suggestions (autocomplete)
pub async fn get_search_suggestions(&self, query: &str, limit: u32) -> Result<Vec<String>, Error>

// Get index statistics
pub async fn get_index_stats(&self) -> Result<IndexStats, Error>

// List indexed documents (admin)
pub async fn list_indexed_documents(&self, page: u32, per_page: u32) -> Result<IndexedDocumentsResponse, Error>

// Get all indexed post IDs
pub async fn get_indexed_post_ids(&self) -> Result<Vec<i64>, Error>

// Health check
pub async fn health_check(&self) -> Result<bool, Error>

// Refresh index (make documents searchable immediately)
pub async fn refresh_blog_index(&self) -> Result<(), Error>
```

---

## Blog Post Indexing Job

### Job Module

Located at: `blazing_sun/src/app/mq/jobs/index_blog_post/mod.rs`

### Job Actions

```rust
pub enum IndexAction {
    /// Index a new post or update existing
    Index,
    /// Delete a post from the index
    Delete,
    /// Reindex all published posts (bulk operation)
    ReindexAll,
}

pub struct IndexBlogPostParams {
    pub action: IndexAction,
    pub post_id: Option<i64>,
    pub post_slug: Option<String>,
}

impl IndexBlogPostParams {
    /// Create params for indexing a single post
    pub fn index(post_id: i64, post_slug: Option<&str>) -> Self

    /// Create params for deleting a post from the index
    pub fn delete(post_id: i64, post_slug: Option<&str>) -> Self

    /// Create params for reindexing all posts
    pub fn reindex_all() -> Self
}
```

### Enqueueing Jobs

```rust
use crate::app::mq::jobs::IndexBlogPostParams;
use crate::bootstrap::mq::{self, JobOptions};

// Index a single post after creation/update
let params = IndexBlogPostParams::index(post_id, Some(&post_slug));
let options = JobOptions::new().priority(2);
mq::enqueue_job_dyn(&mq, "index_blog_post", &params, options).await?;

// Delete from index
let params = IndexBlogPostParams::delete(post_id, Some(&post_slug));
mq::enqueue_job_dyn(&mq, "index_blog_post", &params, options).await?;

// Reindex all posts (admin operation)
let params = IndexBlogPostParams::reindex_all();
mq::enqueue_job_dyn(&mq, "index_blog_post", &params, options).await?;
```

### Worker Module

Located at: `blazing_sun/src/app/mq/workers/index_blog_post/mod.rs`

The worker processes jobs from RabbitMQ:

```rust
pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    // Deserialize parameters
    let params: IndexBlogPostParams = serde_json::from_str(&job.payload)?;

    // Get Elasticsearch client
    let es_client = mq.elasticsearch()
        .ok_or("Elasticsearch client not available")?;

    // Execute the indexing job
    match index_blog_post::execute(mq.db(), es_client, &params).await {
        Ok(true) => Ok(JobResult::Success(json!({
            "action": format!("{:?}", params.action),
            "post_id": params.post_id,
            "status": "success"
        }))),
        Ok(false) => Ok(JobResult::Retry("Job returned false".to_string())),
        Err(e) => {
            // Retry on connection errors, fail on others
            if is_retryable_error(&e) {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
```

### Index Single Post Logic

```rust
async fn index_single_post(
    db: &Pool<Postgres>,
    es_client: &ElasticsearchClient,
    post_id: i64,
    post_slug: Option<&str>,
) -> Result<bool, String> {
    // Fetch post with categories and tags
    let post = sqlx::query_as::<_, PostForIndex>(r#"
        SELECT
            p.id, p.title, p.slug, p.excerpt, p.content, p.status,
            p.is_featured, p.view_count, p.published_at, p.created_at,
            p.updated_at, p.author_id,
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
    "#)
    .bind(post_id)
    .fetch_optional(db)
    .await?;

    // Only index published posts
    if post.status != "published" {
        // Remove from index if not published
        return delete_single_post(es_client, post_id, post_slug).await;
    }

    // Build document
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
        categories: serde_json::from_value(post.categories_json).unwrap_or_default(),
        tags: serde_json::from_value(post.tags_json).unwrap_or_default(),
        content_type: "blog".to_string(),
    };

    // Index the document
    es_client.index_blog_post(&document).await?;

    Ok(true)
}
```

---

## Document Structure

### BlogPostDocument

```rust
pub struct BlogPostDocument {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub author_id: i64,
    pub author_name: String,
    pub categories: Vec<CategoryRef>,
    pub tags: Vec<TagRef>,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub view_count: i32,
    pub is_featured: bool,
    pub content_type: String,  // "blog", "page", "product", etc.
}

pub struct CategoryRef {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

pub struct TagRef {
    pub id: i64,
    pub name: String,
    pub slug: String,
}
```

---

## Admin Operations

### Trigger Reindex

```bash
# Via API
curl -X POST https://localhost/api/v1/admin/blog/reindex \
    -H "Authorization: Bearer {admin_token}"

# Reindex single post
curl -X POST https://localhost/api/v1/admin/blog/reindex/123 \
    -H "Authorization: Bearer {admin_token}"
```

### Get Index Statistics

```bash
# Via Elasticsearch directly
curl http://localhost:9200/blazing_sun_blog_posts/_stats

# Via API
curl https://localhost/api/v1/admin/search/stats \
    -H "Authorization: Bearer {admin_token}"
```

### Check Cluster Health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

---

## Troubleshooting

### Common Issues

**1. Elasticsearch not starting:**
```bash
# Check logs
docker compose logs elasticsearch

# Common fix: increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
```

**2. Index not created:**
```bash
# Check if index exists
curl http://localhost:9200/blazing_sun_blog_posts

# Manually create (application does this on startup)
# Restart rust container to trigger initialization
docker compose restart rust
```

**3. Search returning no results:**
```bash
# Check document count
curl http://localhost:9200/blazing_sun_blog_posts/_count

# Check a document
curl http://localhost:9200/blazing_sun_blog_posts/_search?size=1

# Trigger reindex via admin API
```

**4. Memory issues:**
```bash
# Adjust heap size in .env
ELASTICSEARCH_HEAP_SIZE=1g

# Restart container
docker compose restart elasticsearch
```

### Useful Commands

```bash
# Enter Elasticsearch container
docker compose exec elasticsearch bash

# Check cluster health
curl -X GET "localhost:9200/_cluster/health?pretty"

# List all indices
curl -X GET "localhost:9200/_cat/indices?v"

# Get index mappings
curl -X GET "localhost:9200/blazing_sun_blog_posts/_mapping?pretty"

# Search all documents
curl -X GET "localhost:9200/blazing_sun_blog_posts/_search?pretty" \
    -H "Content-Type: application/json" \
    -d '{"query": {"match_all": {}}}'

# Delete index (caution!)
curl -X DELETE "localhost:9200/blazing_sun_blog_posts"
```

---

## Related Documentation

- **[Blog System Documentation](../Blog/BLOG.md)** - Blog database and API
- **[Message Queue Documentation](../MessageQueue/MESSAGE_QUEUE.md)** - RabbitMQ job processing
- **[Infrastructure Documentation](../../docker_infrastructure/INFRASTRUCTURE.md)** - Docker setup

---

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| Dockerfile | `/home/milner/Desktop/rust/elasticsearch/Dockerfile` | Container build |
| elasticsearch.yml | `/home/milner/Desktop/rust/elasticsearch/elasticsearch.yml` | ES configuration |
| entrypoint.sh | `/home/milner/Desktop/rust/elasticsearch/entrypoint.sh` | Startup script |
| healthcheck.sh | `/home/milner/Desktop/rust/elasticsearch/healthcheck.sh` | Health check |
| elasticsearch.rs | `blazing_sun/src/config/elasticsearch.rs` | Rust config |
| mod.rs | `blazing_sun/src/bootstrap/elasticsearch/mod.rs` | Module exports |
| client.rs | `blazing_sun/src/bootstrap/elasticsearch/client.rs` | ES client |
| search.rs | `blazing_sun/src/bootstrap/elasticsearch/search.rs` | Search operations |
| Job mod.rs | `blazing_sun/src/app/mq/jobs/index_blog_post/mod.rs` | Indexing job |
| Worker mod.rs | `blazing_sun/src/app/mq/workers/index_blog_post/mod.rs` | Job worker |
