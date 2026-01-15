//! Schema Catalog Read Queries
//!
//! Read operations for schema catalog tables used to drive Schema.org selection.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaTypeRow {
    pub name: String,
    pub label: String,
    pub description: String,
    pub is_data_type: bool,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaPropertyRow {
    pub name: String,
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaPropertyExpectedRow {
    pub property_name: String,
    pub property_label: String,
    pub property_description: String,
    pub expected_type: Option<String>,
    pub expected_is_data_type: Option<bool>,
}

pub async fn get_top_level_categories(
    db: &Pool<Postgres>,
) -> Result<Vec<SchemaTypeRow>, sqlx::Error> {
    sqlx::query_as!(
        SchemaTypeRow,
        r#"
        SELECT
            st.name,
            st.label,
            st.description,
            st.is_data_type,
            EXISTS (
                SELECT 1 FROM schema_type_parents stp2
                WHERE stp2.parent_name = st.name
            ) AS "has_children!"
        FROM schema_type_parents stp
        JOIN schema_types st ON stp.type_name = st.name
        WHERE stp.parent_name = 'Thing'
          AND st.is_data_type = false
        ORDER BY st.name ASC
        "#
    )
    .fetch_all(db)
    .await
}

pub async fn get_children(
    db: &Pool<Postgres>,
    parent_name: &str,
) -> Result<Vec<SchemaTypeRow>, sqlx::Error> {
    sqlx::query_as!(
        SchemaTypeRow,
        r#"
        SELECT
            st.name,
            st.label,
            st.description,
            st.is_data_type,
            EXISTS (
                SELECT 1 FROM schema_type_parents stp2
                WHERE stp2.parent_name = st.name
            ) AS "has_children!"
        FROM schema_type_parents stp
        JOIN schema_types st ON stp.type_name = st.name
        WHERE stp.parent_name = $1
        ORDER BY st.name ASC
        "#,
        parent_name
    )
    .fetch_all(db)
    .await
}

pub async fn get_type_by_name(
    db: &Pool<Postgres>,
    name: &str,
) -> Result<Option<(String, String, String, bool)>, sqlx::Error> {
    let row: Option<_> = sqlx::query!(
        r#"
        SELECT name, label, description, is_data_type
        FROM schema_types
        WHERE name = $1
        "#,
        name
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| (r.name, r.label, r.description, r.is_data_type)))
}

pub async fn get_type_parents(db: &Pool<Postgres>, name: &str) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<_> = sqlx::query!(
        r#"
        SELECT parent_name
        FROM schema_type_parents
        WHERE type_name = $1
        ORDER BY parent_name ASC
        "#,
        name
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|row| row.parent_name).collect())
}

pub async fn get_schema_properties(
    db: &Pool<Postgres>,
    type_name: &str,
) -> Result<Vec<SchemaPropertyExpectedRow>, sqlx::Error> {
    sqlx::query_as!(
        SchemaPropertyExpectedRow,
        r#"
        SELECT
            sp.name AS property_name,
            sp.label AS property_label,
            sp.description AS property_description,
            spe.expected_type,
            st.is_data_type AS expected_is_data_type
        FROM schema_type_properties stp
        JOIN schema_properties sp ON sp.name = stp.property_name
        LEFT JOIN schema_property_expected_types spe ON spe.property_name = sp.name
        LEFT JOIN schema_types st ON st.name = spe.expected_type
        WHERE stp.type_name = $1
        ORDER BY sp.name ASC, spe.expected_type ASC
        "#,
        type_name
    )
    .fetch_all(db)
    .await
}

pub async fn get_schema_path(
    db: &Pool<Postgres>,
    type_name: &str,
) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        WITH RECURSIVE ancestry AS (
            SELECT
                stp.type_name,
                stp.parent_name,
                ARRAY[stp.type_name] AS path
            FROM schema_type_parents stp
            WHERE stp.type_name = $1

            UNION ALL

            SELECT
                stp.type_name,
                stp.parent_name,
                ancestry.path || stp.parent_name
            FROM schema_type_parents stp
            JOIN ancestry ON stp.type_name = ancestry.parent_name
        )
        SELECT path
        FROM ancestry
        WHERE parent_name IS NULL OR parent_name = 'Thing'
        ORDER BY array_length(path, 1) ASC
        LIMIT 1
        "#,
        type_name
    )
    .fetch_optional(db)
    .await?;

    if let Some(row) = rows {
        let mut path = row.path.unwrap_or_default();
        path.reverse();
        return Ok(path);
    }

    Ok(vec![type_name.to_string()])
}

/// Row for properties with inheritance info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaPropertyWithInheritanceRow {
    pub property_name: String,
    pub property_label: String,
    pub property_description: String,
    pub expected_type: Option<String>,
    pub expected_is_data_type: Option<bool>,
    pub defined_on: String,
}

/// Get all properties for a schema type INCLUDING inherited properties from all parent types.
/// For example, Gene (Thing → BioChemEntity → Gene) returns:
/// - Properties defined directly on Gene
/// - Properties inherited from BioChemEntity
/// - Properties inherited from Thing
pub async fn get_schema_properties_with_inheritance(
    db: &Pool<Postgres>,
    type_name: &str,
) -> Result<Vec<SchemaPropertyWithInheritanceRow>, sqlx::Error> {
    sqlx::query_as!(
        SchemaPropertyWithInheritanceRow,
        r#"
        WITH RECURSIVE type_ancestry AS (
            -- Start with the requested type's parents
            SELECT type_name, parent_name, 0 AS depth
            FROM schema_type_parents
            WHERE type_name = $1

            UNION ALL

            -- Recursively get parent types
            SELECT stp.type_name, stp.parent_name, ta.depth + 1
            FROM schema_type_parents stp
            JOIN type_ancestry ta ON stp.type_name = ta.parent_name
            WHERE ta.depth < 20
        ),
        all_ancestor_types AS (
            -- Include the type itself
            SELECT $1 AS type_name
            UNION
            -- Include all parent types
            SELECT parent_name FROM type_ancestry WHERE parent_name IS NOT NULL
        )
        SELECT DISTINCT ON (sp.name, spe.expected_type)
            sp.name AS property_name,
            sp.label AS property_label,
            sp.description AS property_description,
            spe.expected_type,
            st.is_data_type AS expected_is_data_type,
            stp.type_name AS "defined_on!"
        FROM all_ancestor_types aat
        JOIN schema_type_properties stp ON stp.type_name = aat.type_name
        JOIN schema_properties sp ON sp.name = stp.property_name
        LEFT JOIN schema_property_expected_types spe ON spe.property_name = sp.name
        LEFT JOIN schema_types st ON st.name = spe.expected_type
        ORDER BY sp.name ASC, spe.expected_type ASC, stp.type_name ASC
        "#,
        type_name
    )
    .fetch_all(db)
    .await
}
