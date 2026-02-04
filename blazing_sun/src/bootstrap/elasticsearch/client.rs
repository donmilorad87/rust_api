//! Elasticsearch Client
//!
//! Provides connection and basic operations for Elasticsearch.

use crate::config::ElasticsearchConfig;
use elasticsearch::{
    http::transport::Transport, indices::IndicesCreateParts, indices::IndicesExistsParts,
    indices::IndicesRefreshParts, Elasticsearch,
};
use serde_json::json;
use std::sync::Arc;

/// Type alias for shared Elasticsearch client
pub type SharedElasticsearch = Arc<ElasticsearchClient>;

/// Elasticsearch client wrapper with helper methods
pub struct ElasticsearchClient {
    client: Elasticsearch,
}

impl ElasticsearchClient {
    /// Create a new Elasticsearch client
    pub async fn new() -> Result<Self, elasticsearch::Error> {
        let url = ElasticsearchConfig::url();
        let transport = Transport::single_node(url)?;
        let client = Elasticsearch::new(transport);

        Ok(Self { client })
    }

    /// Get the underlying Elasticsearch client
    pub fn client(&self) -> &Elasticsearch {
        &self.client
    }

    /// Check if connection is healthy
    pub async fn health_check(&self) -> Result<bool, elasticsearch::Error> {
        let response = self.client.ping().send().await?;
        Ok(response.status_code().is_success())
    }

    /// Initialize the blog posts index with mappings
    pub async fn initialize_blog_index(&self) -> Result<(), elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();

        // Check if index exists
        let exists = self
            .client
            .indices()
            .exists(IndicesExistsParts::Index(&[&index_name]))
            .send()
            .await?;

        if exists.status_code().is_success() {
            tracing::info!("Elasticsearch blog posts index already exists");
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
                            "suggest": {
                                "type": "completion",
                                "analyzer": "simple"
                            }
                        }
                    },
                    "slug": { "type": "keyword" },
                    "excerpt": {
                        "type": "text",
                        "analyzer": "blog_analyzer"
                    },
                    "content": {
                        "type": "text",
                        "analyzer": "blog_analyzer"
                    },
                    "author_id": { "type": "long" },
                    "author_name": {
                        "type": "text",
                        "fields": {
                            "keyword": { "type": "keyword" }
                        }
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

        let response = self
            .client
            .indices()
            .create(IndicesCreateParts::Index(&index_name))
            .body(mappings)
            .send()
            .await?;

        if response.status_code().is_success() {
            tracing::info!("Created Elasticsearch blog posts index: {}", index_name);
        } else {
            let error_body = response.text().await?;
            tracing::error!(
                "Failed to create Elasticsearch index: {} - {}",
                index_name,
                error_body
            );
        }

        Ok(())
    }

    /// Refresh the blog posts index to make documents searchable immediately
    pub async fn refresh_blog_index(&self) -> Result<(), elasticsearch::Error> {
        let index_name = ElasticsearchConfig::blog_posts_index();
        self.client
            .indices()
            .refresh(IndicesRefreshParts::Index(&[&index_name]))
            .send()
            .await?;
        Ok(())
    }
}

/// Create a new Elasticsearch client
pub async fn create_elasticsearch() -> Result<SharedElasticsearch, elasticsearch::Error> {
    let client = ElasticsearchClient::new().await?;

    // Initialize blog index
    if let Err(e) = client.initialize_blog_index().await {
        tracing::warn!("Failed to initialize blog index: {:?}", e);
    }

    Ok(Arc::new(client))
}
