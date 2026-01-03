# Theme Configuration System

The admin theme system (`/admin/theme`) provides a comprehensive interface for managing site appearance and SEO.

## Access Requirements

- **URL**: `/admin/theme`
- **Permission**: Admin (level >= 10)
- **Authentication**: JWT required

## Tab Overview

| Tab | Purpose | Triggers Rebuild |
|-----|---------|------------------|
| Branding | Logo, favicon, site name, identity colors | Yes (if colors change) |
| Colors | Light/dark theme color palettes | Yes |
| Typography | Fonts, sizes, weights, line heights | Yes |
| Spacing | Margins, padding, border radii | Yes |
| SEO | Meta tags, schemas, hreflang | No |

## Architecture

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
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `site_config` | Global theme settings (single row) |
| `page_seo` | Per-page SEO configuration |
| `page_schemas` | Schema.org structured data |
| `page_hreflangs` | Language targeting (placeholder) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/theme` | Get theme config |
| PUT | `/api/v1/admin/theme` | Update theme + rebuild |
| PUT | `/api/v1/admin/theme/branding` | Update branding |
| POST | `/api/v1/admin/theme/build` | Manual rebuild |
| GET | `/api/v1/admin/theme/build/status` | Build status |
| GET | `/api/v1/admin/seo` | List all page SEO |
| GET | `/api/v1/admin/seo/{route_name}` | Get page SEO |
| PUT | `/api/v1/admin/seo/{route_name}` | Update page SEO |
| GET | `/api/v1/admin/seo/page/{id}/schemas` | List schemas |
| POST | `/api/v1/admin/seo/page/{id}/schemas` | Create schema |
| PUT | `/api/v1/admin/seo/schema/{id}` | Update schema |
| DELETE | `/api/v1/admin/seo/schema/{id}` | Delete schema |

## Build Process

When theme changes are saved:

1. **Database Update**: New values stored in `site_config`
2. **SCSS Generation**: `_variables.scss` updated with new values
3. **Vite Build**: All 8 frontend projects rebuilt
4. **Asset Copy**: Built CSS/JS copied to `resources/`
5. **Version Bump**: `assets_version` incremented
6. **Cache Invalidation**: Browsers fetch new assets

## Frontend Projects

```
src/frontend/pages/
├── GLOBAL/           # Base styles, navbar, theme variables
├── SIGN_IN/          # Sign in page styles
├── SIGN_UP/          # Sign up page styles
├── FORGOT_PASSWORD/  # Forgot password styles
├── PROFILE/          # Profile page styles
├── REGISTERED_USERS/ # Admin users page styles
├── UPLOADS/          # Admin uploads page styles
└── THEME/            # Admin theme page styles
```

## Related Documentation

- [Branding Configuration](./BRANDING.md)
- [Colors Configuration](./COLORS.md)
- [Typography Configuration](./TYPOGRAPHY.md)
- [Spacing Configuration](./SPACING.md)
- [SEO Configuration](./SEO.md)
