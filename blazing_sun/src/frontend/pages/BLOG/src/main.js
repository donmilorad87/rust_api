/**
 * BLOG - Shared Blog Styles
 *
 * This module provides shared CSS styles for all blog pages.
 * Individual blog page JS functionality is provided by page-specific bundles.
 */

// Import shared blog styles
import './styles/main.scss';

// Blog utility functions (shared across all blog pages)
export class BlogUtils {
  /**
   * Format a date string for display
   * @param {string} dateStr - ISO date string
   * @param {string} locale - Locale for formatting
   * @returns {string} Formatted date
   */
  static formatDate(dateStr, locale = 'en-US') {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Calculate read time for content
   * @param {string} content - HTML or text content
   * @param {number} wordsPerMinute - Reading speed
   * @returns {number} Minutes to read
   */
  static calculateReadTime(content, wordsPerMinute = 200) {
    const text = content.replace(/<[^>]*>/g, '');
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Truncate text to a maximum length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text with ellipsis
   */
  static truncate(text, maxLength = 150) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Create a slug from a string
   * @param {string} str - String to slugify
   * @returns {string} URL-safe slug
   */
  static slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Debounce a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  static debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Export for global use
window.BlogUtils = BlogUtils;

console.log('[BLOG] Shared styles and utilities loaded');
