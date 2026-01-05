# SQLx - Queries and Macros

Source: https://github.com/context7/rs_sqlx_sqlx/blob/main/macro.query.md

`query!` with bind parameters.

```rust
// let mut conn = <impl sqlx::Executor>;
let account = sqlx::query!(
        // just pretend "accounts" is a real table
        "select * from (select (1) as id, 'Herp Derpinson' as name) accounts where id = ?",
        1i32
    )
    .fetch_one(&mut conn)
    .await?;

println!("{account:?}");
println!("{}: {}", account.id, account.name);
```

Source: https://github.com/context7/rs_sqlx_sqlx/blob/main/macro.query_as.md

`query_as!` to fetch into a struct.

```rust
#[derive(Debug)]
struct Account {
    id: i32,
    name: String
}

// let mut conn = <impl sqlx::Executor>;
let account = sqlx::query_as!(
        Account,
        "select * from (select (1) as id, 'Herp Derpinson' as name) accounts where id = ?",
        1i32
    )
    .fetch_one(&mut conn)
    .await?;

println!("{account:?}");
println!("{}: {}", account.id, account.name);
```
