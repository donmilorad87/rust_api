//! Localization export utilities
//!
//! Generates per-locale JSON files for frontend translation loading.

use serde_json::{json, Map, Value};
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::app::db_query::read::localization as localization_read;

#[derive(Debug, thiserror::Error)]
pub enum LocalizationExportError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub struct LocalizationExporter;

impl LocalizationExporter {
    pub fn localization_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("resources")
            .join("localization")
    }

    pub async fn export_all(db: &Pool<Postgres>) -> Result<(), LocalizationExportError> {
        let locales = localization_read::get_locale_codes(db).await?;
        let keys = localization_read::get_keys(db).await?;
        let base_dir = Self::localization_dir();

        fs::create_dir_all(&base_dir)?;

        for locale_code in locales {
            let translations =
                localization_read::get_translations_for_locale(db, &locale_code).await?;
            let mut translation_map: HashMap<String, (String, String)> = HashMap::new();

            for row in translations {
                translation_map.insert(row.key, (row.singular, row.plural));
            }

            let mut locale_json = Map::new();

            for key in &keys {
                let (singular, plural) = translation_map
                    .get(&key.key)
                    .cloned()
                    .unwrap_or_else(|| (String::new(), String::new()));

                locale_json.insert(
                    key.key.clone(),
                    json!({
                        "singular": singular,
                        "plural": plural,
                        "context": key.context.clone().unwrap_or_default()
                    }),
                );
            }

            let file_path = base_dir.join(format!("{}.json", locale_code));
            let contents = Value::Object(locale_json);
            let json_string = serde_json::to_string_pretty(&contents)?;
            fs::write(file_path, json_string)?;
        }

        Ok(())
    }
}
