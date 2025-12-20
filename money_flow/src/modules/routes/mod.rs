use actix_web::web;

pub mod controllers;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(controllers::auth::sign_up)
            .service(controllers::auth::sign_in)
            .service(controllers::me::get_profile)
            .service(controllers::me::update_profile),
    );
}
