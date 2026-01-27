//!
//! API Routes
//!
//! This file defines all API routes for the application.
//!

use actix_web::{middleware::from_fn, web};

use crate::app::http::api::controllers::activation::ActivationController;
use crate::app::http::api::controllers::admin::AdminController;
use crate::app::http::api::controllers::auth::AuthController;
use crate::app::http::api::controllers::balance::BalanceController;
use crate::app::http::api::controllers::email::EmailController;
use crate::app::http::api::controllers::game_chat_config::GameChatConfigController;
use crate::app::http::api::controllers::localization::LocalizationController;
use crate::app::http::api::controllers::roulette::RouletteController;
use crate::app::http::api::controllers::roulette_ajax::RouletteAjaxController;
use crate::app::http::api::controllers::schema::SchemaController;
use crate::app::http::api::controllers::theme::ThemeController;
use crate::app::http::api::controllers::upload::UploadController;
use crate::app::http::api::controllers::user::UserController;
use crate::app::http::api::controllers::{
    competitions, gallery, gallery_like, game_config, game_history, geo_place, oauth,
    oauth_api_product, oauth_client, oauth_gallery, oauth_scope, picture,
};
use crate::middleware;
use crate::middleware::permission::{levels, require_permission};
use crate::route;

/// Register all API routes
pub fn register(cfg: &mut web::ServiceConfig) {
    // Register named routes for URL generation
    register_route_names();

    // ============================================
    // Authentication Routes (Public)
    // ============================================
    cfg.service(
        web::scope("/api/v1/auth")
            .route("/sign-up", web::post().to(AuthController::sign_up))
            .route("/sign-in", web::post().to(AuthController::sign_in))
            .route("/sign-out", web::post().to(AuthController::sign_out))
            .route(
                "/sign-out-all",
                web::post().to(AuthController::sign_out_all),
            )
            .route("/refresh", web::post().to(AuthController::refresh)),
    );

    // ============================================
    // Account Activation & Password Reset Routes (Public)
    // ============================================
    cfg.service(
        web::scope("/api/v1/account")
            .route(
                "/activate-account",
                web::post().to(ActivationController::activate_account),
            )
            .route(
                "/forgot-password",
                web::post().to(ActivationController::forgot_password),
            )
            .route(
                "/verify-hash",
                web::post().to(ActivationController::verify_hash),
            )
            .route(
                "/reset-password",
                web::post().to(ActivationController::reset_password),
            )
            .route(
                "/set-password-when-needed",
                web::get().to(ActivationController::verify_set_password_link),
            )
            .route(
                "/set-password-when-needed",
                web::post().to(ActivationController::set_password_when_needed),
            ),
    );

    // ============================================
    // Schema Catalog Routes (Public)
    // ============================================
    cfg.service(
        web::scope("/api/v1/schemas")
            .route("/categories", web::get().to(SchemaController::categories))
            .route(
                "/children/{type_name}",
                web::get().to(SchemaController::children),
            )
            // Entity resolution with recursive @id expansion
            .route(
                "/entity/{schema_id}",
                web::get().to(SchemaController::resolve_entity),
            )
            // Type definition (must be last due to wildcard)
            .route("/{type_name}", web::get().to(SchemaController::schema)),
    );

    // ============================================
    // Password Change Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/password")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(
                "/change-password",
                web::post().to(ActivationController::change_password_direct),
            )
            .route(
                "/verify-password-change",
                web::post().to(ActivationController::verify_and_change_password),
            ),
    );

    // ============================================
    // Email Change Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/email")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(
                "/request-change",
                web::post().to(EmailController::request_change),
            )
            .route(
                "/verify-old-email",
                web::post().to(EmailController::verify_old_email),
            )
            .route(
                "/verify-new-email",
                web::post().to(EmailController::verify_new_email),
            ),
    );

    // ============================================
    // User Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/user")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(UserController::get_current))
            .route("/{id}", web::get().to(UserController::get_by_id))
            .route("", web::patch().to(UserController::update_partial))
            .route("", web::put().to(UserController::update_full))
            .route("", web::post().to(UserController::admin_create))
            .route("/avatar", web::patch().to(UserController::update_avatar))
            .route("/{id}", web::delete().to(UserController::delete)),
    );

    // ============================================
    // Balance Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/balance")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("/checkout", web::post().to(BalanceController::create_checkout_session)),
    );

    // ============================================
    // Roulette Game Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/roulette")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("/place-bet", web::post().to(RouletteController::place_bet))
            .route("/spin", web::post().to(RouletteController::spin))
            .route("/history", web::get().to(RouletteController::history))
            .route("/stats", web::get().to(RouletteController::stats))
            .route("/balance", web::get().to(RouletteController::balance)),
    );

    // ============================================
    // Roulette AJAX Endpoint (WordPress-style single endpoint)
    // POST /api/games/roulette with action parameter
    // ============================================
    cfg.service(
        web::resource("/api/games/roulette")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(web::post().to(RouletteAjaxController::handle)),
    );

    // ============================================
    // Games Config Routes (Public - no auth required)
    // ============================================
    // Game Config (Public - no auth)
    // ============================================
    cfg.service(
        web::scope("/api/v1/games")
            .route("/config", web::get().to(game_config::get_config))
            // Game History Routes (Requires JWT - wrapped individually)
            .service(
                web::resource("/{game_type}/history")
                    .wrap(from_fn(middleware::auth::verify_jwt))
                    .route(web::get().to(game_history::get_history)),
            )
            .service(
                web::resource("/{game_type}/history/{game_id}")
                    .wrap(from_fn(middleware::auth::verify_jwt))
                    .route(web::get().to(game_history::get_game_details)),
            ),
    );

    // ============================================
    // Upload Downloads (Public files - no auth required)
    // ============================================
    cfg.service(
        web::scope("/api/v1/upload/download")
            // Public file downloads (no auth)
            .route(
                "/public/{uuid}",
                web::get().to(UploadController::download_public),
            ),
    );

    // ============================================
    // Upload Routes (All uploads require JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/upload")
            .wrap(from_fn(middleware::auth::verify_jwt))
            // Upload public file (requires auth)
            .route("/public", web::post().to(UploadController::upload_public))
            // Upload private file (requires auth)
            .route("/private", web::post().to(UploadController::upload_private))
            // Upload multiple files (requires auth)
            .route(
                "/multiple",
                web::post().to(UploadController::upload_multiple),
            )
            // Download private file (requires auth)
            .route(
                "/private/{uuid}",
                web::get().to(UploadController::download_private),
            )
            // Delete upload (requires auth)
            .route("/{uuid}", web::delete().to(UploadController::delete))
            // Get user's uploads (requires auth)
            .route("/user", web::get().to(UploadController::get_user_uploads))
            // Avatar/profile picture routes (requires auth)
            .route("/avatar", web::post().to(UploadController::upload_avatar))
            .route("/avatar", web::delete().to(UploadController::delete_avatar))
            // Chunked upload routes
            .route(
                "/chunked/start",
                web::post().to(UploadController::start_chunked_upload),
            )
            .route(
                "/chunked/{uuid}/chunk/{index}",
                web::post().to(UploadController::upload_chunk),
            )
            .route(
                "/chunked/{uuid}/complete",
                web::post().to(UploadController::complete_chunked_upload),
            )
            .route(
                "/chunked/{uuid}",
                web::delete().to(UploadController::cancel_chunked_upload),
            ),
    );

    // ============================================
    // Avatar Download (Protected - requires JWT)
    // User can only access their own avatar
    // ============================================
    cfg.service(
        web::scope("/api/v1/avatar")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("/{uuid}", web::get().to(UploadController::get_avatar)),
    );

    // ============================================
    // Admin Routes (Protected - requires JWT + permissions)
    // Note: Using separate scopes with specific paths to avoid routing conflicts
    // ============================================

    // Theme routes (Admin+ permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin/theme")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt)) // Runs first (extracts permissions)
            .route("", web::get().to(ThemeController::get))
            .route("", web::put().to(ThemeController::update))
            .route("/branding", web::put().to(ThemeController::update_branding))
            .route("/build", web::post().to(ThemeController::trigger_build))
            .route(
                "/build/status",
                web::get().to(ThemeController::build_status),
            ),
    );

    // Localization routes (Admin+ permission = 10 or 100)
    cfg.service(
        web::scope("/api/v1/admin/localizations")
            .wrap(from_fn(require_permission(levels::ADMIN)))
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(
                "/languages",
                web::get().to(LocalizationController::list_languages),
            )
            .route(
                "/languages",
                web::post().to(LocalizationController::create_language),
            )
            .route(
                "/languages/{id}",
                web::put().to(LocalizationController::update_language),
            )
            .route(
                "/languages/{id}",
                web::delete().to(LocalizationController::delete_language),
            )
            .route(
                "/locales",
                web::get().to(LocalizationController::list_locales),
            )
            .route(
                "/locales",
                web::post().to(LocalizationController::create_locale),
            )
            .route(
                "/locales/{id}",
                web::put().to(LocalizationController::update_locale),
            )
            .route(
                "/locales/{id}",
                web::delete().to(LocalizationController::delete_locale),
            )
            .route("/keys", web::get().to(LocalizationController::list_keys))
            .route("/keys", web::post().to(LocalizationController::create_key))
            .route(
                "/keys/{id}",
                web::put().to(LocalizationController::update_key),
            )
            .route(
                "/keys/{id}",
                web::delete().to(LocalizationController::delete_key),
            ),
    );

    // ============================================
    // Gallery Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/galleries")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(gallery::get_user_galleries))
            .route("", web::post().to(gallery::create_gallery))
            .route("/reorder", web::post().to(gallery::reorder_galleries))
            .route("/{id}", web::get().to(gallery::get_gallery))
            .route("/{id}", web::put().to(gallery::update_gallery))
            .route("/{id}", web::delete().to(gallery::delete_gallery))
            .route("/{id}/likes", web::post().to(gallery_like::like_gallery))
            .route("/{id}/likes", web::delete().to(gallery_like::unlike_gallery))
            // Picture routes within gallery
            .route(
                "/{id}/pictures",
                web::get().to(picture::get_gallery_pictures),
            )
            .route("/{id}/pictures", web::post().to(picture::add_picture))
            .route(
                "/{id}/pictures/reorder",
                web::post().to(picture::reorder_pictures),
            )
            .route(
                "/{id}/pictures/bulk-delete",
                web::post().to(picture::bulk_delete_pictures),
            )
            .route(
                "/{gallery_id}/pictures/{picture_id}",
                web::put().to(picture::update_picture),
            )
            .route(
                "/{gallery_id}/pictures/{picture_id}",
                web::delete().to(picture::remove_picture),
            ),
    );

    // ============================================
    // Geo Galleries Map Data (Authenticated)
    // ============================================
    cfg.service(
        web::scope("/api/v1/geo-galleries")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(gallery::get_geo_galleries))
            .route("/{gallery_uuid}", web::get().to(gallery::get_geo_gallery)),
    );
    cfg.service(
        web::scope("/api/v1/geo-places")
            .route("", web::get().to(geo_place::list_public))
            .route("/{id}/images", web::get().to(geo_place::list_place_images)),
    );

    // ============================================
    // Competitions (Public + Protected)
    // ============================================
    cfg.service(
        web::scope("/api/v1/competitions")
            .route("", web::get().to(competitions::list_competitions))
            .route("/{id}", web::get().to(competitions::get_competition))
            .route(
                "/{id}/entries",
                web::post()
                    .to(competitions::join_competition)
                    .wrap(from_fn(middleware::auth::verify_jwt)),
            )
            .route(
                "",
                web::post()
                    .to(competitions::create_competition)
                    .wrap(from_fn(require_permission(levels::ADMIN)))
                    .wrap(from_fn(middleware::auth::verify_jwt)),
            )
            .route(
                "/{id}/admin-votes",
                web::post()
                    .to(competitions::admin_vote)
                    .wrap(from_fn(require_permission(levels::ADMIN)))
                    .wrap(from_fn(middleware::auth::verify_jwt)),
            )
            .route(
                "/{id}/finalize",
                web::post()
                    .to(competitions::finalize_competition)
                    .wrap(from_fn(require_permission(levels::ADMIN)))
                    .wrap(from_fn(middleware::auth::verify_jwt)),
            ),
    );

    // ============================================
    // OAuth-Protected Gallery Routes
    // ============================================
    // OAuth galleries API with scope-based permissions and ownership enforcement
    // - galleries.read: Can read ALL galleries
    // - galleries.write: Can create/edit/delete ONLY OWNED galleries
    cfg.service(
        web::scope("/api/v1/oauth/galleries")
            .wrap(from_fn(middleware::oauth_auth::verify_oauth_jwt))
            .route("", web::get().to(oauth_gallery::list_galleries))
            .route("", web::post().to(oauth_gallery::create_gallery))
            .route("/{id}", web::get().to(oauth_gallery::get_gallery))
            .route(
                "/{id}/images",
                web::get().to(oauth_gallery::list_gallery_images),
            )
            .route("/{id}", web::put().to(oauth_gallery::update_gallery))
            .route("/{id}", web::delete().to(oauth_gallery::delete_gallery)),
    );

    cfg.service(
        web::scope("/api/v1/oauth/pictures")
            .wrap(from_fn(middleware::oauth_auth::verify_oauth_jwt))
            .route("/{id}", web::delete().to(oauth_gallery::delete_picture)),
    );

    // SEO routes (Admin+ permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin/seo")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt)) // Runs first (extracts permissions)
            // Page SEO routes
            .route("", web::get().to(ThemeController::seo_list))
            .route("", web::post().to(ThemeController::seo_create))
            .route(
                "/schema-catalog",
                web::get().to(ThemeController::schema_catalog),
            )
            .route(
                "/entities",
                web::get().to(ThemeController::schema_entity_list),
            )
            .route(
                "/entities",
                web::post().to(ThemeController::schema_entity_upsert),
            )
            .route(
                "/entities/{schema_id}",
                web::get().to(ThemeController::schema_entity_get),
            )
            .route(
                "/entities/{schema_id}",
                web::delete().to(ThemeController::schema_entity_delete),
            )
            .route(
                "/entity-types",
                web::get().to(ThemeController::schema_entity_types),
            )
            .route("/{route_name}", web::get().to(ThemeController::seo_get))
            .route("/{route_name}", web::put().to(ThemeController::seo_update))
            .route(
                "/{route_name}/toggle",
                web::patch().to(ThemeController::seo_toggle_active),
            )
            .route(
                "/page/{id}/hreflang",
                web::get().to(ThemeController::hreflang_list),
            )
            .route(
                "/page/{id}/hreflang",
                web::post().to(ThemeController::hreflang_upsert),
            )
            .route(
                "/hreflang/{id}",
                web::delete().to(ThemeController::hreflang_delete),
            )
            // Schema routes (for structured data)
            .route(
                "/page/{id}/schemas",
                web::get().to(ThemeController::schema_list),
            )
            .route(
                "/page/{id}/schemas",
                web::post().to(ThemeController::schema_create),
            )
            .route("/schema/{id}", web::get().to(ThemeController::schema_get))
            .route(
                "/schema/{id}",
                web::put().to(ThemeController::schema_update),
            )
            .route(
                "/schema/{id}",
                web::delete().to(ThemeController::schema_delete),
            ),
    );

    // Game Chat Config routes (Admin+ permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin/game-chat")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt)) // Runs first (extracts permissions)
            .route("/config", web::get().to(GameChatConfigController::get_config))
            .route("/config", web::put().to(GameChatConfigController::update_config))
            .route(
                "/global-mute",
                web::post().to(GameChatConfigController::toggle_global_mute),
            )
            .route(
                "/profanity/add",
                web::post().to(GameChatConfigController::add_profanity_word),
            )
            .route(
                "/profanity/remove",
                web::post().to(GameChatConfigController::remove_profanity_word),
            ),
    );

    // Super Admin routes (permission = 100) - must be registered before Admin routes
    // to ensure /users is matched before /users/{id}/avatar
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    // So we need: verify_jwt THEN require_permission
    cfg.service(
        web::scope("/api/v1/admin/users")
            .wrap(from_fn(require_permission(levels::SUPER_ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt)) // Runs first (extracts permissions)
            .route("", web::get().to(AdminController::list_users))
            .route("/bulk", web::post().to(AdminController::bulk_user_actions))
            .route("/{id}", web::delete().to(AdminController::delete_user))
            .route(
                "/{id}/permissions",
                web::patch().to(AdminController::update_user_permissions),
            ),
    );

    // Admin routes (permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt)) // Runs first (extracts permissions)
            .route("/uploads", web::get().to(AdminController::list_uploads))
            .route(
                "/uploads/bulk-delete",
                web::post().to(AdminController::bulk_delete_uploads),
            )
            .route(
                "/uploads/{uuid}/metadata",
                web::patch().to(AdminController::update_upload_metadata),
            )
            .route("/assets", web::get().to(AdminController::list_assets))
            .route("/geo-places", web::get().to(geo_place::list_admin))
            .route("/geo-places", web::post().to(geo_place::create_place))
            .route("/geo-places/{id}/images", web::post().to(geo_place::add_place_image))
            .route(
                "/users/{id}/avatar",
                web::delete().to(AdminController::delete_user_avatar),
            ),
    );

    // ============================================
    // OAuth Client Routes (Protected - requires JWT OR session)
    // ============================================
    cfg.service(
        web::scope("/api/v1/oauth/clients")
            .wrap(from_fn(middleware::dual_auth::verify_jwt_or_session))
            // OAuth Client CRUD
            .route("", web::get().to(oauth_client::get_user_clients))
            .route("", web::post().to(oauth_client::create_client))
            .route("/{client_id}", web::get().to(oauth_client::get_client))
            .route("/{client_id}", web::put().to(oauth_client::update_client))
            .route(
                "/{client_id}",
                web::delete().to(oauth_client::delete_client),
            )
            // TODO: Implement client activation/deactivation endpoints
            // .route(
            //     "/{client_id}/deactivate",
            //     web::post().to(oauth_client::deactivate_client),
            // )
            // .route(
            //     "/{client_id}/activate",
            //     web::post().to(oauth_client::activate_client),
            // )
            // TODO: Implement client secrets management endpoints
            // .route(
            //     "/{client_id}/secrets",
            //     web::get().to(oauth_client::get_client_secrets),
            // )
            // .route(
            //     "/{client_id}/secrets",
            //     web::post().to(oauth_client::create_client_secret),
            // )
            // .route(
            //     "/{client_id}/secrets/{secret_id}",
            //     web::delete().to(oauth_client::delete_client_secret),
            // )
            // Redirect URIs Management
            .route(
                "/{client_id}/redirect-uris",
                web::get().to(oauth_client::get_redirect_uris),
            )
            .route(
                "/{client_id}/redirect-uris",
                web::post().to(oauth_client::add_redirect_uri),
            )
            .route(
                "/{client_id}/redirect-uris/{uri_id}",
                web::delete().to(oauth_client::delete_redirect_uri),
            )
            // Authorized Domains Management
            .route(
                "/{client_id}/authorized-domains",
                web::get().to(oauth_client::get_authorized_domains),
            )
            .route(
                "/{client_id}/authorized-domains",
                web::post().to(oauth_client::add_authorized_domain),
            )
            .route(
                "/{client_id}/authorized-domains/{domain_id}",
                web::delete().to(oauth_client::delete_authorized_domain),
            )
            // OAuth API Product Management (Google Cloud Console Approach)
            // List all available API products with scopes
            .route(
                "/{client_id}/api-products",
                web::get().to(oauth_api_product::list_api_products),
            )
            // List enabled APIs for this client
            .route(
                "/{client_id}/enabled-apis",
                web::get().to(oauth_api_product::list_enabled_apis),
            )
            // Enable an API (user then selects individual scopes)
            .route(
                "/{client_id}/enable-api",
                web::post().to(oauth_api_product::enable_api),
            )
            // Disable an API (revokes all API scopes)
            .route(
                "/{client_id}/enabled-apis/{api_id}",
                web::delete().to(oauth_api_product::disable_api),
            )
            // Grant a specific scope to the client
            .route(
                "/{client_id}/scopes",
                web::get().to(oauth_scope::list_client_scopes),
            )
            // Grant a specific scope to the client
            .route(
                "/{client_id}/scopes",
                web::post().to(oauth_api_product::grant_scope),
            )
            // Revoke a specific scope from the client
            .route(
                "/{client_id}/scopes/{scope_id}",
                web::delete().to(oauth_api_product::revoke_scope),
            ),
    );

    // ============================================
    // OAuth Scope Queries
    // ============================================
    // List scopes for a specific API product (public endpoint)
    cfg.service(
        web::resource("/api/v1/oauth/api-products/{api_id}/scopes")
            .route(web::get().to(oauth_scope::list_scopes_by_api_product)),
    );

    // ============================================
    // OAuth 2.0 Authorization Flow
    // GET: Shows consent page (with login modal if not authenticated)
    // POST: Processes consent (requires authentication - checked in controller)
    // Uses optional JWT middleware - both endpoints extract user_id if present,
    // but the controller handles authentication requirements for POST.
    // ============================================
    cfg.service(
        web::scope("/oauth/authorize")
            .wrap(from_fn(middleware::auth::verify_jwt_optional))
            .route("", web::get().to(oauth::authorize_get))
            .route("", web::post().to(oauth::authorize_post)),
    );

    // ============================================
    // OAuth 2.0 Token Endpoints (Public - uses client credentials)
    // ============================================
    cfg.route("/oauth/token", web::post().to(oauth::token_post));
    cfg.route("/oauth/revoke", web::post().to(oauth::revoke_post));
    cfg.route(
        "/oauth/callback/exchange",
        web::post().to(oauth::callback_exchange_post),
    );

    // ============================================
    // OAuth 2.0 Authorized Apps (User-facing - requires auth)
    // Manage apps the user has authorized (consent grants)
    // ============================================
    cfg.service(
        web::scope("/oauth/authorized-apps")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(oauth::get_authorized_apps))
            .route("/revoke", web::post().to(oauth::revoke_app_authorization)),
    );

    // ============================================
    // OAuth 2.0 JWKS Endpoint (Public - for JWT verification)
    // ============================================
    cfg.service(web::scope("/.well-known").route("/jwks.json", web::get().to(oauth::jwks_json)));
}

/// Register all route names for URL generation
fn register_route_names() {
    // Auth routes
    route!("auth.sign_up", "/api/v1/auth/sign-up");
    route!("auth.sign_in", "/api/v1/auth/sign-in");
    route!("auth.sign_out", "/api/v1/auth/sign-out");
    route!("auth.sign_out_all", "/api/v1/auth/sign-out-all");
    route!("auth.refresh", "/api/v1/auth/refresh");

    // Account routes
    route!("account.activate", "/api/v1/account/activate-account");
    route!("account.forgot_password", "/api/v1/account/forgot-password");
    route!("account.verify_hash", "/api/v1/account/verify-hash");
    route!("account.reset_password", "/api/v1/account/reset-password");
    route!(
        "account.set_password_when_needed",
        "/api/v1/account/set-password-when-needed"
    );

    // Password routes
    route!("password.change", "/api/v1/password/change-password");
    route!(
        "password.verify_change",
        "/api/v1/password/verify-password-change"
    );

    // User routes
    route!("user.current", "/api/v1/user");
    route!("user.show", "/api/v1/user/{id}");
    route!("user.update_full", "/api/v1/user");
    route!("user.update_partial", "/api/v1/user");
    route!("user.admin_create", "/api/v1/user");
    route!("user.avatar", "/api/v1/user/avatar");
    route!("user.delete", "/api/v1/user/{id}");

    // Balance routes
    route!("balance.checkout", "/api/v1/balance/checkout");
    route!("balance.checkout_kafka", "/api/v1/balance/checkout-kafka");

    // Roulette routes
    route!("roulette.place_bet", "/api/v1/roulette/place-bet");
    route!("roulette.spin", "/api/v1/roulette/spin");
    route!("roulette.history", "/api/v1/roulette/history");
    route!("roulette.stats", "/api/v1/roulette/stats");
    route!("roulette.balance", "/api/v1/roulette/balance");
    route!("roulette.ajax", "/api/games/roulette");

    // Games routes
    route!("games.config", "/api/v1/games/config");

    // Gallery routes
    route!("galleries.list", "/api/v1/galleries");
    route!("galleries.create", "/api/v1/galleries");
    route!("galleries.reorder", "/api/v1/galleries/reorder");
    route!("galleries.show", "/api/v1/galleries/{id}");
    route!("galleries.update", "/api/v1/galleries/{id}");
    route!("galleries.delete", "/api/v1/galleries/{id}");
    route!("galleries.likes", "/api/v1/galleries/{id}/likes");

    // Picture routes
    route!("pictures.list", "/api/v1/galleries/{id}/pictures");
    route!("pictures.add", "/api/v1/galleries/{id}/pictures");
    route!(
        "pictures.reorder",
        "/api/v1/galleries/{id}/pictures/reorder"
    );
    route!(
        "pictures.bulk_delete",
        "/api/v1/galleries/{id}/pictures/bulk-delete"
    );
    route!(
        "pictures.update",
        "/api/v1/galleries/{gallery_id}/pictures/{picture_id}"
    );

    // Geo galleries / places
    route!("geo_galleries.list", "/api/v1/geo-galleries");
    route!(
        "geo_galleries.show",
        "/api/v1/geo-galleries/{gallery_uuid}"
    );
    route!("geo_places.list", "/api/v1/geo-places");
    route!("geo_places.admin", "/api/v1/admin/geo-places");

    // Competitions
    route!("competitions.list", "/api/v1/competitions");
    route!("competitions.create", "/api/v1/competitions");
    route!("competitions.show", "/api/v1/competitions/{id}");
    route!(
        "competitions.entries.create",
        "/api/v1/competitions/{id}/entries"
    );
    route!(
        "competitions.admin_vote",
        "/api/v1/competitions/{id}/admin-votes"
    );
    route!(
        "competitions.finalize",
        "/api/v1/competitions/{id}/finalize"
    );
    route!(
        "pictures.remove",
        "/api/v1/galleries/{gallery_id}/pictures/{picture_id}"
    );

    // Upload routes (all require auth except public download)
    route!("upload.public", "/api/v1/upload/public");
    route!("upload.private", "/api/v1/upload/private");
    route!("upload.multiple", "/api/v1/upload/multiple");
    route!(
        "upload.download.public",
        "/api/v1/upload/download/public/{uuid}"
    );
    route!("upload.private.download", "/api/v1/upload/private/{uuid}");
    route!("upload.delete", "/api/v1/upload/{uuid}");
    route!("upload.user", "/api/v1/upload/user");

    // Avatar routes
    route!("upload.avatar", "/api/v1/upload/avatar");
    route!("upload.avatar.delete", "/api/v1/upload/avatar");
    route!("avatar.get", "/api/v1/avatar/{uuid}");

    // Chunked upload routes
    route!("upload.chunked.start", "/api/v1/upload/chunked/start");
    route!(
        "upload.chunked.chunk",
        "/api/v1/upload/chunked/{uuid}/chunk/{index}"
    );
    route!(
        "upload.chunked.complete",
        "/api/v1/upload/chunked/{uuid}/complete"
    );
    route!("upload.chunked.cancel", "/api/v1/upload/chunked/{uuid}");

    // Schema catalog routes (public)
    route!("schemas.categories", "/api/v1/schemas/categories");
    route!("schemas.children", "/api/v1/schemas/children/{type_name}");
    route!("schemas.type", "/api/v1/schemas/{type_name}");

    // Admin routes (permission protected)
    route!("admin.uploads", "/api/v1/admin/uploads");
    route!(
        "admin.uploads.bulk_delete",
        "/api/v1/admin/uploads/bulk-delete"
    );
    route!(
        "admin.uploads.update_metadata",
        "/api/v1/admin/uploads/{uuid}/metadata"
    );
    route!("admin.assets", "/api/v1/admin/assets");
    route!("admin.users", "/api/v1/admin/users");
    route!("admin.users.bulk", "/api/v1/admin/users/bulk");
    route!("admin.delete_user", "/api/v1/admin/users/{id}");
    route!(
        "admin.delete_user_avatar",
        "/api/v1/admin/users/{id}/avatar"
    );
    route!(
        "admin.update_user_permissions",
        "/api/v1/admin/users/{id}/permissions"
    );

    // Theme routes (Admin+ permission)
    route!("admin.theme", "/api/v1/admin/theme");
    route!("admin.theme.update", "/api/v1/admin/theme");
    route!("admin.theme.branding", "/api/v1/admin/theme/branding");
    route!("admin.theme.build", "/api/v1/admin/theme/build");
    route!(
        "admin.theme.build_status",
        "/api/v1/admin/theme/build/status"
    );

    // SEO routes (Admin+ permission)
    route!("admin.seo.list", "/api/v1/admin/seo");
    route!("admin.seo.sync", "/api/v1/admin/seo/sync");
    route!("admin.seo.get", "/api/v1/admin/seo/{route_name}");
    route!("admin.seo.update", "/api/v1/admin/seo/{route_name}");
    route!("admin.seo.toggle", "/api/v1/admin/seo/{route_name}/toggle");

    // Schema routes (Admin+ permission)
    route!(
        "admin.seo.schema.list",
        "/api/v1/admin/seo/page/{id}/schemas"
    );
    route!(
        "admin.seo.schema.create",
        "/api/v1/admin/seo/page/{id}/schemas"
    );
    route!("admin.seo.schema.get", "/api/v1/admin/seo/schema/{id}");
    route!("admin.seo.schema.update", "/api/v1/admin/seo/schema/{id}");
    route!("admin.seo.schema.delete", "/api/v1/admin/seo/schema/{id}");
    route!(
        "admin.seo.schema.catalog",
        "/api/v1/admin/seo/schema-catalog"
    );
    route!("admin.seo.entity.list", "/api/v1/admin/seo/entities");
    route!("admin.seo.entity.create", "/api/v1/admin/seo/entities");
    route!(
        "admin.seo.entity.get",
        "/api/v1/admin/seo/entities/{schema_id}"
    );
    route!(
        "admin.seo.entity.delete",
        "/api/v1/admin/seo/entities/{schema_id}"
    );
    route!("admin.seo.entity.types", "/api/v1/admin/seo/entity-types");

    // Game Chat Config routes (Admin+ permission)
    route!("admin.game_chat.config", "/api/v1/admin/game-chat/config");
    route!(
        "admin.game_chat.global_mute",
        "/api/v1/admin/game-chat/global-mute"
    );
    route!(
        "admin.game_chat.profanity_add",
        "/api/v1/admin/game-chat/profanity/add"
    );
    route!(
        "admin.game_chat.profanity_remove",
        "/api/v1/admin/game-chat/profanity/remove"
    );

    // Webhooks
}
