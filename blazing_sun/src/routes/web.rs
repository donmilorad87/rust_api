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
    route!("web.geo_galleries", "/geo_galleries");
    route!("web.geo_gallery", "/geo_gallery/{gallery_uuid}");
    route!("web.competitions", "/competitions");
    route!("web.games", "/games");
    route!("web.games.bigger_dice_lobby", "/games/bigger-dice");
    route!("web.games.bigger_dice", "/games/bigger-dice/{room_id}");
    route!("web.games.tic_tac_toe_lobby", "/games/tic-tac-toe");
    route!("web.games.tic_tac_toe", "/games/tic-tac-toe/{room_id}");
    route!("web.games.roulette_lobby", "/games/roulette");
    route!("web.games.roulette", "/games/roulette/{room_id}");
    route!("web.logout", "/logout");

    // Serbian variants
    route!("web.home", "/", "sr");
    route!("web.sign_up", "/registracija", "sr");
    route!("web.sign_in", "/prijava", "sr");
    route!("web.forgot_password", "/zaboravljena_lozinka", "sr");
    route!("web.profile", "/profil", "sr");
    route!("web.balance", "/balans", "sr");
    route!("oauth.applications", "/oauth/aplikacije", "sr");
    route!("web.galleries", "/galerije", "sr");
    route!("web.geo_galleries", "/geo_galerije", "sr");
    route!("web.geo_gallery", "/geo_galerija/{gallery_uuid}", "sr");
    route!("web.competitions", "/takmicenja", "sr");
    route!("web.games", "/igre", "sr");
    route!("web.games.bigger_dice_lobby", "/igre/vece-kocke", "sr");
    route!("web.games.bigger_dice", "/igre/vece-kocke/{room_id}", "sr");
    route!("web.games.tic_tac_toe_lobby", "/igre/iks-oks", "sr");
    route!("web.games.tic_tac_toe", "/igre/iks-oks/{room_id}", "sr");
    route!("web.games.roulette_lobby", "/igre/rulet", "sr");
    route!("web.games.roulette", "/igre/rulet/{room_id}", "sr");
    route!("web.logout", "/odjava", "sr");

    // Admin pages (Admin+ can access)
    route!("admin.uploads", "/admin/uploads");
    route!("admin.theme", "/admin/theme");
    route!("admin.game_chat", "/admin/game-chat");
    route!("admin.uploads", "/admin/otpremanja", "sr");
    route!("admin.theme", "/admin/tema", "sr");
    route!("admin.game_chat", "/admin/igra-pricaonica", "sr");

    // Super Admin pages (Super Admin only)
    route!("superadmin.users", "/superadmin/users");
    route!("superadmin.users", "/superadmin/korisnici", "sr");
}
