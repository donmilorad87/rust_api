# Spacing Configuration

The Spacing tab manages margins, padding, and border radii throughout the application.

## Spacing Scale

Consistent spacing scale based on 4px increments:

| Variable | Default | Pixels | Usage |
|----------|---------|--------|-------|
| `$spacing-xs` | 0.25rem | 4px | Tight spacing |
| `$spacing-sm` | 0.5rem | 8px | Small gaps |
| `$spacing-base` | 1rem | 16px | Default spacing |
| `$spacing-md` | 1.5rem | 24px | Medium gaps |
| `$spacing-lg` | 2rem | 32px | Large spacing |
| `$spacing-xl` | 3rem | 48px | Extra large |
| `$spacing-2xl` | 4rem | 64px | Section spacing |
| `$spacing-3xl` | 6rem | 96px | Major sections |

## Component Padding

Specific padding values for common components:

| Variable | Default | Usage |
|----------|---------|-------|
| `$btn-padding-y` | 0.75rem | Button vertical padding |
| `$btn-padding-x` | 1rem | Button horizontal padding |
| `$input-padding-y` | 0.75rem | Input vertical padding |
| `$input-padding-x` | 1rem | Input horizontal padding |
| `$card-padding` | 2rem | Card content padding |

## Border Radii

| Variable | Default | Usage |
|----------|---------|-------|
| `$border-radius-sm` | 0.25rem | Small elements (badges) |
| `$border-radius-md` | 0.5rem | Medium elements (buttons) |
| `$border-radius-lg` | 0.75rem | Large elements (cards) |
| `$border-radius-xl` | 1rem | Extra large elements |
| `$border-radius-full` | 9999px | Fully rounded (pills, avatars) |

## Admin UI

The Spacing tab displays:

1. **Spacing Scale**: Visual representation of spacing values
2. **Component Padding**: Input fields for button/input/card padding
3. **Border Radius**: Sliders with visual preview
4. **Preview Panel**: Live preview of changes

## Database Storage

Spacing settings stored in `site_config.scss_variables` JSONB:

```json
{
  "spacing_xs": "0.25rem",
  "spacing_sm": "0.5rem",
  "spacing_base": "1rem",
  "spacing_md": "1.5rem",
  "spacing_lg": "2rem",
  "spacing_xl": "3rem",
  "spacing_2xl": "4rem",
  "spacing_3xl": "6rem",
  "btn_padding_y": "0.75rem",
  "btn_padding_x": "1rem",
  "input_padding_y": "0.75rem",
  "input_padding_x": "1rem",
  "card_padding": "2rem",
  "border_radius_sm": "0.25rem",
  "border_radius_md": "0.5rem",
  "border_radius_lg": "0.75rem",
  "border_radius_xl": "1rem",
  "border_radius_full": "9999px"
}
```

## SCSS Generation

When saved, `_variables.scss` is updated:

```scss
// Spacing Scale
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-base: 1rem;
$spacing-md: 1.5rem;
$spacing-lg: 2rem;
$spacing-xl: 3rem;
$spacing-2xl: 4rem;
$spacing-3xl: 6rem;

// Component Padding
$btn-padding-y: 0.75rem;
$btn-padding-x: 1rem;
$input-padding-y: 0.75rem;
$input-padding-x: 1rem;
$card-padding: 2rem;

// Border Radii
$border-radius-sm: 0.25rem;
$border-radius-md: 0.5rem;
$border-radius-lg: 0.75rem;
$border-radius-xl: 1rem;
$border-radius-full: 9999px;
```

## API Endpoint

```http
PUT /api/v1/admin/theme
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "scss_variables": {
    "spacing_base": "1rem",
    "spacing_lg": "2rem",
    "btn_padding_y": "0.75rem",
    "btn_padding_x": "1.25rem",
    "border_radius_md": "0.5rem"
  }
}
```

## Using Spacing in SCSS

### Margins and Padding

```scss
// Using spacing scale
.container {
  padding: $spacing-lg;
  margin-bottom: $spacing-xl;
}

.card {
  padding: $card-padding;
  margin-bottom: $spacing-md;
}

// Utility classes
.mt-sm { margin-top: $spacing-sm; }
.mt-base { margin-top: $spacing-base; }
.mt-md { margin-top: $spacing-md; }
.mt-lg { margin-top: $spacing-lg; }

.p-sm { padding: $spacing-sm; }
.p-base { padding: $spacing-base; }
.p-md { padding: $spacing-md; }
.p-lg { padding: $spacing-lg; }
```

### Border Radii

```scss
// Buttons
.btn {
  padding: $btn-padding-y $btn-padding-x;
  border-radius: $border-radius-md;
}

// Cards
.card {
  border-radius: $border-radius-lg;
}

// Inputs
.form-input {
  padding: $input-padding-y $input-padding-x;
  border-radius: $border-radius-md;
}

// Avatars (fully rounded)
.avatar {
  border-radius: $border-radius-full;
}

// Badges
.badge {
  padding: $spacing-xs $spacing-sm;
  border-radius: $border-radius-sm;
}
```

### Layout Gaps

```scss
// Flexbox gaps
.flex-row {
  display: flex;
  gap: $spacing-base;
}

.flex-col {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

// Grid gaps
.grid {
  display: grid;
  gap: $spacing-lg;
}
```

### Section Spacing

```scss
// Page sections
.section {
  padding: $spacing-2xl 0;
}

.hero {
  padding: $spacing-3xl $spacing-lg;
}

// Content areas
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 $spacing-base;

  @media (min-width: 768px) {
    padding: 0 $spacing-lg;
  }
}
```

## Responsive Spacing

```scss
// Smaller spacing on mobile
.card {
  padding: $spacing-base;

  @media (min-width: 768px) {
    padding: $card-padding;
  }
}

// Tighter gaps on mobile
.grid {
  gap: $spacing-sm;

  @media (min-width: 768px) {
    gap: $spacing-lg;
  }
}
```

## Best Practices

1. **Consistency**: Always use spacing variables, never hardcoded values
2. **Scale**: Stick to the defined scale for visual harmony
3. **Rhythm**: Use consistent spacing between similar elements
4. **Breathing Room**: Don't cram elements too tightly
5. **Mobile First**: Start with smaller spacing, increase for larger screens
6. **Touch Targets**: Ensure buttons have at least 44px touch area
7. **Whitespace**: Use generous spacing for readability
