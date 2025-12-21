use actix_web::{middleware::from_fn, web};

use crate::middleware;

pub mod controllers;
pub mod validators;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(controllers::auth::sign_up)
            .service(controllers::auth::sign_in)
            .service(
                web::scope("")
                    .wrap(from_fn(middleware::auth::verify_jwt))
                    .service(controllers::me::get_profile)
                    .service(controllers::me::update_profile),
            ),
    );
}
