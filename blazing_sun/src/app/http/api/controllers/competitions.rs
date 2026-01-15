//! Competitions API Controller
//!
//! Handles creation, listing, submissions, voting, and finalization.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;

const PRIZE_CENTS: i64 = 10000;

#[derive(Debug, Deserialize)]
pub struct CreateCompetitionRequest {
    pub title: String,
    pub description: String,
    pub start_date: String,
    pub end_date: String,
    pub rules: String,
}

#[derive(Debug, Deserialize)]
pub struct JoinCompetitionRequest {
    pub gallery_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct AdminVoteRequest {
    pub gallery_id: i64,
}

#[derive(Debug, Serialize)]
pub struct CompetitionResponse {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub start_date: String,
    pub end_date: String,
    pub prize_cents: i64,
    pub rules: String,
    pub status: String,
    pub winner_gallery_id: Option<i64>,
    pub winner_user_id: Option<i64>,
    pub awarded_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CompetitionEntryResponse {
    pub gallery_id: i64,
    pub user_id: i64,
    pub likes_count: i64,
    pub admin_votes_count: i64,
    pub score: f64,
}

fn competition_status(now: DateTime<Utc>, start: DateTime<Utc>, end: DateTime<Utc>) -> String {
    if now < start {
        "upcoming".to_string()
    } else if now > end {
        "ended".to_string()
    } else {
        "active".to_string()
    }
}

fn compute_scores(entries: &[db_read::competition::CompetitionEntryWithCounts]) -> Vec<f64> {
    let max_likes = entries.iter().map(|e| e.likes_count).max().unwrap_or(0);
    let max_admin = entries.iter().map(|e| e.admin_votes_count).max().unwrap_or(0);

    entries
        .iter()
        .map(|entry| {
            let likes_score = if max_likes > 0 {
                entry.likes_count as f64 / max_likes as f64
            } else {
                0.0
            };

            let admin_score = if max_admin > 0 {
                entry.admin_votes_count as f64 / max_admin as f64
            } else {
                0.0
            };

            (likes_score * 0.5) + (admin_score * 0.5)
        })
        .collect()
}

/// GET /api/v1/competitions
pub async fn list_competitions(state: web::Data<AppState>) -> HttpResponse {
    let db = state.db.lock().await;

    match db_read::competition::get_all(&db).await {
        Ok(competitions) => {
            let now = Utc::now();
            let response: Vec<CompetitionResponse> = competitions
                .into_iter()
                .map(|competition| CompetitionResponse {
                    id: competition.id,
                    title: competition.title,
                    description: competition.description,
                    start_date: competition.start_date.to_rfc3339(),
                    end_date: competition.end_date.to_rfc3339(),
                    prize_cents: competition.prize_cents,
                    rules: competition.rules,
                    status: competition_status(now, competition.start_date, competition.end_date),
                    winner_gallery_id: competition.winner_gallery_id,
                    winner_user_id: competition.winner_user_id,
                    awarded_at: competition.awarded_at.map(|date| date.to_rfc3339()),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "competitions": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competitions: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competitions"
            }))
        }
    }
}

/// GET /api/v1/competitions/{id}
pub async fn get_competition(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let competition_id = path.into_inner();
    let db = state.db.lock().await;

    let competition = match db_read::competition::get_by_id(&db, competition_id).await {
        Ok(competition) => competition,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Competition not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competition: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competition"
            }));
        }
    };

    let entries = match db_read::competition::get_entries_with_counts(&db, competition_id).await {
        Ok(entries) => entries,
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competition entries: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competition entries"
            }));
        }
    };

    let scores = compute_scores(&entries);
    let entry_response: Vec<CompetitionEntryResponse> = entries
        .into_iter()
        .zip(scores.into_iter())
        .map(|(entry, score)| CompetitionEntryResponse {
            gallery_id: entry.gallery_id,
            user_id: entry.user_id,
            likes_count: entry.likes_count,
            admin_votes_count: entry.admin_votes_count,
            score,
        })
        .collect();

    let now = Utc::now();
    let response = CompetitionResponse {
        id: competition.id,
        title: competition.title,
        description: competition.description,
        start_date: competition.start_date.to_rfc3339(),
        end_date: competition.end_date.to_rfc3339(),
        prize_cents: competition.prize_cents,
        rules: competition.rules,
        status: competition_status(now, competition.start_date, competition.end_date),
        winner_gallery_id: competition.winner_gallery_id,
        winner_user_id: competition.winner_user_id,
        awarded_at: competition.awarded_at.map(|date| date.to_rfc3339()),
    };

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "competition": response,
        "entries": entry_response
    }))
}

/// POST /api/v1/competitions (admin)
pub async fn create_competition(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateCompetitionRequest>,
) -> HttpResponse {
    if body.title.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Title cannot be empty"
        }));
    }

    let start_date = match DateTime::parse_from_rfc3339(&body.start_date) {
        Ok(date) => date.with_timezone(&Utc),
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid start date"
            }));
        }
    };

    let end_date = match DateTime::parse_from_rfc3339(&body.end_date) {
        Ok(date) => date.with_timezone(&Utc),
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid end date"
            }));
        }
    };

    if start_date >= end_date {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Start date must be before end date"
        }));
    }

    let admin_id = req.extensions().get::<i64>().copied();
    let db = state.db.lock().await;

    let params = db_mutations::competition::CreateCompetitionParams {
        title: body.title.clone(),
        description: body.description.clone(),
        start_date,
        end_date,
        prize_cents: PRIZE_CENTS,
        rules: body.rules.clone(),
        created_by: admin_id,
    };

    match db_mutations::competition::create(&db, &params).await {
        Ok(id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": id
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create competition: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create competition"
            }))
        }
    }
}

/// POST /api/v1/competitions/{id}/entries
pub async fn join_competition(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<JoinCompetitionRequest>,
) -> HttpResponse {
    let competition_id = path.into_inner();
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    let competition = match db_read::competition::get_by_id(&db, competition_id).await {
        Ok(competition) => competition,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Competition not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competition: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competition"
            }));
        }
    };

    if competition.awarded_at.is_some() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Competition is finalized"
        }));
    }

    let now = Utc::now();
    if now < competition.start_date || now > competition.end_date {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Competition is not active"
        }));
    }

    if db_read::competition::entry_exists(&db, competition_id, body.gallery_id).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Gallery already submitted"
        }));
    }

    let gallery = match db_read::gallery::get_by_id_and_user(&db, body.gallery_id, user_id).await {
        Ok(gallery) => gallery,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch gallery: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch gallery"
            }));
        }
    };

    if !gallery.is_public {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery must be public to join competitions"
        }));
    }

    if gallery.gallery_type != "geo_galleries" {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery must be a geo gallery to join competitions"
        }));
    }

    if gallery.latitude.is_none() || gallery.longitude.is_none() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery must have geo coordinates"
        }));
    }

    let params = db_mutations::competition::CreateCompetitionEntryParams {
        competition_id,
        gallery_id: body.gallery_id,
        user_id,
    };

    match db_mutations::competition::add_entry(&db, &params).await {
        Ok(entry_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": entry_id
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to add competition entry: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to join competition"
            }))
        }
    }
}

/// POST /api/v1/competitions/{id}/admin-votes
pub async fn admin_vote(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<AdminVoteRequest>,
) -> HttpResponse {
    let competition_id = path.into_inner();
    let admin_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    let competition = match db_read::competition::get_by_id(&db, competition_id).await {
        Ok(competition) => competition,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Competition not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competition: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competition"
            }));
        }
    };

    if competition.awarded_at.is_some() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Competition is finalized"
        }));
    }

    let now = Utc::now();
    if now < competition.start_date || now > competition.end_date {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Competition is not active"
        }));
    }

    if !db_read::competition::entry_exists(&db, competition_id, body.gallery_id).await {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery is not submitted to this competition"
        }));
    }

    if db_read::competition::admin_vote_exists(&db, competition_id, body.gallery_id, admin_id).await
    {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Admin already voted"
        }));
    }

    let params = db_mutations::competition::CreateAdminVoteParams {
        competition_id,
        gallery_id: body.gallery_id,
        admin_id,
    };

    match db_mutations::competition::add_admin_vote(&db, &params).await {
        Ok(vote_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": vote_id
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to add admin vote: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add admin vote"
            }))
        }
    }
}

/// POST /api/v1/competitions/{id}/finalize
pub async fn finalize_competition(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let competition_id = path.into_inner();
    let db = state.db.lock().await;

    let competition = match db_read::competition::get_by_id(&db, competition_id).await {
        Ok(competition) => competition,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Competition not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch competition: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch competition"
            }));
        }
    };

    if competition.awarded_at.is_some() {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Competition already finalized"
        }));
    }

    let now = Utc::now();
    if now <= competition.end_date {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Competition has not ended"
        }));
    }

    let entries = match db_read::competition::get_entries_with_counts(&db, competition_id).await {
        Ok(entries) => entries,
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch entries: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch entries"
            }));
        }
    };

    if entries.is_empty() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No entries to finalize"
        }));
    }

    let scores = compute_scores(&entries);

    let mut best_index = 0usize;
    let mut best_score = scores[0];

    for (index, score) in scores.iter().enumerate().skip(1) {
        let entry = &entries[index];
        let best_entry = &entries[best_index];

        if *score > best_score
            || (*score == best_score
                && entry.likes_count > best_entry.likes_count)
            || (*score == best_score
                && entry.likes_count == best_entry.likes_count
                && entry.admin_votes_count > best_entry.admin_votes_count)
        {
            best_index = index;
            best_score = *score;
        }
    }

    let winner = &entries[best_index];

    if let Err(e) = db_mutations::competition::set_winner(
        &db,
        competition_id,
        winner.gallery_id,
        winner.user_id,
    )
    .await
    {
        drop(db);
        eprintln!("Failed to set competition winner: {:?}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to finalize competition"
        }));
    }

    if let Err(e) = db_mutations::user::add_balance(&db, winner.user_id, PRIZE_CENTS).await {
        drop(db);
        eprintln!("Failed to award prize: {:?}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to award prize"
        }));
    }

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "winner_gallery_id": winner.gallery_id,
        "winner_user_id": winner.user_id,
        "score": best_score,
        "likes_count": winner.likes_count,
        "admin_votes_count": winner.admin_votes_count
    }))
}
