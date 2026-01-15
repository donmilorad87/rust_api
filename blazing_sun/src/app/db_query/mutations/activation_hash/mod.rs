use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use sqlx::{Pool, Postgres};

/// Create activation hash with metadata
pub async fn create_with_metadata(
    db: &Pool<Postgres>,
    user_id: i64,
    hash: &str,
    hash_type: &str,
    expiry_time: DateTime<Utc>,
    metadata: serde_json::Value,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO activation_hashes
            (user_id, hash, hash_type, expiry_time, metadata, used, created_at)
        VALUES
            ($1, $2, $3, $4, $5, 0, NOW())
        RETURNING id
        "#,
        user_id,
        hash,
        hash_type,
        expiry_time,
        metadata
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Create activation hash without metadata (for backward compatibility)
/// Takes expiry_minutes and converts to DateTime<Utc>
pub async fn create(
    db: &Pool<Postgres>,
    user_id: i64,
    hash: &str,
    hash_type: &str,
    expiry_minutes: i64,
) -> Result<i64, sqlx::Error> {
    let expiry_time = Utc::now() + Duration::minutes(expiry_minutes);
    create_with_metadata(
        db,
        user_id,
        hash,
        hash_type,
        expiry_time,
        serde_json::json!({}),
    )
    .await
}

/// Mark activation hash as used
pub async fn mark_as_used(db: &Pool<Postgres>, hash_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE activation_hashes
        SET used = 1
        WHERE id = $1
        "#,
        hash_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete activation hash by ID
pub async fn delete(db: &Pool<Postgres>, hash_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM activation_hashes
        WHERE id = $1
        "#,
        hash_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete all unused hashes of a specific type for a user
pub async fn delete_unused_by_type(
    db: &Pool<Postgres>,
    user_id: i64,
    hash_type: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM activation_hashes
        WHERE user_id = $1
          AND hash_type = $2
          AND used = 0
        "#,
        user_id,
        hash_type
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================
// Legacy functions for backward compatibility
// ============================================

/// Generate a random 20-character hash
pub fn generate_hash() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..20)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Activation hash record (for legacy compatibility)
pub struct ActivationHash {
    pub id: i64,
    pub user_id: i64,
    pub hash: String,
    pub hash_type: String,
    pub expiry_time: DateTime<Utc>,
    pub used: i16,
    pub created_at: DateTime<Utc>,
}

/// Find an activation hash by hash string (for legacy compatibility)
pub async fn find_by_hash(db: &Pool<Postgres>, hash: &str) -> Result<ActivationHash, sqlx::Error> {
    sqlx::query_as!(
        ActivationHash,
        "SELECT id, user_id, hash, hash_type, expiry_time, used, created_at FROM activation_hashes WHERE hash = $1",
        hash
    )
    .fetch_one(db)
    .await
}

/// Find an activation hash by hash string and user_id (for legacy compatibility)
pub async fn find_by_hash_and_user(
    db: &Pool<Postgres>,
    hash: &str,
    user_id: i64,
) -> Result<ActivationHash, sqlx::Error> {
    sqlx::query_as!(
        ActivationHash,
        "SELECT id, user_id, hash, hash_type, expiry_time, used, created_at FROM activation_hashes WHERE hash = $1 AND user_id = $2",
        hash,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Validate an activation hash (not used and not expired)
pub fn is_valid(hash_record: &ActivationHash) -> bool {
    hash_record.used == 0 && hash_record.expiry_time > Utc::now()
}
