/**
 * CSRF Token Utility
 * Provides utilities for retrieving and managing CSRF tokens for API requests.
 */

/**
 * Get the CSRF token from the page meta tag
 * @returns {string|null} - The CSRF token or null if not found
 */
export function getCsrfToken() {
  // Get token from meta tag in <head>
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute('content');
  }

  console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.');
  return null;
}

/**
 * Get headers object with CSRF token included
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} - Headers object with CSRF token
 */
export function getCsrfHeaders(additionalHeaders = {}) {
  const token = getCsrfToken();
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  };

  if (token) {
    headers['X-CSRF-TOKEN'] = token;
  }

  return headers;
}

export default { getCsrfToken, getCsrfHeaders };
