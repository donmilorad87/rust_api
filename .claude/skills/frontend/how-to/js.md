# JavaScript Conventions

## Architecture Plan

### 1) One Vite Project Per Page

Each page will have its own independent **Vite project**.

- The page HTML will be rendered using **server-side rendering (SSR)**.
- Once the page is fully loaded, a **deferred script** will initialize the page's corresponding ES6 class.
- Some pages may include multiple ES6 classes, where a **main class** composes and initializes additional classes.

This approach ensures that each page loads only the JavaScript it actually needs.

---

## File Location

JavaScript files go in: `blazing_sun/src/frontend/pages/{PAGE_NAME}/js/app.js`

Served at URL: `/assets/js/`

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

## ES6 Classes Pattern

Use ES6 classes for organizing code:

```javascript
class ComponentName {
  constructor(selector, options = {}) {
    this.element = document.querySelector(selector);
    this.options = { ...this.defaults, ...options };

    if (!this.element) return;

    this.init();
  }

  get defaults() {
    return {
      // Default options
    };
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    this.element.addEventListener('click', this.handleClick.bind(this));
  }

  handleClick(event) {
    // Handle click
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ComponentName('#my-component');
});
```

## API Calls

Use fetch with async/await:

```javascript
class ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async handleResponse(response) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }
}
```

## Best Practices

1. Use `const` by default, `let` when reassignment needed
2. Use arrow functions for callbacks
3. Use template literals for string interpolation
4. Handle errors with try/catch
5. Avoid global variables - use modules or classes
6. Use meaningful variable/function names
7. Keep functions small and focused