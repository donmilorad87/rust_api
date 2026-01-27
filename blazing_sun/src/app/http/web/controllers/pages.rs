//! Pages Controller
//!
//! Handles web page rendering using Tera templates.
//!
//! ## Named Routes in Templates
//!
//! Use the `route()` function to generate URLs from route names:
//!
//! ```html
//! <a href="{{ route(name='web.sign_up') }}">Sign Up</a>
//! <a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>
//! ```
//!
//! See `bootstrap/utility/template.rs` for available routes and documentation.

use crate::app::db_query::read::localization as db_localization;
use crate::app::db_query::read::page_hreflang as db_page_hreflang;
use crate::app::db_query::read::page_schema as db_page_schema;
use crate::app::db_query::read::page_seo as db_page_seo;
use crate::app::db_query::read::schema_entity as db_schema_entity;
use crate::bootstrap::routes::controller::api::{
    get_route_registry_snapshot, route_with_lang, DEFAULT_LANG,
};
use crate::bootstrap::utility::auth::is_logged;
use crate::bootstrap::utility::csrf;
use crate::bootstrap::utility::template::{
    get_assets_version, get_images_version, register_template_functions,
};
use crate::database::read::site_config as db_site_config;
use crate::database::read::user as db_user;
use crate::database::AppState;
use actix_session::Session;
use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Result};
use once_cell::sync::Lazy;
use serde::Serialize;
use sqlx::{Pool, Postgres};
use std::collections::{HashMap, HashSet};
use tera::{Context, Tera};
use tracing::error;

/// Initialize Tera template engine with all web templates
///
/// This registers custom functions including:
/// - `route(name, ...)` - Generate URLs from named routes
static WEB_TEMPLATES: Lazy<Tera> = Lazy::new(|| {
    // Load only from views/web directory
    let template_pattern = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/resources/views/web/**/*.html"
    );

    let mut tera = match Tera::new(template_pattern) {
        Ok(t) => t,
        Err(e) => {
            panic!("Failed to initialize web templates: {}", e);
        }
    };

    // Register custom template functions (route(), etc.)
    register_template_functions(&mut tera);

    tera.autoescape_on(vec![".html"]);
    tera
});

/// Pages controller for rendering web pages
pub struct PagesController;

/// Theme cookie name (must match JavaScript ThemeManager)
const THEME_COOKIE_NAME: &str = "blazing_sun_theme";

/// Route context extracted by the routing layer for template use
#[derive(Debug, Clone, Serialize)]
pub struct RouteContext {
    pub language: String,
    pub country: Option<String>,
    pub region: Option<String>,
    pub name: String,
    pub args: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HreflangLink {
    pub code: String,
    pub href: String,
}

/// User data for template context
#[derive(Serialize)]
struct TemplateUser {
    id: i64,
    email: String,
    first_name: String,
    last_name: String,
    avatar_url: Option<String>,
}

impl PagesController {
    /// Get the base URL from the request
    fn get_base_url(req: &HttpRequest) -> String {
        let conn_info = req.connection_info();
        format!("{}://{}", conn_info.scheme(), conn_info.host())
    }

    fn normalize_path(path: &str) -> String {
        let trimmed = path.trim_matches('/');
        if trimmed.is_empty() {
            "/".to_string()
        } else {
            format!("/{}", trimmed)
        }
    }

    fn build_path_aliases(path: &str) -> Vec<String> {
        let normalized = Self::normalize_path(path);
        let mut candidates = vec![normalized.clone()];

        if normalized.contains('_') {
            candidates.push(normalized.replace('_', "-"));
        }
        if normalized.contains('-') {
            candidates.push(normalized.replace('-', "_"));
        }

        candidates.sort();
        candidates.dedup();
        candidates
    }

    fn collect_headers_lowercase(req: &HttpRequest) -> HashMap<String, String> {
        let mut headers = HashMap::new();
        for (name, value) in req.headers().iter() {
            let key = name.as_str().to_lowercase();
            let value = value.to_str().unwrap_or("").trim().to_string();
            headers.insert(key, value);
        }
        headers
    }

    fn extract_country_region(
        headers: &HashMap<String, String>,
    ) -> (Option<String>, Option<String>) {
        let country = headers.get("x-country").and_then(|value| {
            let normalized = value.to_lowercase();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });

        let region = headers.get("x-region").and_then(|value| {
            let normalized = value.to_lowercase();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });

        if country.is_none() {
            return (None, None);
        }

        (country, region)
    }

    fn build_qualified_path(
        language: &str,
        country: Option<&str>,
        region: Option<&str>,
        route_path: &str,
    ) -> String {
        let mut segments = vec![language.to_string()];

        if let Some(country) = country {
            segments.push(country.to_string());
            if let Some(region) = region {
                segments.push(region.to_string());
            }
        }

        let normalized_route = Self::normalize_path(route_path);
        if normalized_route != "/" {
            segments.push(normalized_route.trim_start_matches('/').to_string());
        }

        format!("/{}", segments.join("/"))
    }

    fn hreflang_code(language: &str) -> String {
        match language {
            "en" => "en-US".to_string(),
            "sr" => "sr-RS".to_string(),
            _ => language.to_lowercase(),
        }
    }

    fn lang_from_hreflang_code(code: &str) -> String {
        code.split(&['-', '_'])
            .next()
            .unwrap_or(code)
            .to_lowercase()
    }

    fn normalize_hreflang_href(
        href: &str,
        base_url: &str,
        language: &str,
        country: Option<&str>,
        region: Option<&str>,
    ) -> String {
        let trimmed = href.trim();
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            return trimmed.to_string();
        }

        let path = if trimmed.starts_with('/') {
            trimmed.to_string()
        } else {
            format!("/{}", trimmed)
        };

        let mut segments: Vec<&str> = path
            .trim_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect();

        if let Some(first) = segments.first() {
            if *first == language {
                segments.remove(0);
                if let Some(country) = country {
                    if segments.first() == Some(&country) {
                        segments.remove(0);
                        if let Some(region) = region {
                            if segments.first() == Some(&region) {
                                segments.remove(0);
                            }
                        }
                    }
                }
            }
        }

        let remaining = if segments.is_empty() {
            "/".to_string()
        } else {
            format!("/{}", segments.join("/"))
        };

        let rebuilt = Self::build_qualified_path(language, country, region, &remaining);
        format!("{}{}", base_url, rebuilt)
    }

    fn build_hreflang_links_from_entries(
        req: &HttpRequest,
        route_ctx: &RouteContext,
        entries: &[db_page_hreflang::PageHreflang],
    ) -> Vec<HreflangLink> {
        if entries.is_empty() {
            return Self::build_hreflang_links(req, route_ctx);
        }

        let mut links = Vec::new();
        let base_url = Self::get_base_url(req);
        let country = route_ctx.country.as_deref();
        let region = route_ctx.region.as_deref();

        for entry in entries {
            let lang = Self::lang_from_hreflang_code(&entry.lang_code);
            let href =
                Self::normalize_hreflang_href(&entry.href, &base_url, &lang, country, region);
            links.push(HreflangLink {
                code: entry.lang_code.clone(),
                href,
            });
        }

        if let Some(entry) = entries.iter().find(|entry| entry.is_default) {
            let lang = Self::lang_from_hreflang_code(&entry.lang_code);
            let href =
                Self::normalize_hreflang_href(&entry.href, &base_url, &lang, country, region);
            links.push(HreflangLink {
                code: "x-default".to_string(),
                href,
            });
        } else if let Some(entry) = entries
            .iter()
            .find(|entry| Self::lang_from_hreflang_code(&entry.lang_code) == DEFAULT_LANG)
        {
            let href = Self::normalize_hreflang_href(
                &entry.href,
                &base_url,
                DEFAULT_LANG,
                country,
                region,
            );
            links.push(HreflangLink {
                code: "x-default".to_string(),
                href,
            });
        }

        links
    }

    fn build_hreflang_links(req: &HttpRequest, route_ctx: &RouteContext) -> Vec<HreflangLink> {
        let mut links = Vec::new();
        let base_url = Self::get_base_url(req);
        let country = route_ctx.country.as_deref();
        let region = route_ctx.region.as_deref();

        let languages = vec!["en", "sr"];
        for lang in languages {
            if let Some(route_path) = route_with_lang(&route_ctx.name, lang, Some(&route_ctx.args))
            {
                let localized_path = Self::build_qualified_path(lang, country, region, &route_path);
                links.push(HreflangLink {
                    code: Self::hreflang_code(lang),
                    href: format!("{}{}", base_url, localized_path),
                });
            }
        }

        if let Some(route_path) =
            route_with_lang(&route_ctx.name, DEFAULT_LANG, Some(&route_ctx.args))
        {
            let localized_path =
                Self::build_qualified_path(DEFAULT_LANG, country, region, &route_path);
            links.push(HreflangLink {
                code: "x-default".to_string(),
                href: format!("{}{}", base_url, localized_path),
            });
        }

        links
    }

    fn match_route_pattern(pattern: &str, path: &str) -> Option<HashMap<String, String>> {
        let normalized_pattern = Self::normalize_path(pattern);
        let normalized_path = Self::normalize_path(path);

        let pattern_segments: Vec<&str> = normalized_pattern
            .trim_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect();
        let path_segments: Vec<&str> = normalized_path
            .trim_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect();

        if pattern_segments.is_empty() && path_segments.is_empty() {
            return Some(HashMap::new());
        }

        if pattern_segments.len() != path_segments.len() {
            return None;
        }

        let mut args = HashMap::new();
        for (pattern_segment, path_segment) in pattern_segments.iter().zip(path_segments.iter()) {
            if pattern_segment.starts_with('{') && pattern_segment.ends_with('}') {
                let key = pattern_segment
                    .trim_start_matches('{')
                    .trim_end_matches('}');
                args.insert(key.to_string(), path_segment.to_string());
            } else if pattern_segment != path_segment {
                return None;
            }
        }

        Some(args)
    }

    fn resolve_route_by_path(
        path: &str,
        registry: &HashMap<String, HashMap<String, String>>,
    ) -> Option<(String, String, HashMap<String, String>)> {
        for (name, lang_map) in registry {
            if !Self::is_web_route(name) {
                continue;
            }
            for (lang, pattern) in lang_map {
                if let Some(args) = Self::match_route_pattern(pattern, path) {
                    return Some((name.clone(), lang.clone(), args));
                }
            }
        }
        None
    }

    fn resolve_route_for_lang(
        route_path: &str,
        language: &str,
        registry: &HashMap<String, HashMap<String, String>>,
    ) -> Option<(String, HashMap<String, String>)> {
        for (name, lang_map) in registry {
            if !Self::is_web_route(name) {
                continue;
            }
            if let Some(pattern) = lang_map.get(language) {
                if let Some(args) = Self::match_route_pattern(pattern, route_path) {
                    return Some((name.clone(), args));
                }
            }
        }
        None
    }

    fn is_web_route(name: &str) -> bool {
        name.starts_with("web.")
            || name.starts_with("admin.")
            || name.starts_with("superadmin.")
            || name.starts_with("oauth.")
    }

    fn build_route_redirect(req: &HttpRequest, route_name: &str) -> Option<String> {
        let extensions = req.extensions();
        let route_ctx = extensions.get::<RouteContext>();
        let lang = route_ctx
            .map(|ctx| ctx.language.as_str())
            .unwrap_or(DEFAULT_LANG);
        let route_path = route_with_lang(route_name, lang, None)?;

        let (country, region) = route_ctx
            .map(|ctx| (ctx.country.as_deref(), ctx.region.as_deref()))
            .unwrap_or((None, None));

        Some(Self::build_qualified_path(
            lang,
            country,
            region,
            &route_path,
        ))
    }

    /// Get theme from cookie
    /// Returns "dark" or "light" (defaults to "light" if not set)
    fn get_theme(req: &HttpRequest) -> String {
        req.cookie(THEME_COOKIE_NAME)
            .map(|c| c.value().to_string())
            .filter(|v| v == "dark" || v == "light")
            .unwrap_or_else(|| "light".to_string())
    }

    /// Create base context with common variables and auth info
    fn base_context(req: &HttpRequest, session: &Session) -> Context {
        let auth = is_logged(req);

        let mut context = Context::new();
        context.insert("base_url", &Self::get_base_url(req));
        context.insert("year", &chrono::Utc::now().format("%Y").to_string());
        context.insert("app_name", "Blazing Sun");
        context.insert("is_logged", &auth.is_logged);
        // Admin permission flags for navigation
        context.insert("is_admin", &auth.is_admin());
        context.insert("is_super_admin", &auth.is_super_admin());
        // Theme from cookie (server-side rendering)
        context.insert("theme", &Self::get_theme(req));
        // Asset versioning for cache busting
        context.insert("assets_version", get_assets_version());
        context.insert("images_version", get_images_version());
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
        }

        if let Some(route_ctx) = req.extensions().get::<RouteContext>() {
            context.insert("language", &route_ctx.language);
            context.insert("country", &route_ctx.country);
            context.insert("region", &route_ctx.region);
            context.insert("route_name", &route_ctx.name);
            context.insert("route_args", &route_ctx.args);
            context.insert("html_lang", &route_ctx.language);
        } else {
            context.insert("language", DEFAULT_LANG);
            context.insert("country", &Option::<String>::None);
            context.insert("region", &Option::<String>::None);
            context.insert("route_name", "");
            context.insert("route_args", &HashMap::<String, String>::new());
            context.insert("html_lang", DEFAULT_LANG);
        }

        // CSRF token for forms and AJAX requests
        if let Ok(token) = csrf::get_or_create_token(session) {
            context.insert("csrf_token", &token);
        } else {
            error!("Failed to get or create CSRF token");
            context.insert("csrf_token", "");
        }

        context
    }

    /// Add branding info (logo, favicon, site identity) to template context
    /// Uses ID-based asset rendering - automatically determines public/private from database
    async fn add_branding_to_context(context: &mut Context, db: &Pool<Postgres>) {
        if let Ok(branding) = db_site_config::get_branding(db).await {
            // Site identity (name, visibility, colors, size)
            context.insert("site_name", &branding.site_name);
            context.insert("show_site_name", &branding.show_site_name);
            context.insert("identity_color_start", &branding.identity_color_start);
            context.insert("identity_color_end", &branding.identity_color_end);
            context.insert("identity_size", &branding.identity_size);
            // Override app_name with site_name from database
            context.insert("app_name", &branding.site_name);

            // Logo - use ID-based asset rendering (unified approach)
            // Automatically determines public/private from database storage_type
            if let Some(logo_id) = branding.logo_id {
                use crate::bootstrap::utility::template::asset_by_id;
                // Use medium variant for logo (768px) for good quality on most screens
                if let Some(logo_url) = asset_by_id(db, logo_id, Some("medium")).await {
                    context.insert("logo_url", &logo_url);
                }
            }

            // Favicon - use ID-based asset rendering (unified approach)
            // Automatically determines public/private from database storage_type
            if let Some(favicon_id) = branding.favicon_id {
                use crate::bootstrap::utility::template::asset_by_id;
                // Use small variant for favicon (320px) suitable for browser tabs
                if let Some(favicon_url) = asset_by_id(db, favicon_id, Some("small")).await {
                    context.insert("favicon_url", &favicon_url);
                }
            }
        }
    }

    /// Add available languages to template context for language dropdown
    /// Fetches languages with their locales from database
    async fn add_languages_to_context(context: &mut Context, db: &Pool<Postgres>) {
        if let Ok(languages) = db_localization::get_languages_for_dropdown(db).await {
            context.insert("available_languages", &languages);
        }
    }

    /// Add SEO meta and JSON-LD schemas to template context
    /// Fetches page_seo by route_name and associated active schemas
    async fn add_seo_to_context(
        req: &HttpRequest,
        context: &mut Context,
        db: &Pool<Postgres>,
        route_name: &str,
    ) {
        let extensions = req.extensions();
        let route_ctx = extensions.get::<RouteContext>();
        let language = route_ctx
            .map(|ctx| ctx.language.as_str())
            .unwrap_or(DEFAULT_LANG);

        let translation = db_page_seo::get_translation_by_route_lang(db, route_name, language)
            .await
            .ok()
            .flatten();
        let fallback = if language != DEFAULT_LANG {
            db_page_seo::get_translation_by_route_lang(db, route_name, DEFAULT_LANG)
                .await
                .ok()
                .flatten()
        } else {
            None
        };

        let legacy_meta = if translation.is_none() && fallback.is_none() {
            db_page_seo::get_meta_by_route(db, route_name).await.ok()
        } else {
            None
        };

        if let Some(meta) = translation.as_ref().or(fallback.as_ref()) {
            if let Some(ref title) = meta.title {
                context.insert("seo_title", title);
            }
            if let Some(ref description) = meta.description {
                context.insert("seo_description", description);
            }
            if let Some(ref keywords) = meta.keywords {
                context.insert("seo_keywords", keywords);
            }
            if let Some(ref robots) = meta.robots {
                context.insert("seo_robots", robots);
            }

            if let Some(ref og_title) = meta.og_title {
                context.insert("og_title", og_title);
            }
            if let Some(ref og_desc) = meta.og_description {
                context.insert("og_description", og_desc);
            }
            if let Some(ref og_type) = meta.og_type {
                context.insert("og_type", og_type);
            }

            if let Some(ref twitter_card) = meta.twitter_card {
                context.insert("twitter_card", twitter_card);
            }
            if let Some(ref twitter_title) = meta.twitter_title {
                context.insert("twitter_title", twitter_title);
            }
            if let Some(ref twitter_desc) = meta.twitter_description {
                context.insert("twitter_description", twitter_desc);
            }
        } else if let Some(seo) = legacy_meta {
            // Basic meta tags
            if let Some(ref title) = seo.title {
                context.insert("seo_title", title);
            }
            if let Some(ref description) = seo.description {
                context.insert("seo_description", description);
            }
            if let Some(ref keywords) = seo.keywords {
                context.insert("seo_keywords", keywords);
            }
            if let Some(ref robots) = seo.robots {
                context.insert("seo_robots", robots);
            }
            // Open Graph
            if let Some(ref og_title) = seo.og_title {
                context.insert("og_title", og_title);
            }
            if let Some(ref og_desc) = seo.og_description {
                context.insert("og_description", og_desc);
            }
            if let Some(ref og_type) = seo.og_type {
                context.insert("og_type", og_type);
            }

            // Twitter Card
            if let Some(ref twitter_card) = seo.twitter_card {
                context.insert("twitter_card", twitter_card);
            }
            if let Some(ref twitter_title) = seo.twitter_title {
                context.insert("twitter_title", twitter_title);
            }
            if let Some(ref twitter_desc) = seo.twitter_description {
                context.insert("twitter_description", twitter_desc);
            }
        }

        let canonical_url = format!("{}{}", Self::get_base_url(req), req.path());
        context.insert("seo_canonical", &canonical_url);

        // Fetch page_seo ID to get schemas
        if let Ok(page_seo) = db_page_seo::get_by_route(db, route_name).await {
            let schema_lang = route_ctx
                .map(|ctx| ctx.language.as_str())
                .unwrap_or(DEFAULT_LANG);
            // Fetch active schemas for this page
            if let Ok(schemas) =
                db_page_schema::get_active_by_page_seo_id_lang(db, page_seo.id, schema_lang).await
            {
                let mut nodes: std::collections::HashMap<String, serde_json::Value> =
                    std::collections::HashMap::new();
                let mut references: std::collections::HashSet<String> =
                    std::collections::HashSet::new();
                let mut root_nodes: Vec<serde_json::Value> = Vec::new();

                for s in schemas {
                    // Skip if no schema_data (entity not found via JOIN)
                    let Some(mut schema) = s.schema_data else {
                        continue;
                    };
                    if let serde_json::Value::Object(ref mut map) = schema {
                        if !map.contains_key("@type") {
                            map.insert(
                                "@type".to_string(),
                                serde_json::Value::String(s.schema_type.clone()),
                            );
                        }
                    }

                    let normalized =
                        Self::normalize_schema_for_graph(schema, &mut nodes, &mut references);
                    if let serde_json::Value::Object(ref map) = normalized {
                        if map.len() == 1 && map.contains_key("@id") {
                            continue;
                        }
                    }
                    root_nodes.push(normalized);
                }

                let missing_ids: Vec<String> = references
                    .iter()
                    .filter(|id| !nodes.contains_key(*id))
                    .cloned()
                    .collect();

                if !missing_ids.is_empty() {
                    if let Ok(entities) =
                        db_schema_entity::get_by_schema_ids_lang(db, &missing_ids, schema_lang)
                            .await
                    {
                        for entity in entities {
                            let mut data = entity.schema_data;
                            if let serde_json::Value::Object(ref mut map) = data {
                                map.remove("@context");
                                if !map.contains_key("@type") {
                                    map.insert(
                                        "@type".to_string(),
                                        serde_json::Value::String(entity.schema_type.clone()),
                                    );
                                }
                                map.insert(
                                    "@id".to_string(),
                                    serde_json::Value::String(entity.schema_id.clone()),
                                );
                            }
                            nodes.insert(entity.schema_id, data);
                        }
                    }
                }

                let mut graph_nodes: Vec<serde_json::Value> = nodes.values().cloned().collect();
                graph_nodes.extend(root_nodes);

                if !graph_nodes.is_empty() {
                    let json_ld = if graph_nodes.len() == 1 {
                        let mut single = graph_nodes.remove(0);
                        if let serde_json::Value::Object(ref mut map) = single {
                            map.insert(
                                "@context".to_string(),
                                serde_json::Value::String("https://schema.org".to_string()),
                            );
                        }
                        single
                    } else {
                        serde_json::json!({
                            "@context": "https://schema.org",
                            "@graph": graph_nodes
                        })
                    };

                    if let Ok(json_str) = serde_json::to_string(&json_ld) {
                        context.insert("json_ld_schemas", &json_str);
                    }
                }
            }
        }

        if let Some(route_ctx) = route_ctx {
            let hreflang_entries = match db_page_seo::get_by_route(db, route_name).await {
                Ok(page) => db_page_hreflang::get_by_page_id(db, page.id)
                    .await
                    .unwrap_or_default(),
                Err(_) => Vec::new(),
            };

            let hreflang_links = if hreflang_entries.is_empty() {
                Self::build_hreflang_links(req, route_ctx)
            } else {
                Self::build_hreflang_links_from_entries(req, route_ctx, &hreflang_entries)
            };

            if !hreflang_links.is_empty() {
                context.insert("hreflang_links", &hreflang_links);
            }
        }
    }

    /// Redirect response
    fn redirect(location: &str) -> HttpResponse {
        HttpResponse::Found()
            .insert_header(("Location", location))
            .finish()
    }

    fn redirect_to_route(req: &HttpRequest, route_name: &str) -> HttpResponse {
        if let Some(location) = Self::build_route_redirect(req, route_name) {
            return Self::redirect(&location);
        }
        Self::redirect("/")
    }

    fn normalize_schema_for_graph(
        value: serde_json::Value,
        nodes: &mut std::collections::HashMap<String, serde_json::Value>,
        references: &mut std::collections::HashSet<String>,
    ) -> serde_json::Value {
        match value {
            serde_json::Value::Object(map) => {
                let id_value = map
                    .get("@id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let has_type = map.contains_key("@type");

                let mut normalized_map = serde_json::Map::new();
                for (key, val) in map.into_iter() {
                    if key == "@context" {
                        continue;
                    }
                    let normalized_val = Self::normalize_schema_for_graph(val, nodes, references);
                    normalized_map.insert(key, normalized_val);
                }

                if let Some(schema_id) = id_value {
                    let is_reference =
                        normalized_map.len() == 1 && normalized_map.contains_key("@id");
                    if is_reference {
                        references.insert(schema_id.clone());
                        return serde_json::json!({ "@id": schema_id });
                    }

                    if !has_type && !normalized_map.contains_key("@type") {
                        normalized_map.insert(
                            "@type".to_string(),
                            serde_json::Value::String("Thing".to_string()),
                        );
                    }
                    normalized_map.insert(
                        "@id".to_string(),
                        serde_json::Value::String(schema_id.clone()),
                    );
                    nodes.insert(schema_id.clone(), serde_json::Value::Object(normalized_map));
                    return serde_json::json!({ "@id": schema_id });
                }

                serde_json::Value::Object(normalized_map)
            }
            serde_json::Value::Array(values) => serde_json::Value::Array(
                values
                    .into_iter()
                    .map(|val| Self::normalize_schema_for_graph(val, nodes, references))
                    .collect(),
            ),
            other => other,
        }
    }

    /// Render a template with the given context
    fn render(template: &str, context: &Context) -> HttpResponse {
        match WEB_TEMPLATES.render(template, context) {
            Ok(html) => HttpResponse::Ok().content_type("text/html").body(html),
            Err(e) => {
                // Log full error chain for debugging
                error!("Template rendering error: {}", e);
                if let Some(source) = std::error::Error::source(&e) {
                    error!("  Caused by: {}", source);
                }
                error!("  Template: {}", template);
                HttpResponse::InternalServerError()
                    .content_type("text/html")
                    .body(format!(
                        "<h1>500 - Internal Server Error</h1><p>Template error: Failed to render '{}'</p>",
                        template
                    ))
            }
        }
    }

    /// Localized routing entrypoint for all web pages.
    /// Resolves base routes and redirects to /{lang}/{country}/{region}/{route}.
    pub async fn localized_router(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let registry = get_route_registry_snapshot().unwrap_or_default();
        if registry.is_empty() {
            return Self::not_found(req, session, state).await;
        }

        let normalized_path = Self::normalize_path(req.path());
        let path_segments: Vec<&str> = normalized_path
            .trim_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect();

        let mut languages = HashSet::new();
        for lang_map in registry.values() {
            for lang in lang_map.keys() {
                languages.insert(lang.to_string());
            }
        }

        if let Some(first_segment) = path_segments.first() {
            if languages.contains(*first_segment) {
                let language = first_segment.to_string();
                let mut matched: Option<(
                    String,
                    Option<String>,
                    Option<String>,
                    HashMap<String, String>,
                )> = None;

                // Priority 1: Try to match actual routes BEFORE interpreting segments as country/region
                // This prevents "/en/games/bigger-dice" from being interpreted as homepage with country=games

                // Try /{lang}/{country}/{region}/{route...} (4+ segments)
                if path_segments.len() >= 4 {
                    let route_path = format!("/{}", path_segments[3..].join("/"));
                    for candidate in Self::build_path_aliases(&route_path) {
                        if let Some((name, args)) =
                            Self::resolve_route_for_lang(&candidate, &language, &registry)
                        {
                            matched = Some((
                                name,
                                Some(path_segments[1].to_lowercase()),
                                Some(path_segments[2].to_lowercase()),
                                args,
                            ));
                            break;
                        }
                    }
                }

                // Try /{lang}/{country}/{route...} (3+ segments, treat segment[1] as country)
                if matched.is_none() && path_segments.len() >= 3 {
                    let route_path = format!("/{}", path_segments[2..].join("/"));
                    for candidate in Self::build_path_aliases(&route_path) {
                        if let Some((name, args)) =
                            Self::resolve_route_for_lang(&candidate, &language, &registry)
                        {
                            matched =
                                Some((name, Some(path_segments[1].to_lowercase()), None, args));
                            break;
                        }
                    }
                }

                // Try /{lang}/{route...} (2+ segments, no country/region)
                if matched.is_none() && path_segments.len() >= 2 {
                    let route_path = format!("/{}", path_segments[1..].join("/"));
                    for candidate in Self::build_path_aliases(&route_path) {
                        if let Some((name, args)) =
                            Self::resolve_route_for_lang(&candidate, &language, &registry)
                        {
                            matched = Some((name, None, None, args));
                            break;
                        }
                    }
                }

                // Priority 2: Fallback to homepage with country/region interpretation
                // Only if segment looks like a valid 2-letter country code
                if matched.is_none() && path_segments.len() == 3 {
                    let potential_country = path_segments[1];
                    // Only treat as country if it's a 2-letter code (ISO 3166-1 alpha-2)
                    if potential_country.len() == 2 && potential_country.chars().all(|c| c.is_ascii_alphabetic()) {
                        if let Some((name, args)) =
                            Self::resolve_route_for_lang("/", &language, &registry)
                        {
                            matched = Some((
                                name,
                                Some(path_segments[1].to_lowercase()),
                                Some(path_segments[2].to_lowercase()),
                                args,
                            ));
                        }
                    }
                }

                if matched.is_none() && path_segments.len() == 2 {
                    let potential_country = path_segments[1];
                    // Only treat as country if it's a 2-letter code
                    if potential_country.len() == 2 && potential_country.chars().all(|c| c.is_ascii_alphabetic()) {
                        if let Some((name, args)) =
                            Self::resolve_route_for_lang("/", &language, &registry)
                        {
                            matched = Some((name, Some(path_segments[1].to_lowercase()), None, args));
                        }
                    }
                }

                if matched.is_none() && path_segments.len() == 1 {
                    if let Some((name, args)) =
                        Self::resolve_route_for_lang("/", &language, &registry)
                    {
                        matched = Some((name, None, None, args));
                    }
                }

                if let Some((name, country, region, args)) = matched {
                    let headers = Self::collect_headers_lowercase(&req);
                    let (header_country, header_region) = Self::extract_country_region(&headers);

                    if let Some(header_country) = header_country.as_deref() {
                        let country_mismatch = country.as_deref() != Some(header_country);
                        let region_mismatch = header_region.is_some()
                            && region.as_deref() != header_region.as_deref();
                        let missing_country = country.is_none();
                        let missing_region = header_region.is_some() && region.is_none();

                        if country_mismatch || region_mismatch || missing_country || missing_region
                        {
                            if let Some(route_path) = route_with_lang(&name, &language, Some(&args))
                            {
                                let redirect_url = Self::build_qualified_path(
                                    &language,
                                    Some(header_country),
                                    header_region.as_deref(),
                                    &route_path,
                                );
                                return Ok(Self::redirect(&redirect_url));
                            }
                        }
                    }

                    req.extensions_mut().insert(RouteContext {
                        language,
                        country,
                        region,
                        name: name.clone(),
                        args: args.clone(),
                    });
                    return Self::dispatch_route(&name, req, session, state).await;
                }

                return Self::not_found(req, session, state).await;
            }
        }

        let candidate_paths = Self::build_path_aliases(&normalized_path);

        let mut resolved: Option<(String, String, HashMap<String, String>)> = None;
        for candidate in candidate_paths {
            if let Some(found) = Self::resolve_route_by_path(&candidate, &registry) {
                resolved = Some(found);
                break;
            }
        }

        if let Some((name, language, args)) = resolved {
            let route_path =
                route_with_lang(&name, &language, Some(&args)).unwrap_or_else(|| "/".to_string());
            let headers = Self::collect_headers_lowercase(&req);
            let (country, region) = Self::extract_country_region(&headers);
            let redirect_url = Self::build_qualified_path(
                &language,
                country.as_deref(),
                region.as_deref(),
                &route_path,
            );
            return Ok(Self::redirect(&redirect_url));
        }

        Self::not_found(req, session, state).await
    }

    async fn dispatch_route(
        route_name: &str,
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        match route_name {
            "web.home" => Self::homepage(req, session, state).await,
            "web.sign_up" => Self::sign_up(req, session, state).await,
            "web.sign_in" => Self::sign_in(req, session, state).await,
            "web.forgot_password" => Self::forgot_password(req, session, state).await,
            "web.profile" => Self::profile(req, session, state).await,
            "web.balance" => Self::balance(req, session, state).await,
            "oauth.applications" => Self::oauth_applications(req, session, state).await,
            "web.galleries" => Self::galleries(req, session, state).await,
            "web.geo_galleries" => Self::geo_galleries(req, session, state).await,
            "web.geo_gallery" => Self::geo_gallery(req, session, state).await,
            "web.competitions" => Self::competitions(req, session, state).await,
            "web.games" => Self::games(req, session, state).await,
            "web.games.bigger_dice_lobby" => Self::bigger_dice_lobby(req, session, state).await,
            "web.games.bigger_dice" => Self::bigger_dice_game(req, session, state).await,
            "web.games.tic_tac_toe_lobby" => Self::tic_tac_toe_lobby(req, session, state).await,
            "web.games.tic_tac_toe" => Self::tic_tac_toe_game(req, session, state).await,
            "web.games.roulette_lobby" => Self::roulette_lobby(req, session, state).await,
            "web.games.roulette" => Self::roulette_game(req, session, state).await,
            "web.logout" => Self::logout(req).await,
            "admin.uploads" => Self::uploads(req, session, state).await,
            "admin.theme" => Self::theme(req, session, state).await,
            "admin.game_chat" => Self::game_chat_config(req, session, state).await,
            "superadmin.users" => Self::registered_users(req, session, state).await,
            _ => Self::not_found(req, session, state).await,
        }
    }

    /// Homepage - shows different content for logged/guest users
    pub async fn homepage(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        let mut context = Self::base_context(&req, &session);

        // Add branding (logo, favicon, site name)
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.home").await;
        drop(db);

        if auth.is_logged {
            context.insert("template_type", "logged");
        } else {
            context.insert("template_type", "guest");
        }

        Ok(Self::render("homepage.html", &context))
    }

    /// Sign Up page - redirects to profile if logged in
    pub async fn sign_up(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.profile"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.sign_up").await;
        drop(db);

        Ok(Self::render("sign_up.html", &context))
    }

    /// Sign In page - redirects to profile if logged in
    pub async fn sign_in(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.profile"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.sign_in").await;
        drop(db);

        Ok(Self::render("sign_in.html", &context))
    }

    /// Forgot Password page - redirects to profile if logged in
    pub async fn forgot_password(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.profile"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.forgot_password").await;
        drop(db);

        Ok(Self::render("forgot_password.html", &context))
    }

    /// Profile page - redirects to sign-in if not logged in
    pub async fn profile(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;

        // Add branding (logo, favicon, site name)
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.profile").await;

        // Fetch user data if we have a user_id
        if let Some(user_id) = auth.user_id {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                // Get avatar URL using dedicated avatar endpoint
                // This works regardless of storage_type (public/private)
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    // Use small variant (320px) for profile picture display
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        }
        drop(db);

        Ok(Self::render("profile.html", &context))
    }

    /// Balance top-up page - redirects to sign-in if not logged in
    pub async fn balance(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;

        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.balance").await;

        if let Some(user_id) = auth.user_id {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let balance_coins = user.balance / 100;
                context.insert("balance_cents", &user.balance);
                context.insert("balance_coins", &balance_coins);
            }
        }

        drop(db);

        Ok(Self::render("balance.html", &context))
    }

    /// OAuth Applications page - redirects to sign-in if not logged in
    pub async fn oauth_applications(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;

        // Add branding (logo, favicon, site name)
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "oauth.applications").await;

        // Fetch user data if we have a user_id
        if let Some(user_id) = auth.user_id {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url: None, // Not needed for OAuth page
                };
                context.insert("user", &template_user);
            }
        }
        drop(db);

        Ok(Self::render("oauth_applications.html", &context))
    }

    /// Logout - clears auth cookie and redirects to homepage
    pub async fn logout(req: HttpRequest) -> Result<HttpResponse> {
        use actix_web::cookie::{time::Duration, Cookie};

        // Create an expired cookie to clear the auth token
        let cookie = Cookie::build("auth_token", "")
            .path("/")
            .max_age(Duration::seconds(0))
            .http_only(true)
            .finish();

        let redirect_url =
            Self::build_route_redirect(&req, "web.home").unwrap_or_else(|| "/".to_string());

        Ok(HttpResponse::Found()
            .cookie(cookie)
            .insert_header(("Location", redirect_url))
            .finish())
    }

    /// Uploads Admin page - requires Admin+ permissions
    pub async fn uploads(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect_to_route(&req, "web.home"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "admin.uploads").await;
        drop(db);

        Ok(Self::render("uploads.html", &context))
    }

    /// Theme Configuration Admin page - requires Admin+ permissions
    pub async fn theme(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect_to_route(&req, "web.home"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "admin.theme").await;
        drop(db);

        Ok(Self::render("admin_theme.html", &context))
    }

    /// Game Chat Configuration Admin page - requires Admin+ permissions
    pub async fn game_chat_config(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect_to_route(&req, "web.home"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "admin.game_chat").await;
        drop(db);

        Ok(Self::render("admin_game_chat.html", &context))
    }

    /// Registered Users Admin page - requires Super Admin permissions
    pub async fn registered_users(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Must have super admin permissions (>= 100)
        if !auth.is_super_admin() {
            return Ok(Self::redirect_to_route(&req, "web.home"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "admin.users").await;
        drop(db);

        // We don't load user data server-side since JavaScript fetches via API
        // This avoids code duplication and keeps data fresh

        Ok(Self::render("registered_users.html", &context))
    }

    /// Galleries page - requires authentication
    pub async fn galleries(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.galleries").await;
        drop(db);

        // JavaScript will fetch galleries via API
        Ok(Self::render("galleries.html", &context))
    }

    /// Geo galleries map page - public
    pub async fn geo_galleries(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.geo_galleries").await;
        drop(db);

        Ok(Self::render("geo_galleries.html", &context))
    }

    /// Geo gallery detail page - requires authentication
    pub async fn geo_gallery(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.geo_gallery").await;
        drop(db);

        if let Some(route_ctx) = req.extensions().get::<RouteContext>() {
            if let Some(gallery_uuid) = route_ctx.args.get("gallery_uuid") {
                context.insert("gallery_uuid", gallery_uuid);
            }
        }

        Ok(Self::render("geo_gallery.html", &context))
    }

    /// Competitions page - public
    pub async fn competitions(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.competitions").await;
        drop(db);

        Ok(Self::render("competitions.html", &context))
    }

    /// Games page - requires authentication
    pub async fn games(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games").await;

        // Fetch user data if we have a user_id
        if let Some(user_id) = auth.user_id {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                // Get avatar URL for display
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        }
        drop(db);

        // JavaScript handles WebSocket connection and game logic
        Ok(Self::render("games.html", &context))
    }

    /// Bigger Dice lobby page - shows room list and create room UI
    pub async fn bigger_dice_lobby(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.bigger_dice_lobby").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // No room_id - this is the lobby
        context.insert("room_id", &"");
        context.insert("room_name", "Bigger Dice");
        context.insert("is_lobby", &true);

        // Build WebSocket URL for the game server
        let base_url = Self::get_base_url(&req);
        let ws_url = base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        context.insert("ws_url", &format!("{}/ws/games", ws_url));

        Ok(Self::render("bigger_dice.html", &context))
    }

    /// Bigger Dice game page - renders individual game room
    pub async fn bigger_dice_game(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Extract room_id from route args
        let route_ctx = req.extensions();
        let route_context = route_ctx.get::<RouteContext>();
        let room_id = route_context
            .and_then(|ctx| ctx.args.get("room_id"))
            .cloned()
            .unwrap_or_default();

        if room_id.is_empty() {
            return Ok(Self::redirect_to_route(&req, "web.games"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.bigger_dice").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // Room info
        context.insert("room_id", &room_id);
        context.insert("room_name", "Bigger Dice"); // Could be fetched from ws_gateway/database
        context.insert("is_lobby", &false);

        // Check if user wants to join as spectator (from ?spectate=true query param)
        let is_spectator = req.query_string().contains("spectate=true");
        context.insert("is_spectator", &is_spectator);

        // Build WebSocket URL for the game server
        let base_url = Self::get_base_url(&req);
        let ws_url = base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        context.insert("ws_url", &format!("{}/ws/games", ws_url));

        Ok(Self::render("bigger_dice.html", &context))
    }

    /// Tic Tac Toe lobby page - shows room list and create room UI
    pub async fn tic_tac_toe_lobby(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.tic_tac_toe_lobby").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // No room_id - this is the lobby
        context.insert("room_id", &"");
        context.insert("room_name", "Tic Tac Toe");
        context.insert("is_lobby", &true);

        // Build WebSocket URL for the game server
        let base_url = Self::get_base_url(&req);
        let ws_url = base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        context.insert("ws_url", &format!("{}/ws/games", ws_url));

        Ok(Self::render("tic_tac_toe.html", &context))
    }

    /// Tic Tac Toe game page - renders individual game room
    pub async fn tic_tac_toe_game(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Extract room_id from route args
        let route_ctx = req.extensions();
        let route_context = route_ctx.get::<RouteContext>();
        let room_id = route_context
            .and_then(|ctx| ctx.args.get("room_id"))
            .cloned()
            .unwrap_or_default();

        if room_id.is_empty() {
            return Ok(Self::redirect_to_route(&req, "web.games"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.tic_tac_toe").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // Room info
        context.insert("room_id", &room_id);
        context.insert("room_name", "Tic Tac Toe");
        context.insert("is_lobby", &false);

        // Check if user wants to join as spectator (from ?spectate=true query param)
        let is_spectator = req.query_string().contains("spectate=true");
        context.insert("is_spectator", &is_spectator);

        // Build WebSocket URL for the game server
        let base_url = Self::get_base_url(&req);
        let ws_url = base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        context.insert("ws_url", &format!("{}/ws/games", ws_url));

        Ok(Self::render("tic_tac_toe.html", &context))
    }

    /// Roulette lobby page - shows roulette game
    pub async fn roulette_lobby(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.roulette_lobby").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // No room_id - this is the lobby
        context.insert("room_id", &"");
        context.insert("room_name", "Roulette");
        context.insert("is_lobby", &true);

        Ok(Self::render("roulette.html", &context))
    }

    /// Roulette game page - renders individual game room
    pub async fn roulette_game(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect_to_route(&req, "web.sign_in"));
        }

        // Extract room_id from route args
        let route_ctx = req.extensions();
        let route_context = route_ctx.get::<RouteContext>();
        let room_id = route_context
            .and_then(|ctx| ctx.args.get("room_id"))
            .cloned()
            .unwrap_or_default();

        if room_id.is_empty() {
            return Ok(Self::redirect_to_route(&req, "web.games"));
        }

        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&req, &mut context, &db, "web.games.roulette").await;

        // Fetch user data
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        } else {
            context.insert("user_id", &0i64);
        }
        drop(db);

        // Room info
        context.insert("room_id", &room_id);
        context.insert("room_name", "Roulette");
        context.insert("is_lobby", &false);

        Ok(Self::render("roulette.html", &context))
    }

    /// 404 Not Found page
    pub async fn not_found(
        req: HttpRequest,
        session: Session,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let mut context = Self::base_context(&req, &session);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_languages_to_context(&mut context, &db).await;
        drop(db);

        Ok(Self::render_with_status(
            "404.html",
            &context,
            actix_web::http::StatusCode::NOT_FOUND,
        ))
    }

    /// Render a template with a custom status code
    fn render_with_status(
        template: &str,
        context: &Context,
        status: actix_web::http::StatusCode,
    ) -> HttpResponse {
        match WEB_TEMPLATES.render(template, context) {
            Ok(html) => HttpResponse::build(status)
                .content_type("text/html")
                .body(html),
            Err(e) => {
                error!("Template rendering error: {}", e);
                HttpResponse::InternalServerError()
                    .content_type("text/html")
                    .body(format!(
                        "<h1>500 - Internal Server Error</h1><p>Template error: {}</p>",
                        e
                    ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PagesController;
    use serde_json::json;
    use std::collections::{HashMap, HashSet};

    #[test]
    fn normalize_schema_for_graph_collects_nodes_and_refs() {
        let schema = json!({
            "@type": "Organization",
            "@id": "urn:en:entity:organization:org-1",
            "name": "GDC Group",
            "founder": {
                "@id": "urn:en:entity:person:person-1",
                "@type": "Person",
                "name": "John Doe"
            },
            "address": {
                "@id": "urn:en:entity:postaladdress:addr-1"
            }
        });

        let mut nodes: HashMap<String, serde_json::Value> = HashMap::new();
        let mut refs: HashSet<String> = HashSet::new();
        let normalized = PagesController::normalize_schema_for_graph(schema, &mut nodes, &mut refs);

        assert!(normalized.get("@id").is_some());
        assert!(nodes.contains_key("urn:en:entity:organization:org-1"));
        assert!(nodes.contains_key("urn:en:entity:person:person-1"));
        assert!(refs.contains("urn:en:entity:postaladdress:addr-1"));
    }
}

// ============================================================================
// OAuth Consent Page Rendering (used by OAuth API controller)
// ============================================================================

/// Scope information for consent page display
#[derive(Debug, Clone, Serialize)]
pub struct ConsentScopeInfo {
    pub scope_name: String,
    pub scope_description: String,
    pub sensitive: bool,
}

/// Data required to render the OAuth consent page
#[derive(Debug, Clone)]
pub struct OAuthConsentData {
    pub client_name: String,
    pub client_id: String,
    pub client_type: String,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
    pub scopes: Vec<ConsentScopeInfo>,
    pub redirect_uri: String,
    pub scope_string: String,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
}

/// Render the OAuth consent page
/// This is called from the OAuth API controller when user consent is needed
pub async fn render_oauth_consent(
    req: &HttpRequest,
    session: &Session,
    state: &AppState,
    data: OAuthConsentData,
) -> HttpResponse {
    // Start with base context (includes csrf_token, theme, is_logged, etc.)
    let mut context = PagesController::base_context(req, session);

    // Add branding (logo, favicon, site name) and languages
    let db = state.db.lock().await;
    PagesController::add_branding_to_context(&mut context, &db).await;
    PagesController::add_languages_to_context(&mut context, &db).await;
    drop(db);

    // Client information
    context.insert("client_name", &data.client_name);
    context.insert("client_id", &data.client_id);
    context.insert("client_type", &data.client_type);

    // Optional client URLs (override logo_url from branding if client has one)
    if let Some(ref url) = data.logo_url {
        context.insert("client_logo_url", url);
    }
    if let Some(ref url) = data.homepage_url {
        context.insert("homepage_url", url);
    }
    if let Some(ref url) = data.privacy_policy_url {
        context.insert("privacy_policy_url", url);
    }
    if let Some(ref url) = data.terms_of_service_url {
        context.insert("terms_of_service_url", url);
    }

    // Scopes
    context.insert("scopes", &data.scopes);

    // OAuth parameters for the form
    context.insert("redirect_uri", &data.redirect_uri);
    context.insert("scope", &data.scope_string);

    if let Some(ref state_param) = data.state {
        context.insert("state", state_param);
    }
    if let Some(ref code_challenge) = data.code_challenge {
        context.insert("code_challenge", code_challenge);
    }
    if let Some(ref code_challenge_method) = data.code_challenge_method {
        context.insert("code_challenge_method", code_challenge_method);
    }

    match WEB_TEMPLATES.render("oauth_consent.html", &context) {
        Ok(html) => HttpResponse::Ok().content_type("text/html").body(html),
        Err(e) => {
            error!("OAuth consent template rendering error: {}", e);
            HttpResponse::InternalServerError()
                .content_type("text/html")
                .body(format!(
                    "<h1>500 - Internal Server Error</h1><p>Template error: {}</p>",
                    e
                ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PagesController;
    use std::collections::HashMap;

    #[test]
    fn normalize_path_handles_root() {
        assert_eq!(PagesController::normalize_path("/"), "/");
        assert_eq!(PagesController::normalize_path(""), "/");
        assert_eq!(PagesController::normalize_path("/sign-up/"), "/sign-up");
    }

    #[test]
    fn match_route_pattern_extracts_args() {
        let args = PagesController::match_route_pattern("/galleries/{id}", "/galleries/42")
            .expect("should match");
        assert_eq!(args.get("id"), Some(&"42".to_string()));
    }

    #[test]
    fn build_qualified_path_uses_optional_segments() {
        let full = PagesController::build_qualified_path("en", Some("rs"), Some("su"), "/sign-up");
        assert_eq!(full, "/en/rs/su/sign-up");

        let base = PagesController::build_qualified_path("sr", None, None, "/");
        assert_eq!(base, "/sr");
    }

    #[test]
    fn resolve_route_by_path_finds_language() {
        let mut registry = HashMap::new();
        let mut lang_map = HashMap::new();
        lang_map.insert("en".to_string(), "/sign-up".to_string());
        lang_map.insert("sr".to_string(), "/registracija".to_string());
        registry.insert("web.sign_up".to_string(), lang_map);

        let found = PagesController::resolve_route_by_path("/registracija", &registry)
            .expect("should resolve");
        assert_eq!(found.0, "web.sign_up");
        assert_eq!(found.1, "sr");
    }
}
