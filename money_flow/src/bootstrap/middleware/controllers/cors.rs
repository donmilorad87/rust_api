use actix_cors::Cors;

pub fn configure() -> Cors {
    // CORS - allow all for development
    Cors::permissive()
}
