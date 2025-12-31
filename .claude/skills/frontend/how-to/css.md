# CSS Styling Conventions

## Architecture Plan

### 1) One Vite Project Per Page

Each page will have its own independent **Vite project**.

- The page HTML will be rendered using **server-side rendering (SSR)**.
- Once the page is fully loaded, a **deferred script** will initialize the page's corresponding ES6 class.
- Some pages may include multiple ES6 classes, where a **main class** composes and initializes additional classes.

This approach ensures that each page loads only the JavaScript it actually needs.

---

## File Location

CSS files go in: `blazing_sun/src/frontend/pages/{PAGE_NAME}/src/styles/main.scss`

Served at URL: `/assets/css/{PAGE_NAME}/style.css`

---

## Theme System

### Overview

The application uses a **CSS custom properties (CSS variables)** based theming system that supports:

1. **System Default**: Automatically detects user's OS preference via `prefers-color-scheme`
2. **Manual Override**: Users can toggle themes via a switch (sets `data-theme` on `<html>`)
3. **Persistence**: Theme preference stored in cookie + localStorage

### IMPORTANT: GLOBAL-First Theme Architecture

**All CSS theme variables are defined ONLY in GLOBAL CSS (`blazing_sun/src/frontend/pages/GLOBAL/src/styles/_theme.scss`).**

Page-specific CSS files must **NEVER redefine theme CSS variables**. They should only:
1. Use the theme variables (e.g., `background: var(--color-surface)`)
2. Define SCSS constants (spacing, typography, z-index - non-themeable values)

**CSS Loading Order:**
```
1. GLOBAL CSS (defines all theme variables)
2. Page-specific CSS (uses theme variables, no redefinition)
```

**Why?**
- GLOBAL CSS is loaded first via `base.html`
- If page CSS redefines theme variables, there's a "flash of incorrect colors" as different values load
- Single source of truth for colors ensures consistency across all pages

### What Goes Where

**GLOBAL `_theme.scss`:**
- All CSS custom properties (`--color-*`, `--shadow-*`, `--nav-*`, `--input-*`, etc.)
- Both `:root` (light) and `[data-theme="dark"]` selectors
- These are the ONLY definitions of theme variables

**GLOBAL `_utilities.scss`:**
- All utility classes (`.df`, `.aic`, `.m1`, `.p2`, `.gap-md`, etc.)
- This is the SINGLE SOURCE OF TRUTH for utility classes
- Page projects inherit these from GLOBAL CSS - they do NOT create their own utilities

**Page-specific `_variables.scss`:**
- Minimal SCSS constants needed for BEM component compilation
- Font sizes, spacing, radius, transitions, breakpoints, shadows
- Optional: z-index, colors, gradients (only if used by BEM components)
- Import these with `@use 'variables' as *`

**Page projects do NOT have:**
- Their own `_utilities.scss` (utility classes come from GLOBAL)
- CSS custom property definitions (theme colors come from GLOBAL)
- Duplicate variable definitions that match GLOBAL

### Example: Correct Page-Specific `_variables.scss`

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

### Example: Correct Component Usage

```scss
@use 'variables' as *;

.card {
  // Use GLOBAL theme variables for colors
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);

  // Use SCSS variables for non-theme values
  padding: $spacing-xl;
  border-radius: $radius-md;
  transition: background-color $transition-normal;
}

.form-group__input {
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  color: var(--color-text-primary);

  &:focus {
    border-color: var(--color-border-focus);
    box-shadow: var(--focus-ring);
  }
}
```

### Theme Detection Priority

1. `data-theme="dark"` or `data-theme="light"` on `<html>` (highest priority)
2. System preference via `@media (prefers-color-scheme: dark)`
3. Light theme as default fallback

**IMPORTANT:** The `data-theme` attribute must ALWAYS be set explicitly in `base.html`:
```html
<html lang="en" data-theme="{% if theme == 'dark' %}dark{% else %}light{% endif %}">
```
This prevents the CSS `@media (prefers-color-scheme: dark)` from overriding the user's chosen theme.

### JavaScript Theme Controller

```javascript
class ThemeController {
  constructor() {
    this.init();
  }

  init() {
    // Check for saved preference, otherwise use system default
    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    // If no saved preference, CSS handles system default automatically
  }

  toggle() {
    const current = this.getCurrentTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  getCurrentTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
```

### Theme Switch HTML

```html
<button class="theme-switch" aria-label="Toggle theme" onclick="themeController.toggle()">
  <span class="theme-switch__track"></span>
  <span class="theme-switch__thumb">
    <span class="theme-switch__icon theme-switch__icon--sun">
      <svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 100 10 5 5 0 000-10z"/></svg>
    </span>
    <span class="theme-switch__icon theme-switch__icon--moon">
      <svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
    </span>
  </span>
</button>
```

---

## Color System

### Light Theme (Default)

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | `#667eea` | Primary brand color, buttons, links |
| `--color-primary-dark` | `#764ba2` | Gradient endpoint, hover states |
| `--color-primary-light` | `#8b9ff5` | Light accents |
| `--color-success` | `#00b09b` | Success states, confirmations |
| `--color-success-light` | `#96c93d` | Success gradient endpoint |
| `--color-error` | `#ff5f6d` | Error states, validation |
| `--color-error-light` | `#ffc371` | Error gradient endpoint |
| `--color-warning` | `#f0ad4e` | Warning states |
| `--color-info` | `#5bc0de` | Info states |
| `--color-bg-primary` | `#ffffff` | Page background |
| `--color-bg-secondary` | `#f8f9fa` | Section backgrounds |
| `--color-bg-tertiary` | `#e9ecef` | Subtle backgrounds |
| `--color-surface` | `#ffffff` | Cards, inputs, modals |
| `--color-surface-hover` | `#f8f9fa` | Surface hover state |
| `--color-text-primary` | `#333333` | Main text |
| `--color-text-secondary` | `#666666` | Secondary text |
| `--color-text-muted` | `#999999` | Muted/placeholder text |
| `--color-text-inverse` | `#ffffff` | Text on dark backgrounds |
| `--color-border` | `#e0e0e0` | Default borders |
| `--color-border-light` | `#f0f0f0` | Subtle borders |

### Dark Theme

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | `#8b9ff5` | Primary (lightened for dark bg) |
| `--color-primary-dark` | `#9b7fdb` | Gradient endpoint |
| `--color-primary-light` | `#667eea` | Light accents |
| `--color-success` | `#4ade80` | Success (brightened) |
| `--color-success-light` | `#86efac` | Success gradient |
| `--color-error` | `#f87171` | Error (brightened) |
| `--color-error-light` | `#fca5a5` | Error gradient |
| `--color-warning` | `#fbbf24` | Warning |
| `--color-info` | `#38bdf8` | Info |
| `--color-bg-primary` | `#0f0f0f` | Page background |
| `--color-bg-secondary` | `#1a1a1a` | Section backgrounds |
| `--color-bg-tertiary` | `#262626` | Subtle backgrounds |
| `--color-surface` | `#1e1e1e` | Cards, inputs, modals |
| `--color-surface-hover` | `#2a2a2a` | Surface hover state |
| `--color-text-primary` | `#f5f5f5` | Main text |
| `--color-text-secondary` | `#a3a3a3` | Secondary text |
| `--color-text-muted` | `#737373` | Muted text |
| `--color-text-inverse` | `#0f0f0f` | Text on light bg |
| `--color-border` | `#404040` | Default borders |
| `--color-border-light` | `#333333` | Subtle borders |

### Gray Scale (Theme-adaptive)

| Light Theme | Dark Theme | Usage |
|-------------|------------|-------|
| `--gray-50: #fafafa` | `--gray-50: #171717` | Lightest/darkest |
| `--gray-100: #f8f9fa` | `--gray-100: #1a1a1a` | Very light/dark |
| `--gray-200: #e9ecef` | `--gray-200: #262626` | Light/dark |
| `--gray-300: #dee2e6` | `--gray-300: #333333` | Light-mid |
| `--gray-400: #ced4da` | `--gray-400: #525252` | Mid-light |
| `--gray-500: #adb5bd` | `--gray-500: #737373` | Mid |
| `--gray-600: #6c757d` | `--gray-600: #a3a3a3` | Mid-dark |
| `--gray-700: #495057` | `--gray-700: #d4d4d4` | Dark/light text |
| `--gray-800: #343a40` | `--gray-800: #e5e5e5` | Very dark/light |
| `--gray-900: #212529` | `--gray-900: #f5f5f5` | Darkest/lightest |

### Gradients

```scss
// Primary gradient (purple-indigo)
--gradient-primary: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);

// Success gradient (teal-green)
--gradient-success: linear-gradient(to right, var(--color-success), var(--color-success-light));

// Error gradient (coral-orange)
--gradient-error: linear-gradient(to right, var(--color-error), var(--color-error-light));
```

### Shadows (Theme-adaptive)

| Variable | Light | Dark |
|----------|-------|------|
| `--shadow-color` | `rgba(0,0,0,0.1)` | `rgba(0,0,0,0.3)` |
| `--shadow-color-heavy` | `rgba(0,0,0,0.2)` | `rgba(0,0,0,0.5)` |
| `--shadow-primary` | `rgba(102,126,234,0.4)` | `rgba(139,159,245,0.3)` |
| `--shadow-sm` | `0 2px 10px var(--shadow-color)` | |
| `--shadow-md` | `0 5px 20px var(--shadow-color)` | |
| `--shadow-lg` | `0 10px 40px var(--shadow-color-heavy)` | |

---

## Styling Strategy (SCSS)

Each page will also have its own SCSS files compiled into a single stylesheet.

### Utility-First Class System

SCSS will primarily be written as **utility classes**, for example:

```html
<div class="df aic jcc"></div>
```

### Utility Class Mapping

**Display:**
- `df` → `display: flex`
- `dg` → `display: grid`
- `db` → `display: block`
- `dn` → `display: none`

**Flexbox:**
- `aic` → `align-items: center`
- `jcc` → `justify-content: center`
- `jcsb` → `justify-content: space-between`
- `fdc` → `flex-direction: column`

**Spacing (0-5 scale, xxl for 6):**
- `m0-m5` → margin
- `p0-p6` → padding
- `mt0-mt5` → margin-top
- `g0-g5` → gap

**Colors (Theme-aware):**
- `c-primary` → `color: var(--color-primary)`
- `c-text` → `color: var(--color-text-primary)`
- `c-muted` → `color: var(--color-text-muted)`
- `bg-surface` → `background: var(--color-surface)`
- `bg-primary` → `background: var(--color-bg-primary)`

Only the utility classes required for a specific page should be included in that page's SCSS build.

---

## BEM for Complex Components

If a component requires more complex styling than utility classes can reasonably provide:

- Use **BEM methodology** for those component styles
- Keep **BEM styles strictly separated** from the utility class system

---

## Folder Structure

All Vite projects will live under: `blazing_sun/src/frontend`

### GLOBAL Project (Single Source of Truth)

```
blazing_sun/src/frontend/pages/GLOBAL/
  src/
    styles/
      _variables.scss     # SCSS compile-time constants (master definitions)
      _theme.scss         # CSS custom properties (light/dark themes)
      _utilities.scss     # ALL utility classes (single source of truth)
      _base.scss          # Base element styles
      _navbar.scss        # Navbar component
      main.scss           # Entry point
    js/
      ThemeManager.js     # Theme switching logic
      Navbar.js           # Navbar component
      main.js             # Entry point
  vite.config.js
  package.json
```

### Page Projects (Minimal Structure)

```
blazing_sun/src/frontend/pages/SIGN_UP/
  src/
    styles/
      _variables.scss     # Minimal SCSS vars for BEM compilation
      _signup-form.scss   # BEM component styles (uses var() for colors)
      main.scss           # Entry point, imports partials
    SignUp.js             # ES6 class for page logic
    main.js               # Entry point
  vite.config.js
  package.json
```

**Note**: Page projects do NOT have:
- `_utilities.scss` - Utility classes come from GLOBAL CSS
- `_theme.scss` - Theme colors come from GLOBAL CSS
- Duplicate variable definitions

### Why This Architecture Works

- **GLOBAL CSS loads first** via `base.html` → defines all utilities and theme colors
- **Page CSS loads second** → only contains BEM components for that page
- **No duplication** → smaller bundles, faster loads
- **Theme consistency** → all pages use same colors from GLOBAL
- **Easy maintenance** → update utilities/colors in one place

Because the output files are static assets, the browser will cache them after the first load, making subsequent visits faster.

---

## Build Output Targets

### CSS Output

**Vite project location:**
`blazing_sun/src/frontend/pages/SIGN_UP`

**Output compiled and minified CSS to:**
`/home/milner/Desktop/rust/blazing_sun/src/resources/css/SIGN_UP/style.css`

Vite should support two configurations:

- **Development build**
  - Source maps enabled
  - Non-minified output
- **Production build**
  - Minified output
  - No source maps

---

## CSS Organization

```scss
// ===================
// 1. Variables (@use 'variables')
// ===================
// CSS custom properties for theming
// SCSS variables for spacing, typography, breakpoints

// ===================
// 2. Reset/Base Styles (in main.scss)
// ===================
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

// ===================
// 3. Utilities (@use 'utilities')
// ===================
.df { display: flex; }
.c-primary { color: var(--color-primary); }

// ===================
// 4. Components (@use 'component-name')
// ===================
.card {
  background: var(--color-surface);
  border-radius: $radius-md;
  box-shadow: var(--shadow-lg);

  &__title {
    color: var(--color-text-primary);
  }
}
```

---

## Responsive Design

Mobile-first approach with standard breakpoints:

```scss
// SCSS Variables (non-themeable)
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1440px;

// Usage
.card {
  width: 100%;  // Mobile default
}

@media (min-width: $breakpoint-md) {
  .card {
    width: 50%;  // Tablet
  }
}

@media (min-width: $breakpoint-lg) {
  .card {
    width: 33.333%;  // Desktop
  }
}
```

---

## Typography Scale

| Variable | Size | Usage |
|----------|------|-------|
| `$font-size-xs` | 0.75rem (12px) | Captions, labels |
| `$font-size-sm` | 0.875rem (14px) | Small text, hints |
| `$font-size-base` | 1rem (16px) | Body text |
| `$font-size-lg` | 1.25rem (20px) | Subheadings |
| `$font-size-xl` | 1.5rem (24px) | H3 headings |
| `$font-size-xxl` | 2rem (32px) | H2 headings |
| `$font-size-xxxl` | 3rem (48px) | H1 headings |

---

## Spacing Scale

| Variable | Size | Usage |
|----------|------|-------|
| `$spacing-xs` | 0.25rem (4px) | Tight spacing |
| `$spacing-sm` | 0.5rem (8px) | Small gaps |
| `$spacing-md` | 1rem (16px) | Default spacing |
| `$spacing-lg` | 1.5rem (24px) | Section spacing |
| `$spacing-xl` | 2rem (32px) | Large gaps |
| `$spacing-xxl` | 3rem (48px) | Major sections |

---

## Border Radius Scale

| Variable | Size | Usage |
|----------|------|-------|
| `$radius-sm` | 5px | Buttons, inputs |
| `$radius-md` | 10px | Cards, containers |
| `$radius-lg` | 15px | Large cards |
| `$radius-full` | 9999px | Pills, circles |

---

## Transitions

| Variable | Duration | Usage |
|----------|----------|-------|
| `$transition-fast` | 0.15s ease | Hover states |
| `$transition-normal` | 0.25s ease | Standard animations |
| `$transition-slow` | 0.4s ease | Page transitions |

---

## Z-Index Scale

| Variable | Value | Usage |
|----------|-------|-------|
| `$z-dropdown` | 100 | Dropdowns |
| `$z-sticky` | 200 | Sticky headers |
| `$z-fixed` | 300 | Fixed elements |
| `$z-modal-backdrop` | 400 | Modal overlays |
| `$z-modal` | 500 | Modal content |
| `$z-popover` | 600 | Popovers |
| `$z-tooltip` | 700 | Tooltips |
| `$z-toast` | 800 | Toast notifications |

---

## Accessibility

### Reduced Motion

```scss
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### High Contrast

```scss
@media (prefers-contrast: high) {
  :root {
    --color-border: currentColor;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
  }
}
```

### Focus States

```scss
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## Best Practices

1. **Always use CSS variables** for colors to support theming
2. **NEVER hardcode colors** - use `var(--color-*)` or utility classes
3. Avoid `!important` unless absolutely necessary
4. Keep specificity low
5. Group related styles together
6. Comment sections for organization
7. Use minimal utility classes needed for each page
8. Test both light and dark themes during development
9. Ensure WCAG AA contrast ratios for text
10. Support keyboard navigation with visible focus states

---

## SCSS/Sass Best Practices (CRITICAL)

### Avoid Deprecated Features

**IMPORTANT**: Dart Sass is deprecating features. Follow these rules to avoid build warnings:

#### 1. Use Modern Sass API in Vite

**MANDATORY** for all Vite configs:

```javascript
// vite.config.js
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',  // REQUIRED - avoids legacy-js-api deprecation
        charset: false,
      },
    },
  },
});
```

#### 2. Avoid Deprecated SCSS Features

| Deprecated | Use Instead |
|------------|-------------|
| `@import` | `@use` and `@forward` |
| Global variables without namespace | `@use 'file' as namespace;` then `namespace.$var` |
| `lighten()` / `darken()` | `color.adjust()` or `color.scale()` |
| `saturate()` / `desaturate()` | `color.adjust($saturation: X)` |
| Division with `/` | `math.div()` or `calc()` |
| `!global` flag | Define variables at root level |

#### 3. Modern @use Syntax

```scss
// OLD (deprecated)
@import 'variables';
@import 'mixins';

// NEW (required)
@use 'variables' as vars;
@use 'mixins' as mix;

// Usage
.element {
  color: vars.$color-primary;
  @include mix.flex-center;
}

// Or with * for all members (use sparingly)
@use 'variables' as *;
```

#### 4. Modern Color Functions

```scss
// OLD (deprecated)
$lighter: lighten($color, 10%);
$darker: darken($color, 10%);

// NEW (required)
@use 'sass:color';

$lighter: color.adjust($color, $lightness: 10%);
$darker: color.adjust($color, $lightness: -10%);

// Or use color.scale for proportional changes
$lighter: color.scale($color, $lightness: 20%);
```

#### 5. Modern Math Functions

```scss
// OLD (deprecated in some contexts)
$result: $width / 2;

// NEW (required)
@use 'sass:math';

$result: math.div($width, 2);

// Or use CSS calc() when possible
width: calc(100% / 3);
```

### Vite Project Checklist

When creating a new Vite project, ensure:

- [ ] `api: 'modern-compiler'` in scss preprocessorOptions
- [ ] Use `@use` instead of `@import`
- [ ] Use `sass:color` module for color manipulation
- [ ] Use `sass:math` module for division
- [ ] No deprecated Sass functions

### Example: Modern SCSS File Structure

```scss
// _variables.scss
$color-primary: #667eea;
$spacing-md: 1rem;

// _mixins.scss
@use 'sass:color';

@mixin hover-darken($amount: 10%) {
  &:hover {
    background: color.adjust($color, $lightness: -$amount);
  }
}

// main.scss
@use 'variables' as vars;
@use 'mixins' as mix;

.button {
  background: vars.$color-primary;
  padding: vars.$spacing-md;
  @include mix.hover-darken(5%);
}
```

---

## Naming Convention

- Use kebab-case for file names: `main-styles.scss`, `_signup-form.scss`
- Use BEM-like naming for classes: `.block__element--modifier`
- Prefix partials with underscore: `_variables.scss`
- CSS variables use `--category-name` format
- SCSS variables use `$category-name` format
