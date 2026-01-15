//! Competition read queries
//!
//! Read operations for competitions and entries.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competition {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub prize_cents: i64,
    pub rules: String,
    pub created_by: Option<i64>,
    pub winner_gallery_id: Option<i64>,
    pub winner_user_id: Option<i64>,
    pub awarded_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionEntryWithCounts {
    pub entry_id: i64,
    pub gallery_id: i64,
    pub user_id: i64,
    pub likes_count: i64,
    pub admin_votes_count: i64,
}

/// Get competition by ID
pub async fn get_by_id(db: &Pool<Postgres>, competition_id: i64) -> Result<Competition, sqlx::Error> {
    sqlx::query_as!(
        Competition,
        r#"
        SELECT id, title, description, start_date, end_date, prize_cents, rules, created_by,
               winner_gallery_id, winner_user_id, awarded_at, created_at, updated_at
        FROM competitions
        WHERE id = $1
        "#,
        competition_id
    )
    .fetch_one(db)
    .await
}

/// List all competitions
pub async fn get_all(db: &Pool<Postgres>) -> Result<Vec<Competition>, sqlx::Error> {
    sqlx::query_as!(
        Competition,
        r#"
        SELECT id, title, description, start_date, end_date, prize_cents, rules, created_by,
               winner_gallery_id, winner_user_id, awarded_at, created_at, updated_at
        FROM competitions
        ORDER BY start_date DESC
        "#
    )
    .fetch_all(db)
    .await
}

/// Check if a gallery is already submitted to a competition
pub async fn entry_exists(
    db: &Pool<Postgres>,
    competition_id: i64,
    gallery_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM competition_entries WHERE competition_id = $1 AND gallery_id = $2) as "exists!""#,
        competition_id,
        gallery_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if an admin vote exists
pub async fn admin_vote_exists(
    db: &Pool<Postgres>,
    competition_id: i64,
    gallery_id: i64,
    admin_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM competition_admin_votes WHERE competition_id = $1 AND gallery_id = $2 AND admin_id = $3) as "exists!""#,
        competition_id,
        gallery_id,
        admin_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Get competition entries with like and admin vote counts
pub async fn get_entries_with_counts(
    db: &Pool<Postgres>,
    competition_id: i64,
) -> Result<Vec<CompetitionEntryWithCounts>, sqlx::Error> {
    sqlx::query_as!(
        CompetitionEntryWithCounts,
        r#"
        SELECT
            ce.id as entry_id,
            ce.gallery_id,
            ce.user_id,
            COUNT(DISTINCT gl.id) as "likes_count!",
            COUNT(DISTINCT cav.id) as "admin_votes_count!"
        FROM competition_entries ce
        LEFT JOIN gallery_likes gl ON gl.gallery_id = ce.gallery_id
        LEFT JOIN competition_admin_votes cav
            ON cav.gallery_id = ce.gallery_id AND cav.competition_id = ce.competition_id
        WHERE ce.competition_id = $1
        GROUP BY ce.id, ce.gallery_id, ce.user_id
        ORDER BY ce.created_at ASC
        "#,
        competition_id
    )
    .fetch_all(db)
    .await
}

/// Count total entries for a competition
pub async fn count_entries(db: &Pool<Postgres>, competition_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM competition_entries WHERE competition_id = $1"#,
        competition_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}
