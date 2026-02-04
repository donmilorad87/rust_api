/**
 * SearchAdminPage Controller
 *
 * Manages the search index admin interface.
 */

export class SearchAdminPage {
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.statsContainer = options.statsContainer;
    this.itemsContainer = options.itemsContainer;
    this.itemsPagination = options.itemsPagination;
    this.blogsListContainer = options.blogsListContainer;
    this.blogsPagination = options.blogsPagination;
    this.modal = options.modal;

    this.currentItemsPage = 1;
    this.currentBlogsPage = 1;
    this.itemsPerPage = 20;
    this.isModalOpen = false;
    this.isLoading = false;

    this.init();
  }

  async init() {
    await this.loadStats();
    await this.loadIndexedItems(1);
  }

  showToast(message, type = 'info') {
    if (typeof Toastify !== 'undefined') {
      const colors = {
        success: 'linear-gradient(to right, #00b09b, #96c93d)',
        error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        info: 'linear-gradient(to right, #667eea, #764ba2)',
      };
      Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        style: { background: colors[type] || colors.info },
      }).showToast();
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  async loadStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/stats`);
      if (!response.ok) {
        if (response.status === 503) {
          this.updateStats({ total_documents: 'N/A', health: 'unavailable', store_size: 'N/A' });
          return;
        }
        throw new Error('Failed to load stats');
      }

      const data = await response.json();
      if (data.status === 'success' && data.stats) {
        this.updateStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      this.updateStats({ total_documents: 'Error', health: 'error', store_size: 'Error' });
    }
  }

  updateStats(stats) {
    if (this.statsContainer.indexedDocs) {
      this.statsContainer.indexedDocs.textContent = stats.total_documents?.toLocaleString() || '-';
    }
    if (this.statsContainer.indexHealth) {
      const health = stats.health || 'unknown';
      this.statsContainer.indexHealth.textContent = health.charAt(0).toUpperCase() + health.slice(1);
    }
    if (this.statsContainer.indexSize) {
      this.statsContainer.indexSize.textContent = stats.store_size || '-';
    }
  }

  async loadIndexedItems(page = 1) {
    this.currentItemsPage = page;

    if (!this.itemsContainer) return;

    this.itemsContainer.innerHTML = `
      <div class="empty-state">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p>Loading indexed items...</p>
      </div>
    `;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: this.itemsPerPage.toString(),
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/items?${params}`);

      if (!response.ok) {
        if (response.status === 503) {
          this.renderItemsEmpty('Search service is currently unavailable.');
          return;
        }
        throw new Error('Failed to load indexed items');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        this.renderIndexedItems(data.items);
        this.renderPagination(this.itemsPagination, data.pagination, (p) => this.loadIndexedItems(p));
      } else {
        this.renderItemsEmpty('No indexed items found.');
      }
    } catch (error) {
      console.error('Failed to load indexed items:', error);
      this.renderItemsEmpty('Failed to load indexed items.');
    }
  }

  renderIndexedItems(items) {
    if (!this.itemsContainer) return;

    const html = items
      .map(item => `
        <div class="index-item">
          <div class="index-item__info">
            <div class="index-item__title">${this.escapeHtml(item.title)}</div>
            <div class="index-item__meta">
              <span>Type: ${item.content_type || 'blog'}</span>
              <span>Status: ${item.status || 'published'}</span>
            </div>
          </div>
          <span class="index-item__status index-item__status--indexed">Indexed</span>
        </div>
      `)
      .join('');

    this.itemsContainer.innerHTML = `<div class="index-list">${html}</div>`;
  }

  renderItemsEmpty(message) {
    if (!this.itemsContainer) return;
    this.itemsContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>No Items</h3>
        <p>${message}</p>
      </div>
    `;
    if (this.itemsPagination) {
      this.itemsPagination.innerHTML = '';
    }
  }

  async loadBlogs(page = 1) {
    this.currentBlogsPage = page;

    if (!this.blogsListContainer) return;

    this.blogsListContainer.innerHTML = `
      <li class="empty-state">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p>Loading blogs...</p>
      </li>
    `;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: this.itemsPerPage.toString(),
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/blogs?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load blogs');
      }

      const data = await response.json();

      if (data.blogs && data.blogs.length > 0) {
        this.renderBlogsList(data.blogs);
        this.renderPagination(this.blogsPagination, data.pagination, (p) => this.loadBlogs(p));
      } else {
        this.blogsListContainer.innerHTML = `
          <li class="empty-state">
            <p>No blog posts found.</p>
          </li>
        `;
        if (this.blogsPagination) {
          this.blogsPagination.innerHTML = '';
        }
      }
    } catch (error) {
      console.error('Failed to load blogs:', error);
      this.blogsListContainer.innerHTML = `
        <li class="empty-state">
          <p>Failed to load blog posts.</p>
        </li>
      `;
    }
  }

  renderBlogsList(blogs) {
    if (!this.blogsListContainer) return;

    const html = blogs
      .map(blog => {
        const statusClass = blog.is_indexed ? 'index-item__status--indexed' : 'index-item__status--not-indexed';
        const statusText = blog.is_indexed ? 'Indexed' : 'Not Indexed';
        const indexBtnHtml = blog.is_indexed
          ? ''
          : `<button class="btn btn--sm btn--success" data-index-blog="${blog.id}">Index</button>`;

        return `
          <li class="index-item">
            <div class="index-item__info">
              <div class="index-item__title">${this.escapeHtml(blog.title)}</div>
              <div class="index-item__meta">
                <span>Status: ${blog.status}</span>
                ${blog.published_at ? `<span>Published: ${this.formatDate(blog.published_at)}</span>` : ''}
              </div>
            </div>
            <span class="index-item__status ${statusClass}">${statusText}</span>
            ${indexBtnHtml}
          </li>
        `;
      })
      .join('');

    this.blogsListContainer.innerHTML = html;

    // Bind index buttons
    this.blogsListContainer.querySelectorAll('[data-index-blog]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blogId = btn.dataset.indexBlog;
        await this.indexSingleBlog(blogId, btn);
      });
    });
  }

  renderPagination(container, pagination, onPageChange) {
    if (!container || !pagination) return;

    if (pagination.total_pages <= 1) {
      container.innerHTML = '';
      return;
    }

    const currentPage = pagination.page;
    const totalPages = pagination.total_pages;
    const pages = this.getPaginationRange(currentPage, totalPages);

    let html = '';

    // Previous button
    if (currentPage > 1) {
      html += `<button class="pagination__btn" data-page="${currentPage - 1}">&laquo; Prev</button>`;
    }

    // Page numbers
    pages.forEach(page => {
      if (page === '...') {
        html += `<span class="pagination__btn" style="cursor: default;">...</span>`;
      } else {
        const isActive = page === currentPage;
        html += `<button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}" data-page="${page}">${page}</button>`;
      }
    });

    // Next button
    if (currentPage < totalPages) {
      html += `<button class="pagination__btn" data-page="${currentPage + 1}">Next &raquo;</button>`;
    }

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        onPageChange(page);
      });
    });
  }

  getPaginationRange(current, total) {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    let prev = null;
    for (const i of range) {
      if (prev) {
        if (i - prev === 2) {
          rangeWithDots.push(prev + 1);
        } else if (i - prev !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      prev = i;
    }

    return rangeWithDots;
  }

  async indexSingleBlog(blogId, button) {
    if (this.isLoading) return;

    this.isLoading = true;
    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Indexing...';

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/index/blog/${blogId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        this.showToast(data.message || 'Blog indexed successfully', 'success');
        // Refresh the list
        await this.loadBlogs(this.currentBlogsPage);
        await this.loadStats();
        await this.loadIndexedItems(this.currentItemsPage);
      } else {
        throw new Error(data.message || 'Failed to index blog');
      }
    } catch (error) {
      console.error('Failed to index blog:', error);
      this.showToast(error.message || 'Failed to index blog', 'error');
      button.disabled = false;
      button.textContent = originalText;
    } finally {
      this.isLoading = false;
    }
  }

  async indexAllBlogs() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showToast('Starting reindex of all blogs...', 'info');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/index/blogs/all`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        this.showToast(data.message || 'Reindex started in background', 'success');
        // Refresh stats after a delay
        setTimeout(() => {
          this.loadStats();
          this.loadIndexedItems(1);
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to start reindex');
      }
    } catch (error) {
      console.error('Failed to start reindex:', error);
      this.showToast(error.message || 'Failed to start reindex', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async indexNotIndexedBlogs() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showToast('Indexing missing blogs...', 'info');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/search/index/blogs/not-indexed`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        this.showToast(data.message || 'Indexing complete', 'success');
        await this.loadStats();
        await this.loadIndexedItems(1);
        await this.loadBlogs(this.currentBlogsPage);
      } else {
        throw new Error(data.message || 'Failed to index blogs');
      }
    } catch (error) {
      console.error('Failed to index blogs:', error);
      this.showToast(error.message || 'Failed to index blogs', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  openModal() {
    if (this.modal) {
      this.modal.classList.add('is-open');
      this.isModalOpen = true;
      this.loadBlogs(1);
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('is-open');
      this.isModalOpen = false;
    }
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
