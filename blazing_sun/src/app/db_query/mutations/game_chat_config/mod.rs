//! Game Chat Config Mutation Queries
//!
//! Write operations for the game_chat_config table.

use sqlx::{Pool, Postgres};

/// Parameters for updating game chat configuration
#[derive(Debug, Default)]
pub struct UpdateChatConfigParams {
    pub rate_limit_messages: Option<i32>,
    pub rate_limit_window_seconds: Option<i32>,
    pub max_message_length: Option<i32>,
    pub profanity_filter_enabled: Option<bool>,
    pub profanity_word_list: Option<Vec<String>>,
    pub global_mute_enabled: Option<bool>,
}

/// Update game chat configuration using stored procedure
pub async fn update_config(
    db: &Pool<Postgres>,
    params: &UpdateChatConfigParams,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_update_game_chat_config($1, $2, $3, $4, $5, $6) as "success!""#,
        params.rate_limit_messages,
        params.rate_limit_window_seconds,
        params.max_message_length,
        params.profanity_filter_enabled,
        params.profanity_word_list.as_deref(),
        params.global_mute_enabled
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Set global mute on/off (emergency kill switch)
pub async fn set_global_mute(db: &Pool<Postgres>, enabled: bool) -> Result<bool, sqlx::Error> {
    let params = UpdateChatConfigParams {
        global_mute_enabled: Some(enabled),
        ..Default::default()
    };
    update_config(db, &params).await
}

/// Update rate limit settings
pub async fn set_rate_limit(
    db: &Pool<Postgres>,
    messages: i32,
    window_seconds: i32,
) -> Result<bool, sqlx::Error> {
    let params = UpdateChatConfigParams {
        rate_limit_messages: Some(messages),
        rate_limit_window_seconds: Some(window_seconds),
        ..Default::default()
    };
    update_config(db, &params).await
}

/// Set max message length
pub async fn set_max_message_length(
    db: &Pool<Postgres>,
    length: i32,
) -> Result<bool, sqlx::Error> {
    let params = UpdateChatConfigParams {
        max_message_length: Some(length),
        ..Default::default()
    };
    update_config(db, &params).await
}

/// Toggle profanity filter
pub async fn set_profanity_filter(
    db: &Pool<Postgres>,
    enabled: bool,
) -> Result<bool, sqlx::Error> {
    let params = UpdateChatConfigParams {
        profanity_filter_enabled: Some(enabled),
        ..Default::default()
    };
    update_config(db, &params).await
}

/// Update profanity word list
pub async fn set_profanity_words(
    db: &Pool<Postgres>,
    words: Vec<String>,
) -> Result<bool, sqlx::Error> {
    let params = UpdateChatConfigParams {
        profanity_word_list: Some(words),
        ..Default::default()
    };
    update_config(db, &params).await
}

/// Add words to profanity list
pub async fn add_profanity_words(
    db: &Pool<Postgres>,
    new_words: &[String],
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        UPDATE game_chat_config
        SET profanity_word_list = profanity_word_list || $1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING TRUE as "success!"
        "#,
        new_words
    )
    .fetch_one(db)
    .await
    .map(|_| true)
}

/// Remove a word from profanity list
pub async fn remove_profanity_word(
    db: &Pool<Postgres>,
    word: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        UPDATE game_chat_config
        SET profanity_word_list = array_remove(profanity_word_list, $1),
            updated_at = NOW()
        WHERE id = 1
        RETURNING TRUE as "success!"
        "#,
        word
    )
    .fetch_one(db)
    .await
    .map(|_| true)
}
