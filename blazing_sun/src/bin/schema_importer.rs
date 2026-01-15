//! Schema.org catalog importer
//!
//! Usage:
//!   cargo run --bin schema_importer -- --source <url-or-path> [--reset]

use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::path::Path;

#[derive(Debug, Clone)]
struct TypeInfo {
    label: String,
    comment: String,
    parents: Vec<String>,
    is_data_type: bool,
}

#[derive(Debug, Clone)]
struct PropertyInfo {
    label: String,
    comment: String,
    expected_types: Vec<String>,
    domain_types: Vec<String>,
}

fn normalize_id(raw: &str) -> String {
    raw.rsplit(['/', '#', ':'])
        .next()
        .unwrap_or(raw)
        .to_string()
}

fn extract_label(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Object(map)) => {
            // Try @value first (language-tagged literals)
            if let Some(val) = map.get("@value").and_then(|v| v.as_str()) {
                return val.to_string();
            }
            // Try @id for references
            if let Some(val) = map.get("@id").and_then(|v| v.as_str()) {
                return normalize_id(val);
            }
            String::new()
        }
        Some(Value::Array(items)) => {
            // For arrays, try to find English version first, then take first item
            for item in items {
                if let Some(obj) = item.as_object() {
                    let lang = obj.get("@language").and_then(|v| v.as_str()).unwrap_or("");
                    if lang == "en" {
                        if let Some(val) = obj.get("@value").and_then(|v| v.as_str()) {
                            return val.to_string();
                        }
                    }
                }
            }
            // Fallback to first item
            items.first().map(|item| extract_label(Some(item))).unwrap_or_default()
        }
        _ => String::new(),
    }
}

fn extract_ids(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::String(text)) => vec![normalize_id(text)],
        Some(Value::Array(items)) => items
            .iter()
            .flat_map(|item| extract_ids(Some(item)))
            .collect(),
        Some(Value::Object(map)) => map
            .get("@id")
            .and_then(|val| val.as_str())
            .map(|id| vec![normalize_id(id)])
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn extract_types(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::String(text)) => vec![text.clone()],
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|item| item.as_str().map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    }
}

async fn load_source(source: &str) -> Result<String, Box<dyn Error>> {
    if Path::new(source).exists() {
        return Ok(std::fs::read_to_string(source)?);
    }

    let response = reqwest::get(source).await?;
    let body = response.text().await?;
    Ok(body)
}

fn parse_schema_graph(
    value: &Value,
) -> Result<(HashMap<String, TypeInfo>, HashMap<String, PropertyInfo>), Box<dyn Error>> {
    let graph = value
        .get("@graph")
        .and_then(|val| val.as_array())
        .ok_or("Missing @graph in schema source")?;

    let mut types: HashMap<String, TypeInfo> = HashMap::new();
    let mut properties: HashMap<String, PropertyInfo> = HashMap::new();
    let mut data_types: HashSet<String> = HashSet::new();

    for entry in graph {
        let id = match entry.get("@id").and_then(|val| val.as_str()) {
            Some(id) => normalize_id(id),
            None => continue,
        };
        let entry_types = extract_types(entry.get("@type"));

        let is_property = entry_types.iter().any(|t| t == "rdf:Property");
        let is_rdfs_class = entry_types.iter().any(|t| t == "rdfs:Class");
        let is_schema_class = entry_types.iter().any(|t| t == "schema:Class");
        let is_data_type_entry = entry_types.iter().any(|t| t == "schema:DataType");

        if is_property {
            let label = extract_label(entry.get("rdfs:label"));
            let comment = extract_label(entry.get("rdfs:comment"));
            let expected_types = extract_ids(entry.get("schema:rangeIncludes"));
            let domain_types = extract_ids(entry.get("schema:domainIncludes"));

            // Merge with existing property if present (some properties have multiple entries)
            if let Some(existing) = properties.get_mut(&id) {
                // Only update fields that are non-empty in the new entry
                if !label.is_empty() {
                    existing.label = label;
                }
                if !comment.is_empty() {
                    existing.comment = comment;
                }
                // Merge domain types (don't replace)
                for domain in domain_types {
                    if !existing.domain_types.contains(&domain) {
                        existing.domain_types.push(domain);
                    }
                }
                // Merge expected types (don't replace)
                for expected in expected_types {
                    if !existing.expected_types.contains(&expected) {
                        existing.expected_types.push(expected);
                    }
                }
            } else {
                properties.insert(
                    id,
                    PropertyInfo {
                        label,
                        comment,
                        expected_types,
                        domain_types,
                    },
                );
            }
            continue;
        }

        let is_type_entry = is_rdfs_class || is_schema_class || is_data_type_entry;
        if is_type_entry {
            let label = extract_label(entry.get("rdfs:label"));
            let comment = extract_label(entry.get("rdfs:comment"));
            let parents = extract_ids(entry.get("rdfs:subClassOf"));
            let is_data_type = entry_types.iter().any(|t| t == "schema:DataType");

            if is_data_type {
                data_types.insert(id.clone());
            }

            // Merge with existing entry if present (preserve parents from earlier entries)
            if let Some(existing) = types.get_mut(&id) {
                // Merge parents - keep existing parents and add new ones
                for parent in parents {
                    if !existing.parents.contains(&parent) {
                        existing.parents.push(parent);
                    }
                }
                // Update label/comment if the new entry has non-empty values
                if !label.is_empty() {
                    existing.label = label;
                }
                if !comment.is_empty() {
                    existing.comment = comment;
                }
                existing.is_data_type = existing.is_data_type || is_data_type;
            } else {
                types.insert(
                    id,
                    TypeInfo {
                        label,
                        comment,
                        parents,
                        is_data_type,
                    },
                );
            }
        }
    }

    // Properly detect all data types by walking the full inheritance chain
    // A type is a data type if:
    // 1. It's explicitly marked as schema:DataType
    // 2. OR any of its ancestors (recursively) is a data type
    fn is_descendant_of_data_type(
        type_name: &str,
        types: &HashMap<String, TypeInfo>,
        data_types: &HashSet<String>,
        visited: &mut HashSet<String>,
    ) -> bool {
        // Prevent infinite loops
        if visited.contains(type_name) {
            return false;
        }
        visited.insert(type_name.to_string());

        // Check if this type is already known to be a data type
        if data_types.contains(type_name) {
            return true;
        }

        // Check if type_name is "DataType" itself
        if type_name == "DataType" {
            return true;
        }

        // Get the type info
        if let Some(info) = types.get(type_name) {
            // Check each parent recursively
            for parent in &info.parents {
                if is_descendant_of_data_type(parent, types, data_types, visited) {
                    return true;
                }
            }
        }

        false
    }

    // Build complete set of data types
    let mut all_data_types: HashSet<String> = data_types.clone();
    for name in types.keys() {
        let mut visited = HashSet::new();
        if is_descendant_of_data_type(name, &types, &data_types, &mut visited) {
            all_data_types.insert(name.clone());
        }
    }

    // Update all types with correct is_data_type flag
    for (name, info) in types.iter_mut() {
        info.is_data_type = all_data_types.contains(name);
    }

    println!(
        "Found {} data types: {:?}",
        all_data_types.len(),
        all_data_types.iter().take(20).collect::<Vec<_>>()
    );

    Ok((types, properties))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv::dotenv().ok();

    let mut source = "https://schema.org/version/latest/schemaorg-current-https.jsonld".to_string();
    let mut reset = false;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--source" => {
                if let Some(value) = args.next() {
                    source = value;
                }
            }
            "--reset" => {
                reset = true;
            }
            _ => {}
        }
    }

    let body = load_source(&source).await?;
    let json: Value = serde_json::from_str(&body)?;
    let (types, properties) = parse_schema_graph(&json)?;

    let database_url = std::env::var("DATABASE_URL")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let mut tx = pool.begin().await?;

    if reset {
        sqlx::query(
            r#"
            TRUNCATE TABLE
                schema_property_expected_types,
                schema_type_properties,
                schema_type_parents,
                schema_properties,
                schema_types
            RESTART IDENTITY
            "#,
        )
        .execute(&mut *tx)
        .await?;
    }

    for (name, info) in &types {
        sqlx::query(
            r#"
            INSERT INTO schema_types (name, label, description, is_data_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name) DO UPDATE
            SET label = EXCLUDED.label,
                description = EXCLUDED.description,
                is_data_type = EXCLUDED.is_data_type,
                updated_at = NOW()
            "#,
        )
        .bind(name)
        .bind(&info.label)
        .bind(&info.comment)
        .bind(info.is_data_type)
        .execute(&mut *tx)
        .await?;
    }

    for (name, info) in &types {
        for parent in &info.parents {
            sqlx::query(
                r#"
                INSERT INTO schema_type_parents (type_name, parent_name)
                VALUES ($1, $2)
                ON CONFLICT (type_name, parent_name) DO NOTHING
                "#,
            )
            .bind(name)
            .bind(parent)
            .execute(&mut *tx)
            .await?;
        }
    }

    let mut type_properties: HashMap<String, HashSet<String>> = HashMap::new();
    for (name, info) in &properties {
        sqlx::query(
            r#"
            INSERT INTO schema_properties (name, label, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE
            SET label = EXCLUDED.label,
                description = EXCLUDED.description,
                updated_at = NOW()
            "#,
        )
        .bind(name)
        .bind(&info.label)
        .bind(&info.comment)
        .execute(&mut *tx)
        .await?;

        for domain in &info.domain_types {
            if !types.contains_key(domain) {
                continue;
            }

            type_properties
                .entry(domain.clone())
                .or_default()
                .insert(name.clone());
        }

        for expected in &info.expected_types {
            if !types.contains_key(expected) {
                continue;
            }

            sqlx::query(
                r#"
                INSERT INTO schema_property_expected_types (property_name, expected_type)
                VALUES ($1, $2)
                ON CONFLICT (property_name, expected_type) DO NOTHING
                "#,
            )
            .bind(name)
            .bind(expected)
            .execute(&mut *tx)
            .await?;
        }
    }

    for (type_name, props) in &type_properties {
        for prop in props {
            sqlx::query(
                r#"
                INSERT INTO schema_type_properties (type_name, property_name)
                VALUES ($1, $2)
                ON CONFLICT (type_name, property_name) DO NOTHING
                "#,
            )
            .bind(type_name)
            .bind(prop)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    // Calculate statistics
    let total_type_property_links: usize = type_properties.values().map(|s| s.len()).sum();
    let types_with_properties = type_properties.len();
    let properties_with_domains: usize = properties
        .values()
        .filter(|p| !p.domain_types.is_empty())
        .count();
    let properties_with_labels: usize = properties
        .values()
        .filter(|p| !p.label.is_empty())
        .count();

    println!("\n=== Schema Import Complete ===");
    println!("Types imported: {}", types.len());
    println!("  - Data types: {}", types.values().filter(|t| t.is_data_type).count());
    println!("  - Entity types: {}", types.values().filter(|t| !t.is_data_type).count());
    println!("Properties imported: {}", properties.len());
    println!("  - With labels: {}", properties_with_labels);
    println!("  - With domains: {}", properties_with_domains);
    println!("Type-property links created: {}", total_type_property_links);
    println!("Types with properties: {}", types_with_properties);

    // Show sample of types and their property counts
    println!("\n=== Sample Type Property Counts ===");
    let sample_types = ["PostalAddress", "Person", "Organization", "Thing", "Place", "Country"];
    for type_name in &sample_types {
        let count = type_properties.get(*type_name).map(|s| s.len()).unwrap_or(0);
        println!("  {}: {} direct properties", type_name, count);
    }

    Ok(())
}
