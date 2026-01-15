# Admin Theme Configuration Page Route

## Overview

The theme configuration page allows administrators to customize the entire application's visual appearance including colors, typography, spacing, branding, SEO, and Schema.org structured data.

---

## Route Details

| Property | Value |
|----------|-------|
| **Path** | `/admin/theme` |
| **Method** | GET |
| **Named Route** | `admin.theme` |
| **Auth Required** | Yes (manual check) |
| **Permission Level** | Admin (10) or Super Admin (100) |
| **Controller** | `PagesController::theme` |
| **Template** | `web/admin_theme.html` |

---

## Features

### 1. Color Configuration
- **Light Theme Colors**: Primary, secondary, accent, background, text, borders
- **Dark Theme Colors**: Separate palette for dark mode
- **HSL Color Picker**: Live preview with hex/RGB/HSL formats
- **CSS Custom Properties**: Generated dynamically from database
- **Per-Component Colors**: Buttons, cards, inputs, etc.

### 2. Typography
- **Font Families**: Heading and body font stacks
- **Font Sizes**: Base, headings (h1-h6), small, large
- **Font Weights**: Thin, regular, semibold, bold
- **Line Heights**: Tight, normal, relaxed
- **Letter Spacing**: Normal, wide, wider

### 3. Spacing System
- **Base Unit**: 4px, 8px, 16px (configurable)
- **Spacing Scale**: xs, sm, md, lg, xl, 2xl, 3xl
- **Padding**: Component-specific padding
- **Margins**: Component-specific margins
- **Gap**: Grid and flexbox gaps

### 4. Branding
- **Logo Upload**: SVG, PNG, JPEG support (max 2MB)
- **Favicon Upload**: ICO, PNG support (16x16, 32x32, 48x48)
- **Site Name**: Display name (50 chars max)
- **Show Site Name**: Toggle visibility alongside logo

### 5. SEO Configuration (Per Page)
- **Title**: Page-specific title (60 chars recommended)
- **Description**: Meta description (160 chars recommended)
- **Keywords**: Comma-separated keywords
- **OG Image**: Open Graph image for social sharing
- **Canonical URL**: Preferred URL for duplicate content
- **Robots**: Index/follow directives
- **Active**: Enable/disable per page

### 6. Schema.org Structured Data
- **Organization Schema**: Company information, contact points, social profiles
- **Article Schema**: Blog posts with author, publish date, image
- **Product Schema**: E-commerce products with price, availability, ratings
- **Person Schema**: Author/profile information
- **Event Schema**: Event details with date, location, organizer
- **FAQ Schema**: Frequently asked questions
- **BreadcrumbList Schema**: Site navigation hierarchy
- **And 20+ more types**: Extensible schema system

---

## Frontend Architecture

### Page Location
```
blazing_sun/src/frontend/pages/THEME/
```

### Components (4 Classes + Schema Definitions)

1. **ThemeConfig.js** (Main Controller - ~2000+ lines)
   - **Tab Navigation**: 6 tabs (Colors, Typography, Spacing, Branding, SEO, Schema)
   - **Theme Mode Toggle**: Switch between light/dark theme preview
   - **Color Picker Management**: Initialize and update color pickers
   - **Size Picker Management**: Typography and spacing controls
   - **Logo/Favicon Upload**: Image selection with preview
   - **SEO Metadata**: Per-page SEO configuration
   - **Schema Builder**: Visual schema.org data editor
   - **Build Trigger**: Compile SCSS to CSS with progress overlay

2. **ColorPicker.js** (Color selection component)
   - HSL color picker widget
   - Hex/RGB/HSL format conversion
   - Live preview with CSS custom properties
   - Color history

3. **SizePicker.js** (Size selection component)
   - Unit selector (px, rem, em, %)
   - Numeric input with validation
   - Preset sizes (sm, md, lg, xl)
   - Live preview

4. **SchemaDefinitions.js** (Schema.org definitions - 47.7KB)
   - Complete type definitions for 30+ schema types
   - Property constraints and validation rules
   - Example data for each type
   - Nested object support

### Build Output

- **JavaScript**: `/src/resources/js/THEME/app.js` (97KB - largest bundle)
- **CSS**: `/src/resources/css/THEME/style.css` (30KB)

**Note**: Largest bundle due to extensive Schema.org definitions

---

## Backend Implementation

### Controller Method

```rust
pub async fn theme(
    req: HttpRequest,
    tmpl: web::Data<Tera>,
    state: web::Data<AppState>
) -> Result<HttpResponse, ApiError> {
    // Extract user ID and permissions
    let (user_id, permissions) = match extract_user_with_permissions(&req) {
        Some(data) => data,
        None => {
            return Ok(HttpResponse::Found()
                .insert_header(("Location", "/sign-in"))
                .finish());
        }
    };

    // Check admin permission (10 or 100)
    if permissions < 10 {
        return Ok(HttpResponse::Found()
            .insert_header(("Location", "/"))
            .finish());
    }

    // Fetch current theme configuration
    let theme_config = db_query::read::site_config::get(&state.db).await?;

    // Prepare template context
    let mut context = Context::new();
    context.insert("page_title", "Admin - Theme Configuration");
    context.insert("theme_config", &theme_config);
    context.insert("user_permissions", &permissions);

    // Render template
    let rendered = tmpl.render("web/admin_theme.html", &context)?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(rendered))
}
```

---

## API Endpoints Used

### Theme Configuration
- `GET /api/v1/admin/theme` - Get current theme config
- `PUT /api/v1/admin/theme` - Update theme config (colors, typography, spacing)
- `PUT /api/v1/admin/theme/branding` - Update branding (logo, favicon, site name)

### Theme Build
- `POST /api/v1/admin/theme/build` - Trigger SCSS compilation
- `GET /api/v1/admin/theme/build/status` - Check build progress

**Build Process**:
1. Parse SCSS variables and CSS custom properties from database
2. Generate `.scss` files with theme variables
3. Compile SCSS to CSS using grass compiler
4. Create versioned backup in `storage/app/private/theme_backups/`
5. Update `.env` with new `ASSETS_VERSION` timestamp
6. Return build result with version number

### SEO Management
- `GET /api/v1/admin/seo` - List all page SEO configs
- `GET /api/v1/admin/seo/{route_name}` - Get SEO config for specific page
- `PUT /api/v1/admin/seo/{route_name}` - Update SEO config
- `PATCH /api/v1/admin/seo/{route_name}/toggle` - Toggle active status

### Schema Management
- `GET /api/v1/admin/seo/page/{id}/schemas` - List schemas for page
- `POST /api/v1/admin/seo/page/{id}/schemas` - Create new schema
- `GET /api/v1/admin/seo/schema/{id}` - Get schema by ID
- `PUT /api/v1/admin/seo/schema/{id}` - Update schema
- `DELETE /api/v1/admin/seo/schema/{id}` - Delete schema

---

## Database Schema

### site_config Table

```sql
CREATE TABLE site_config (
    id BIGSERIAL PRIMARY KEY,
    -- Branding
    logo_uuid UUID REFERENCES uploads(uuid),
    favicon_uuid UUID REFERENCES uploads(uuid),
    site_name VARCHAR(50),
    show_site_name BOOLEAN DEFAULT true,

    -- Theme Variables (JSONB)
    scss_variables JSONB DEFAULT '{}'::jsonb,  -- SCSS variables
    theme_light JSONB DEFAULT '{}'::jsonb,     -- Light theme CSS properties
    theme_dark JSONB DEFAULT '{}'::jsonb,      -- Dark theme CSS properties

    -- Build Info
    last_build_at TIMESTAMP,
    build_status VARCHAR(20),  -- 'idle', 'building', 'success', 'failed'
    build_error TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### page_seo Table

```sql
CREATE TABLE page_seo (
    id BIGSERIAL PRIMARY KEY,
    route_name VARCHAR(100) UNIQUE NOT NULL,  -- 'web.profile', 'web.home', etc.
    title VARCHAR(100),
    description TEXT,
    keywords TEXT,
    og_image_uuid UUID REFERENCES uploads(uuid),
    canonical_url TEXT,
    robots VARCHAR(50),  -- 'index,follow', 'noindex,nofollow', etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### page_schemas Table

```sql
CREATE TABLE page_schemas (
    id BIGSERIAL PRIMARY KEY,
    page_seo_id BIGINT REFERENCES page_seo(id) ON DELETE CASCADE,
    schema_type VARCHAR(100) NOT NULL,  -- 'Organization', 'Article', 'Product', etc.
    schema_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## SCSS Build System

### Generated Files

**SCSS Variables** (`_variables.scss`):
```scss
// Generated from database
$primary-color: #667eea;
$secondary-color: #764ba2;
$accent-color: #f093fb;
$background-color: #ffffff;
$text-color: #1a202c;

$font-family-heading: 'Inter', sans-serif;
$font-family-body: 'Inter', sans-serif;

$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
```

**CSS Custom Properties** (`theme.css`):
```css
:root {
  /* Light Theme */
  --color-primary: #667eea;
  --color-secondary: #764ba2;
  --color-accent: #f093fb;
  --color-background: #ffffff;
  --color-text: #1a202c;
}

[data-theme="dark"] {
  /* Dark Theme */
  --color-primary: #9f7aea;
  --color-secondary: #a78bfa;
  --color-accent: #f687b3;
  --color-background: #1a202c;
  --color-text: #f7fafc;
}
```

### Build Process Flow

```
1. Admin updates theme config in UI
   ↓
2. Frontend sends PUT request to /api/v1/admin/theme
   ↓
3. Backend saves to database (site_config table)
   ↓
4. Admin clicks "Build Theme" button
   ↓
5. Frontend sends POST request to /api/v1/admin/theme/build
   ↓
6. Backend triggers ThemeBuilder:
   a. Parse SCSS variables from database
   b. Generate _variables.scss file
   c. Parse CSS custom properties
   d. Generate theme.css file
   e. Compile SCSS → CSS using grass compiler
   f. Create versioned backup
   g. Update ASSETS_VERSION in .env
   h. Return build result
   ↓
7. Frontend polls /api/v1/admin/theme/build/status
   ↓
8. On success: Show success toast, reload page with new assets
   On failure: Show error toast with details
```

### Theme Versioning

**Assets Version Format**: Millisecond timestamp
- Example: `1704133807456`
- Updated in `.env` file: `ASSETS_VERSION=1704133807456`
- Used in templates: `{{ assets('/css/GLOBAL/style.css', version=env.ASSETS_VERSION) }}`
- Ensures cache busting on theme updates

**Backup Files**:
```
storage/app/private/theme_backups/
├── theme_20260102_143807_456.scss      # SCSS source
├── variables_20260102_143807_456.scss  # Variables
└── env_20260102_143807_456.txt         # .env snapshot
```

---

## Schema.org Integration

### Available Schema Types

| Category | Types |
|----------|-------|
| **Organization** | Organization, Corporation, LocalBusiness, NGO |
| **Creative Work** | Article, BlogPosting, NewsArticle, Book, Movie, MusicRecording |
| **Product** | Product, Offer, AggregateOffer, Review, AggregateRating |
| **Person** | Person, ProfilePage |
| **Event** | Event, BusinessEvent, SocialEvent |
| **Place** | Place, LocalBusiness, Restaurant, Hotel |
| **List** | BreadcrumbList, ItemList, HowTo, FAQPage |
| **Other** | WebSite, WebPage, ContactPoint, PostalAddress |

### Example Schema Output

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Blazing Sun",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "description": "A modern web application built with Rust",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-555-123-4567",
    "contactType": "customer service"
  },
  "sameAs": [
    "https://twitter.com/blazingsun",
    "https://github.com/blazingsun"
  ]
}
```

### Schema Rendering

Schemas are rendered in `<script type="application/ld+json">` tags in the `<head>`:

```html
<head>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      ...
    }
    </script>
</head>
```

---

## Security Considerations

1. **Permission Check**: Admin (10) or Super Admin (100) required
2. **SCSS Injection Prevention**: Only allowed properties parsed, no raw SCSS
3. **File Upload Validation**: Logo/favicon MIME type and size checks
4. **Path Traversal Prevention**: UUID-based file storage
5. **XSS Prevention**: Site name and meta descriptions sanitized
6. **CSRF Protection**: Same-origin policy enforced
7. **Build Process Isolation**: SCSS compilation runs in controlled environment

---

## User Experience

### Loading States
- Color picker initialization with skeleton loader
- Build progress overlay with spinner
- Disabled save button during build
- Real-time build status polling

### Validation Feedback
- Color format validation (hex, RGB, HSL)
- Size format validation (px, rem, em)
- Schema validation with JSON schema
- Error messages for invalid configurations

### Accessibility
- ARIA labels on color pickers
- Keyboard navigation through tabs
- Screen reader announcements for build status
- High contrast mode support

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Initial Load | < 3s | TBD |
| Build Time | < 10s | TBD |
| Color Picker Response | < 100ms | TBD |
| Bundle Size (JS) | < 150KB | 97KB ✓ |
| Bundle Size (CSS) | < 50KB | 30KB ✓ |

---

## Common Issues

### Build Fails with SCSS Error
**Cause**: Invalid SCSS syntax in generated variables
**Solution**: Check variable values in database, ensure valid CSS units

### Theme Not Applied After Build
**Cause**: Browser cache or incorrect ASSETS_VERSION
**Solution**: Hard refresh (Ctrl+F5) or clear browser cache

### Schema Validation Fails
**Cause**: Missing required properties or invalid JSON
**Solution**: Use Schema.org validator: https://validator.schema.org/

### Logo Upload Fails
**Cause**: File size exceeds 2MB or unsupported format
**Solution**: Compress image or convert to PNG/JPEG/SVG

---

## Related Documentation

- [Theme Configuration Feature](../../AdminUploads/README.md)
- [SCSS Build System](../../Backend/Theme/)
- [Theme API Endpoints](../API/theme.md)
- [SEO API Endpoints](../API/seo.md)
- [Schema.org Types](https://schema.org/docs/full.html)

---

**Last Updated**: 2026-01-02
**Controller Location**: `/home/milner/Desktop/rust/blazing_sun/src/app/http/web/controllers/pages.rs:theme`
**Template Location**: `/home/milner/Desktop/rust/blazing_sun/src/resources/views/web/admin_theme.html`
**Frontend Source**: `/home/milner/Desktop/rust/blazing_sun/src/frontend/pages/THEME/`
**Theme Builder**: `/home/milner/Desktop/rust/blazing_sun/src/bootstrap/includes/theme/`
