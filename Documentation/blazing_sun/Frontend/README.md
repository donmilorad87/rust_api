# Frontend Build System - Complete Documentation

## Overview

The Blazing Sun frontend uses a **page-based architecture** with individual Vite builds for each page. This approach provides:
- **Fast builds** - Only rebuild changed pages
- **Code splitting** - Each page has its own bundle
- **Independent development** - Work on pages in isolation
- **No framework overhead** - Vanilla ES6 JavaScript with classes
- **Modern tooling** - Vite for bundling, SCSS for styling

---

## Architecture

### Page-Based Structure

```
blazing_sun/src/frontend/pages/
├── GLOBAL/              # Shared navigation and theme management
├── SIGN_IN/             # Sign in page
├── SIGN_UP/             # Sign up page
├── FORGOT_PASSWORD/     # Password reset page
├── PROFILE/             # User profile page
├── REGISTERED_USERS/    # Admin user management
├── UPLOADS/             # Admin file uploads
├── THEME/               # Admin theme configuration
└── GALLERIES/           # Gallery management

Each page contains:
├── src/
│   ├── main.js          # Entry point
│   ├── *.js             # ES6 class components
│   └── styles/
│       ├── main.scss    # Main stylesheet
│       ├── _*.scss      # Partials
│       └── _variables.scss  # SCSS variables
├── package.json         # Dependencies
├── vite.config.js       # Build configuration
└── node_modules/        # Installed dependencies
```

### Build Output

```
blazing_sun/src/resources/
├── js/
│   ├── GLOBAL/app.js
│   ├── SIGN_IN/app.js
│   ├── PROFILE/app.js
│   └── ...
└── css/
    ├── GLOBAL/style.css
    ├── SIGN_IN/style.css
    ├── PROFILE/style.css
    └── ...
```

---

## The Sandbox Issue

### Problem

When running `npm run build` directly on the host system:

```bash
cd src/frontend/pages/PROFILE && npm run build
```

You may encounter:

```
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
```

**Cause**: Sandbox restrictions prevent npm/vite from setting up network interfaces.

### Solution

**Always run builds inside the Docker container** where sandbox restrictions don't apply.

---

## Build Commands

### Helper Script (Recommended)

**Location**: `/home/milner/Desktop/rust/build-frontend.sh`

```bash
# Build all pages (production)
./build-frontend.sh all

# Build all pages (development)
./build-frontend.sh all dev

# Build specific page (production)
./build-frontend.sh PROFILE
./build-frontend.sh UPLOADS
./build-frontend.sh GLOBAL

# Build specific page (development)
./build-frontend.sh PROFILE dev
./build-frontend.sh UPLOADS dev
```

**What it does**:
1. Executes `docker compose exec rust` to enter container
2. Changes to page directory
3. Runs `npm run build:prod` or `npm run build:dev`
4. Outputs to `src/resources/`

### Manual Docker Commands

```bash
# Build PROFILE page (production)
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/PROFILE && npm run build:prod"

# Build PROFILE page (development)
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/PROFILE && npm run build:dev"

# Build UPLOADS page
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/UPLOADS && npm run build:prod"

# Build GLOBAL styles
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/GLOBAL && npm run build:prod"
```

### Watch Mode (Development)

For continuous rebuilding during development:

```bash
# Inside Docker container
docker compose exec rust bash

# Navigate to page and start watch mode
cd /home/rust/blazing_sun/src/frontend/pages/PROFILE
npm run dev
```

This watches for file changes and rebuilds automatically.

---

## Vite Configuration

### Standard Configuration

**File**: `vite.config.js` (in each page directory)

```javascript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src'),

  build: {
    outDir: path.resolve(__dirname, '../../resources/js/PROFILE'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'src/main.js')
      },
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return '../css/PROFILE/style.css';
          }
          return '[name].[ext]';
        }
      }
    },

    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    sourcemap: process.env.NODE_ENV !== 'production'
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "${path.resolve(__dirname, 'src/styles/_variables.scss')}";`
      }
    }
  }
});
```

### Key Settings

| Setting | Purpose |
|---------|---------|
| `root` | Source directory (`src/`) |
| `outDir` | Output directory (`../../resources/js/PROFILE/`) |
| `emptyOutDir` | Clear output before build |
| `entryFileNames` | Output JS filename (`app.js`) |
| `assetFileNames` | Output CSS filename (`../css/PROFILE/style.css`) |
| `minify` | Minify in production only |
| `sourcemap` | Generate source maps in dev mode |
| `preprocessorOptions` | SCSS configuration |

---

## Package Configuration

### Standard package.json

**File**: `package.json` (in each page directory)

```json
{
  "name": "profile-page",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "NODE_ENV=development vite build",
    "build:prod": "NODE_ENV=production vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "sass": "^1.69.0"
  }
}
```

### Scripts Explained

| Script | Purpose |
|--------|---------|
| `dev` | Start dev server with HMR |
| `build` | Build (defaults to production) |
| `build:dev` | Build with development mode (sourcemaps, no minify) |
| `build:prod` | Build with production mode (minify, no sourcemaps) |
| `preview` | Preview production build locally |

---

## Development Workflow

### Initial Setup

```bash
# Enter Docker container
docker compose exec rust bash

# Navigate to page
cd /home/rust/blazing_sun/src/frontend/pages/PROFILE

# Install dependencies (first time only)
npm install
```

### Development Cycle

**Option 1: Build on change (Recommended for Claude Code)**

```bash
# From host machine
./build-frontend.sh PROFILE dev

# Make changes to src/PROFILE/src/
# Run build again
./build-frontend.sh PROFILE dev

# Refresh browser
```

**Option 2: Watch mode (Traditional development)**

```bash
# Inside Docker container
cd /home/rust/blazing_sun/src/frontend/pages/PROFILE
npm run dev

# Make changes to src/
# Vite rebuilds automatically
# Refresh browser to see changes
```

### Production Build

```bash
# Build for production (minified, no sourcemaps)
./build-frontend.sh PROFILE

# Or build all pages
./build-frontend.sh all
```

---

## SCSS Structure

### Variables

**File**: `src/styles/_variables.scss` (in each page)

```scss
// Colors
$primary-color: #667eea;
$secondary-color: #764ba2;
$success-color: #10b981;
$error-color: #ef4444;
$warning-color: #f59e0b;

// Spacing
$spacing-1: 0.25rem;
$spacing-2: 0.5rem;
$spacing-3: 0.75rem;
$spacing-4: 1rem;
$spacing-6: 1.5rem;

// Typography
$font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-size-base: 16px;
$font-size-sm: 14px;
$font-size-lg: 18px;

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
```

### Main Stylesheet

**File**: `src/styles/main.scss`

```scss
@import 'variables';
@import 'base';
@import 'components';
@import 'profile';  // Page-specific styles
```

### Component Partials

Create focused partial files for each component:

```scss
// _profile.scss
.profile {
  &__container {
    max-width: 1200px;
    margin: 0 auto;
  }

  &__grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: $spacing-6;

    @media (max-width: $breakpoint-md) {
      grid-template-columns: 1fr;
    }
  }
}

.avatar {
  &__image {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    object-fit: cover;
  }

  &__overlay {
    opacity: 0;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}
```

---

## JavaScript Components

### Component Structure

Each component is an ES6 class:

```javascript
/**
 * ProfilePage Component
 * Manages personal information form
 */
export class ProfilePage {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLFormElement} config.profileForm - Form element
   * @param {HTMLInputElement} config.firstNameInput - First name input
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.form = config.profileForm;
    this.firstNameInput = config.firstNameInput;
    this.showToast = config.showToast;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.firstNameInput.addEventListener('input', () => this.validateForm());
  }

  /**
   * Handle form submission
   * @param {Event} event
   */
  async handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/user/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: this.firstNameInput.value
        })
      });

      if (response.ok) {
        this.showToast('Profile updated successfully', 'success');
      } else {
        this.showToast('Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      this.showToast('Network error', 'error');
    }
  }

  /**
   * Validate form fields
   * @returns {boolean}
   */
  validateForm() {
    const isValid = this.firstNameInput.value.trim().length > 0;
    this.form.querySelector('button[type="submit"]').disabled = !isValid;
    return isValid;
  }
}

export default ProfilePage;
```

### Entry Point

**File**: `src/main.js`

```javascript
import './styles/main.scss';
import { ProfilePage } from './ProfilePage.js';
import { AvatarUpload } from './AvatarUpload.js';
import { PasswordChange } from './PasswordChange.js';

/**
 * Toast notification helper
 */
function showToast(message, type = 'info') {
  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 4000,
      gravity: 'top',
      position: 'right',
      className: `toast-${type}`,
      stopOnFocus: true
    }).showToast();
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Initialize all page components
 */
function initProfilePage() {
  const baseUrl = window.BASE_URL || '';
  const userData = window.USER_DATA || null;

  const profilePage = new ProfilePage({
    baseUrl,
    userData,
    profileForm: document.getElementById('profileForm'),
    firstNameInput: document.getElementById('first_name'),
    showToast
  });

  const avatarUpload = new AvatarUpload({
    baseUrl,
    avatarContainer: document.getElementById('avatarContainer'),
    showToast,
    getAuthToken: () => profilePage.getAuthToken()
  });

  const passwordChange = new PasswordChange({
    baseUrl,
    form: document.getElementById('passwordForm'),
    showToast,
    getAuthToken: () => profilePage.getAuthToken()
  });

  // Make components available globally for debugging
  window.profilePage = profilePage;
  window.avatarUpload = avatarUpload;
  window.passwordChange = passwordChange;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}
```

---

## Adding New Pages

### Step 1: Create Directory Structure

```bash
cd /home/rust/blazing_sun/src/frontend/pages
mkdir -p NEW_PAGE/src/styles
```

### Step 2: Copy Template Files

```bash
# Copy from existing page
cp PROFILE/package.json NEW_PAGE/
cp PROFILE/vite.config.js NEW_PAGE/
```

### Step 3: Update Configuration

**Edit `package.json`**:
```json
{
  "name": "new-page",
  ...
}
```

**Edit `vite.config.js`**:
```javascript
// Change output paths
outDir: path.resolve(__dirname, '../../resources/js/NEW_PAGE'),
assetFileNames: (assetInfo) => {
  if (assetInfo.name.endsWith('.css')) {
    return '../css/NEW_PAGE/style.css';
  }
  ...
}
```

### Step 4: Create Source Files

**`src/main.js`**:
```javascript
import './styles/main.scss';
import { NewPage } from './NewPage.js';

function init() {
  const newPage = new NewPage({
    // config
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

**`src/NewPage.js`**:
```javascript
export class NewPage {
  constructor(config) {
    // initialization
  }
}
```

**`src/styles/main.scss`**:
```scss
@import 'variables';
@import 'new-page';
```

### Step 5: Install Dependencies

```bash
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/NEW_PAGE && npm install"
```

### Step 6: Build

```bash
./build-frontend.sh NEW_PAGE
```

### Step 7: Create Template

**`src/resources/views/web/new_page.html`**:
```html
{% extends "base.html" %}

{% block title %}New Page - {{ app_name }}{% endblock %}

{% block extra_styles_links %}
<link rel="stylesheet" href="/assets/css/NEW_PAGE/style.css?v={{ assets_version }}">
{% endblock %}

{% block content %}
<main class="new-page">
  <!-- Content here -->
</main>
{% endblock %}

{% block scripts %}
<script>
  window.BASE_URL = '{{ base_url | safe }}';
</script>
<script src="/assets/js/NEW_PAGE/app.js?v={{ assets_version }}" defer></script>
{% endblock %}
```

### Step 8: Add Route

**`src/routes/web.rs`**:
```rust
.route("/new-page", web::get().to(pages::new_page))
```

---

## Best Practices

### Component Design

1. **Single Responsibility** - Each component does one thing
2. **Configuration Over Code** - Pass config objects to constructors
3. **Event Delegation** - Use event listeners efficiently
4. **Dependency Injection** - Pass dependencies via config
5. **Clear Documentation** - JSDoc comments for all public methods

### SCSS Organization

1. **Variables First** - Define all variables in `_variables.scss`
2. **Component Isolation** - One partial per component
3. **BEM Naming** - Use Block Element Modifier naming
4. **Mobile First** - Design for mobile, enhance for desktop
5. **Avoid Deep Nesting** - Max 3 levels of nesting

### Performance

1. **Code Splitting** - Each page is its own bundle
2. **Tree Shaking** - Import only what you use
3. **Lazy Loading** - Load images and resources lazily
4. **Minification** - Production builds are minified
5. **Caching** - Use `?v={{ assets_version }}` for cache busting

---

## Troubleshooting

### Build Fails with Sandbox Error

**Error**: `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`

**Solution**: Always build inside Docker:
```bash
./build-frontend.sh PAGE_NAME
```

### Changes Don't Appear

1. **Clear browser cache**: Ctrl+Shift+R (hard refresh)
2. **Verify build completed**: Check `src/resources/` for updated files
3. **Check cache busting**: Verify `?v={{ assets_version }}` in template
4. **Restart Rust container**: `docker compose restart rust`

### npm Command Not Found

**Solution**: Ensure Node.js installed in Rust container:
```bash
docker compose exec rust node --version
docker compose exec rust npm --version
```

If not installed, check `rust/install.dev.sh`.

### SCSS Import Errors

**Error**: `Can't find stylesheet to import`

**Solution**: Check import paths in `vite.config.js`:
```javascript
scss: {
  additionalData: `@import "${path.resolve(__dirname, 'src/styles/_variables.scss')}";`
}
```

### Build Output Missing

**Solution**: Check `vite.config.js` output paths:
```javascript
outDir: path.resolve(__dirname, '../../resources/js/PAGE_NAME'),
assetFileNames: (assetInfo) => {
  if (assetInfo.name.endsWith('.css')) {
    return '../css/PAGE_NAME/style.css';
  }
  ...
}
```

---

## Integration with Backend

### Template Variables

Templates receive these variables from backend:

```rust
let mut context = tera::Context::new();
context.insert("base_url", &env::base_url());
context.insert("app_name", &env::app_name());
context.insert("assets_version", &get_assets_version());
context.insert("user", &user);
```

Access in templates:
```html
<script>
  window.BASE_URL = '{{ base_url | safe }}';
  window.USER_DATA = {
    id: {{ user.id }},
    email: "{{ user.email }}",
    first_name: "{{ user.first_name }}"
  };
</script>
```

### API Communication

All components use `fetch()` with credentials:

```javascript
const response = await fetch(`${this.baseUrl}/api/v1/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',  // Include HttpOnly cookies
  body: JSON.stringify(data)
});
```

---

## Related Documentation

- [Admin Uploads](../AdminUploads/README.md)
- [Profile Page](../ProfilePage/README.md)
- [Backend API](../../blazing_sun/CLAUDE_partials/09-api-endpoints.md)

---

**Last Updated**: 2026-01-02
**Maintainer**: Blazing Sun Development Team
