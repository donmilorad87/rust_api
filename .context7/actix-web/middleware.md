# Actix Web - Middleware on Routes

Source: https://github.com/context7/rs-actix-web-4.11.0/blob/main/src/actix_web/route.rs.md

Apply middleware to specific routes and methods.

```rust
App::new()
    .route("/", web::get().to(HttpResponse::Ok).wrap(Logger::default()))
    .service(
        web::resource("/test")
            .route(web::get().to(HttpResponse::Ok))
            .route(
                web::post()
                    .to(HttpResponse::Created)
                    .wrap(DefaultHeaders::new().add(("x-test", "x-posted"))),
            )
            .route(
                web::delete()
                    .to(HttpResponse::Accepted)
                    .wrap(Logger::default()),
            ),
    )
```
