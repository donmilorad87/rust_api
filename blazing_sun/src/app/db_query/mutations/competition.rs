//! Competition mutation queries
//!
//! Write operations for competitions, entries, and votes.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

/// Parameters for creating a competition
pub struct CreateCompetitionParams {
    pub title: String,
    pub description: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub prize_cents: i64,
    pub rules: String,
    pub created_by: Option<i64>,
}

/// Parameters for creating an entry
pub struct CreateCompetitionEntryParams {
    pub competition_id: i64,
    pub gallery_id: i64,
    pub user_id: i64,
}

/// Parameters for creating an admin vote
pub struct CreateAdminVoteParams {
    pub competition_id: i64,
    pub gallery_id: i64,
    pub admin_id: i64,
}

/// Create a new competition
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreateCompetitionParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO competitions (title, description, start_date, end_date, prize_cents, rules, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
        params.title,
        params.description,
        params.start_date,
        params.end_date,
        params.prize_cents,
        params.rules,
        params.created_by
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Add a gallery to a competition
pub async fn add_entry(
    db: &Pool<Postgres>,
    params: &CreateCompetitionEntryParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO competition_entries (competition_id, gallery_id, user_id)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        params.competition_id,
        params.gallery_id,
        params.user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Add an admin vote to a competition entry
pub async fn add_admin_vote(
    db: &Pool<Postgres>,
    params: &CreateAdminVoteParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO competition_admin_votes (competition_id, gallery_id, admin_id)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        params.competition_id,
        params.gallery_id,
        params.admin_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Set competition winner and award timestamp
pub async fn set_winner(
    db: &Pool<Postgres>,
    competition_id: i64,
    winner_gallery_id: i64,
    winner_user_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE competitions
        SET winner_gallery_id = $1, winner_user_id = $2, awarded_at = NOW()
        WHERE id = $3
        "#,
        winner_gallery_id,
        winner_user_id,
        competition_id
    )
    .execute(db)
    .await?;

    Ok(())
}
