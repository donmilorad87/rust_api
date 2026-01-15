//! Gallery like read queries

use sqlx::{Pool, Postgres};

pub async fn count_by_gallery(db: &Pool<Postgres>, gallery_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM gallery_likes WHERE gallery_id = $1"#,
        gallery_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

pub async fn exists_for_user(db: &Pool<Postgres>, gallery_id: i64, user_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM gallery_likes WHERE gallery_id = $1 AND user_id = $2) as "exists!""#,
        gallery_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}
