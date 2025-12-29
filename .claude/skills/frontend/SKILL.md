---
name: frontend
description: HTML/CSS/JavaScript and Tera template development. Use for web pages, styling, and frontend functionality. (project)
invocable: true
---

# Frontend Development Skill

You are a frontend development subagent for the Money Flow Rust project. Your role is to create and maintain HTML templates, CSS styles, and JavaScript functionality.

## Project Context

**Always read these files before starting work:**
- @money_flow/CLAUDE.md - Application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Templates** | `money_flow/Templates/TEMPLATES.md` | Tera templates, base layouts, partials |
| **Web Routes** | `money_flow/Routes/Web/WEB_ROUTES.md` | Web page routes, named routes |
| **Uploads** | `money_flow/Uploads/UPLOADS.md` | File upload UI, displaying images |
| **Bootstrap** | `money_flow/Bootstrap/BOOTSTRAP.md` | Template utilities, asset versioning |
| **Email** | `money_flow/Email/EMAIL.md` | Email template design |

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
| HTML Templates | `money_flow/src/resources/views/web/` | Tera templates for web pages |
| CSS Styles | `money_flow/src/resources/css/` | Stylesheets served at `/assets/css/` |
| JavaScript | `money_flow/src/resources/js/` | Scripts served at `/assets/js/` |
| Email Templates | `money_flow/src/resources/views/emails/` | Tera templates for emails |

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

## Folder Structure

All Vite projects will live under: money_flow/src/frontend


Create the following structure:
money_flow/src/frontend/
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

Each page's Vite project (`money_flow/src/frontend/pages/{PAGE_NAME}/`) must contain:

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
cd /home/milner/Desktop/rust/money_flow/src/frontend/pages/{PAGE_NAME}
echo -e "# Dependencies\nnode_modules/\n\n# Build cache\n.vite/" > .gitignore
```

## Build Output Targets

### CSS Output

**Vite project location:**

money_flow/src/frontend/pages/SIGN_UP


**Output compiled and minified CSS to:**

/home/milner/Desktop/rust/money_flow/src/resources/css/SIGN_UP/style.css

Vite should support two configurations:

- **Development build**
  - Source maps enabled
  - Non-minified output
- **Production build**
  - Minified output
  - No source maps

### JavaScript Output

**Vite project location:**

money_flow/src/frontend/pages/SIGN_UP

**Output compiled and minified JavaScript to:**

/home/milner/Desktop/rust/money_flow/src/resources/js/SIGN_UP/app.js


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

{% block title %}Page Title - MoneyFlow{% endblock %}

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

Templates are in: `money_flow/src/resources/views/web/{page_name}.html`

---

## Complete Vite Project Workflow

**Follow these steps IN ORDER when creating a new page's Vite project:**

1. **Create Vite project folder**: `money_flow/src/frontend/pages/{PAGE_NAME}/`
2. **Create package.json** with vite, sass dependencies
3. **Create vite.config.js** with dev/prod build configs
4. **Create .gitignore** for node_modules
5. **Create SCSS structure** in `src/styles/`
6. **Create JavaScript structure** in `src/`
7. **Run `npm install`**
8. **Run `npm run build`**
9. **Increment `ASSETS_VERSION`** in `money_flow/.env`
10. **Update Tera template** to include new CSS/JS assets

**WARNING**: Skipping step 10 means the page will not load the new assets!

---

## Detailed instructions to claude

- we create vite project for each page. vite project will build css from scss and it will build javascript from javscript classes.

1. go inside of /money_flow/src/frontend/pages and create /money_flow/src/frontend/pages/{NAME_OF_PAGE}
2. create vite project
3. create scss folder and js folder inside of vtte root folder
4. add production and development configuration for the vite. development will create source maps and non minified code, and production will create minified code without source maps, both for js and css.
5. css will be created from utility classes like class="df aic jcc". beside utility classes there will be BEM metotologiy for the comoponents. if something is complex to be writen in utility classes and have lot of states, then we will use BEM for it. creat app.scss and include all files inside of it.
6. create app.js inside of js folder of vite and import all other classes needed for the page inside of it. every page will have app.js and that class will only instaniate other classes on that page. app.js is just starting point.
7. once css and js are done then you need to output to: /home/milner/Desktop/rust/money_flow/src/resources/css/pages/{NAME_OF_PAGE}/style.css and for js /home/milner/Desktop/rust/money_flow/src/resources/js/pages/{NAME_OF_PAGE}/app.js
8. why we are using vite project for just one page, or for all pages? why every page have different vite project? because we will have only css for that page, and only js for that page. First time we will load assets when user land on page, assets will be cachet to browser and page will be optimized, it will use only needed css and only neede js.

- when we have created asstes then rust function determine_assets will load assets inside of head tag on templates. function determine_assets should be included in head and determine_assets should check on what route we are and based on route function will know {NAME_OF_PAGE} and include right assets.