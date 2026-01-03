use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivationHash {
    pub id: i64,
    pub user_id: i64,
    pub hash: String,
    pub hash_type: String,
    pub expiry_time: DateTime<Utc>,
    pub used: i16,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Get activation hash by hash string, type, and user_id
/// Ensures the hash belongs to the specified user and is of the correct type
pub async fn get_by_hash_and_type(
    db: &Pool<Postgres>,
    hash: &str,
    hash_type: &str,
    user_id: i64,
) -> Result<ActivationHash, sqlx::Error> {
    sqlx::query_as!(
        ActivationHash,
        r#"
        SELECT
            id,
            user_id,
            hash,
            hash_type,
            expiry_time,
            used,
            metadata,
            created_at
        FROM activation_hashes
        WHERE hash = $1
          AND hash_type = $2
          AND user_id = $3
          AND used = 0
          AND expiry_time > NOW()
        LIMIT 1
        "#,
        hash,
        hash_type,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Get activation hash by hash string only (for general lookups)
pub async fn get_by_hash(
    db: &Pool<Postgres>,
    hash: &str,
) -> Result<ActivationHash, sqlx::Error> {
    sqlx::query_as!(
        ActivationHash,
        r#"
        SELECT
            id,
            user_id,
            hash,
            hash_type,
            expiry_time,
            used,
            metadata,
            created_at
        FROM activation_hashes
        WHERE hash = $1
        LIMIT 1
        "#,
        hash
    )
    .fetch_one(db)
    .await
}

/// Check if a valid unused hash exists for user and type
pub async fn exists_for_user(
    db: &Pool<Postgres>,
    user_id: i64,
    hash_type: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM activation_hashes
            WHERE user_id = $1
              AND hash_type = $2
              AND used = 0
              AND expiry_time > NOW()
        ) as "exists!"
        "#,
        user_id,
        hash_type
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}
