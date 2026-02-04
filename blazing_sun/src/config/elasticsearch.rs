use once_cell::sync::Lazy;

pub struct ElasticsearchConfig {
    pub host: String,
    pub port: u16,
    pub url: String,
    pub index_prefix: String,
}

pub static ELASTICSEARCH: Lazy<ElasticsearchConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("ELASTICSEARCH_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port: u16 = std::env::var("ELASTICSEARCH_PORT")
        .unwrap_or_else(|_| "9200".to_string())
        .parse()
        .expect("ELASTICSEARCH_PORT must be a valid number");
    let index_prefix =
        std::env::var("ELASTICSEARCH_INDEX_PREFIX").unwrap_or_else(|_| "blazing_sun_".to_string());

    let url = format!("http://{}:{}", host, port);

    ElasticsearchConfig {
        host,
        port,
        url,
        index_prefix,
    }
});

impl ElasticsearchConfig {
    pub fn host() -> &'static str {
        &ELASTICSEARCH.host
    }

    pub fn port() -> u16 {
        ELASTICSEARCH.port
    }

    pub fn url() -> &'static str {
        &ELASTICSEARCH.url
    }

    pub fn index_prefix() -> &'static str {
        &ELASTICSEARCH.index_prefix
    }

    /// Get the full index name with prefix
    pub fn index_name(name: &str) -> String {
        format!("{}{}", ELASTICSEARCH.index_prefix, name)
    }

    /// Blog posts index name
    pub fn blog_posts_index() -> String {
        Self::index_name("blog_posts")
    }
}
