# Branding Configuration

The Branding tab manages your site's visual identity including logo, favicon, site name, and brand colors.

## Settings

### Site Name

| Field | Type | Description |
|-------|------|-------------|
| Site Name | Text | Display name shown in navbar and page titles |
| Show Site Name | Toggle | Whether to display site name in navbar |

**Usage in templates:**
```html
{{ site_name }}         {# "Blazing Sun" #}
{{ show_site_name }}    {# true/false #}
```

### Logo

| Field | Type | Description |
|-------|------|-------------|
| Logo | File Upload | PNG, JPG, SVG, WebP supported |
| Max Size | - | 10MB |

**Upload Process:**
1. Click "Upload Logo" button
2. Select image file
3. File is uploaded to public storage
4. UUID stored in `site_config.logo_uuid`
5. Displayed in navbar automatically

**Usage in templates:**
```html
{% if logo_stored_name %}
<img src="{{ assets(name=logo_stored_name, visibility='public') }}" alt="{{ site_name }}">
{% endif %}
```

### Favicon

| Field | Type | Description |
|-------|------|-------------|
| Favicon | File Upload | ICO, PNG, SVG supported |
| Max Size | - | 1MB |

**Template rendering (base.html):**
```html
{% if favicon_stored_name %}
<link rel="icon" href="{{ assets(name=favicon_stored_name, visibility='public') }}">
{% else %}
<link rel="icon" href="data:image/svg+xml,...">  {# Default SVG favicon #}
{% endif %}
```

### Identity Colors

Gradient colors used for site branding (buttons, links, navbar accents):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Identity Color Start | Color Picker | #667eea | Gradient start color |
| Identity Color End | Color Picker | #764ba2 | Gradient end color |

**SCSS Variables Generated:**
```scss
$identity-color-start: #667eea;
$identity-color-end: #764ba2;
$identity-gradient: linear-gradient(135deg, $identity-color-start 0%, $identity-color-end 100%);
```

**Triggers Rebuild:** Yes (when colors change)

### Identity Size

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Identity Size | Size Picker | 1.375rem | Size of logo/text in navbar |

**SCSS Variable:**
```scss
$identity-size: 1.375rem;
```

## Database Storage

All branding settings are stored in the `site_config` table:

| Column | Type | Description |
|--------|------|-------------|
| site_name | VARCHAR | Site display name |
| show_site_name | BOOLEAN | Show name in navbar |
| logo_uuid | UUID | FK to uploads table |
| favicon_uuid | UUID | FK to uploads table |
| identity_color_start | VARCHAR | Hex color code |
| identity_color_end | VARCHAR | Hex color code |
| identity_size | VARCHAR | CSS size value |

## API Endpoints

### Update Branding

```http
PUT /api/v1/admin/theme/branding
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "site_name": "My Site",
  "show_site_name": true,
  "identity_color_start": "#3498db",
  "identity_color_end": "#9b59b6",
  "identity_size": "1.5rem",
  "logo_uuid": "abc123-...",
  "favicon_uuid": "def456-..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Branding saved and theme rebuilt successfully",
  "new_version": "1.0.028"
}
```

### Remove Logo/Favicon

Send empty string to remove:
```json
{
  "logo_uuid": "",
  "favicon_uuid": ""
}
```

## Template Context Variables

Variables available in all Tera templates after `add_branding_to_context()`:

| Variable | Type | Description |
|----------|------|-------------|
| `site_name` | String | Site display name |
| `show_site_name` | Boolean | Show name flag |
| `logo_stored_name` | String? | Logo filename for assets() |
| `favicon_stored_name` | String? | Favicon filename for assets() |
| `identity_color_start` | String | Gradient start color |
| `identity_color_end` | String | Gradient end color |
| `identity_size` | String | Size in rem |

## Example: Custom Navbar

```html
<nav class="navbar">
  <a href="/" class="brand">
    {% if logo_stored_name %}
      <img
        src="{{ assets(name=logo_stored_name, visibility='public') }}"
        alt="{{ site_name }}"
        style="height: {{ identity_size }};"
      >
    {% endif %}
    {% if show_site_name %}
      <span
        class="site-name"
        style="background: linear-gradient(135deg, {{ identity_color_start }}, {{ identity_color_end }}); -webkit-background-clip: text; color: transparent;"
      >
        {{ site_name }}
      </span>
    {% endif %}
  </a>
</nav>
```

## Best Practices

1. **Logo Format**: Use SVG for best quality at all sizes
2. **Favicon**: Provide both ICO and PNG for broad browser support
3. **Color Contrast**: Ensure identity colors have good contrast with backgrounds
4. **Mobile**: Test logo visibility on mobile viewports
5. **Performance**: Optimize logo file size (compress images)
