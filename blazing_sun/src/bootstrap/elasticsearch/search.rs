//! Blog Search Operations
//!
//! Provides search and indexing operations for blog posts.

use crate::config::ElasticsearchConfig;
use chrono::{DateTime, Utc};
use elasticsearch::{
    DeleteParts, GetParts, IndexParts, SearchParts, UpdateParts,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::ElasticsearchClient;

/// Blog post document for Elasticsearch indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    /// Content type for filtering: "blog", "page", "product", etc.
    pub content_type: String,
}

/// Category reference for nested documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRef {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

/// Tag reference for nested documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagRef {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

/// Search result with highlights
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Search highlights for matching fields
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchHighlights {
    pub title: Option<Vec<String>>,
    pub excerpt: Option<Vec<String>>,
    pub content: Option<Vec<String>>,
}

/// Search response with pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogSearchResponse {
    pub results: Vec<BlogSearchResult>,
    pub total: u64,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}

/// Index statistics for admin dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub total_documents: u64,
    pub health: String,
    pub store_size: String,
    pub index_name: String,
}

/// Indexed document summary for admin list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedDocument {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub content_type: String,
    pub excerpt: Option<String>,
    pub status: String,
    pub updated_at: Option<String>,
}

/// Response for listing indexed documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedDocumentsResponse {
    pub documents: Vec<IndexedDocument>,
    pub total: u64,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}

impl ElasticsearchClient {
    /// Index a blog post document
    pub async fn index_blog_post(&self, post: &BlogPostDocument) -> Result<(), elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        tracing::info!(
            "Elasticsearch: Indexing blog post {} ({}) to index {}",
            post.id,
            post.title,
            index_name
        );

        let response = self
            .client()
            .index(IndexParts::IndexId(&index_name, &post.id.to_string()))
            .body(post)
            .send()
            .await?;

        let status = response.status_code();
        if !status.is_success() {
            let error_body = response.text().await?;
            tracing::error!(
                "Elasticsearch: Failed to index blog post {} - HTTP {} - {}",
                post.id,
                status,
                error_body
            );
            return Err(elasticsearch::Error::from(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Elasticsearch indexing failed: HTTP {} - {}", status, error_body),
            )));
        }

        tracing::info!("Elasticsearch: Successfully indexed blog post {}", post.id);
        Ok(())
    }

    /// Update a blog post document
    pub async fn update_blog_post(&self, post: &BlogPostDocument) -> Result<(), elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        let response = self
            .client()
            .update(UpdateParts::IndexId(&index_name, &post.id.to_string()))
            .body(json!({
                "doc": post,
                "doc_as_upsert": true
            }))
            .send()
            .await?;

        if !response.status_code().is_success() {
            let error_body = response.text().await?;
            tracing::error!("Failed to update blog post {}: {}", post.id, error_body);
        }

        Ok(())
    }

    /// Delete a blog post from the index
    pub async fn delete_blog_post(&self, post_id: i64) -> Result<(), elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        let response = self
            .client()
            .delete(DeleteParts::IndexId(&index_name, &post_id.to_string()))
            .send()
            .await?;

        if !response.status_code().is_success() && response.status_code().as_u16() != 404 {
            let error_body = response.text().await?;
            tracing::error!("Failed to delete blog post {}: {}", post_id, error_body);
        }

        Ok(())
    }

    /// Get a blog post by ID
    pub async fn get_blog_post(&self, post_id: i64) -> Result<Option<BlogPostDocument>, elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        let response = self
            .client()
            .get(GetParts::IndexId(&index_name, &post_id.to_string()))
            .send()
            .await?;

        if response.status_code().as_u16() == 404 {
            return Ok(None);
        }

        let body: Value = response.json().await?;

        if let Some(source) = body.get("_source") {
            let post: BlogPostDocument = serde_json::from_value(source.clone())
                .map_err(|e| {
                    tracing::error!("Failed to parse blog post: {}", e);
                    elasticsearch::Error::from(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        e.to_string(),
                    ))
                })?;
            return Ok(Some(post));
        }

        Ok(None)
    }

    /// Search blog posts with advanced fuzzy matching and highlighting
    ///
    /// Supports:
    /// - Partial word matching ("post" finds "test post")
    /// - Typo tolerance ("tst" finds "test", "est po" finds "test post")
    /// - Multi-field search (title, excerpt, content, author)
    /// - Category filtering
    /// - Highlighting of matched terms
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
        // The "category" parameter here refers to content TYPE (blog, pages, products)
        // not actual blog post categories
        if let Some(content_type) = category {
            if !content_type.is_empty() {
                // Filter by content type (e.g., "blog" for blog posts only)
                filters.push(json!({
                    "term": { "content_type": content_type }
                }));
            }
            // If empty, search all content types (no additional filter)
        }

        // Build advanced search query with multiple strategies:
        // 1. Fuzzy matching for typos (AUTO fuzziness)
        // 2. Phrase prefix for partial word completion
        // 3. Wildcard for flexible partial matching
        // 4. Cross-fields for multi-word queries spanning fields
        let search_body = json!({
            "from": from,
            "size": per_page,
            "query": {
                "bool": {
                    "filter": filters,
                    "should": [
                        // Strategy 1: Exact/fuzzy multi-match with low prefix requirement
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
                        // Strategy 2: Cross-fields for multi-word queries
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "excerpt^2", "content"],
                                "type": "cross_fields",
                                "operator": "or",
                                "boost": 2
                            }
                        },
                        // Strategy 3: Phrase prefix for partial word completion
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "excerpt^2", "content"],
                                "type": "phrase_prefix",
                                "boost": 2.5
                            }
                        },
                        // Strategy 4: Wildcard search for flexible partial matching
                        {
                            "query_string": {
                                "query": format!("*{}*", query.replace(" ", "* *")),
                                "fields": ["title^3", "excerpt^2", "content"],
                                "analyze_wildcard": true,
                                "boost": 1.5
                            }
                        },
                        // Strategy 5: Individual term fuzzy matching (for single typos like "tst")
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
                    "title": {
                        "number_of_fragments": 1,
                        "fragment_size": 200
                    },
                    "excerpt": {
                        "number_of_fragments": 2,
                        "fragment_size": 200
                    },
                    "content": {
                        "number_of_fragments": 3,
                        "fragment_size": 200
                    }
                },
                "pre_tags": ["<mark>"],
                "post_tags": ["</mark>"]
            },
            "sort": [
                { "_score": "desc" },
                { "published_at": "desc" }
            ]
        });

        let response = self
            .client()
            .search(SearchParts::Index(&[&index_name]))
            .body(search_body)
            .send()
            .await?;

        let body: Value = response.json().await?;

        // Parse total hits
        let total = body["hits"]["total"]["value"].as_u64().unwrap_or(0);
        let total_pages = ((total as f64) / (per_page as f64)).ceil() as u32;

        // Parse hits
        let mut results = Vec::new();
        if let Some(hits) = body["hits"]["hits"].as_array() {
            for hit in hits {
                let source = &hit["_source"];
                let score = hit["_score"].as_f64().unwrap_or(0.0) as f32;

                // Parse highlights
                let highlights = if let Some(highlight) = hit.get("highlight") {
                    SearchHighlights {
                        title: highlight["title"]
                            .as_array()
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
                        excerpt: highlight["excerpt"]
                            .as_array()
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
                        content: highlight["content"]
                            .as_array()
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
                    }
                } else {
                    SearchHighlights::default()
                };

                // Parse categories
                let categories: Vec<CategoryRef> = source["categories"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| serde_json::from_value(v.clone()).ok())
                            .collect()
                    })
                    .unwrap_or_default();

                // Parse tags
                let tags: Vec<TagRef> = source["tags"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| serde_json::from_value(v.clone()).ok())
                            .collect()
                    })
                    .unwrap_or_default();

                let result = BlogSearchResult {
                    id: source["id"].as_i64().unwrap_or(0),
                    title: source["title"].as_str().unwrap_or("").to_string(),
                    slug: source["slug"].as_str().unwrap_or("").to_string(),
                    excerpt: source["excerpt"].as_str().map(String::from),
                    author_name: source["author_name"].as_str().unwrap_or("").to_string(),
                    published_at: source["published_at"]
                        .as_str()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    view_count: source["view_count"].as_i64().unwrap_or(0) as i32,
                    is_featured: source["is_featured"].as_bool().unwrap_or(false),
                    categories,
                    tags,
                    highlights,
                    score,
                };

                results.push(result);
            }
        }

        Ok(BlogSearchResponse {
            results,
            total,
            page,
            per_page,
            total_pages,
        })
    }

    /// Get index statistics for admin dashboard
    pub async fn get_index_stats(&self) -> Result<IndexStats, elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        // Get document count
        let count_response = self
            .client()
            .count(elasticsearch::CountParts::Index(&[&index_name]))
            .send()
            .await?;

        let count_body: Value = count_response.json().await?;
        let total_documents = count_body["count"].as_u64().unwrap_or(0);

        // Get index info
        let cat_response = self
            .client()
            .cat()
            .indices(elasticsearch::cat::CatIndicesParts::Index(&[&index_name]))
            .format("json")
            .send()
            .await?;

        let cat_body: Value = cat_response.json().await?;
        let index_info = cat_body.as_array().and_then(|arr| arr.first());

        let health = index_info
            .and_then(|info| info["health"].as_str())
            .unwrap_or("unknown")
            .to_string();

        let store_size = index_info
            .and_then(|info| info["store.size"].as_str())
            .unwrap_or("0b")
            .to_string();

        Ok(IndexStats {
            total_documents,
            health,
            store_size,
            index_name,
        })
    }

    /// List all indexed documents with pagination (for admin)
    pub async fn list_indexed_documents(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<IndexedDocumentsResponse, elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();
        let from = (page.saturating_sub(1)) * per_page;

        let search_body = json!({
            "from": from,
            "size": per_page,
            "query": {
                "match_all": {}
            },
            "sort": [
                { "updated_at": "desc" }
            ],
            "_source": ["id", "title", "slug", "status", "excerpt", "updated_at", "published_at"]
        });

        let response = self
            .client()
            .search(SearchParts::Index(&[&index_name]))
            .body(search_body)
            .send()
            .await?;

        let body: Value = response.json().await?;
        let total = body["hits"]["total"]["value"].as_u64().unwrap_or(0);
        let total_pages = ((total as f64) / (per_page as f64)).ceil() as u32;

        let mut documents = Vec::new();
        if let Some(hits) = body["hits"]["hits"].as_array() {
            for hit in hits {
                let source = &hit["_source"];
                documents.push(IndexedDocument {
                    id: source["id"].as_i64().unwrap_or(0),
                    title: source["title"].as_str().unwrap_or("").to_string(),
                    slug: source["slug"].as_str().unwrap_or("").to_string(),
                    content_type: source["content_type"].as_str().unwrap_or("blog").to_string(),
                    excerpt: source["excerpt"].as_str().map(String::from),
                    status: source["status"].as_str().unwrap_or("").to_string(),
                    updated_at: source["updated_at"].as_str().map(String::from),
                });
            }
        }

        Ok(IndexedDocumentsResponse {
            documents,
            total,
            page,
            per_page,
            total_pages,
        })
    }

    /// Check which post IDs are indexed
    pub async fn get_indexed_post_ids(&self) -> Result<Vec<i64>, elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        // Use scroll API for getting all IDs efficiently
        let search_body = json!({
            "size": 10000,
            "query": {
                "match_all": {}
            },
            "_source": ["id"]
        });

        let response = self
            .client()
            .search(SearchParts::Index(&[&index_name]))
            .body(search_body)
            .send()
            .await?;

        let body: Value = response.json().await?;
        let mut ids = Vec::new();

        if let Some(hits) = body["hits"]["hits"].as_array() {
            for hit in hits {
                if let Some(id) = hit["_source"]["id"].as_i64() {
                    ids.push(id);
                }
            }
        }

        Ok(ids)
    }

    /// Get search suggestions (autocomplete)
    pub async fn get_search_suggestions(
        &self,
        query: &str,
        limit: u32,
    ) -> Result<Vec<String>, elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        let search_body = json!({
            "suggest": {
                "title-suggest": {
                    "prefix": query,
                    "completion": {
                        "field": "title.suggest",
                        "size": limit,
                        "skip_duplicates": true,
                        "fuzzy": {
                            "fuzziness": "AUTO"
                        }
                    }
                }
            }
        });

        let response = self
            .client()
            .search(SearchParts::Index(&[&index_name]))
            .body(search_body)
            .send()
            .await?;

        let body: Value = response.json().await?;

        let mut suggestions = Vec::new();
        if let Some(suggest) = body["suggest"]["title-suggest"].as_array() {
            for item in suggest {
                if let Some(options) = item["options"].as_array() {
                    for option in options {
                        if let Some(text) = option["text"].as_str() {
                            suggestions.push(text.to_string());
                        }
                    }
                }
            }
        }

        Ok(suggestions)
    }
}
