/**
 * ArchiveWidget Component
 *
 * Displays a collapsible archive tree organized by year > month.
 * Each year can be expanded to show months with post counts.
 *
 * @example
 * const archive = new ArchiveWidget(document.getElementById('archiveWidget'), {
 *   archives: [{ year: 2024, month: 1, post_count: 5 }],
 *   baseUrl: '',
 *   onMonthClick: (year, month) => loadArchive(year, month)
 * });
 */
export class ArchiveWidget {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @param {Array} options.archives - Array of {year, month, post_count}
   * @param {string} options.baseUrl - Base URL for archive links
   * @param {Function} options.onMonthClick - Optional callback when month is clicked
   */
  constructor(container, options = {}) {
    if (!container) {
      console.error('ArchiveWidget: Container element required');
      return;
    }

    this.container = container;
    this.archives = options.archives || [];
    this.baseUrl = options.baseUrl || '';
    this.onMonthClick = options.onMonthClick || null;

    // Track expanded years
    this.expandedYears = new Set();

    // Month names for display
    this.monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    this.render();
  }

  /**
   * Group archives by year
   * @returns {Map<number, Array>} Map of year to array of {month, post_count}
   */
  groupByYear() {
    const grouped = new Map();

    this.archives.forEach(item => {
      if (!grouped.has(item.year)) {
        grouped.set(item.year, []);
      }
      grouped.get(item.year).push({
        month: item.month,
        post_count: item.post_count
      });
    });

    // Sort months within each year (descending)
    grouped.forEach((months, year) => {
      months.sort((a, b) => b.month - a.month);
    });

    // Convert to array sorted by year descending
    return new Map(
      [...grouped.entries()].sort((a, b) => b[0] - a[0])
    );
  }

  /**
   * Calculate total posts for a year
   * @param {Array} months - Array of month data
   * @returns {number}
   */
  getYearTotal(months) {
    return months.reduce((sum, m) => sum + (m.post_count || 0), 0);
  }

  /**
   * Render the archive widget
   */
  render() {
    if (this.archives.length === 0) {
      this.container.innerHTML = `
        <div class="archive-widget archive-widget--empty">
          <p>No archives found</p>
        </div>
      `;
      return;
    }

    const grouped = this.groupByYear();
    let html = '<div class="archive-widget">';

    grouped.forEach((months, year) => {
      const isExpanded = this.expandedYears.has(year);
      const yearTotal = this.getYearTotal(months);

      html += `
        <div class="archive-widget__year" data-year="${year}">
          <div class="archive-widget__year-header" data-action="toggle">
            <span class="archive-widget__year-label">${year}</span>
            <span class="archive-widget__year-count">${yearTotal} posts</span>
            <svg
              class="archive-widget__year-icon ${isExpanded ? 'archive-widget__year-icon--expanded' : ''}"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="archive-widget__months ${isExpanded ? 'archive-widget__months--expanded' : ''}">
            ${this.renderMonths(year, months)}
          </div>
        </div>
      `;
    });

    html += '</div>';
    this.container.innerHTML = html;

    this.bindEvents();
  }

  /**
   * Render months for a year
   * @param {number} year
   * @param {Array} months
   * @returns {string}
   */
  renderMonths(year, months) {
    return months
      .map(m => {
        const monthName = this.monthNames[m.month - 1] || 'Unknown';
        const href = `${this.baseUrl}/blog/archive/${year}/${String(m.month).padStart(2, '0')}`;

        return `
          <a
            href="${href}"
            class="archive-widget__month"
            data-year="${year}"
            data-month="${m.month}"
          >
            <span class="archive-widget__month-name">${monthName}</span>
            <span class="archive-widget__month-count">${m.post_count || 0}</span>
          </a>
        `;
      })
      .join('');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Year toggle events
    this.container.querySelectorAll('[data-action="toggle"]').forEach(header => {
      header.addEventListener('click', () => {
        const yearEl = header.closest('.archive-widget__year');
        const year = parseInt(yearEl.dataset.year, 10);
        this.toggleYear(year);
      });
    });

    // Month click events
    if (this.onMonthClick) {
      this.container.querySelectorAll('.archive-widget__month').forEach(monthEl => {
        monthEl.addEventListener('click', (e) => {
          e.preventDefault();
          const year = parseInt(monthEl.dataset.year, 10);
          const month = parseInt(monthEl.dataset.month, 10);
          this.onMonthClick(year, month);
        });
      });
    }
  }

  /**
   * Toggle year expansion
   * @param {number} year
   */
  toggleYear(year) {
    if (this.expandedYears.has(year)) {
      this.expandedYears.delete(year);
    } else {
      this.expandedYears.add(year);
    }
    this.render();
  }

  /**
   * Expand a specific year
   * @param {number} year
   */
  expandYear(year) {
    this.expandedYears.add(year);
    this.render();
  }

  /**
   * Collapse a specific year
   * @param {number} year
   */
  collapseYear(year) {
    this.expandedYears.delete(year);
    this.render();
  }

  /**
   * Expand all years
   */
  expandAll() {
    this.groupByYear().forEach((_, year) => {
      this.expandedYears.add(year);
    });
    this.render();
  }

  /**
   * Collapse all years
   */
  collapseAll() {
    this.expandedYears.clear();
    this.render();
  }

  /**
   * Update archives and re-render
   * @param {Array} archives - New archives array
   */
  update(archives) {
    this.archives = archives || [];
    this.render();
  }
}
