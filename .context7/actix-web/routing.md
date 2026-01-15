# Actix Web - Routing

Source: https://github.com/context7/rs-actix-web-4.11.0/blob/main/src/actix_web/route.rs.md

Route methods on a resource, async handlers, and JSON response.

```rust
web::resource("/test")
    .route(web::get().to(HttpResponse::Ok))
    .route(web::put().to(|| async {
        Err::<HttpResponse, _>(error::ErrorBadRequest("err"))
    }))
    .route(web::post().to(|| async {
        sleep(Duration::from_millis(100)).await;
        Ok::<_, Infallible>(HttpResponse::Created())
    }))
    .route(web::delete().to(|| async {
        sleep(Duration::from_millis(100)).await;
        Err::<HttpResponse, _>(error::ErrorBadRequest("err"))
    })),
web::resource("/json").route(web::get().to(|| async {
    sleep(Duration::from_millis(25)).await;
    web::Json(MyObject {
        name: "test".to_string(),
    })
}))
```

Source: https://github.com/context7/rs-actix-web-4.11.0/blob/main/actix_web/struct.Resource.md

Shortcut for binding a handler to a resource.

```rust
use actix_web::{App, HttpRequest, HttpResponse, web};

async fn index(req: HttpRequest) -> HttpResponse {
    todo!()
}

App::new().service(web::resource("/").to(index));
```
