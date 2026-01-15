//!
//! Game Chat Config Controller
//!
//! Handles game chat configuration operations:
//! - GET /api/admin/game-chat/config: Get current chat configuration
//! - PUT /api/admin/game-chat/config: Update chat configuration
//! - POST /api/admin/game-chat/global-mute: Toggle global mute
//!

use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::app::db_query::mutations::game_chat_config as db_mutations;
use crate::app::db_query::read::game_chat_config as db_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::utility::auth::is_logged;
use crate::database::AppState;

/// Game Chat Config Controller
pub struct GameChatConfigController;

/// Chat configuration response
#[derive(Debug, Serialize)]
pub struct ChatConfigResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub config: ChatConfigDto,
}

/// Chat configuration DTO
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatConfigDto {
    pub rate_limit_messages: i32,
    pub rate_limit_window_seconds: i32,
    pub max_message_length: i32,
    pub profanity_filter_enabled: bool,
    pub profanity_word_list: Vec<String>,
    pub global_mute_enabled: bool,
}

/// Chat config update request
#[derive(Debug, Deserialize)]
pub struct ChatConfigUpdateRequest {
    pub rate_limit_messages: Option<i32>,
    pub rate_limit_window_seconds: Option<i32>,
    pub max_message_length: Option<i32>,
    pub profanity_filter_enabled: Option<bool>,
    pub profanity_word_list: Option<Vec<String>>,
    pub global_mute_enabled: Option<bool>,
}

/// Global mute toggle request
#[derive(Debug, Deserialize)]
pub struct GlobalMuteRequest {
    pub enabled: bool,
}

/// Add word to profanity list request
#[derive(Debug, Deserialize)]
pub struct AddProfanityWordRequest {
    pub word: String,
}

/// Remove word from profanity list request
#[derive(Debug, Deserialize)]
pub struct RemoveProfanityWordRequest {
    pub word: String,
}

impl GameChatConfigController {
    /// Get current chat configuration
    ///
    /// GET /api/admin/game-chat/config
    pub async fn get_config(
        req: HttpRequest,
        state: web::Data<AppState>,
    ) -> HttpResponse {
        // Check admin permissions
        let auth = is_logged(&req);
        if !auth.is_logged || !auth.is_admin() {
            return HttpResponse::Forbidden().json(BaseResponse::error("Access denied"));
        }

        let db = state.db.lock().await;

        match db_read::get_config(&db).await {
            Ok(config) => {
                HttpResponse::Ok().json(ChatConfigResponse {
                    base: BaseResponse::success("Chat configuration retrieved"),
                    config: ChatConfigDto {
                        rate_limit_messages: config.rate_limit_messages,
                        rate_limit_window_seconds: config.rate_limit_window_seconds,
                        max_message_length: config.max_message_length,
                        profanity_filter_enabled: config.profanity_filter_enabled,
                        profanity_word_list: config.profanity_word_list,
                        global_mute_enabled: config.global_mute_enabled,
                    },
                })
            }
            Err(e) => {
                error!("Failed to get chat config: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve chat configuration"))
            }
        }
    }

    /// Update chat configuration
    ///
    /// PUT /api/admin/game-chat/config
    pub async fn update_config(
        req: HttpRequest,
        state: web::Data<AppState>,
        body: web::Json<ChatConfigUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permissions
        let auth = is_logged(&req);
        if !auth.is_logged || !auth.is_admin() {
            return HttpResponse::Forbidden().json(BaseResponse::error("Access denied"));
        }

        // Validate input
        if let Some(rate_limit) = body.rate_limit_messages {
            if rate_limit < 1 || rate_limit > 1000 {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Rate limit messages must be between 1 and 1000"));
            }
        }

        if let Some(window) = body.rate_limit_window_seconds {
            if window < 1 || window > 3600 {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Rate limit window must be between 1 and 3600 seconds"));
            }
        }

        if let Some(max_len) = body.max_message_length {
            if max_len < 1 || max_len > 10000 {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Max message length must be between 1 and 10000"));
            }
        }

        let db = state.db.lock().await;

        let params = db_mutations::UpdateChatConfigParams {
            rate_limit_messages: body.rate_limit_messages,
            rate_limit_window_seconds: body.rate_limit_window_seconds,
            max_message_length: body.max_message_length,
            profanity_filter_enabled: body.profanity_filter_enabled,
            profanity_word_list: body.profanity_word_list.clone(),
            global_mute_enabled: body.global_mute_enabled,
        };

        match db_mutations::update_config(&db, &params).await {
            Ok(_) => {
                info!("Game chat config updated by admin");

                // Fetch and return updated config
                match db_read::get_config(&db).await {
                    Ok(config) => {
                        HttpResponse::Ok().json(ChatConfigResponse {
                            base: BaseResponse::success("Chat configuration updated"),
                            config: ChatConfigDto {
                                rate_limit_messages: config.rate_limit_messages,
                                rate_limit_window_seconds: config.rate_limit_window_seconds,
                                max_message_length: config.max_message_length,
                                profanity_filter_enabled: config.profanity_filter_enabled,
                                profanity_word_list: config.profanity_word_list,
                                global_mute_enabled: config.global_mute_enabled,
                            },
                        })
                    }
                    Err(e) => {
                        error!("Failed to fetch updated config: {}", e);
                        HttpResponse::Ok().json(BaseResponse::success("Chat configuration updated"))
                    }
                }
            }
            Err(e) => {
                error!("Failed to update chat config: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update chat configuration"))
            }
        }
    }

    /// Toggle global mute (emergency kill switch)
    ///
    /// POST /api/admin/game-chat/global-mute
    pub async fn toggle_global_mute(
        req: HttpRequest,
        state: web::Data<AppState>,
        body: web::Json<GlobalMuteRequest>,
    ) -> HttpResponse {
        // Check admin permissions
        let auth = is_logged(&req);
        if !auth.is_logged || !auth.is_admin() {
            return HttpResponse::Forbidden().json(BaseResponse::error("Access denied"));
        }

        let db = state.db.lock().await;

        match db_mutations::set_global_mute(&db, body.enabled).await {
            Ok(_) => {
                if body.enabled {
                    info!("Global mute enabled by admin");
                    HttpResponse::Ok().json(BaseResponse::success("Global mute enabled"))
                } else {
                    info!("Global mute disabled by admin");
                    HttpResponse::Ok().json(BaseResponse::success("Global mute disabled"))
                }
            }
            Err(e) => {
                error!("Failed to toggle global mute: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to toggle global mute"))
            }
        }
    }

    /// Add word to profanity filter list
    ///
    /// POST /api/admin/game-chat/profanity/add
    pub async fn add_profanity_word(
        req: HttpRequest,
        state: web::Data<AppState>,
        body: web::Json<AddProfanityWordRequest>,
    ) -> HttpResponse {
        // Check admin permissions
        let auth = is_logged(&req);
        if !auth.is_logged || !auth.is_admin() {
            return HttpResponse::Forbidden().json(BaseResponse::error("Access denied"));
        }

        let word = body.word.trim().to_lowercase();
        if word.is_empty() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Word cannot be empty"));
        }

        let db = state.db.lock().await;

        match db_mutations::add_profanity_words(&db, &[word.clone()]).await {
            Ok(_) => {
                info!("Added word to profanity filter: {}", word);
                HttpResponse::Ok().json(BaseResponse::success("Word added to profanity filter"))
            }
            Err(e) => {
                error!("Failed to add profanity word: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to add word to profanity filter"))
            }
        }
    }

    /// Remove word from profanity filter list
    ///
    /// POST /api/admin/game-chat/profanity/remove
    pub async fn remove_profanity_word(
        req: HttpRequest,
        state: web::Data<AppState>,
        body: web::Json<RemoveProfanityWordRequest>,
    ) -> HttpResponse {
        // Check admin permissions
        let auth = is_logged(&req);
        if !auth.is_logged || !auth.is_admin() {
            return HttpResponse::Forbidden().json(BaseResponse::error("Access denied"));
        }

        let word = body.word.trim().to_lowercase();
        if word.is_empty() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Word cannot be empty"));
        }

        let db = state.db.lock().await;

        match db_mutations::remove_profanity_word(&db, &word).await {
            Ok(_) => {
                info!("Removed word from profanity filter: {}", word);
                HttpResponse::Ok().json(BaseResponse::success("Word removed from profanity filter"))
            }
            Err(e) => {
                error!("Failed to remove profanity word: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to remove word from profanity filter"))
            }
        }
    }
}
