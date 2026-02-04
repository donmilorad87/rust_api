//!
//! Web Routes
//!
//! This file defines all web routes for the application.
//!

use actix_files::Files;
use actix_web::{web, Route};

use crate::app::http::web::controllers::pages::PagesController;
use crate::route;

/// Register all web routes
pub fn register(cfg: &mut web::ServiceConfig) {
    // Register named routes for URL generation
    register_route_names();

    // ============================================
    // Static Assets
    // ============================================
    cfg.service(
        Files::new(
            "/assets/js",
            concat!(env!("CARGO_MANIFEST_DIR"), "/src/resources/js"),
        )
        .show_files_listing(),
    );
    cfg.service(
        Files::new(
            "/assets/css",
            concat!(env!("CARGO_MANIFEST_DIR"), "/src/resources/css"),
        )
        .show_files_listing(),
    );
    cfg.service(
        Files::new(
            "/assets/img",
            concat!(env!("CARGO_MANIFEST_DIR"), "/src/resources/img"),
        )
        .show_files_listing(),
    );

    // ============================================
    // Web Pages (Localized Router)
    // ============================================
    cfg.route("/", web::get().to(PagesController::localized_router));
    cfg.route(
        "/{path:.*}",
        web::get().to(PagesController::localized_router),
    );

    // ============================================
    // 404 Fallback (must be last)
    // ============================================
    cfg.default_service(Route::new().to(PagesController::not_found));
}

/// Register all web route names for URL generation
fn register_route_names() {
    route!("web.home", "/");
    route!("web.sign_up", "/sign_up");
    route!("web.sign_in", "/sign_in");
    route!("web.forgot_password", "/forgot_password");
    route!("web.profile", "/profile");
    route!("web.balance", "/balance");
    route!("oauth.applications", "/oauth/applications");
    route!("web.galleries", "/galleries");
    route!("web.geo_galleries.gallery", "/geo_galleries/gallery");
    route!("web.geo_gallery", "/geo_gallery/{gallery_uuid}");
    route!("web.geo_galleries.competitions", "/geo_galleries/competitions");
    route!("web.games", "/games");
    route!("web.games.bigger_dice_lobby", "/games/bigger-dice");
    route!("web.games.bigger_dice", "/games/bigger-dice/{room_id}");
    route!("web.games.tic_tac_toe_lobby", "/games/tic-tac-toe");
    route!("web.games.tic_tac_toe", "/games/tic-tac-toe/{room_id}");
    route!("web.games.roulette_lobby", "/games/roulette");
    route!("web.games.roulette", "/games/roulette/{room_id}");
    route!("web.games.roulette_multiplayer", "/games/roulette-multiplayer");
    route!("web.games.slot_machine", "/games/slot-machine");
    route!("web.logout", "/logout");

    // Blog routes (public)
    route!("web.blog", "/blog");
    route!("web.blog.category", "/blog/category/{slug}");
    route!("web.blog.tag", "/blog/tag/{slug}");
    route!("web.blog.taxonomy", "/blog/taxonomy/{slug}");
    route!("web.blog.search", "/blog/search");
    route!("web.blog.archive_index", "/blog/archive");
    route!("web.blog.archive", "/blog/archive/{year}/{month}");
    // Single post - must be LAST to avoid matching category/tag/etc paths
    route!("web.blog.post", "/blog/{slug}");

    // Serbian variants
    route!("web.home", "/", "sr");
    route!("web.sign_up", "/registracija", "sr");
    route!("web.sign_in", "/prijava", "sr");
    route!("web.forgot_password", "/zaboravljena_lozinka", "sr");
    route!("web.profile", "/profil", "sr");
    route!("web.balance", "/balans", "sr");
    route!("oauth.applications", "/oauth/aplikacije", "sr");
    route!("web.galleries", "/galerije", "sr");
    route!("web.geo_galleries.gallery", "/geo_galerije/galerija", "sr");
    route!("web.geo_gallery", "/geo_galerija/{gallery_uuid}", "sr");
    route!("web.geo_galleries.competitions", "/geo_galerije/takmicenja", "sr");
    route!("web.games", "/igre", "sr");
    route!("web.games.bigger_dice_lobby", "/igre/vece-kocke", "sr");
    route!("web.games.bigger_dice", "/igre/vece-kocke/{room_id}", "sr");
    route!("web.games.tic_tac_toe_lobby", "/igre/iks-oks", "sr");
    route!("web.games.tic_tac_toe", "/igre/iks-oks/{room_id}", "sr");
    route!("web.games.roulette_lobby", "/igre/rulet", "sr");
    route!("web.games.roulette", "/igre/rulet/{room_id}", "sr");
    route!("web.games.roulette_multiplayer", "/igre/rulet-vise-igraca", "sr");
    route!("web.games.slot_machine", "/igre/slot-masina", "sr");
    route!("web.logout", "/odjava", "sr");

    // Blog routes (public) - Serbian variants
    route!("web.blog", "/blog", "sr");
    route!("web.blog.category", "/blog/kategorija/{slug}", "sr");
    route!("web.blog.tag", "/blog/oznaka/{slug}", "sr");
    route!("web.blog.taxonomy", "/blog/taksonomija/{slug}", "sr");
    route!("web.blog.search", "/blog/pretraga", "sr");
    route!("web.blog.archive_index", "/blog/arhiva", "sr");
    route!("web.blog.archive", "/blog/arhiva/{year}/{month}", "sr");
    // Single post - must be LAST to avoid matching category/tag/etc paths
    route!("web.blog.post", "/blog/{slug}", "sr");

    // Admin pages (Admin+ can access)
    route!("admin.uploads", "/admin/uploads");
    route!("admin.theme", "/admin/theme");
    route!("admin.game_chat", "/admin/game-chat");
    route!("admin.uploads", "/admin/otpremanja", "sr");
    route!("admin.theme", "/admin/tema", "sr");
    route!("admin.game_chat", "/admin/igra-pricaonica", "sr");

    // Admin blog routes (Admin+ can access)
    route!("admin.blog", "/admin/blog");
    route!("admin.blog.categories", "/admin/blog/categories");
    route!("admin.blog.tags", "/admin/blog/tags");
    route!("admin.blog.posts", "/admin/blog/posts");
    route!("admin.blog.posts.new", "/admin/blog/posts/new");
    route!("admin.blog.posts.edit", "/admin/blog/posts/{id}/edit");
    route!("admin.blog.taxonomies", "/admin/blog/taxonomies");
    route!("admin.blog.analytics", "/admin/blog/analytics");

    // Admin search index management
    route!("admin.search", "/admin/search");

    // Admin blog routes - Serbian variants
    route!("admin.blog", "/admin/blog", "sr");
    route!("admin.blog.categories", "/admin/blog/kategorije", "sr");
    route!("admin.blog.tags", "/admin/blog/oznake", "sr");
    route!("admin.blog.posts", "/admin/blog/clanci", "sr");
    route!("admin.blog.posts.new", "/admin/blog/clanci/novi", "sr");
    route!("admin.blog.posts.edit", "/admin/blog/clanci/{id}/izmeni", "sr");
    route!("admin.blog.taxonomies", "/admin/blog/taksonomije", "sr");
    route!("admin.blog.analytics", "/admin/blog/analitika", "sr");

    // Super Admin pages (Super Admin only)
    route!("superadmin.users", "/superadmin/users");
    route!("superadmin.users", "/superadmin/korisnici", "sr");
}
