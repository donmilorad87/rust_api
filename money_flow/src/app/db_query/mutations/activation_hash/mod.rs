use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use sqlx::{Pool, Postgres};

/// Generate a random 40-character hash
pub fn generate_hash() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..40)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Create a new activation hash
pub async fn create(
    db: &Pool<Postgres>,
    user_id: i64,
    hash: &str,
    hash_type: &str,
    expiry_minutes: i64,
) -> Result<i64, sqlx::Error> {
    let expiry_time = Utc::now() + Duration::minutes(expiry_minutes);

    let result = sqlx::query!(
        r#"INSERT INTO activation_hashes (user_id, hash, hash_type, expiry_time, used)
           VALUES ($1, $2, $3, $4, 0) RETURNING id"#,
        user_id,
        hash,
        hash_type,
        expiry_time
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Activation hash record
pub struct ActivationHash {
    pub id: i64,
    pub user_id: i64,
    pub hash: String,
    pub hash_type: String,
    pub expiry_time: DateTime<Utc>,
    pub used: i16,
    pub created_at: DateTime<Utc>,
}

/// Find an activation hash by hash string
pub async fn find_by_hash(db: &Pool<Postgres>, hash: &str) -> Result<ActivationHash, sqlx::Error> {
    sqlx::query_as!(
        ActivationHash,
        "SELECT id, user_id, hash, hash_type, expiry_time, used, created_at FROM activation_hashes WHERE hash = $1",
        hash
    )
    .fetch_one(db)
    .await
}

/// Find an activation hash by hash string and user_id
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

/// Mark an activation hash as used
pub async fn mark_as_used(db: &Pool<Postgres>, hash_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE activation_hashes SET used = 1 WHERE id = $1",
        hash_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Delete all expired and used activation hashes for cleanup
pub async fn cleanup_expired(db: &Pool<Postgres>) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        "DELETE FROM activation_hashes WHERE used = 1 OR expiry_time < NOW()"
    )
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}
