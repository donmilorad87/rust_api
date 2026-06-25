# Footer Component Documentation

This document provides comprehensive documentation for the Footer component in the Blazing Sun application, including structure, JavaScript functionality, SCSS styles, and template integration.

---

## Overview

The Footer component provides a consistent site-wide footer with:

- **4-Row Layout** - Organized sections for branding, legal, resources, and social links
- **Company Information** - Logo, PIB, MB, contact details
- **Legal Links** - About Us, Contact Us, Privacy Policy, Terms
- **Resource Links** - Blog and additional resources
- **Social/Connect Links** - Social media and community links
- **Back to Top** - Smooth scroll functionality
- **Responsive Design** - Mobile-optimized layout

---

## Structure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                FOOTER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Row 1: Info Row                                                            │
│  ┌─────────────────┬─────────────────┬─────────────────┐                   │
│  │     Brand       │  Company Details │   Contact Info  │                   │
│  │  (Logo, Name,   │   (PIB, MB)      │  (Email, Phone, │                   │
│  │   Tagline)      │                  │    Address)     │                   │
│  └─────────────────┴─────────────────┴─────────────────┘                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Row 2: Legal Links                                                         │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Legal: About Us, Contact Us, Privacy, Terms        │                   │
│  └─────────────────────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Row 3: Resources Links                                                     │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Resources: Blog, Documentation, etc.               │                   │
│  └─────────────────────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Row 4: Connect Links                                                       │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Connect: Social Media Links                        │                   │
│  └─────────────────────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Bottom: Copyright & Back to Top                                            │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  (C) 2024 Site Name. All rights reserved.  [Back]   │                   │
│  └─────────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Locations

| File | Path | Purpose |
|------|------|---------|
| Template | `blazing_sun/src/resources/views/web/partials/_footer.html` | HTML structure |
| JavaScript | `blazing_sun/src/frontend/pages/GLOBAL/src/js/Footer.js` | Interactivity |
| SCSS | `blazing_sun/src/frontend/pages/GLOBAL/src/styles/_footer.scss` | Styling |

---

## Template (HTML)

Located at: `blazing_sun/src/resources/views/web/partials/_footer.html`

### Usage in Templates

```html
{% include "partials/_footer.html" %}
```

### Complete Template Structure

```html
{# Footer Partial Template #}
{# Include this in any page with: {% include "partials/_footer.html" %} #}

<footer class="footer" role="contentinfo">
    <div class="footer__container">
        {# Row 1: Info/Logo Row #}
        <div class="footer__row">
            <div class="footer__info">
                {# Brand/Logo Section #}
                <div class="footer__brand">
                    <a href="{{ route(name='web.home', lang=language) | default(value='/') }}"
                       class="footer__logo"
                       aria-label="{{ site_name | default(value='Blazing Sun') }} - Go to homepage">
                        {% if logo_url %}
                        <img src="{{ logo_url }}"
                             alt="{{ site_name | default(value='Blazing Sun') }} logo"
                             class="footer__logo-image">
                        {% else %}
                        <svg class="footer__logo-icon" width="40" height="40" viewBox="0 0 48 48">
                            <!-- Default logo SVG -->
                        </svg>
                        {% endif %}
                        <span class="footer__logo-text">{{ site_name | default(value='Blazing Sun') }}</span>
                    </a>
                    <p class="footer__tagline">
                        {{ footer_tagline | default(value='Building the future, one line at a time.') }}
                    </p>
                </div>

                {# Company Details (PIB, MB) #}
                <div class="footer__company-details">
                    <div class="footer__detail">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <!-- Building icon -->
                        </svg>
                        <span class="footer__detail-label">PIB:</span>
                        <span class="footer__detail-value">{{ company_pib | default(value='123456789') }}</span>
                    </div>
                    <div class="footer__detail">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <!-- Document icon -->
                        </svg>
                        <span class="footer__detail-label">MB:</span>
                        <span class="footer__detail-value">{{ company_mb | default(value='12345678') }}</span>
                    </div>
                </div>

                {# Contact Info #}
                <div class="footer__contact">
                    <h3 class="footer__contact-title">Contact Us</h3>
                    <a href="mailto:{{ contact_email | default(value='info@example.com') }}"
                       class="footer__contact-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <!-- Email icon -->
                        </svg>
                        {{ contact_email | default(value='info@example.com') }}
                    </a>
                    <a href="tel:{{ contact_phone | default(value='+1234567890') }}"
                       class="footer__contact-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <!-- Phone icon -->
                        </svg>
                        {{ contact_phone | default(value='+1 (234) 567-890') }}
                    </a>
                    <span class="footer__contact-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <!-- Location icon -->
                        </svg>
                        {{ contact_address | default(value='123 Main Street, City, Country') }}
                    </span>
                </div>
            </div>
        </div>

        {# Row 2: Links (Legal) #}
        <div class="footer__row">
            <div class="footer__links-row">
                <div class="footer__links-group">
                    <h4 class="footer__links-title">Legal</h4>
                    <ul class="footer__links-list">
                        <li>
                            <a href="{{ route(name='web.about_us', lang=language) | default(value='/about-us') }}"
                               class="footer__link">
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                                </svg>
                                About Us
                            </a>
                        </li>
                        <li>
                            <a href="{{ route(name='web.contact_us', lang=language) | default(value='/contact-us') }}"
                               class="footer__link">
                                <!-- Arrow icon -->
                                Contact Us
                            </a>
                        </li>
                        <li>
                            <a href="{{ route(name='web.privacy_policy', lang=language) | default(value='/privacy-policy') }}"
                               class="footer__link">
                                <!-- Arrow icon -->
                                Privacy Policy
                            </a>
                        </li>
                        <li>
                            <a href="{{ route(name='web.terms_conditions', lang=language) | default(value='/terms-and-conditions') }}"
                               class="footer__link">
                                <!-- Arrow icon -->
                                Terms &amp; Conditions
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        {# Row 3: Resources #}
        <div class="footer__row">
            <div class="footer__links-row">
                <div class="footer__links-group">
                    <h4 class="footer__links-title">Resources</h4>
                    <ul class="footer__links-list">
                        <li>
                            <a href="{{ route(name='web.blog', lang=language) | default(value='/blog') }}"
                               class="footer__link">
                                <!-- Arrow icon -->
                                Blog
                            </a>
                        </li>
                        {# Add more links here as needed #}
                    </ul>
                </div>
            </div>
        </div>

        {# Row 4: Connect #}
        <div class="footer__row">
            <div class="footer__links-row">
                <div class="footer__links-group">
                    <h4 class="footer__links-title">Connect</h4>
                    <ul class="footer__links-list">
                        {# Add social media or other links here as needed #}
                    </ul>
                </div>
            </div>
        </div>

        {# Footer Bottom: Copyright & Back to Top #}
        <div class="footer__bottom">
            <p class="footer__copyright">
                &copy; <span class="footer__year">2024</span>
                {{ site_name | default(value='Blazing Sun') }}. All rights reserved.
            </p>
            <button type="button" class="footer__back-to-top" aria-label="Back to top">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                </svg>
                Back to top
            </button>
        </div>
    </div>
</footer>
```

---

## Template Variables

### Required Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `site_name` | String | "Blazing Sun" | Site/company name |
| `language` | String | "en" | Current language code |

### Optional Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `logo_url` | String? | None | URL to logo image |
| `footer_tagline` | String | "Building the future..." | Brand tagline |
| `company_pib` | String | "123456789" | Company tax ID (PIB) |
| `company_mb` | String | "12345678" | Company registration (MB) |
| `contact_email` | String | "info@example.com" | Contact email |
| `contact_phone` | String | "+1 (234) 567-890" | Contact phone |
| `contact_address` | String | "123 Main Street..." | Physical address |

---

## JavaScript Component

Located at: `blazing_sun/src/frontend/pages/GLOBAL/src/js/Footer.js`

### Class Definition

```javascript
/**
 * Footer - Site footer functionality
 *
 * Features:
 * - Back to top smooth scroll
 * - Year auto-update
 * - Link hover effects
 */
export class Footer {
  constructor() {
    this.footer = document.querySelector('.footer');
    this.backToTopBtn = document.querySelector('.footer__back-to-top');
    this.yearElement = document.querySelector('.footer__year');

    this.init();
  }

  /**
   * Initialize footer
   */
  init() {
    this.updateYear();
    this.setupBackToTop();
  }

  /**
   * Update the current year in the footer
   */
  updateYear() {
    if (this.yearElement) {
      this.yearElement.textContent = new Date().getFullYear();
    }
  }

  /**
   * Setup back to top button functionality
   */
  setupBackToTop() {
    if (!this.backToTopBtn) return;

    this.backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

export default Footer;
```

### Usage

```javascript
import { Footer } from './Footer.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Footer();
});
```

### Features

1. **Year Auto-Update** - Automatically updates the copyright year to the current year
2. **Back to Top** - Smooth scroll to top of page when button is clicked
3. **Link Effects** - CSS-based hover effects (handled in SCSS)

---

## SCSS Styles

Located at: `blazing_sun/src/frontend/pages/GLOBAL/src/styles/_footer.scss`

### CSS Custom Properties Used

```scss
--footer-bg: var(--card-bg);     // Footer background
--border-color                   // Border color
--text-primary                   // Primary text color
--text-secondary                 // Secondary text color
--text-muted                     // Muted text color
--hover-bg                       // Hover background
```

### BEM Class Structure

| Class | Purpose |
|-------|---------|
| `.footer` | Root footer element |
| `.footer__container` | Max-width wrapper |
| `.footer__row` | Row container |
| `.footer__info` | Info row content wrapper |
| `.footer__brand` | Brand/logo section |
| `.footer__logo` | Logo link |
| `.footer__logo-image` | Logo image |
| `.footer__logo-icon` | Default SVG logo |
| `.footer__logo-text` | Site name text |
| `.footer__tagline` | Brand tagline |
| `.footer__company-details` | PIB/MB section |
| `.footer__detail` | Individual detail item |
| `.footer__detail-label` | Detail label (PIB:, MB:) |
| `.footer__detail-value` | Detail value |
| `.footer__contact` | Contact info section |
| `.footer__contact-title` | Contact section title |
| `.footer__contact-item` | Contact item (email, phone, etc.) |
| `.footer__links-row` | Links row wrapper |
| `.footer__links-group` | Links group container |
| `.footer__links-title` | Links group title |
| `.footer__links-list` | Links list (ul) |
| `.footer__link` | Individual link |
| `.footer__bottom` | Bottom bar |
| `.footer__copyright` | Copyright text |
| `.footer__year` | Year span |
| `.footer__back-to-top` | Back to top button |

### Complete SCSS

```scss
@use 'variables' as *;

// ============================================
// FOOTER
// ============================================

.footer {
  background: var(--footer-bg, var(--card-bg));
  border-top: 1px solid var(--border-color);
  padding: $spacing-xl 0;
  margin-top: auto;
}

.footer__container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 $spacing-xl;
}

// ============================================
// FOOTER ROWS
// ============================================

.footer__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  padding: $spacing-lg 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
}

// ============================================
// ROW 1: INFO/LOGO ROW
// ============================================

.footer__info {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xl;
  width: 100%;
  justify-content: space-between;
  align-items: flex-start;
}

.footer__brand {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  max-width: 300px;
}

.footer__logo {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  text-decoration: none;

  &:hover .footer__logo-image {
    transform: scale(1.05);
  }
}

.footer__logo-image {
  height: 40px;
  width: auto;
  max-width: 150px;
  object-fit: contain;
  transition: transform $transition-normal;
}

.footer__logo-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  transition: transform $transition-normal;
}

.footer__logo-text {
  font-size: $font-size-xl;
  font-weight: 700;
  background: $gradient-primary;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.footer__tagline {
  font-size: $font-size-sm;
  color: var(--text-muted);
  line-height: 1.5;
}

// Company Details (PIB, MB)
.footer__company-details {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.footer__detail {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  color: var(--text-secondary);

  svg {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
}

.footer__detail-label {
  font-weight: 600;
  color: var(--text-primary);
}

.footer__detail-value {
  color: var(--text-secondary);
}

// Contact Info
.footer__contact {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.footer__contact-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: $spacing-xs;
}

.footer__contact-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color $transition-fast;

  svg {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: color $transition-fast;
  }

  &:hover {
    color: $color-primary;
    text-decoration: none;

    svg {
      color: $color-primary;
    }
  }
}

// ============================================
// ROWS 2-4: LINKS ROWS
// ============================================

.footer__links-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xl;
  width: 100%;
}

.footer__links-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  min-width: 150px;
}

.footer__links-title {
  font-size: $font-size-sm;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: $spacing-xs;
}

.footer__links-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.footer__link {
  font-size: $font-size-sm;
  color: var(--text-secondary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs 0;
  transition: color $transition-fast, transform $transition-fast;

  svg {
    width: 14px;
    height: 14px;
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity $transition-fast, transform $transition-fast;
  }

  &:hover {
    color: $color-primary;
    text-decoration: none;

    svg {
      opacity: 1;
      transform: translateX(0);
    }
  }
}

// ============================================
// FOOTER BOTTOM
// ============================================

.footer__bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-md;
  padding-top: $spacing-lg;
  border-top: 1px solid var(--border-color);
  margin-top: $spacing-lg;
}

.footer__copyright {
  font-size: $font-size-sm;
  color: var(--text-muted);
}

.footer__year {
  font-weight: 500;
}

.footer__back-to-top {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-sm;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  transition: all $transition-fast;

  svg {
    width: 16px;
    height: 16px;
    transition: transform $transition-fast;
  }

  &:hover {
    color: $color-primary;
    background: var(--hover-bg);

    svg {
      transform: translateY(-2px);
    }
  }
}

// ============================================
// RESPONSIVE
// ============================================

@media (max-width: $breakpoint-lg) {
  .footer__info {
    gap: $spacing-lg;
  }

  .footer__brand {
    max-width: 250px;
  }
}

@media (max-width: $breakpoint-md) {
  .footer {
    padding: $spacing-lg 0;
  }

  .footer__container {
    padding: 0 $spacing-md;
  }

  .footer__row {
    flex-direction: column;
    gap: $spacing-lg;
    padding: $spacing-md 0;
  }

  .footer__info {
    flex-direction: column;
    gap: $spacing-lg;
  }

  .footer__brand {
    max-width: 100%;
  }

  .footer__links-row {
    flex-direction: column;
    gap: $spacing-lg;
  }

  .footer__links-group {
    width: 100%;
  }

  .footer__bottom {
    flex-direction: column;
    text-align: center;
    gap: $spacing-sm;
  }
}

@media (max-width: $breakpoint-sm) {
  .footer__logo-text {
    font-size: $font-size-lg;
  }

  .footer__contact-item,
  .footer__detail {
    font-size: $font-size-xs;
  }
}
```

---

## Responsive Behavior

### Desktop (> 1024px)

- Full 3-column layout in info row
- Links displayed in horizontal groups
- Copyright and back-to-top on same line

### Tablet (768px - 1024px)

- Reduced gaps between sections
- Brand section narrower
- Still horizontal layout

### Mobile (< 768px)

- All sections stack vertically
- Full-width sections
- Footer bottom centered and stacked
- Links groups full width

### Small Mobile (< 480px)

- Smaller font sizes
- Compact contact items
- Logo text smaller

---

## Accessibility

### ARIA Attributes

| Element | Attribute | Purpose |
|---------|-----------|---------|
| `<footer>` | `role="contentinfo"` | Identifies as footer landmark |
| Logo link | `aria-label` | Describes link purpose |
| SVG icons | `aria-hidden="true"` | Hides decorative icons |
| Back to top | `aria-label="Back to top"` | Describes button action |

### Keyboard Navigation

- All links are focusable
- Back to top button is keyboard accessible
- Focus states styled for visibility

### Screen Reader Considerations

- Semantic HTML structure
- Proper heading hierarchy (h3 for sections, h4 for link groups)
- Descriptive link text (no "click here")
- Hidden decorative elements

---

## Customization

### Changing Colors

Override CSS custom properties in your theme:

```scss
:root {
  --footer-bg: #1a1a2e;
  --border-color: #2d2d44;
}

[data-theme="light"] {
  --footer-bg: #f8f9fa;
  --border-color: #e9ecef;
}
```

### Adding Links

Add new link items to the template:

```html
<li>
    <a href="{{ route(name='web.new_page', lang=language) | default(value='/new-page') }}"
       class="footer__link">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        New Page
    </a>
</li>
```

### Adding Social Icons

```html
{# In Row 4: Connect #}
<li>
    <a href="https://twitter.com/yourhandle"
       class="footer__link"
       target="_blank"
       rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <!-- Twitter icon SVG path -->
        </svg>
        Twitter
    </a>
</li>
```

---

## Related Documentation

- **[Frontend Build Documentation](./FRONTEND_BUILD.md)** - Vite build system
- **[Legal Pages Documentation](../Pages/LEGAL_PAGES.md)** - Legal page templates
- **[Templates Documentation](../Templates/TEMPLATES.md)** - Tera templates
