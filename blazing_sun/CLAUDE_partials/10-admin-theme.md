# Admin Theme Configuration System

The admin theme system (`/admin/theme`) provides a comprehensive interface for managing site branding, theme colors, typography, spacing, SEO meta tags, and Schema.org structured data.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Admin Theme Page (/admin/theme)                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐  ┌───────┐ │
│  │Branding │  │  Colors  │  │ Typography │  │ Spacing │  │  SEO  │ │
│  │   Tab   │  │   Tab    │  │    Tab     │  │   Tab   │  │  Tab  │ │
│  └────┬────┘  └────┬─────┘  └─────┬──────┘  └────┬────┘  └───┬───┘ │
│       │            │              │              │            │     │
│       ▼            ▼              ▼              ▼            ▼     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    ThemeController (API)                        ││
│  │  PUT /theme - Update colors/typography → triggers SCSS build    ││
│  │  PUT /theme/branding - Update logo/favicon/site name            ││
│  │  PUT /seo/{route} - Update SEO meta tags                        ││
│  │  POST /seo/page/{id}/schemas - Add Schema.org structured data   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      ThemeService                               ││
│  │  1. Update _variables.scss with new values                      ││
│  │  2. Run Vite build for all 8 frontend projects                  ││
│  │  3. Increment assets_version for cache busting                  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Database Tables                                  │
├─────────────────────────────────────────────────────────────────────┤
│  site_config (1 row)  │  page_seo (per page)  │  page_schemas       │
│  - scss_variables     │  - route_name         │  - page_seo_id (FK) │
│  - theme_light/dark   │  - title, description │  - schema_type      │
│  - logo/favicon_uuid  │  - og_*, twitter_*    │  - schema_data JSON │
│  - assets_version     │  - robots, canonical  │  - position         │
│  - build status       │  - is_active          │  - is_active        │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Tables

### site_config Table

Single-row table storing global theme configuration:

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| site_name | VARCHAR | Site display name |
| show_site_name | BOOLEAN | Show name in navbar |
| identity_color_start | VARCHAR | Gradient start color |
| identity_color_end | VARCHAR | Gradient end color |
| identity_size | VARCHAR | Logo/text size (rem) |
| logo_uuid | UUID | FK to uploads (logo image) |
| favicon_uuid | UUID | FK to uploads (favicon) |
| scss_variables | JSONB | All SCSS variable overrides |
| theme_light | JSONB | Light theme color overrides |
| theme_dark | JSONB | Dark theme color overrides |
| assets_version | VARCHAR | Cache-busting version (e.g., "1.0.027") |
| last_build_status | VARCHAR | "success", "failed", "building" |
| last_build_at | TIMESTAMPTZ | Last build timestamp |
| last_build_error | TEXT | Error message if build failed |

### page_seo Table

Per-page SEO configuration:

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| route_name | VARCHAR | Named route (e.g., "web.sign_in") |
| page_path | VARCHAR | URL path (e.g., "/sign-in") |
| page_label | VARCHAR | Human-readable name |
| title | VARCHAR | Page title (`<title>`) |
| description | VARCHAR | Meta description |
| keywords | VARCHAR | Meta keywords |
| og_title | VARCHAR | Open Graph title |
| og_description | VARCHAR | Open Graph description |
| og_image_uuid | UUID | Open Graph image |
| og_type | VARCHAR | Open Graph type (website, article) |
| twitter_card | VARCHAR | Twitter card type (summary, large) |
| twitter_title | VARCHAR | Twitter title |
| twitter_description | VARCHAR | Twitter description |
| twitter_image_uuid | UUID | Twitter image |
| canonical_url | VARCHAR | Canonical URL |
| robots | VARCHAR | Robots directive (index, noindex) |
| structured_data | JSONB | Legacy JSON-LD (deprecated) |
| custom_meta | JSONB | Custom meta tags |
| is_active | BOOLEAN | Enable/disable SEO |

### page_schemas Table

Schema.org structured data (JSON-LD) per page:

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| page_seo_id | BIGINT | FK to page_seo |
| schema_type | VARCHAR | Schema.org type (Organization, WebSite, etc.) |
| schema_data | JSONB | Full JSON-LD schema object |
| position | INT | Order for multiple schemas |
| is_active | BOOLEAN | Enable/disable this schema |

## Theme Configuration Tabs

### 1. Branding Tab
- **Site Name**: Text displayed in navbar (if show_site_name enabled)
- **Show Site Name**: Toggle visibility in navbar
- **Logo Upload**: Upload PNG/JPG/SVG logo
- **Favicon Upload**: Upload favicon (auto-detected format)
- **Identity Colors**: Gradient colors for site branding
- **Identity Size**: Size of logo/text in navbar

### 2. Colors Tab
- **Light Theme Colors**: Background, text, card, link colors
- **Dark Theme Colors**: Same set for dark mode
- Changes trigger SCSS rebuild

### 3. Typography Tab
- **Font Families**: Base, heading, monospace fonts
- **Font Sizes**: Scale from xs to 2xl, headings h1-h6
- **Font Weights**: Light, normal, medium, semibold, bold
- **Line Heights**: Tight, base, loose
- Changes trigger SCSS rebuild

### 4. Spacing Tab
- **Spacing Scale**: xs, sm, base, md, lg, xl, 2xl, 3xl
- **Border Radii**: sm, md, lg, xl, full
- Changes trigger SCSS rebuild

### 5. SEO Tab

The SEO tab has three sub-tabs:

#### 5.1 Metatags Sub-tab
Per-page SEO configuration:
- Title, description, keywords
- Open Graph tags (title, description, type, image)
- Twitter Card tags (card type, title, description, image)
- Robots directive (index/noindex, follow/nofollow)
- Canonical URL

#### 5.2 Schemas Sub-tab
Schema.org structured data management:
- List of schemas for selected page
- Add/Edit/Delete schemas
- Support for 50+ Schema.org types:
  - **Organizations**: Organization, LocalBusiness, Corporation
  - **Web**: WebSite, WebPage, AboutPage, ContactPage, FAQPage
  - **Content**: Article, NewsArticle, BlogPosting
  - **Commerce**: Product, Offer, Review, AggregateRating
  - **Events**: Event, BusinessEvent, MusicEvent
  - **People**: Person, ProfilePage
  - **Navigation**: BreadcrumbList, SiteNavigationElement
  - And many more...

#### 5.3 Hreflang Sub-tab (Placeholder)
Language/region targeting for multi-language sites.
Currently a demo table - full implementation requires i18n routing.

## JSON-LD Schema Rendering

Schemas are automatically rendered in the `<head>` of each page:

```html
<!-- At bottom of <head> -->
<script type="application/ld+json">
[{"@context":"https://schema.org","@type":"Organization","name":"Blazing Sun",...}]
</script>
```

**How it works:**

1. `PagesController::add_seo_to_context()` fetches SEO data for the page's route_name
2. Queries `page_schemas` for active schemas linked to that page_seo entry
3. Adds `@context: "https://schema.org"` to each schema
4. Serializes to JSON and inserts into template context as `json_ld_schemas`
5. `base.html` template renders the JSON-LD block at bottom of `<head>`

**Template rendering (base.html):**
```html
{# JSON-LD Structured Data Schemas - placed at bottom of head #}
{% if json_ld_schemas %}
<script type="application/ld+json">
{{ json_ld_schemas | safe }}
</script>
{% endif %}
```

## SCSS Build System

When theme colors, typography, or spacing are changed:

1. **Update SCSS Variables**: `_variables.scss` in GLOBAL project is updated
2. **Run Vite Build**: All 8 frontend projects are rebuilt:
   - GLOBAL, SIGN_IN, SIGN_UP, FORGOT_PASSWORD
   - PROFILE, REGISTERED_USERS, UPLOADS, THEME
3. **Copy Output**: Built CSS/JS copied to `resources/css/` and `resources/js/`
4. **Increment Version**: `assets_version` bumped for cache invalidation
5. **Update Database**: Build status and timestamp recorded

**Frontend Projects Structure:**
```
src/frontend/pages/
├── GLOBAL/           # Base styles, navbar, theme variables
├── SIGN_IN/          # Sign in page styles
├── SIGN_UP/          # Sign up page styles
├── FORGOT_PASSWORD/  # Forgot password styles
├── PROFILE/          # Profile page styles
├── REGISTERED_USERS/ # Admin users page styles
├── UPLOADS/          # Admin uploads page styles
└── THEME/            # Admin theme page styles (ThemeConfig.js)
```

## Using Theme Data in Templates

**Available context variables:**

```html
{# Branding #}
{{ site_name }}              {# Site name from DB #}
{{ show_site_name }}         {# Boolean #}
{{ logo_stored_name }}       {# For assets() function #}
{{ favicon_stored_name }}    {# For assets() function #}
{{ identity_color_start }}   {# Gradient start #}
{{ identity_color_end }}     {# Gradient end #}
{{ identity_size }}          {# Size in rem #}

{# SEO Meta #}
{{ seo_title }}              {# Page title #}
{{ seo_description }}        {# Meta description #}
{{ seo_keywords }}           {# Meta keywords #}
{{ seo_robots }}             {# Robots directive #}
{{ seo_canonical }}          {# Canonical URL #}

{# Open Graph #}
{{ og_title }}
{{ og_description }}
{{ og_type }}

{# Twitter Card #}
{{ twitter_card }}
{{ twitter_title }}
{{ twitter_description }}

{# JSON-LD Schemas #}
{{ json_ld_schemas | safe }} {# Pre-serialized JSON array #}

{# Versioning #}
{{ assets_version }}         {# For cache busting #}
```

## Adding SEO to a New Page

1. **Register the page in page_seo table:**
```sql
INSERT INTO page_seo (route_name, page_path, page_label, title, is_active)
VALUES ('web.my_page', '/my-page', 'My Page', 'My Page - Blazing Sun', true);
```

2. **Call add_seo_to_context in the controller:**
```rust
pub async fn my_page(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    let mut context = Self::base_context(&req);
    let db = state.db.lock().await;
    Self::add_branding_to_context(&mut context, &db).await;
    Self::add_seo_to_context(&mut context, &db, "web.my_page").await;
    drop(db);
    Ok(Self::render("my_page.html", &context))
}
```

3. **Add schemas via admin panel** (optional):
   - Go to Admin > Theme > SEO tab
   - Select the page from dropdown
   - Click "Schemas" sub-tab
   - Click "Add Schema"
   - Select schema type and fill in fields
   - Save

## Database Queries for Theme/SEO

**Read operations:**
```rust
use crate::app::db_query::read::site_config;
use crate::app::db_query::read::page_seo;
use crate::app::db_query::read::page_schema;

// Get site config
let config = site_config::get(&db).await?;

// Get branding info
let branding = site_config::get_branding(&db).await?;

// Get page SEO by route
let seo = page_seo::get_by_route(&db, "web.sign_in").await?;

// Get active schemas for a page
let schemas = page_schema::get_active_by_page_seo_id(&db, page_seo_id).await?;
```

**Mutation operations:**
```rust
use crate::app::db_query::mutations::site_config;
use crate::app::db_query::mutations::page_seo;
use crate::app::db_query::mutations::page_schema;

// Update theme colors
site_config::update_themes(&db, Some(scss_vars), Some(light), Some(dark)).await?;

// Update page SEO
page_seo::update_by_route(&db, "web.sign_in", &params).await?;

// Create schema
let id = page_schema::create(&db, &CreatePageSchemaParams {
    page_seo_id,
    schema_type: "Organization".to_string(),
    schema_data: json!({ "name": "Acme Corp", ... }),
    position: Some(0),
    is_active: Some(true),
}).await?;

// Delete schema
page_schema::delete(&db, schema_id).await?;
```
