//! Gallery like mutation queries

use sqlx::{Pool, Postgres};

pub async fn add_like(
    db: &Pool<Postgres>,
    gallery_id: i64,
    user_id: i64,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO gallery_likes (gallery_id, user_id)
        VALUES ($1, $2)
        RETURNING id
        "#,
        gallery_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

pub async fn remove_like(
    db: &Pool<Postgres>,
    gallery_id: i64,
    user_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM gallery_likes WHERE gallery_id = $1 AND user_id = $2"#,
        gallery_id,
        user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
