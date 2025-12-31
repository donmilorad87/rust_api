---
name: frontend
description: HTML/CSS/JavaScript and Tera template development. Use for web pages, styling, and frontend functionality. (project)
invocable: true
---

# Frontend Development Skill

You are a frontend development subagent for the Blazing Sun Rust project. Your role is to create and maintain HTML templates, CSS styles, and JavaScript functionality.

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Templates** | `blazing_sun/Templates/TEMPLATES.md` | Tera templates, base layouts, partials |
| **Web Routes** | `blazing_sun/Routes/Web/WEB_ROUTES.md` | Web page routes, named routes |
| **Uploads** | `blazing_sun/Uploads/UPLOADS.md` | File upload UI, displaying images |
| **Bootstrap** | `blazing_sun/Bootstrap/BOOTSTRAP.md` | Template utilities, asset versioning |
| **Email** | `blazing_sun/Email/EMAIL.md` | Email template design |

---

## TDD-FIRST METHODOLOGY (MANDATORY)

**CRITICAL**: This project follows strict Test-Driven Development.

### Before ANY Implementation:

1. **CALL TESTER FIRST** - Request Playwright tests for the page
2. **Wait for failing tests** (RED phase)
3. **Then implement** page to make tests pass (GREEN phase)
4. **Refactor** while keeping tests green

### Test Location

```
tests/routes/web/{PAGE_NAME}/    - Playwright page tests
```

### TDD Workflow

```
Page Request → Tester writes Playwright tests → Tests FAIL → You implement → Tests PASS
```

---

## File Locations

| Type | Path | Purpose |
|------|------|---------|
| HTML Templates | `blazing_sun/src/resources/views/web/` | Tera templates for web pages |
| CSS Styles | `blazing_sun/src/resources/css/` | Stylesheets served at `/assets/css/` |
| JavaScript | `blazing_sun/src/resources/js/` | Scripts served at `/assets/js/` |
| Email Templates | `blazing_sun/src/resources/views/emails/` | Tera templates for emails |

## Asset URLs in Templates

```html
<!-- CSS -->
<link rel="stylesheet" href="/assets/css/{PAGE_NAME}/style.css">

<!-- JavaScript -->
<script src="/assets/js/{PAGE_NAME}/app.js"></script>

<!-- Public storage files -->
<img src="/storage/image.jpg">
```

## How-To Guides

Detailed guides for each technology (in this skill folder):
- @frontend/how-to/html.md - HTML/Tera template conventions
- @frontend/how-to/css.md - CSS styling conventions
- @frontend/how-to/js.md - JavaScript conventions

## Workflow

1. **Understand the requirement** - Read relevant context files
2. **Check existing patterns** - Review existing templates/styles for consistency
3. **Create/modify files** - Follow the conventions in how-to guides
4. **Test in browser** - Verify changes work correctly

## Key Principles

- Keep templates simple and readable
- Use semantic HTML5 elements
- Prefer vanilla JavaScript (ES6+ classes)
- Mobile-first responsive design
- Minimize external dependencies
- Follow existing code patterns


## Architecture Plan

### 1) One Vite Project Per Page

Each page will have its own independent **Vite project**.

- The page HTML will be rendered using **server-side rendering (SSR)**.
- Once the page is fully loaded, a **deferred script** will initialize the page's corresponding ES6 class.
- Some pages may include multiple ES6 classes, where a **main class** composes and initializes additional classes.

This approach ensures that each page loads only the JavaScript it actually needs.

---

## Styling Strategy (SCSS)

Each page will also have its own SCSS files compiled into a single stylesheet.

### CRITICAL: Avoid Deprecated Sass Features

**All Vite projects MUST use modern Sass API to avoid deprecation warnings.**

```javascript
// vite.config.js - MANDATORY
css: {
  preprocessorOptions: {
    scss: {
      api: 'modern-compiler',  // REQUIRED
      charset: false,
    },
  },
}
```

**Deprecated features to AVOID:**
- `@import` → Use `@use` and `@forward`
- `lighten()`/`darken()` → Use `color.adjust()` from `sass:color`
- Division with `/` → Use `math.div()` from `sass:math`

See `@frontend/how-to/css.md` → "SCSS/Sass Best Practices" section for full details.

### Utility-First Class System

SCSS will primarily be written as **utility classes**, for example:

```html
<div class="df aic jcc"></div>
```

## Utility Class Mapping

- **df** -> `display: flex`
- **aic** -> `align-items: center`
- **jcc** -> `justify-content: center`

Only the utility classes required for a specific page should be included in that page's SCSS build.

---

## BEM for Complex Components

If a component requires more complex styling than utility classes can reasonably provide:

- Use **BEM methodology** for those component styles
- Keep **BEM styles strictly separated** from the utility class system

---

## GLOBAL-First Theme Architecture (CRITICAL)

**GLOBAL is the single source of truth for all theme variables AND utility classes.**

### Architecture Overview

```
GLOBAL/src/styles/
├── _variables.scss    ← SCSS compile-time constants (master definitions)
├── _theme.scss        ← CSS Custom Properties (light/dark theme colors)
├── _utilities.scss    ← ALL utility classes (single source of truth)
├── _base.scss         ← Base element styles
├── _navbar.scss       ← Navbar component styles
└── main.scss          ← Entry point, imports all partials
```

### Three Key Files in GLOBAL

| File | Type | Example |
|------|------|---------|
| `GLOBAL/_variables.scss` | SCSS constants | `$spacing-md: 1rem;` |
| `GLOBAL/_theme.scss` | CSS Custom Properties | `--card-bg: #ffffff;` |
| `GLOBAL/_utilities.scss` | Utility classes | `.df { display: flex; }` |

### Key Rules

1. **GLOBAL defines all theme colors** - CSS custom properties ONLY in GLOBAL's `_theme.scss`
2. **GLOBAL defines all utility classes** - `.df`, `.aic`, `.m1`, etc. are ONLY in GLOBAL's `_utilities.scss`
3. **Page projects NEVER redefine theme colors** - Use GLOBAL variables, don't create your own
4. **Page projects NEVER have their own `_utilities.scss`** - They inherit utility classes from GLOBAL CSS
5. **Page `_variables.scss`** - Contains minimal SCSS constants needed for BEM component compilation

### Page-Level `_variables.scss` Structure (Required Minimum)

Page projects need only these SCSS variables for compiling BEM components:

```scss
// ============================================
// PAGE NAME - SCSS Variables
// ============================================
// Minimal SCSS variables for BEM component compilation.
// Runtime theming uses CSS custom properties from GLOBAL/_theme.scss.
// Utility classes come from GLOBAL/_utilities.scss.

// --- Typography ---
$font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
$font-size-xs: 0.75rem;
$font-size-sm: 0.875rem;
$font-size-base: 1rem;
$font-size-lg: 1.125rem;
$font-size-xl: 1.25rem;
$font-size-2xl: 1.5rem;
$font-size-xxl: 1.75rem;
$font-size-3xl: 2rem;

// --- Spacing ---
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;

// --- Border Radius ---
$radius-sm: 4px;
$radius-md: 6px;
$radius-lg: 8px;
$radius-full: 9999px;

// --- Transitions ---
$transition-fast: 0.15s ease;
$transition-normal: 0.25s ease;

// --- Breakpoints ---
$breakpoint-sm: 480px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;

// --- Shadows (SCSS fallbacks) ---
$shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
$shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

// --- OPTIONAL: Only if page BEM components use these ---
// Z-Index (only if modals/overlays used)
// $z-dropdown: 100;
// $z-modal: 200;
// $z-overlay: 300;

// Colors (only if BEM uses SCSS color functions)
// $color-primary: #667eea;
// $gradient-primary: linear-gradient(135deg, $color-primary 0%, #764ba2 100%);
```

### Adding New Theme Variables

1. Add to `GLOBAL/_theme.scss` (both `:root` and `[data-theme="dark"]`)
2. Update admin theme template HTML with DOM picker elements
3. Update backend whitelist in `config/theme.rs`
4. Rebuild GLOBAL: `npm run build`
5. Increment `ASSETS_VERSION`

### Why This Matters

- All pages share same theme colors
- All pages share same utility classes (no duplication)
- Theme switching updates all pages instantly
- Super admins can configure theme from one location
- Smaller page CSS bundles (no duplicate utility definitions)

---

## Theme Color Sync System

The theme color system syncs between three components:

1. **SCSS Source**: `src/frontend/pages/GLOBAL/src/styles/_theme.scss`
2. **Database**: `site_config.theme_light` and `site_config.theme_dark` (JSONB)
3. **Admin UI**: `admin/theme` → Colors panel (THEME page Vite project)

### DOM-Based Picker Architecture

ThemeConfig.js uses **DOM-based pickers** - color pickers, angle pickers, and size pickers are defined in HTML with `data-*` attributes, then initialized from JavaScript.

**HTML Structure (in admin_theme.html):**
```html
<!-- Color Picker -->
<div class="color-picker" data-var="bg_gradient_start" data-type="light">
  <label class="color-picker__label">Background Gradient Start</label>
  <div class="color-picker__input-group">
    <input type="color" class="color-picker__color" value="#667eea">
    <input type="text" class="color-picker__hex" value="#667eea">
  </div>
</div>

<!-- Angle Picker -->
<div class="angle-picker" data-var="gradient_primary_angle" data-section="scss">
  <label class="angle-picker__label">Primary Gradient Angle</label>
  <div class="angle-picker__input-group">
    <input type="range" class="angle-picker__range" min="0" max="360" value="135">
    <input type="number" class="angle-picker__number" min="0" max="360" value="135">
    <span class="angle-picker__unit">deg</span>
  </div>
</div>

<!-- Size Picker -->
<div class="size-picker" data-var="font_size_base" data-section="scss">
  <label class="size-picker__label">Base Font Size</label>
  <div class="size-picker__input-group">
    <input type="number" class="size-picker__input" step="0.0625" value="1">
    <span class="size-picker__unit">rem</span>
  </div>
</div>
```

**JavaScript Initialization (ThemeConfig.js):**
```javascript
// Color pickers initialized from DOM
initializeDomColorPickers() {
  const pickers = document.querySelectorAll('.color-picker[data-var][data-type]');
  pickers.forEach(picker => {
    const varName = picker.dataset.var;      // e.g., 'bg_gradient_start'
    const themeType = picker.dataset.type;   // 'light' or 'dark'
    // Store reference and attach event handlers
    this.domColorPickers.push({ element: picker, varName, themeType, ... });
  });
}

// Angle pickers initialized from DOM
initializeDomAnglePickers() {
  const pickers = document.querySelectorAll('.angle-picker[data-var][data-section]');
  // ...similar pattern
}

// Size pickers initialized from DOM
initializeDomSizePickers() {
  const pickers = document.querySelectorAll('.size-picker[data-var][data-section]');
  // ...similar pattern
}
```

### Key Format: Underscore vs Hyphen

| Component | Format | Example |
|-----------|--------|---------|
| `_theme.scss` file | CSS hyphen format | `--bg-gradient-start: #ff5500;` |
| Database JSONB | Underscore format | `{"bg_gradient_start": "#ff5500"}` |
| HTML data-var attribute | Underscore format | `data-var="bg_gradient_start"` |
| Frontend JS storage | Underscore format | `this.currentConfig.theme_light.bg_gradient_start` |

### Save Colors Flow

1. User changes color in Admin → Colors panel
2. `handleDomColorChange()` stores value with underscore key (from `data-var`)
3. "Save Colors" button calls `saveColors()` method
4. `PUT /api/v1/admin/theme/colors` sends `theme_light` and `theme_dark` JSON
5. Backend validates keys against whitelist (underscore format)
6. ThemeService updates `_theme.scss` (converts to hyphen)
7. `npm run build` compiles SCSS to CSS
8. `ASSETS_VERSION` incremented
9. Frontend receives success response with new version

### Adding New Theme Color Variable

**Step 1: HTML (admin_theme.html)**:
Add a color picker element in the appropriate section:
```html
<div class="color-picker" data-var="new_property" data-type="light">
  <label class="color-picker__label">New Property</label>
  <div class="color-picker__input-group">
    <input type="color" class="color-picker__color" value="#ffffff">
    <input type="text" class="color-picker__hex" value="#ffffff">
  </div>
</div>
<!-- Also add for dark theme with data-type="dark" -->
```

**Step 2: Backend (config/theme.rs)**:
Add to `allowed_css_properties` whitelist:
```rust
"new_property".to_string(),
```

**Step 3: SCSS (_theme.scss)**:
Add variable in both `:root` and `[data-theme="dark"]` blocks:
```scss
:root {
  --new-property: #ffffff;
}
[data-theme="dark"] {
  --new-property: #000000;
}
```

**Step 4: Database (optional)**:
Add to `theme_light` and `theme_dark` JSONB defaults if needed

---

## Folder Structure

All Vite projects will live under: blazing_sun/src/frontend


Create the following structure:
blazing_sun/src/frontend/
  pages/
    SIGN_UP/

The `SIGN_UP` folder represents the Vite project for the **SIGN_UP** page.

This pattern will repeat for every page (many Vite projects), ensuring:

- Only page-specific CSS is shipped
- Only page-specific JavaScript is shipped
- No large shared bundle with unused code

Because the output files are static assets, the browser will cache them after the first load, making subsequent visits faster.

---

## .gitignore for Vite Projects (MANDATORY)

**CRITICAL**: Every Vite project MUST have a `.gitignore` file to exclude `node_modules` from version control.

### Required .gitignore Content

Each page's Vite project (`blazing_sun/src/frontend/pages/{PAGE_NAME}/`) must contain:

```gitignore
# Dependencies
node_modules/

# Build cache
.vite/
```

### Why This Is Required

- `node_modules/` can contain hundreds of megabytes of files
- Dependencies are reproducible via `package.json` and `package-lock.json`
- Committing `node_modules/` slows down git operations and bloats the repository

### Creating .gitignore for a New Page

When creating a new Vite project for a page:

```bash
cd /home/milner/Desktop/rust/blazing_sun/src/frontend/pages/{PAGE_NAME}
echo -e "# Dependencies\nnode_modules/\n\n# Build cache\n.vite/" > .gitignore
```

## Build Output Targets

### CSS Output

**Vite project location:**

blazing_sun/src/frontend/pages/SIGN_UP


**Output compiled and minified CSS to:**

/home/milner/Desktop/rust/blazing_sun/src/resources/css/SIGN_UP/style.css

Vite should support two configurations:

- **Development build**
  - Source maps enabled
  - Non-minified output
- **Production build**
  - Minified output
  - No source maps

### JavaScript Output

**Vite project location:**

blazing_sun/src/frontend/pages/SIGN_UP

**Output compiled and minified JavaScript to:**

/home/milner/Desktop/rust/blazing_sun/src/resources/js/SIGN_UP/app.js


Vite should support two configurations:

- **Development build**
  - Source maps enabled
  - Non-minified output
- **Production build**
  - Minified output
  - No source maps

---

## Update Tera Template (MANDATORY)

**CRITICAL**: After building Vite assets, you MUST update the corresponding Tera template to include the new CSS/JS files.

### Template Structure

Every page template should follow this pattern:

```html
{% extends "base.html" %}

{% block title %}Page Title - Blazing Sun{% endblock %}

{% block extra_styles_links %}
<link rel="stylesheet" href="/assets/css/{PAGE_NAME}/style.css?v={{ assets_version }}">
{% endblock %}

{% block content %}
<main class="container">
    <!-- Page content -->
</main>
{% endblock %}

{% block scripts %}
<script>
    // Set base URL for API requests
    window.BASE_URL = '{{ base_url }}';
</script>
<script src="/assets/js/{PAGE_NAME}/app.js?v={{ assets_version }}" defer></script>
{% endblock %}
```

### Key Points

1. **CSS goes in `{% block extra_styles_links %}`** - Include version parameter `?v={{ assets_version }}`
2. **JS goes in `{% block scripts %}`** - Use `defer` attribute for non-blocking load
3. **Remove inline JavaScript** - All JS logic should be in the Vite-built app.js
4. **Add ARIA labels** - Ensure forms have `aria-label` attributes
5. **Use semantic HTML** - Replace `<div>` with `<main>`, `<article>`, `<section>` as appropriate

### Template Location

Templates are in: `blazing_sun/src/resources/views/web/{page_name}.html`

---

## Complete Vite Project Workflow

**Follow these steps IN ORDER when creating a new page's Vite project:**

1. **Create Vite project folder**: `blazing_sun/src/frontend/pages/{PAGE_NAME}/`
2. **Create package.json** with vite, sass dependencies
3. **Create vite.config.js** with dev/prod build configs
4. **Create .gitignore** for node_modules
5. **Create SCSS structure** in `src/styles/`
6. **Create JavaScript structure** in `src/`
7. **Run `npm install`**
8. **Run `npm run build`**
9. **Increment `ASSETS_VERSION`** in `blazing_sun/.env`
10. **Update Tera template** to include new CSS/JS assets

**WARNING**: Skipping step 10 means the page will not load the new assets!

---

## Detailed instructions to claude

- we create vite project for each page. vite project will build css from scss and it will build javascript from javscript classes.

1. go inside of /blazing_sun/src/frontend/pages and create /blazing_sun/src/frontend/pages/{NAME_OF_PAGE}
2. create vite project
3. create scss folder and js folder inside of vtte root folder
4. add production and development configuration for the vite. development will create source maps and non minified code, and production will create minified code without source maps, both for js and css.
5. css will be created from utility classes like class="df aic jcc". beside utility classes there will be BEM metotologiy for the comoponents. if something is complex to be writen in utility classes and have lot of states, then we will use BEM for it. creat app.scss and include all files inside of it.
6. create app.js inside of js folder of vite and import all other classes needed for the page inside of it. every page will have app.js and that class will only instaniate other classes on that page. app.js is just starting point.
7. once css and js are done then you need to output to: /home/milner/Desktop/rust/blazing_sun/src/resources/css/pages/{NAME_OF_PAGE}/style.css and for js /home/milner/Desktop/rust/blazing_sun/src/resources/js/pages/{NAME_OF_PAGE}/app.js
8. why we are using vite project for just one page, or for all pages? why every page have different vite project? because we will have only css for that page, and only js for that page. First time we will load assets when user land on page, assets will be cachet to browser and page will be optimized, it will use only needed css and only neede js.

- when we have created asstes then rust function determine_assets will load assets inside of head tag on templates. function determine_assets should be included in head and determine_assets should check on what route we are and based on route function will know {NAME_OF_PAGE} and include right assets.