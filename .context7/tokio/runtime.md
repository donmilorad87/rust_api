# Tokio - Runtime Basics

Source: https://github.com/context7/rs_tokio_tokio/blob/main/attr.main.md

Use the #[tokio::main] macro for simple apps.

```rust
#[tokio::main]
async fn main() {
    println!("Hello world");
}
```

Equivalent explicit runtime builder.

```rust
fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            println!("Hello world");
        })
}
```

Source: https://github.com/context7/rs_tokio_tokio/blob/main/runtime/struct.Builder.md

```rust
use tokio::runtime::Builder;

let rt  = Builder::new_multi_thread().build().unwrap();

rt.block_on(async {
    println!("Hello from the Tokio runtime");
});
```
