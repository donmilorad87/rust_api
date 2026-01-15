# Schema.org Refactor & Dynamic Form Builder - Implementation Plan

> **Goal:** Refactor schema handling so users can select Schema.org **category → subcategory → … → leaf schema**, and the UI dynamically generates the correct form based on properties, expected types, and descriptions — including inherited properties from parent types.

---

## Phase 1: Docker Integration (Schema Importer on Startup)

### 1.1 Modify `rust/entrypoint.sh`

**Location:** `/home/milner/Desktop/rust/rust/entrypoint.sh`

**Changes:**
- Add schema importer execution AFTER migrations but BEFORE app startup
- Run on EVERY container start (per user requirement)
- Use `--reset` flag to ensure fresh data each time
- Handle errors gracefully (warn but continue)

**Implementation:**
```bash
# After "sqlx migrate run"
# Before "cargo watch" or "cargo build"

echo "Running Schema.org catalog import..."
cargo run --bin schema_importer -- --reset || echo "Warning: Schema import failed, continuing..."
```

**Dev Mode Insertion Point:** After line 142 (after sqlx prepare)
**Prod Mode Insertion Point:** After line 157 (after migrations)

### 1.2 Build Schema Importer in Production

**Issue:** In production mode, binaries are compiled separately. Need to ensure `schema_importer` binary is built.

**Solution:**
```bash
# In prod section, before running importer:
cargo build --release --bin schema_importer
./target/release/schema_importer --reset || echo "Warning: Schema import failed"
```

---

## Phase 2: Backend - Enhanced Schema API with Inherited Properties

### 2.1 Enhance `get_schema_properties` Query

**Location:** `blazing_sun/src/app/db_query/read/schema_catalog/mod.rs`

**Current Problem:** `get_schema_properties(type_name)` only returns properties directly associated with that type, NOT inherited properties from parent types.

**Required Behavior:** For type "Gene" (Thing → BioChemEntity → Gene), return:
- Properties defined on Gene
- Properties defined on BioChemEntity
- Properties defined on Thing

**Solution:** Create new function `get_schema_properties_with_inheritance`:

```sql
WITH RECURSIVE type_ancestry AS (
    -- Start with the requested type
    SELECT type_name, parent_name, 0 AS depth
    FROM schema_type_parents
    WHERE type_name = $1

    UNION ALL

    -- Recursively get parent types
    SELECT stp.type_name, stp.parent_name, ta.depth + 1
    FROM schema_type_parents stp
    JOIN type_ancestry ta ON stp.type_name = ta.parent_name
),
all_ancestor_types AS (
    SELECT $1 AS type_name
    UNION
    SELECT parent_name FROM type_ancestry WHERE parent_name IS NOT NULL
)
SELECT DISTINCT
    sp.name AS property_name,
    sp.label AS property_label,
    sp.description AS property_description,
    spe.expected_type,
    st.is_data_type AS expected_is_data_type,
    stp.type_name AS defined_on  -- Which type defines this property
FROM all_ancestor_types aat
JOIN schema_type_properties stp ON stp.type_name = aat.type_name
JOIN schema_properties sp ON sp.name = stp.property_name
LEFT JOIN schema_property_expected_types spe ON spe.property_name = sp.name
LEFT JOIN schema_types st ON st.name = spe.expected_type
ORDER BY sp.name ASC, spe.expected_type ASC
```

### 2.2 Update Schema Controller

**Location:** `blazing_sun/src/app/http/api/controllers/schema.rs`

**Changes to `GET /api/v1/schemas/{type_name}`:**
- Use new `get_schema_properties_with_inheritance` function
- Return `defined_on` field to show which ancestor defines each property
- Group properties by: "own" (defined on this type) vs "inherited" (from parent types)

**Enhanced Response Structure:**
```json
{
  "success": true,
  "schema": {
    "type": "Gene",
    "label": "Gene",
    "description": "...",
    "path": ["Thing", "BioChemEntity", "Gene"],
    "properties": {
      "own": [...],       // Properties defined directly on Gene
      "inherited": [...]  // Properties from BioChemEntity and Thing
    }
  }
}
```

### 2.3 Add Entity Resolution Endpoint

**New Endpoint:** `GET /api/v1/schemas/entity/{schema_id}`

**Purpose:** Resolve a stored schema entity by its `@id`, recursively expanding all nested `@id` references.

**Algorithm:**
1. Fetch entity by `@id` from `schema_entities` table
2. Scan all properties in `schema_data`
3. For any property with `@id` reference, recursively fetch that entity
4. Continue until all references are resolved (with circular reference protection)
5. Return fully expanded schema object

**Circular Reference Protection:**
- Track visited `@id` values in a Set
- If an `@id` is encountered twice, return reference instead of expanding

---

## Phase 3: Frontend - Dynamic Form Builder UI

### 3.1 Hierarchical Schema Selector Component

**Location:** `blazing_sun/src/frontend/pages/THEME/src/components/SchemaSelector.js`

**Features:**
- Multi-level dropdown/breadcrumb navigation
- Start with top-level categories (11 types under Thing)
- Each selection loads children via `GET /api/v1/schemas/children/{type}`
- Continue until leaf node (has_children = false) or user stops
- Display current path: `Thing → Organization → LocalBusiness → Library`

**UI Pattern:**
```
[Select Category ▼] → [Select Subcategory ▼] → [Select Type ▼] → [✓ Use This Schema]
```

### 3.2 Dynamic Form Generator

**Location:** `blazing_sun/src/frontend/pages/THEME/src/components/SchemaFormBuilder.js`

**Features:**
- Accept schema definition JSON from API
- Generate form fields for each property
- Display property descriptions (tooltip or inline)
- Separate sections for "Own Properties" vs "Inherited Properties"

### 3.3 Multi-Type Property Handler

**For properties with multiple expected types:**

**UI:**
```
acceptedPaymentMethod:
  Select type: ( ) LoanOrCredit  ( ) PaymentMethod  ( ) Text

  [If Text selected]
  Value: [________________]

  [If Entity type selected]
  @id: [________________] (reference existing entity)
  [ ] Create new entity inline

  [If "Create new" checked]
  [Embedded form for selected entity type]
```

**Implementation:**
- Render radio buttons for expected types
- On selection:
  - If `is_data_type: true` (Text, URL, Number, etc.) → render text/number input
  - If `is_data_type: false` (entity) → render @id input + "Create new" checkbox
  - If "Create new" checked → fetch entity schema and render embedded form

### 3.4 Nested Form Recursion

**Recursive Form Rendering:**
- When user checks "Create new entity inline"
- Fetch schema for that entity type
- Render a nested form container
- Support multiple levels of nesting
- Track nesting depth to prevent infinite UI recursion (max 3-5 levels)

---

## Phase 4: Schema Entity Storage & Retrieval

### 4.1 Save Completed Schema

**When user submits the form:**

1. **Collect form data** into structured JSON
2. **For each non-Text property with inline entity:**
   - Generate URN ID: `urn:{lang}:entity:{type}:{uuid}`
   - Calculate hash for deduplication
   - Check if entity with same hash exists
   - If exists, reuse its `@id`
   - If not, create new `schema_entity` record
   - Replace inline data with `@id` reference in parent
3. **Create entity relations** for all `@id` references
4. **Store final schema** in appropriate table (page_schemas or schema_entities)

### 4.2 Load Schema for Rendering

**When loading a saved schema for display:**

1. Fetch schema by `@id` or page_seo_id
2. Parse `schema_data` JSON
3. For each property with `@id` reference:
   - Recursively fetch referenced entity
   - Embed its data in the response
4. Return fully expanded schema object

### 4.3 Deduplication Logic

**Hash Calculation:**
- Normalize JSON (sorted keys, trimmed values)
- Calculate SHA-256 hash
- Use hash + lang_code + schema_type for uniqueness

**Benefits:**
- Reuse identical entities (e.g., same Organization across multiple pages)
- Reduce storage
- Enable bulk updates when entity changes

---

## Database Schema Review

### Existing Tables (Already Created)

1. **schema_types** - Type definitions (name, label, description, is_data_type)
2. **schema_type_parents** - Parent-child hierarchy
3. **schema_properties** - Property definitions
4. **schema_type_properties** - Which properties belong to which types
5. **schema_property_expected_types** - Expected types for each property
6. **page_schemas** - JSON-LD per page (linked to page_seo)
7. **schema_entities** - Custom schema entities with @id
8. **entity_relations** - Relationships between entities

### No New Tables Required
The existing schema supports all requirements.

---

## API Endpoints Summary

### Existing (Keep)
- `GET /api/v1/schemas/categories` - Top-level categories
- `GET /api/v1/schemas/children/{type}` - Child types
- `GET /api/v1/schemas/{type}` - Schema definition (ENHANCE)

### New Endpoints
- `GET /api/v1/schemas/entity/{schema_id}` - Resolve entity by @id with recursive expansion
- `POST /api/v1/schemas/entity` - Create new schema entity
- `PUT /api/v1/schemas/entity/{schema_id}` - Update schema entity

---

## Implementation Order

### Phase 1: Docker Integration
1. ☐ Modify `rust/entrypoint.sh` - dev mode
2. ☐ Modify `rust/entrypoint.sh` - prod mode
3. ☐ Test container restart imports schema

### Phase 2: Backend API Enhancements
1. ☐ Create `get_schema_properties_with_inheritance` query
2. ☐ Update `SchemaController::schema` to use inheritance query
3. ☐ Add `defined_on` field to property responses
4. ☐ Create entity resolution endpoint
5. ☐ Add recursive entity expansion logic
6. ☐ Run `cargo sqlx prepare` for offline queries

### Phase 3: Frontend Form Builder
1. ☐ Create `SchemaSelector.js` - hierarchical selector
2. ☐ Create `SchemaFormBuilder.js` - dynamic form generator
3. ☐ Create `PropertyInput.js` - multi-type property handler
4. ☐ Create `NestedEntityForm.js` - recursive embedded forms
5. ☐ Integrate into existing SEO tab in admin theme
6. ☐ Add SCSS styling for schema forms
7. ☐ Build frontend with Vite

### Phase 4: Entity Storage
1. ☐ Implement schema save logic with entity extraction
2. ☐ Implement deduplication by hash
3. ☐ Implement entity relation creation
4. ☐ Implement recursive entity loading
5. ☐ Test end-to-end flow

---

## Testing Checklist

- [ ] Docker: Container start imports schemas
- [ ] Docker: Schema import runs on every restart
- [ ] API: Get schema includes inherited properties
- [ ] API: Properties show which type defines them
- [ ] API: Entity resolution expands nested @id references
- [ ] UI: Can navigate Thing → Category → ... → Leaf
- [ ] UI: Form generates correct inputs for each property type
- [ ] UI: Multi-type properties show radio selector
- [ ] UI: Text types render text input
- [ ] UI: Entity types render @id + "create new" option
- [ ] UI: Nested entity forms render correctly
- [ ] Storage: Entities saved with correct @id
- [ ] Storage: Duplicate entities reuse existing @id
- [ ] Storage: Relations created between entities
- [ ] Load: Saved schema loads with all entities expanded

---

## Files to Modify/Create

### Phase 1
- `rust/entrypoint.sh` (modify)

### Phase 2
- `blazing_sun/src/app/db_query/read/schema_catalog/mod.rs` (modify)
- `blazing_sun/src/app/http/api/controllers/schema.rs` (modify)
- `blazing_sun/src/routes/api.rs` (modify - add new routes)

### Phase 3
- `blazing_sun/src/frontend/pages/THEME/src/components/SchemaSelector.js` (create)
- `blazing_sun/src/frontend/pages/THEME/src/components/SchemaFormBuilder.js` (create)
- `blazing_sun/src/frontend/pages/THEME/src/components/PropertyInput.js` (create)
- `blazing_sun/src/frontend/pages/THEME/src/components/NestedEntityForm.js` (create)
- `blazing_sun/src/frontend/pages/THEME/src/styles/_schema-form.scss` (create)
- `blazing_sun/src/resources/views/web/admin_theme.html` (modify - integrate)

### Phase 4
- `blazing_sun/src/app/db_query/mutations/schema_entity/mod.rs` (modify)
- `blazing_sun/src/app/http/api/controllers/theme.rs` (modify - schema save endpoints)

---

## Estimated Complexity

| Phase | Complexity | Key Challenge |
|-------|------------|---------------|
| 1 | Low | Ensuring importer runs reliably on startup |
| 2 | Medium | Recursive SQL query for inherited properties |
| 3 | High | Dynamic form generation with nesting |
| 4 | Medium | Recursive entity resolution with circular ref protection |

---

## Ready for Implementation

This plan covers all requirements from the specification document:
- ✅ Category → Subcategory → Leaf navigation
- ✅ Properties with expected types + descriptions
- ✅ Inherited properties from parent types
- ✅ Dynamic form generation
- ✅ Multi-type property handling (radio selector)
- ✅ Conditional rendering (@id vs inline)
- ✅ Nested embedded forms
- ✅ Entity storage with @id references
- ✅ Recursive entity resolution
- ✅ Deduplication by hash
