//! Game Chat Config Read Queries
//!
//! Read operations for the game_chat_config table.

use sqlx::{Pool, Postgres};

/// Game chat configuration record
#[derive(Debug, Clone)]
pub struct GameChatConfigRecord {
    pub rate_limit_messages: i32,
    pub rate_limit_window_seconds: i32,
    pub max_message_length: i32,
    pub profanity_filter_enabled: bool,
    pub profanity_word_list: Vec<String>,
    pub global_mute_enabled: bool,
}

/// Get the game chat configuration
pub async fn get_config(db: &Pool<Postgres>) -> Result<GameChatConfigRecord, sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT * FROM sp_get_game_chat_config()"#
    )
    .fetch_one(db)
    .await?;

    Ok(GameChatConfigRecord {
        rate_limit_messages: row.rate_limit_messages.unwrap_or(20),
        rate_limit_window_seconds: row.rate_limit_window_seconds.unwrap_or(60),
        max_message_length: row.max_message_length.unwrap_or(512),
        profanity_filter_enabled: row.profanity_filter_enabled.unwrap_or(false),
        profanity_word_list: row.profanity_word_list.unwrap_or_default(),
        global_mute_enabled: row.global_mute_enabled.unwrap_or(false),
    })
}

/// Check if global mute is enabled
pub async fn is_global_mute_enabled(db: &Pool<Postgres>) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT global_mute_enabled FROM game_chat_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get rate limit settings only (for performance)
pub async fn get_rate_limit(db: &Pool<Postgres>) -> Result<(i32, i32), sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT rate_limit_messages, rate_limit_window_seconds FROM game_chat_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok((row.rate_limit_messages, row.rate_limit_window_seconds))
}

/// Get max message length
pub async fn get_max_message_length(db: &Pool<Postgres>) -> Result<i32, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT max_message_length FROM game_chat_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Check if profanity filter is enabled
pub async fn is_profanity_filter_enabled(db: &Pool<Postgres>) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT profanity_filter_enabled FROM game_chat_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get profanity word list
pub async fn get_profanity_words(db: &Pool<Postgres>) -> Result<Vec<String>, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT profanity_word_list FROM game_chat_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}
