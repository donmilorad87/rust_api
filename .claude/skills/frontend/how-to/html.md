# HTML/Tera Template Conventions

## Template Engine: Tera

Blazing Sun uses Tera templating engine.

## Base Template Structure

All web templates should extend the base template:

```html
{% extends "web/base.html" %}

{% block title %}Page Title{% endblock %}

{% block content %}
  <!-- Page content here -->
{% endblock %}
```
## Head CSS and JS

- function determine_assets will be used insie of header to determin on what page we are and what assets should be loaded.

## Template Location

- Web pages: `blazing_sun/src/resources/views/web/`
- Email templates: `blazing_sun/src/resources/views/emails/`

## Tera Syntax Quick Reference

```html
<!-- Variables -->
{{ variable }}
{{ user.name }}

<!-- Conditionals -->
{% if condition %}
  ...
{% elif other_condition %}
  ...
{% else %}
  ...
{% endif %}

<!-- Loops -->
{% for item in items %}
  {{ item.name }}
{% endfor %}

<!-- Include partial -->
{% include "partials/header.html" %}

<!-- Filters -->
{{ text | upper }}
{{ number | round }}
{{ date | date(format="%Y-%m-%d") }}
```

## HTML5 Best Practices

1. Use semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
2. Include proper meta tags for responsive design
3. Use proper heading hierarchy (h1 > h2 > h3)
4. Include alt text for images
5. Use form labels properly

## Example Template

```html
{% extends "web/base.html" %}

{% block title %}Dashboard{% endblock %}

{% block content %}
<main class="container">
  <header>
    <h1>Welcome, {{ user.first_name }}</h1>
  </header>

  <section class="stats">
    {% for stat in stats %}
    <div class="stat-card">
      <h3>{{ stat.label }}</h3>
      <p>{{ stat.value }}</p>
    </div>
    {% endfor %}
  </section>
</main>
{% endblock %}
```