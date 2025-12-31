# Colors Configuration

The Colors tab manages light and dark theme color palettes for the entire application.

## Theme System

The application supports two themes:
- **Light Theme**: Default, bright backgrounds with dark text
- **Dark Theme**: Dark backgrounds with light text

Theme is stored in a cookie (`blazing_sun_theme`) and applied via `data-theme` attribute on `<html>`.

## Color Categories

### Background Colors

| Variable | Light Default | Dark Default | Usage |
|----------|---------------|--------------|-------|
| `--bg-primary` | #ffffff | #1a1a2e | Main page background |
| `--bg-secondary` | #f8f9fa | #16213e | Secondary sections |
| `--bg-tertiary` | #e9ecef | #0f3460 | Tertiary areas |

### Text Colors

| Variable | Light Default | Dark Default | Usage |
|----------|---------------|--------------|-------|
| `--text-primary` | #212529 | #e4e6ea | Main text |
| `--text-secondary` | #6c757d | #a8a8a8 | Secondary text |
| `--text-muted` | #adb5bd | #6c757d | Muted/placeholder text |

### Component Colors

| Variable | Light Default | Dark Default | Usage |
|----------|---------------|--------------|-------|
| `--card-bg` | #ffffff | #16213e | Card backgrounds |
| `--card-shadow` | rgba(0,0,0,0.1) | rgba(0,0,0,0.3) | Card shadows |
| `--input-bg` | #ffffff | #1a1a2e | Input backgrounds |
| `--input-border` | #dee2e6 | #2a2a4a | Input borders |

### Link Colors

| Variable | Light Default | Dark Default | Usage |
|----------|---------------|--------------|-------|
| `--link-color` | #667eea | #8b9cff | Link text |
| `--link-hover` | #5a6fd6 | #a0b0ff | Link hover state |

### Feature Card Colors

| Variable | Light Default | Dark Default | Usage |
|----------|---------------|--------------|-------|
| `--feature-card-bg` | rgba(255,255,255,0.9) | rgba(22,33,62,0.9) | Feature card background |
| `--feature-card-shadow` | rgba(0,0,0,0.1) | rgba(0,0,0,0.3) | Feature card shadow |

## Admin UI

The Colors tab displays color pickers organized in two columns:
- **Left Column**: Light theme colors
- **Right Column**: Dark theme colors

Each color picker shows:
- Color swatch preview
- Hex value input
- Color picker dropdown

## Database Storage

Colors are stored as JSONB in `site_config`:

```sql
-- theme_light column
{
  "bg_primary": "#ffffff",
  "bg_secondary": "#f8f9fa",
  "text_primary": "#212529",
  "text_secondary": "#6c757d",
  "link_color": "#667eea",
  "card_bg": "#ffffff",
  "input_bg": "#ffffff",
  "input_border": "#dee2e6"
}

-- theme_dark column
{
  "bg_primary": "#1a1a2e",
  "bg_secondary": "#16213e",
  "text_primary": "#e4e6ea",
  "text_secondary": "#a8a8a8",
  "link_color": "#8b9cff",
  "card_bg": "#16213e",
  "input_bg": "#1a1a2e",
  "input_border": "#2a2a4a"
}
```

## SCSS Generation

When colors are saved, `_variables.scss` is updated:

```scss
// Light theme
$light-bg-primary: #ffffff;
$light-bg-secondary: #f8f9fa;
$light-text-primary: #212529;
$light-text-secondary: #6c757d;
$light-link-color: #667eea;
$light-card-bg: #ffffff;
$light-input-bg: #ffffff;
$light-input-border: #dee2e6;

// Dark theme
$dark-bg-primary: #1a1a2e;
$dark-bg-secondary: #16213e;
$dark-text-primary: #e4e6ea;
$dark-text-secondary: #a8a8a8;
$dark-link-color: #8b9cff;
$dark-card-bg: #16213e;
$dark-input-bg: #1a1a2e;
$dark-input-border: #2a2a4a;
```

## CSS Custom Properties

The SCSS compiles to CSS custom properties:

```css
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --link-color: #667eea;
  --card-bg: #ffffff;
  --input-bg: #ffffff;
  --input-border: #dee2e6;
}

[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --text-primary: #e4e6ea;
  --text-secondary: #a8a8a8;
  --link-color: #8b9cff;
  --card-bg: #16213e;
  --input-bg: #1a1a2e;
  --input-border: #2a2a4a;
}
```

## API Endpoint

```http
PUT /api/v1/admin/theme
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "theme_light": {
    "bg_primary": "#ffffff",
    "bg_secondary": "#f5f5f5",
    "text_primary": "#333333",
    "link_color": "#0066cc"
  },
  "theme_dark": {
    "bg_primary": "#121212",
    "bg_secondary": "#1e1e1e",
    "text_primary": "#ffffff",
    "link_color": "#66b3ff"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Theme updated and built successfully",
  "new_version": "1.0.029"
}
```

## Theme Switching

### JavaScript (ThemeManager)

```javascript
class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || 'light';
    this.applyTheme();
  }

  getStoredTheme() {
    return document.cookie.match(/blazing_sun_theme=(\w+)/)?.[1];
  }

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.cookie = `blazing_sun_theme=${theme};path=/;max-age=31536000`;
  }

  toggle() {
    this.setTheme(this.theme === 'light' ? 'dark' : 'light');
  }
}
```

### Server-Side Rendering

Theme is read from cookie in `PagesController`:

```rust
fn get_theme(req: &HttpRequest) -> String {
    req.cookie("blazing_sun_theme")
        .map(|c| c.value().to_string())
        .filter(|v| v == "dark" || v == "light")
        .unwrap_or_else(|| "light".to_string())
}
```

Template receives theme value:
```html
<html data-theme="{% if theme == "dark" %}dark{% else %}light{% endif %}">
```

## Using Colors in CSS

Always use CSS custom properties:

```scss
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--input-border);
}

.my-link {
  color: var(--link-color);

  &:hover {
    color: var(--link-hover);
  }
}

.my-card {
  background: var(--card-bg);
  box-shadow: 0 4px 6px var(--card-shadow);
}
```

## Best Practices

1. **Contrast**: Ensure WCAG AA contrast ratios (4.5:1 for text)
2. **Consistency**: Use the same color for similar elements
3. **Accessibility**: Test with color blindness simulators
4. **Preview**: Use the live preview before saving
5. **Backup**: Note current colors before major changes
