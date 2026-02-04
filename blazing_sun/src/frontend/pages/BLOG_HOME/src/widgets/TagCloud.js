/**
 * TagCloud Component
 *
 * Displays tags with weighted font sizes based on post count.
 * Larger font = more posts with that tag.
 *
 * @example
 * const tagCloud = new TagCloud(document.getElementById('tagCloud'), {
 *   tags: [{ id: 1, name: 'JavaScript', slug: 'javascript', post_count: 42 }],
 *   baseUrl: '',
 *   onTagClick: (tag) => console.log('Clicked:', tag)
 * });
 */
export class TagCloud {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @param {Array} options.tags - Array of tag objects with name, slug, post_count
   * @param {string} options.baseUrl - Base URL for tag links
   * @param {Function} options.onTagClick - Optional callback when tag is clicked
   */
  constructor(container, options = {}) {
    if (!container) {
      console.error('TagCloud: Container element required');
      return;
    }

    this.container = container;
    this.tags = options.tags || [];
    this.baseUrl = options.baseUrl || '';
    this.onTagClick = options.onTagClick || null;

    // Size classes based on weight
    this.sizeClasses = ['xs', 'sm', 'md', 'lg', 'xl'];

    this.render();
  }

  /**
   * Calculate size class based on post count
   * @param {number} count - Post count for tag
   * @param {number} minCount - Minimum post count across all tags
   * @param {number} maxCount - Maximum post count across all tags
   * @returns {string} Size class (xs, sm, md, lg, xl)
   */
  calculateSizeClass(count, minCount, maxCount) {
    if (maxCount === minCount) {
      return 'md'; // All tags have same count
    }

    // Normalize to 0-1 range
    const normalized = (count - minCount) / (maxCount - minCount);

    // Map to size class index (0-4)
    const index = Math.min(
      Math.floor(normalized * this.sizeClasses.length),
      this.sizeClasses.length - 1
    );

    return this.sizeClasses[index];
  }

  /**
   * Render the tag cloud
   */
  render() {
    if (this.tags.length === 0) {
      this.container.innerHTML = `
        <div class="tag-cloud tag-cloud--empty">
          <p>No tags found</p>
        </div>
      `;
      return;
    }

    // Calculate min/max post counts
    const counts = this.tags.map(tag => tag.post_count || 0);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    // Build tag elements
    const tagsHtml = this.tags
      .map(tag => {
        const sizeClass = this.calculateSizeClass(
          tag.post_count || 0,
          minCount,
          maxCount
        );
        const href = `${this.baseUrl}/blog/tag/${tag.slug}`;

        return `
          <a
            href="${href}"
            class="tag-cloud__tag tag-cloud__tag--${sizeClass}"
            data-tag-id="${tag.id}"
            data-tag-slug="${tag.slug}"
            title="${tag.name} (${tag.post_count || 0} posts)"
          >
            ${this.escapeHtml(tag.name)}
            <span class="tag-cloud__tag__count">(${tag.post_count || 0})</span>
          </a>
        `;
      })
      .join('');

    this.container.innerHTML = `<div class="tag-cloud">${tagsHtml}</div>`;

    this.bindEvents();
  }

  /**
   * Bind click events if callback provided
   */
  bindEvents() {
    if (!this.onTagClick) {
      return;
    }

    this.container.querySelectorAll('.tag-cloud__tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.preventDefault();
        const tagId = parseInt(tagEl.dataset.tagId, 10);
        const tag = this.tags.find(t => t.id === tagId);
        if (tag) {
          this.onTagClick(tag);
        }
      });
    });
  }

  /**
   * Update tags and re-render
   * @param {Array} tags - New tags array
   */
  update(tags) {
    this.tags = tags || [];
    this.render();
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
