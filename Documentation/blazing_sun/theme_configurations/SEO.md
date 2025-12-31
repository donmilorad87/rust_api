# SEO Configuration

The SEO tab manages search engine optimization settings including meta tags, Schema.org structured data, and language targeting.

## Overview

The SEO tab has three sub-tabs:
1. **Metatags**: Page titles, descriptions, Open Graph, Twitter Cards
2. **Schemas**: Schema.org structured data (JSON-LD)
3. **Hreflang**: Language/region targeting (placeholder)

---

## 1. Metatags

### Basic Meta Tags

| Field | HTML Output | Description |
|-------|-------------|-------------|
| Title | `<title>...</title>` | Page title (50-60 chars) |
| Description | `<meta name="description">` | Page summary (150-160 chars) |
| Keywords | `<meta name="keywords">` | Comma-separated keywords |
| Robots | `<meta name="robots">` | Crawling directives |
| Canonical URL | `<link rel="canonical">` | Preferred URL |

### Open Graph Tags

For Facebook, LinkedIn, and other social platforms:

| Field | HTML Output | Description |
|-------|-------------|-------------|
| OG Title | `<meta property="og:title">` | Social share title |
| OG Description | `<meta property="og:description">` | Social share description |
| OG Type | `<meta property="og:type">` | Content type (website, article) |
| OG Image | `<meta property="og:image">` | Share image (1200x630px) |

### Twitter Card Tags

For Twitter/X sharing:

| Field | HTML Output | Description |
|-------|-------------|-------------|
| Twitter Card | `<meta name="twitter:card">` | Card type (summary, summary_large_image) |
| Twitter Title | `<meta name="twitter:title">` | Tweet title |
| Twitter Description | `<meta name="twitter:description">` | Tweet description |
| Twitter Image | `<meta name="twitter:image">` | Tweet image |

### Robots Directives

| Value | Description |
|-------|-------------|
| `index, follow` | Index page, follow links (default) |
| `noindex, follow` | Don't index, but follow links |
| `index, nofollow` | Index page, don't follow links |
| `noindex, nofollow` | Don't index, don't follow links |

### Database Table: page_seo

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| route_name | VARCHAR | Named route (e.g., "web.sign_in") |
| page_path | VARCHAR | URL path |
| page_label | VARCHAR | Human-readable name |
| title | VARCHAR | Page title |
| description | VARCHAR | Meta description |
| keywords | VARCHAR | Meta keywords |
| og_title | VARCHAR | Open Graph title |
| og_description | VARCHAR | Open Graph description |
| og_image_uuid | UUID | Open Graph image |
| og_type | VARCHAR | Open Graph type |
| twitter_card | VARCHAR | Twitter card type |
| twitter_title | VARCHAR | Twitter title |
| twitter_description | VARCHAR | Twitter description |
| twitter_image_uuid | UUID | Twitter image |
| canonical_url | VARCHAR | Canonical URL |
| robots | VARCHAR | Robots directive |
| is_active | BOOLEAN | Enable/disable |

### API Endpoints

**List all pages:**
```http
GET /api/v1/admin/seo
```

**Get page SEO:**
```http
GET /api/v1/admin/seo/{route_name}
```

**Update page SEO:**
```http
PUT /api/v1/admin/seo/{route_name}
Content-Type: application/json

{
  "title": "Sign In - Blazing Sun",
  "description": "Sign in to your Blazing Sun account",
  "og_title": "Sign In",
  "og_description": "Access your personal finance dashboard",
  "og_type": "website",
  "twitter_card": "summary",
  "robots": "index, follow"
}
```

### Template Rendering

In `base.html`:

```html
<head>
    <title>{% if seo_title %}{{ seo_title }}{% else %}{{ site_name }}{% endif %}</title>

    {% if seo_description %}
    <meta name="description" content="{{ seo_description }}">
    {% endif %}

    {% if seo_keywords %}
    <meta name="keywords" content="{{ seo_keywords }}">
    {% endif %}

    {% if seo_robots %}
    <meta name="robots" content="{{ seo_robots }}">
    {% endif %}

    {% if seo_canonical %}
    <link rel="canonical" href="{{ seo_canonical }}">
    {% endif %}

    {# Open Graph #}
    {% if og_title %}<meta property="og:title" content="{{ og_title }}">{% endif %}
    {% if og_description %}<meta property="og:description" content="{{ og_description }}">{% endif %}
    {% if og_type %}<meta property="og:type" content="{{ og_type }}">{% endif %}

    {# Twitter Card #}
    {% if twitter_card %}<meta name="twitter:card" content="{{ twitter_card }}">{% endif %}
    {% if twitter_title %}<meta name="twitter:title" content="{{ twitter_title }}">{% endif %}
    {% if twitter_description %}<meta name="twitter:description" content="{{ twitter_description }}">{% endif %}
</head>
```

---

## 2. Schemas (Schema.org Structured Data)

Schema.org structured data helps search engines understand your content and can enable rich results in search.

### What is JSON-LD?

JSON-LD (JavaScript Object Notation for Linked Data) is the recommended format for structured data:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Blazing Sun",
  "url": "https://blazingsun.space",
  "logo": "https://blazingsun.space/logo.png"
}
</script>
```

### Supported Schema Types

#### Organizations
- **Organization**: General organization
- **LocalBusiness**: Local business with physical location
- **Corporation**: Incorporated business
- **NGO**: Non-governmental organization

#### Web
- **WebSite**: Website with search
- **WebPage**: Individual web page
- **AboutPage**: About us page
- **ContactPage**: Contact page
- **FAQPage**: FAQ with questions and answers

#### Content
- **Article**: News or blog article
- **NewsArticle**: News story
- **BlogPosting**: Blog post
- **TechArticle**: Technical article

#### Commerce
- **Product**: Product with price
- **Offer**: Product offer
- **Review**: Product review
- **AggregateRating**: Average rating

#### Events
- **Event**: Generic event
- **BusinessEvent**: Business event
- **MusicEvent**: Concert/music event
- **SportsEvent**: Sports event

#### People
- **Person**: Individual person
- **ProfilePage**: User profile page

#### Navigation
- **BreadcrumbList**: Breadcrumb navigation
- **SiteNavigationElement**: Navigation menu

### Database Table: page_schemas

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| page_seo_id | BIGINT | FK to page_seo |
| schema_type | VARCHAR | Schema.org type name |
| schema_data | JSONB | Full schema object |
| position | INT | Order (0 = first) |
| is_active | BOOLEAN | Enable/disable |

### API Endpoints

**List schemas for a page:**
```http
GET /api/v1/admin/seo/page/{page_seo_id}/schemas
```

**Create schema:**
```http
POST /api/v1/admin/seo/page/{page_seo_id}/schemas
Content-Type: application/json

{
  "schema_type": "Organization",
  "schema_data": {
    "name": "Blazing Sun",
    "url": "https://blazingsun.space",
    "logo": "https://blazingsun.space/logo.png",
    "email": "contact@blazingsun.space",
    "telephone": "+1-555-123-4567",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Main St",
      "addressLocality": "San Francisco",
      "addressRegion": "CA",
      "postalCode": "94102",
      "addressCountry": "US"
    },
    "sameAs": [
      "https://twitter.com/blazingsun",
      "https://facebook.com/blazingsun"
    ]
  },
  "position": 0,
  "is_active": true
}
```

**Update schema:**
```http
PUT /api/v1/admin/seo/schema/{id}
Content-Type: application/json

{
  "schema_data": {
    "name": "Blazing Sun Updated",
    ...
  }
}
```

**Delete schema:**
```http
DELETE /api/v1/admin/seo/schema/{id}
```

### Template Rendering

Schemas are rendered at the bottom of `<head>`:

```html
{# JSON-LD Structured Data Schemas - placed at bottom of head #}
{% if json_ld_schemas %}
<script type="application/ld+json">
{{ json_ld_schemas | safe }}
</script>
{% endif %}
```

### How Schema Rendering Works

1. `PagesController::add_seo_to_context()` is called with route_name
2. Queries `page_seo` to get page ID
3. Queries `page_schemas` for active schemas with that page_seo_id
4. Adds `@context: "https://schema.org"` to each schema
5. Serializes array to JSON string
6. Inserts into template context as `json_ld_schemas`
7. Template renders JSON-LD block

### Schema Examples

#### Organization Schema
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Blazing Sun",
  "url": "https://blazingsun.space",
  "logo": "https://blazingsun.space/logo.png",
  "description": "Personal finance tracking application",
  "email": "support@blazingsun.space",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "US"
  },
  "sameAs": [
    "https://twitter.com/blazingsun",
    "https://github.com/blazingsun"
  ]
}
```

#### WebSite Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Blazing Sun",
  "url": "https://blazingsun.space",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://blazingsun.space/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

#### FAQPage Schema
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Blazing Sun?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Blazing Sun is a personal finance tracking application."
      }
    },
    {
      "@type": "Question",
      "name": "Is it free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Blazing Sun offers a free tier."
      }
    }
  ]
}
```

#### BreadcrumbList Schema
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://blazingsun.space/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Profile",
      "item": "https://blazingsun.space/profile"
    }
  ]
}
```

---

## 3. Hreflang (Language Targeting)

Hreflang tags tell search engines which language versions of a page exist.

### Purpose

- Help search engines serve the right language version to users
- Prevent duplicate content issues across language versions
- Improve international SEO

### HTML Output

```html
<link rel="alternate" hreflang="en-US" href="https://example.com/en-us/page">
<link rel="alternate" hreflang="es-ES" href="https://example.com/es-es/pagina">
<link rel="alternate" hreflang="fr-FR" href="https://example.com/fr-fr/page">
<link rel="alternate" hreflang="x-default" href="https://example.com/page">
```

### Database Table: page_hreflangs (Placeholder)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| page_seo_id | BIGINT | FK to page_seo |
| lang_code | VARCHAR | Language code (en-US, es-ES) |
| url | VARCHAR | Full URL for this language |
| is_default | BOOLEAN | Is this x-default? |

### Current Status

**This feature is a placeholder.** Full implementation requires:
1. Multi-language routing system
2. URL structure for language variants
3. Content translation workflow
4. Language detection/switching

### Demo Data (UI Only)

The admin panel shows a demo table:

| Language | Region | URL | Default |
|----------|--------|-----|---------|
| English | US | /en-us/sign-in | x-default |
| Spanish | ES | /es-es/iniciar-sesion | - |
| French | FR | /fr-fr/connexion | - |
| German | DE | /de-de/anmelden | - |

### Future Implementation

When multi-language routing is implemented:

1. Register language variants in `routes/web.rs`:
```rust
route!("web.sign_in", "/sign-in");
route!("web.sign_in", "/iniciar-sesion", "es");
route!("web.sign_in", "/connexion", "fr");
```

2. Configure hreflang in admin panel
3. Template renders hreflang tags automatically

---

## Adding SEO to a New Page

### Step 1: Register in Database

```sql
INSERT INTO page_seo (route_name, page_path, page_label, title, description, is_active)
VALUES (
  'web.my_page',
  '/my-page',
  'My Page',
  'My Page - Blazing Sun',
  'Description of my page for search engines',
  true
);
```

### Step 2: Update Controller

```rust
pub async fn my_page(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    let mut context = Self::base_context(&req);
    let db = state.db.lock().await;

    // Add branding (logo, favicon, site name)
    Self::add_branding_to_context(&mut context, &db).await;

    // Add SEO (meta tags, schemas)
    Self::add_seo_to_context(&mut context, &db, "web.my_page").await;

    drop(db);
    Ok(Self::render("my_page.html", &context))
}
```

### Step 3: Configure in Admin Panel

1. Go to Admin > Theme > SEO
2. Select your page from dropdown
3. Fill in meta tags
4. Add schemas if needed
5. Save

---

## Best Practices

### Meta Tags
- Keep titles under 60 characters
- Keep descriptions under 160 characters
- Use unique titles/descriptions per page
- Include target keywords naturally

### Open Graph
- Use 1200x630px images for best display
- Keep OG title under 65 characters
- Keep OG description under 200 characters

### Schemas
- Use the most specific type applicable
- Include all recommended properties
- Validate with Google's Rich Results Test
- Don't duplicate information unnecessarily

### General
- Every page should have unique SEO
- Test with search engine tools
- Monitor Search Console for issues
- Update regularly as content changes
