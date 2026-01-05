# Tokio - Spawning Tasks

Source: https://github.com/context7/rs_tokio_tokio/blob/main/runtime/struct.Runtime.md

```rust
use tokio::runtime::Runtime;

// Create the runtime
let rt = Runtime::new().unwrap();

// Spawn a future onto the runtime
rt.spawn(async {
    println!("now running on a worker thread");
});
```

Source: https://github.com/context7/rs_tokio_tokio/blob/main/task/fn.spawn.md

```rust
use tokio::net::{TcpListener, TcpStream};

use std::io;

async fn process(socket: TcpStream) {
    // ...
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;

    loop {
        let (socket, _) = listener.accept().await?;

        tokio::spawn(async move {
            // Process each socket concurrently.
            process(socket).await
        });
    }
}
```

```rust
async fn my_background_op(id: i32) -> String {
    let s = format!("Starting background task {}.", id);
    println!("{}", s);
    s
}

let ops = vec![1, 2, 3];
let mut tasks = Vec::with_capacity(ops.len());
for op in ops {
    // This call will make them start running in the background
    // immediately.
    tasks.push(tokio::spawn(my_background_op(op)));
}

let mut outputs = Vec::with_capacity(tasks.len());
for task in tasks {
    outputs.push(task.await.unwrap());
}
println!("{:?}", outputs);
```
