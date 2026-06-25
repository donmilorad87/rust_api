# Legal/Static Pages Documentation

This document provides comprehensive documentation for the legal and static pages in the Blazing Sun application, including About Us, Contact Us, Privacy Policy, and Terms and Conditions pages.

---

## Overview

The Blazing Sun application includes essential legal and informational static pages:

| Page | Purpose |
|------|---------|
| **About Us** | Company information and mission |
| **Contact Us** | Contact form and contact details |
| **Privacy Policy** | Data privacy and GDPR compliance |
| **Terms and Conditions** | Terms of service and user agreement |

All pages support **localization** with English and Serbian variants.

---

## Routes

### English Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `web.about_us` | `/about-us` | About Us page |
| `web.contact_us` | `/contact-us` | Contact Us page |
| `web.privacy_policy` | `/privacy-policy` | Privacy Policy page |
| `web.terms_conditions` | `/terms-and-conditions` | Terms and Conditions page |

### Serbian Routes

| Route Name | URL (Serbian) | Description |
|------------|---------------|-------------|
| `web.about_us` | `/o-nama` | About Us (Serbian) |
| `web.contact_us` | `/kontakt` | Contact Us (Serbian) |
| `web.privacy_policy` | `/politika-privatnosti` | Privacy Policy (Serbian) |
| `web.terms_conditions` | `/uslovi-koriscenja` | Terms and Conditions (Serbian) |

---

## Route Registration

Located in: `blazing_sun/src/routes/web.rs`

```rust
fn register_route_names() {
    // ... other routes ...

    // Legal pages (public)
    route!("web.about_us", "/about-us");
    route!("web.contact_us", "/contact-us");
    route!("web.privacy_policy", "/privacy-policy");
    route!("web.terms_conditions", "/terms-and-conditions");

    // Legal pages (public) - Serbian variants
    route!("web.about_us", "/o-nama", "sr");
    route!("web.contact_us", "/kontakt", "sr");
    route!("web.privacy_policy", "/politika-privatnosti", "sr");
    route!("web.terms_conditions", "/uslovi-koriscenja", "sr");

    // ... other routes ...
}
```

---

## Controller Handlers

Located in: `blazing_sun/src/app/http/web/controllers/pages.rs`

### Route Dispatch

```rust
async fn dispatch_route(
    route_name: &str,
    req: HttpRequest,
    session: Session,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    match route_name {
        // ... other routes ...

        // Legal pages (public)
        "web.about_us" => Self::about_us(req, session, state).await,
        "web.contact_us" => Self::contact_us(req, session, state).await,
        "web.privacy_policy" => Self::privacy_policy(req, session, state).await,
        "web.terms_conditions" => Self::terms_conditions(req, session, state).await,

        // ... other routes ...
    }
}
```

### About Us Handler

```rust
/// About Us page - public page
pub async fn about_us(
    req: HttpRequest,
    session: Session,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    let mut context = Self::base_context(&req, &session);

    let db = state.db.lock().await;
    Self::add_common_async_context(&mut context, &db, &auth).await;
    Self::add_seo_to_context(&req, &mut context, &db, "web.about_us").await;
    drop(db);

    Ok(Self::render("about_us.html", &context))
}
```

### Contact Us Handler

```rust
/// Contact Us page - public page
pub async fn contact_us(
    req: HttpRequest,
    session: Session,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    let mut context = Self::base_context(&req, &session);

    let db = state.db.lock().await;
    Self::add_common_async_context(&mut context, &db, &auth).await;
    Self::add_seo_to_context(&req, &mut context, &db, "web.contact_us").await;
    drop(db);

    Ok(Self::render("contact_us.html", &context))
}
```

### Privacy Policy Handler

```rust
/// Privacy Policy page - public page
pub async fn privacy_policy(
    req: HttpRequest,
    session: Session,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    let mut context = Self::base_context(&req, &session);

    let db = state.db.lock().await;
    Self::add_common_async_context(&mut context, &db, &auth).await;
    Self::add_seo_to_context(&req, &mut context, &db, "web.privacy_policy").await;
    drop(db);

    Ok(Self::render("privacy_policy.html", &context))
}
```

### Terms and Conditions Handler

```rust
/// Terms and Conditions page - public page
pub async fn terms_conditions(
    req: HttpRequest,
    session: Session,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    let mut context = Self::base_context(&req, &session);

    let db = state.db.lock().await;
    Self::add_common_async_context(&mut context, &db, &auth).await;
    Self::add_seo_to_context(&req, &mut context, &db, "web.terms_conditions").await;
    drop(db);

    Ok(Self::render("terms_conditions.html", &context))
}
```

---

## Template Files

### Template Locations

| Page | Template Path |
|------|--------------|
| About Us | `src/resources/views/web/about_us.html` |
| Contact Us | `src/resources/views/web/contact_us.html` |
| Privacy Policy | `src/resources/views/web/privacy_policy.html` |
| Terms & Conditions | `src/resources/views/web/terms_conditions.html` |

### Template Structure

All legal pages follow a consistent structure:

```html
{% extends "layouts/main.html" %}

{% block title %}{{ seo_title | default(value="About Us") }} | {{ app_name }}{% endblock %}

{% block meta %}
{% if seo_description %}
<meta name="description" content="{{ seo_description }}">
{% endif %}
{% if seo_keywords %}
<meta name="keywords" content="{{ seo_keywords }}">
{% endif %}
{% endblock %}

{% block content %}
<main class="legal-page">
    <div class="container">
        <article class="legal-content">
            <h1 class="legal-title">About Us</h1>

            <section class="legal-section">
                <h2>Our Mission</h2>
                <p>Content here...</p>
            </section>

            <section class="legal-section">
                <h2>Our Team</h2>
                <p>Content here...</p>
            </section>

            <!-- Additional sections as needed -->
        </article>
    </div>
</main>
{% endblock %}

{% block scripts %}
<script src="/assets/js/LEGAL/app.js" defer></script>
{% endblock %}
```

### Example: About Us Template

```html
{% extends "layouts/main.html" %}

{% block title %}{{ seo_title | default(value="About Us") }} | {{ app_name }}{% endblock %}

{% block content %}
<main class="about-page">
    <div class="container">
        <article class="about-content">
            <header class="about-header">
                <h1 class="about-title">
                    {% if language == "sr" %}O Nama{% else %}About Us{% endif %}
                </h1>
            </header>

            <section class="about-section">
                <h2>
                    {% if language == "sr" %}Naša Misija{% else %}Our Mission{% endif %}
                </h2>
                <p>
                    {% if language == "sr" %}
                    Naša misija je da pružimo najbolje usluge...
                    {% else %}
                    Our mission is to provide the best services...
                    {% endif %}
                </p>
            </section>

            <section class="about-section">
                <h2>
                    {% if language == "sr" %}Naš Tim{% else %}Our Team{% endif %}
                </h2>
                <p>
                    {% if language == "sr" %}
                    Imamo tim stručnjaka posvećenih...
                    {% else %}
                    We have a team of experts dedicated to...
                    {% endif %}
                </p>
            </section>
        </article>
    </div>
</main>
{% endblock %}
```

### Example: Contact Us Template

```html
{% extends "layouts/main.html" %}

{% block title %}{{ seo_title | default(value="Contact Us") }} | {{ app_name }}{% endblock %}

{% block content %}
<main class="contact-page">
    <div class="container">
        <article class="contact-content">
            <header class="contact-header">
                <h1 class="contact-title">
                    {% if language == "sr" %}Kontaktirajte Nas{% else %}Contact Us{% endif %}
                </h1>
            </header>

            <div class="contact-grid">
                <section class="contact-info">
                    <h2>
                        {% if language == "sr" %}Kontakt Informacije{% else %}Contact Information{% endif %}
                    </h2>

                    <div class="contact-item">
                        <span class="contact-label">Email:</span>
                        <a href="mailto:{{ contact_email | default(value='info@example.com') }}">
                            {{ contact_email | default(value='info@example.com') }}
                        </a>
                    </div>

                    <div class="contact-item">
                        <span class="contact-label">
                            {% if language == "sr" %}Telefon:{% else %}Phone:{% endif %}
                        </span>
                        <a href="tel:{{ contact_phone | default(value='+1234567890') }}">
                            {{ contact_phone | default(value='+1 (234) 567-890') }}
                        </a>
                    </div>

                    <div class="contact-item">
                        <span class="contact-label">
                            {% if language == "sr" %}Adresa:{% else %}Address:{% endif %}
                        </span>
                        <address>{{ contact_address | default(value='123 Main Street, City, Country') }}</address>
                    </div>
                </section>

                <section class="contact-form-section">
                    <h2>
                        {% if language == "sr" %}Pošaljite Poruku{% else %}Send a Message{% endif %}
                    </h2>
                    <form class="contact-form" method="post" action="/api/v1/contact">
                        <input type="hidden" name="csrf_token" value="{{ csrf_token }}">

                        <div class="form-group">
                            <label for="name">
                                {% if language == "sr" %}Ime{% else %}Name{% endif %}
                            </label>
                            <input type="text" id="name" name="name" required>
                        </div>

                        <div class="form-group">
                            <label for="email">Email</label>
                            <input type="email" id="email" name="email" required>
                        </div>

                        <div class="form-group">
                            <label for="message">
                                {% if language == "sr" %}Poruka{% else %}Message{% endif %}
                            </label>
                            <textarea id="message" name="message" rows="5" required></textarea>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            {% if language == "sr" %}Pošalji{% else %}Send{% endif %}
                        </button>
                    </form>
                </section>
            </div>
        </article>
    </div>
</main>
{% endblock %}
```

---

## Template Variables

### Available in All Pages

| Variable | Type | Description |
|----------|------|-------------|
| `language` | String | Current language code ("en" or "sr") |
| `app_name` | String | Application name from config |
| `site_name` | String | Site name from branding |
| `is_logged` | Boolean | Whether user is authenticated |
| `csrf_token` | String | CSRF token for forms |
| `base_url` | String | Base URL of the site |
| `year` | String | Current year (for copyright) |
| `theme` | String | Current theme ("light" or "dark") |

### SEO Variables

| Variable | Type | Description |
|----------|------|-------------|
| `seo_title` | String? | Page title for SEO |
| `seo_description` | String? | Meta description |
| `seo_keywords` | String? | Meta keywords |
| `seo_robots` | String? | Robots directive |
| `seo_canonical` | String | Canonical URL |
| `og_title` | String? | Open Graph title |
| `og_description` | String? | Open Graph description |
| `og_type` | String? | Open Graph type |
| `twitter_card` | String? | Twitter card type |
| `twitter_title` | String? | Twitter title |
| `twitter_description` | String? | Twitter description |

### Branding Variables

| Variable | Type | Description |
|----------|------|-------------|
| `logo_url` | String? | Logo image URL |
| `favicon_url` | String? | Favicon URL |
| `identity_color_start` | String? | Brand gradient start |
| `identity_color_end` | String? | Brand gradient end |

### Contact Variables

| Variable | Type | Description |
|----------|------|-------------|
| `contact_email` | String? | Contact email |
| `contact_phone` | String? | Contact phone |
| `contact_address` | String? | Physical address |

---

## Footer Integration

Legal pages are linked from the footer partial. See the footer documentation for details.

### Footer Links (from `_footer.html`)

```html
<div class="footer__links-group">
    <h4 class="footer__links-title">Legal</h4>
    <ul class="footer__links-list">
        <li>
            <a href="{{ route(name='web.about_us', lang=language) | default(value='/about-us') }}" class="footer__link">
                About Us
            </a>
        </li>
        <li>
            <a href="{{ route(name='web.contact_us', lang=language) | default(value='/contact-us') }}" class="footer__link">
                Contact Us
            </a>
        </li>
        <li>
            <a href="{{ route(name='web.privacy_policy', lang=language) | default(value='/privacy-policy') }}" class="footer__link">
                Privacy Policy
            </a>
        </li>
        <li>
            <a href="{{ route(name='web.terms_conditions', lang=language) | default(value='/terms-and-conditions') }}" class="footer__link">
                Terms & Conditions
            </a>
        </li>
    </ul>
</div>
```

---

## SEO Configuration

### Database SEO Configuration

SEO metadata for legal pages can be configured in the `page_seo` table:

```sql
-- Example: Add SEO metadata for About Us page
INSERT INTO page_seo (route_name, title, description, keywords, robots)
VALUES (
    'web.about_us',
    'About Us - Learn About Our Company',
    'Learn about our mission, team, and values. We are dedicated to providing excellent services.',
    'about us, company, mission, team, values',
    'index, follow'
);

-- Add translations
INSERT INTO page_seo_translations (page_seo_id, language, title, description)
VALUES (
    (SELECT id FROM page_seo WHERE route_name = 'web.about_us'),
    'sr',
    'O Nama - Saznajte o Našoj Kompaniji',
    'Saznajte o našoj misiji, timu i vrednostima. Posvećeni smo pružanju izvanrednih usluga.'
);
```

### Hreflang Tags

The system automatically generates hreflang tags for language variants:

```html
<link rel="alternate" hreflang="en-US" href="https://example.com/en/about-us">
<link rel="alternate" hreflang="sr-RS" href="https://example.com/sr/o-nama">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/about-us">
```

---

## Accessibility

### ARIA Considerations

- Use proper heading hierarchy (h1 for page title, h2 for sections)
- Include `role="main"` on the main content area
- Ensure form labels are properly associated with inputs
- Provide skip links for navigation

### Example Accessible Structure

```html
<main class="legal-page" role="main">
    <article class="legal-content" aria-labelledby="page-title">
        <h1 id="page-title">Privacy Policy</h1>

        <nav class="legal-toc" aria-label="Table of contents">
            <h2>Table of Contents</h2>
            <ol>
                <li><a href="#data-collection">Data Collection</a></li>
                <li><a href="#data-use">How We Use Your Data</a></li>
                <li><a href="#your-rights">Your Rights</a></li>
            </ol>
        </nav>

        <section id="data-collection" aria-labelledby="data-collection-title">
            <h2 id="data-collection-title">1. Data Collection</h2>
            <p>Content...</p>
        </section>

        <!-- Additional sections -->
    </article>
</main>
```

---

## Testing

### Route Tests

```rust
#[actix_rt::test]
async fn test_about_us_page_loads() {
    let app = test::init_service(create_app()).await;

    let req = test::TestRequest::get()
        .uri("/en/about-us")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_rt::test]
async fn test_about_us_serbian_loads() {
    let app = test::init_service(create_app()).await;

    let req = test::TestRequest::get()
        .uri("/sr/o-nama")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}
```

---

## Files Reference

| Component | Path |
|-----------|------|
| Route definitions | `blazing_sun/src/routes/web.rs` |
| Controller handlers | `blazing_sun/src/app/http/web/controllers/pages.rs` |
| About Us template | `blazing_sun/src/resources/views/web/about_us.html` |
| Contact Us template | `blazing_sun/src/resources/views/web/contact_us.html` |
| Privacy Policy template | `blazing_sun/src/resources/views/web/privacy_policy.html` |
| Terms template | `blazing_sun/src/resources/views/web/terms_conditions.html` |
| Footer partial | `blazing_sun/src/resources/views/web/partials/_footer.html` |

---

## Related Documentation

- **[Footer Component Documentation](../Frontend/FOOTER.md)** - Footer integration
- **[Templates Documentation](../Templates/TEMPLATES.md)** - Tera template system
- **[Web Routes Documentation](../Routes/Web/WEB_ROUTES.md)** - All web routes
