//! Schema Catalog Routes Tests
//!
//! # Routes
//! - GET /api/v1/schemas/categories
//! - GET /api/v1/schemas/children/{type}
//! - GET /api/v1/schemas/{type}

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database};
use serde::Deserialize;

#[derive(Deserialize)]
struct BaseResponse {
    status: String,
}

#[derive(Deserialize)]
struct SchemaCategory {
    #[serde(rename = "type")]
    type_name: String,
    label: String,
}

#[derive(Deserialize)]
struct SchemaCategoriesResponse {
    #[serde(flatten)]
    base: BaseResponse,
    categories: Vec<SchemaCategory>,
}

#[derive(Deserialize)]
struct SchemaChild {
    #[serde(rename = "type")]
    type_name: String,
    label: String,
}

#[derive(Deserialize)]
struct SchemaChildrenResponse {
    #[serde(flatten)]
    base: BaseResponse,
    parent: String,
    children: Vec<SchemaChild>,
}

#[derive(Deserialize)]
struct ExpectedType {
    #[serde(rename = "type")]
    type_name: String,
    kind: String,
}

#[derive(Deserialize)]
struct SchemaProperty {
    name: String,
    expected_types: Vec<ExpectedType>,
}

#[derive(Deserialize)]
struct SchemaDefinition {
    #[serde(rename = "type")]
    type_name: String,
    properties: Vec<SchemaProperty>,
}

#[derive(Deserialize)]
struct SchemaDefinitionResponse {
    #[serde(flatten)]
    base: BaseResponse,
    schema: SchemaDefinition,
}

async fn seed_schema_catalog(app_state: &actix_web::web::Data<database::AppState>) {
    let db = app_state.db.lock().await;

    let _ = sqlx::query(
        r#"
        INSERT INTO schema_types (name, label, description, is_data_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE
        SET label = EXCLUDED.label,
            description = EXCLUDED.description,
            is_data_type = EXCLUDED.is_data_type
        "#,
    )
    .bind("Thing")
    .bind("Thing")
    .bind("Top-level schema")
    .bind(false)
    .execute(&*db)
    .await;

    let types = vec![
        (
            "Organization",
            "Organization",
            "An organization",
            false,
            "Thing",
        ),
        ("DataType", "DataType", "Data type", true, "Thing"),
        (
            "Intangible",
            "Intangible",
            "An intangible type",
            false,
            "Thing",
        ),
        (
            "FinancialProduct",
            "FinancialProduct",
            "A financial product",
            false,
            "Intangible",
        ),
        (
            "LocalBusiness",
            "LocalBusiness",
            "A local business",
            false,
            "Organization",
        ),
        ("Library", "Library", "A library", false, "LocalBusiness"),
        (
            "PaymentMethod",
            "PaymentMethod",
            "Payment method",
            false,
            "Intangible",
        ),
        (
            "LoanOrCredit",
            "LoanOrCredit",
            "Loan or credit",
            false,
            "FinancialProduct",
        ),
        ("Text", "Text", "Text data type", true, "DataType"),
    ];

    for (name, label, description, is_data_type, parent) in types {
        let _ = sqlx::query(
            r#"
            INSERT INTO schema_types (name, label, description, is_data_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name) DO UPDATE
            SET label = EXCLUDED.label,
                description = EXCLUDED.description,
                is_data_type = EXCLUDED.is_data_type
            "#,
        )
        .bind(name)
        .bind(label)
        .bind(description)
        .bind(is_data_type)
        .execute(&*db)
        .await;

        let _ = sqlx::query(
            r#"
            INSERT INTO schema_type_parents (type_name, parent_name)
            VALUES ($1, $2)
            ON CONFLICT (type_name, parent_name) DO NOTHING
            "#,
        )
        .bind(name)
        .bind(parent)
        .execute(&*db)
        .await;
    }

    let _ = sqlx::query(
        r#"
        INSERT INTO schema_properties (name, label, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE
        SET label = EXCLUDED.label,
            description = EXCLUDED.description
        "#,
    )
    .bind("acceptedPaymentMethod")
    .bind("acceptedPaymentMethod")
    .bind("Accepted payment methods")
    .execute(&*db)
    .await;

    let _ = sqlx::query(
        r#"
        INSERT INTO schema_type_properties (type_name, property_name)
        VALUES ($1, $2)
        ON CONFLICT (type_name, property_name) DO NOTHING
        "#,
    )
    .bind("Library")
    .bind("acceptedPaymentMethod")
    .execute(&*db)
    .await;

    let expected_types = vec!["LoanOrCredit", "PaymentMethod", "Text"];
    for expected in expected_types {
        let _ = sqlx::query(
            r#"
            INSERT INTO schema_property_expected_types (property_name, expected_type)
            VALUES ($1, $2)
            ON CONFLICT (property_name, expected_type) DO NOTHING
            "#,
        )
        .bind("acceptedPaymentMethod")
        .bind(expected)
        .execute(&*db)
        .await;
    }
}

#[actix_rt::test]
async fn test_schema_categories_include_organization() {
    dotenv::dotenv().ok();

    let app_state = database::state().await;
    seed_schema_catalog(&app_state).await;

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/v1/schemas/categories")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: SchemaCategoriesResponse =
        serde_json::from_slice(&body).expect("Failed to parse categories response");

    assert_eq!(payload.base.status, "success");
    assert!(payload
        .categories
        .iter()
        .any(|category| category.type_name == "Organization"));
}

#[actix_rt::test]
async fn test_schema_children_include_local_business() {
    dotenv::dotenv().ok();

    let app_state = database::state().await;
    seed_schema_catalog(&app_state).await;

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/v1/schemas/children/Organization")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: SchemaChildrenResponse =
        serde_json::from_slice(&body).expect("Failed to parse children response");

    assert_eq!(payload.base.status, "success");
    assert_eq!(payload.parent, "Organization");
    assert!(payload
        .children
        .iter()
        .any(|child| child.type_name == "LocalBusiness"));
}

#[actix_rt::test]
async fn test_schema_definition_includes_expected_types() {
    dotenv::dotenv().ok();

    let app_state = database::state().await;
    seed_schema_catalog(&app_state).await;

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/v1/schemas/Library")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: SchemaDefinitionResponse =
        serde_json::from_slice(&body).expect("Failed to parse schema definition response");

    assert_eq!(payload.base.status, "success");
    assert_eq!(payload.schema.type_name, "Library");

    let accepted = payload
        .schema
        .properties
        .iter()
        .find(|prop| prop.name == "acceptedPaymentMethod")
        .expect("Expected acceptedPaymentMethod property");

    assert!(accepted
        .expected_types
        .iter()
        .any(|expected| expected.type_name == "LoanOrCredit"));
    assert!(accepted
        .expected_types
        .iter()
        .any(|expected| expected.type_name == "PaymentMethod"));
    assert!(accepted
        .expected_types
        .iter()
        .any(|expected| expected.type_name == "Text" && expected.kind == "data_type"));
}
