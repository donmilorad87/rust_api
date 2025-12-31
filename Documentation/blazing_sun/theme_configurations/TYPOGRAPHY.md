# Typography Configuration

The Typography tab manages fonts, sizes, weights, and line heights across the application.

## Typography Categories

### Font Families

| Variable | Default | Description |
|----------|---------|-------------|
| `$font-family-base` | system-ui, -apple-system, sans-serif | Body text |
| `$font-family-heading` | inherit | Headings (h1-h6) |
| `$font-family-mono` | ui-monospace, monospace | Code blocks |

### Font Sizes

Scale based on 1rem = 16px:

| Variable | Default | Pixels | Usage |
|----------|---------|--------|-------|
| `$font-size-xs` | 0.75rem | 12px | Small labels, captions |
| `$font-size-sm` | 0.875rem | 14px | Secondary text |
| `$font-size-base` | 1rem | 16px | Body text |
| `$font-size-md` | 1.125rem | 18px | Emphasized text |
| `$font-size-lg` | 1.25rem | 20px | Large text |
| `$font-size-xl` | 1.5rem | 24px | Section headers |
| `$font-size-2xl` | 2rem | 32px | Page titles |

### Heading Sizes

| Variable | Default | Pixels | Element |
|----------|---------|--------|---------|
| `$font-size-h1` | 2.5rem | 40px | `<h1>` |
| `$font-size-h2` | 2rem | 32px | `<h2>` |
| `$font-size-h3` | 1.75rem | 28px | `<h3>` |
| `$font-size-h4` | 1.5rem | 24px | `<h4>` |
| `$font-size-h5` | 1.25rem | 20px | `<h5>` |
| `$font-size-h6` | 1rem | 16px | `<h6>` |

### Font Weights

| Variable | Default | Usage |
|----------|---------|-------|
| `$font-weight-light` | 300 | Light emphasis |
| `$font-weight-normal` | 400 | Body text |
| `$font-weight-medium` | 500 | Medium emphasis |
| `$font-weight-semibold` | 600 | Strong emphasis |
| `$font-weight-bold` | 700 | Bold text, headings |

### Line Heights

| Variable | Default | Usage |
|----------|---------|-------|
| `$line-height-tight` | 1.25 | Headings, compact text |
| `$line-height-base` | 1.5 | Body text |
| `$line-height-loose` | 1.75 | Readable paragraphs |

### Letter Spacing

| Variable | Default | Usage |
|----------|---------|-------|
| `$letter-spacing-tight` | -0.025em | Tight headlines |
| `$letter-spacing-normal` | 0 | Normal text |
| `$letter-spacing-wide` | 0.025em | Spaced text |

## Admin UI

The Typography tab displays:

1. **Font Family Selectors**: Dropdowns for each font family
2. **Font Size Scale**: Visual scale with rem/px values
3. **Weight Pickers**: Numeric weight selectors
4. **Line Height Sliders**: Visual line height adjustment
5. **Preview Panel**: Live preview of changes

## Database Storage

Typography settings stored in `site_config.scss_variables` JSONB:

```json
{
  "font_family_base": "system-ui, -apple-system, sans-serif",
  "font_family_heading": "inherit",
  "font_family_mono": "ui-monospace, monospace",
  "font_size_xs": "0.75rem",
  "font_size_sm": "0.875rem",
  "font_size_base": "1rem",
  "font_size_md": "1.125rem",
  "font_size_lg": "1.25rem",
  "font_size_xl": "1.5rem",
  "font_size_2xl": "2rem",
  "font_size_h1": "2.5rem",
  "font_size_h2": "2rem",
  "font_size_h3": "1.75rem",
  "font_size_h4": "1.5rem",
  "font_size_h5": "1.25rem",
  "font_size_h6": "1rem",
  "font_weight_light": "300",
  "font_weight_normal": "400",
  "font_weight_medium": "500",
  "font_weight_semibold": "600",
  "font_weight_bold": "700",
  "line_height_tight": "1.25",
  "line_height_base": "1.5",
  "line_height_loose": "1.75",
  "letter_spacing_tight": "-0.025em",
  "letter_spacing_normal": "0",
  "letter_spacing_wide": "0.025em"
}
```

## SCSS Generation

When saved, `_variables.scss` is updated:

```scss
// Font Families
$font-family-base: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
$font-family-heading: inherit;
$font-family-mono: ui-monospace, SFMono-Regular, "SF Mono", monospace;

// Font Sizes
$font-size-xs: 0.75rem;
$font-size-sm: 0.875rem;
$font-size-base: 1rem;
$font-size-md: 1.125rem;
$font-size-lg: 1.25rem;
$font-size-xl: 1.5rem;
$font-size-2xl: 2rem;

// Heading Sizes
$font-size-h1: 2.5rem;
$font-size-h2: 2rem;
$font-size-h3: 1.75rem;
$font-size-h4: 1.5rem;
$font-size-h5: 1.25rem;
$font-size-h6: 1rem;

// Font Weights
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// Line Heights
$line-height-tight: 1.25;
$line-height-base: 1.5;
$line-height-loose: 1.75;

// Letter Spacing
$letter-spacing-tight: -0.025em;
$letter-spacing-normal: 0;
$letter-spacing-wide: 0.025em;
```

## API Endpoint

```http
PUT /api/v1/admin/theme
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "scss_variables": {
    "font_size_base": "1rem",
    "font_size_h1": "2.5rem",
    "font_weight_bold": "700",
    "line_height_base": "1.6"
  }
}
```

## Using Typography in SCSS

```scss
// Body text
body {
  font-family: $font-family-base;
  font-size: $font-size-base;
  font-weight: $font-weight-normal;
  line-height: $line-height-base;
}

// Headings
h1 {
  font-family: $font-family-heading;
  font-size: $font-size-h1;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  letter-spacing: $letter-spacing-tight;
}

// Small text
.text-small {
  font-size: $font-size-sm;
  color: var(--text-secondary);
}

// Code blocks
code, pre {
  font-family: $font-family-mono;
  font-size: $font-size-sm;
}
```

## Responsive Typography

Use relative units for responsive scaling:

```scss
// Base size increases on larger screens
html {
  font-size: 14px;  // Mobile

  @media (min-width: 768px) {
    font-size: 15px;  // Tablet
  }

  @media (min-width: 1024px) {
    font-size: 16px;  // Desktop
  }
}

// All rem values scale automatically
h1 {
  font-size: $font-size-h1;  // 2.5rem = 35px on mobile, 40px on desktop
}
```

## Best Practices

1. **Readability**: Use 1.5-1.75 line height for body text
2. **Hierarchy**: Maintain clear size distinction between headings
3. **Consistency**: Use variables, not hardcoded values
4. **Accessibility**: Minimum 16px for body text
5. **Performance**: Limit custom fonts (web fonts add load time)
6. **Fallbacks**: Always include system font fallbacks
7. **Mobile**: Test readability on small screens
