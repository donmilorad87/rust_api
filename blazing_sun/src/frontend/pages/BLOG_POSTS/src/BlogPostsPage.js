import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogPostsPage Controller
 *
 * Handles blog post management:
 * - Display posts in a table
 * - Create/edit posts with TinyMCE editor
 * - Multi-select for categories and tags
 * - Featured image selection
 * - Post status management (draft, published, scheduled, archived)
 * - Pagination and filtering
 */
export class BlogPostsPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // DOM Elements - List View
    this.listView = document.getElementById('listView');
    this.postsTable = document.getElementById('postsTableBody');
    this.pagination = document.getElementById('pagination');
    this.searchInput = document.getElementById('searchInput');
    this.statusFilter = document.getElementById('statusFilter');
    this.newPostBtn = document.getElementById('newPostBtn');

    // DOM Elements - Editor View
    this.editorView = document.getElementById('editorView');
    this.backToListBtn = document.getElementById('backToListBtn');
    this.postTitleInput = document.getElementById('postTitle');
    this.postSlugInput = document.getElementById('postSlug');
    this.postExcerptInput = document.getElementById('postExcerpt');
    this.categorySelect = document.getElementById('categorySelect');
    this.tagSelect = document.getElementById('tagSelect');
    this.selectedCategories = document.getElementById('selectedCategories');
    this.selectedTags = document.getElementById('selectedTags');
    this.featuredImagePreview = document.getElementById('featuredImagePreview');
    this.statusSelect = document.getElementById('statusSelect');
    this.publishDateInput = document.getElementById('publishDate');
    this.saveDraftBtn = document.getElementById('saveDraftBtn');
    this.publishBtn = document.getElementById('publishBtn');

    // Modals
    this.confirmModal = document.getElementById('confirmModal');
    this.imagePickerModal = document.getElementById('imagePickerModal');

    // State
    this.posts = [];
    this.totalPosts = 0;
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.searchTerm = '';
    this.statusFilterValue = '';
    this.editingPost = null;
    this.tinymceEditor = null;
    this.categories = [];
    this.tags = [];
    this.selectedCategoryIds = new Set();
    this.selectedTagIds = new Set();
    this.featuredImageUuid = null;
    this.pendingAction = null;
    this.availableImages = [];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();

    // Check if posts are already server-rendered (SSR)
    // If the table has actual data rows, skip the initial API load
    const hasServerRenderedPosts = this.postsTable &&
      this.postsTable.querySelectorAll('tr[data-id]').length > 0;

    if (!hasServerRenderedPosts) {
      this.loadPosts();
    }

    this.loadCategoriesAndTags();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // New post button
    if (this.newPostBtn) {
      this.newPostBtn.addEventListener('click', () => this.openEditor());
    }

    // Back to list button
    if (this.backToListBtn) {
      this.backToListBtn.addEventListener('click', () => this.closeEditor());
    }

    // Search input
    if (this.searchInput) {
      let debounceTimer;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchTerm = e.target.value;
          this.currentPage = 1;
          this.loadPosts();
        }, 300);
      });
    }

    // Status filter
    if (this.statusFilter) {
      this.statusFilter.addEventListener('change', (e) => {
        this.statusFilterValue = e.target.value;
        this.currentPage = 1;
        this.loadPosts();
      });
    }

    // Delegated events for posts table
    if (this.postsTable) {
      this.postsTable.addEventListener('click', (e) => this.handleTableClick(e));
    }

    // Save draft button
    if (this.saveDraftBtn) {
      this.saveDraftBtn.addEventListener('click', () => this.savePost('draft'));
    }

    // Publish button
    if (this.publishBtn) {
      this.publishBtn.addEventListener('click', () => this.savePost('published'));
    }

    // Auto-generate slug from title
    if (this.postTitleInput) {
      this.postTitleInput.addEventListener('input', (e) => {
        if (!this.editingPost && this.postSlugInput) {
          this.postSlugInput.value = this.slugify(e.target.value);
        }
      });
    }

    // Featured image click
    if (this.featuredImagePreview) {
      this.featuredImagePreview.addEventListener('click', (e) => {
        if (!e.target.closest('.featured-image__remove')) {
          this.openImagePicker();
        }
      });
    }

    // Category selection
    if (this.categorySelect) {
      this.categorySelect.addEventListener('change', (e) => this.handleCategoryChange(e));
    }

    // Tag selection
    if (this.tagSelect) {
      this.tagSelect.addEventListener('change', (e) => this.handleTagChange(e));
    }

    // Confirm modal events
    if (this.confirmModal) {
      const confirmBtn = this.confirmModal.querySelector('[data-action="confirm"]');
      const cancelBtn = this.confirmModal.querySelector('[data-action="cancel"]');

      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (this.pendingAction) {
            this.pendingAction();
            this.pendingAction = null;
          }
          this.closeConfirmModal();
        });
      }
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeConfirmModal());

      this.confirmModal.addEventListener('click', (e) => {
        if (e.target === this.confirmModal) this.closeConfirmModal();
      });
    }

    // Image picker modal events
    if (this.imagePickerModal) {
      const closeBtn = this.imagePickerModal.querySelector('[data-action="close"]');
      const selectBtn = this.imagePickerModal.querySelector('[data-action="select"]');
      const uploadBtn = this.imagePickerModal.querySelector('[data-action="upload"]');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeImagePicker());
      if (selectBtn) selectBtn.addEventListener('click', () => this.selectFeaturedImage());
      if (uploadBtn) uploadBtn.addEventListener('click', () => this.uploadImage());

      this.imagePickerModal.addEventListener('click', (e) => {
        if (e.target === this.imagePickerModal) this.closeImagePicker();
      });
    }
  }

  /**
   * Handle clicks in posts table
   * @param {Event} e - Click event
   */
  handleTableClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const postId = target.dataset.id;

    switch (action) {
      case 'edit':
        this.editPost(postId);
        break;
      case 'delete':
        this.confirmDeletePost(postId);
        break;
      case 'duplicate':
        this.duplicatePost(postId);
        break;
    }
  }

  /**
   * Load posts from API
   */
  async loadPosts() {
    if (!this.postsTable) return;

    this.renderLoading();

    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage;
      const params = new URLSearchParams({
        limit: this.itemsPerPage,
        offset: offset
      });

      if (this.searchTerm) {
        params.append('search', this.searchTerm);
      }

      if (this.statusFilterValue) {
        params.append('status', this.statusFilterValue);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/posts?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load posts');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.posts = data.posts || [];
        this.totalPosts = data.total || 0;
        this.renderTable();
        this.renderPagination();
      } else {
        throw new Error(data.message || 'Failed to load posts');
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      this.showToast('Failed to load posts', 'error');
      this.renderError();
    }
  }

  /**
   * Load categories and tags for editor
   */
  async loadCategoriesAndTags() {
    try {
      const [catResponse, tagResponse] = await Promise.all([
        fetch(`${this.baseUrl}/api/v1/admin/blog/categories`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'include'
        }),
        fetch(`${this.baseUrl}/api/v1/admin/blog/tags?limit=1000`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'include'
        })
      ]);

      if (catResponse.ok) {
        const catData = await catResponse.json();
        if (catData.status === 'success') {
          this.categories = catData.categories || [];
        }
      }

      if (tagResponse.ok) {
        const tagData = await tagResponse.json();
        if (tagData.status === 'success') {
          this.tags = tagData.tags || [];
        }
      }
    } catch (error) {
      console.error('Error loading categories/tags:', error);
    }
  }

  /**
   * Render posts table
   */
  renderTable() {
    if (!this.postsTable) return;

    if (this.posts.length === 0) {
      this.postsTable.innerHTML = `
        <tr>
          <td colspan="6" class="posts-table__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p>No posts yet. Create your first post!</p>
          </td>
        </tr>
      `;
      return;
    }

    this.postsTable.innerHTML = this.posts.map(post => this.renderPostRow(post)).join('');
  }

  /**
   * Render a single post row
   * @param {Object} post - Post data
   * @returns {string} HTML string
   */
  renderPostRow(post) {
    const statusClasses = {
      published: 'status-badge--published',
      draft: 'status-badge--draft',
      scheduled: 'status-badge--scheduled',
      archived: 'status-badge--archived'
    };

    return `
      <tr data-id="${post.id}">
        <td>
          <div class="post-cell">
            <div class="post-cell__title">${this.escapeHtml(post.title)}</div>
            <div class="post-cell__meta">
              <span class="post-cell__author">by ${this.escapeHtml(post.author_name || 'Unknown')}</span>
              <span>${this.formatDate(post.created_at)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="status-badge ${statusClasses[post.status] || ''}">${post.status}</span>
        </td>
        <td>${post.category_names?.join(', ') || '-'}</td>
        <td>${post.view_count || 0}</td>
        <td>${this.formatDate(post.published_at || post.created_at)}</td>
        <td>
          <div class="post-actions">
            <button class="btn btn--icon" data-action="edit" data-id="${post.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="duplicate" data-id="${post.id}" title="Duplicate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${post.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Open editor view
   * @param {Object|null} post - Post to edit (null for new)
   */
  openEditor(post = null) {
    this.editingPost = post;
    this.selectedCategoryIds = new Set(post?.category_ids || []);
    this.selectedTagIds = new Set(post?.tag_ids || []);
    this.featuredImageUuid = post?.featured_image_uuid || null;

    // Switch views
    if (this.listView) this.listView.classList.add('view-list-mode--hidden');
    if (this.editorView) this.editorView.classList.remove('view-editor-mode--hidden');

    // Populate form
    if (this.postTitleInput) this.postTitleInput.value = post?.title || '';
    if (this.postSlugInput) this.postSlugInput.value = post?.slug || '';
    if (this.postExcerptInput) this.postExcerptInput.value = post?.excerpt || '';
    if (this.statusSelect) this.statusSelect.value = post?.status || 'draft';
    if (this.publishDateInput && post?.published_at) {
      this.publishDateInput.value = post.published_at.slice(0, 16);
    }

    // Render category/tag selections
    this.renderCategorySelect();
    this.renderTagSelect();
    this.renderSelectedCategories();
    this.renderSelectedTags();
    this.renderFeaturedImage();

    // Initialize TinyMCE
    this.initTinyMCE(post?.content || '');
  }

  /**
   * Close editor and return to list
   */
  closeEditor() {
    // Destroy TinyMCE
    if (this.tinymceEditor) {
      this.tinymceEditor.destroy();
      this.tinymceEditor = null;
    }

    this.editingPost = null;
    this.selectedCategoryIds.clear();
    this.selectedTagIds.clear();
    this.featuredImageUuid = null;

    // Switch views
    if (this.listView) this.listView.classList.remove('view-list-mode--hidden');
    if (this.editorView) this.editorView.classList.add('view-editor-mode--hidden');

    // Reload posts to show any updates
    this.loadPosts();
  }

  /**
   * Initialize TinyMCE editor
   * @param {string} content - Initial content
   */
  initTinyMCE(content) {
    const self = this;

    // Check if TinyMCE is loaded
    if (typeof tinymce === 'undefined') {
      console.error('TinyMCE not loaded. Include TinyMCE via CDN in the template.');
      return;
    }

    // Destroy existing instance
    if (this.tinymceEditor) {
      this.tinymceEditor.destroy();
    }

    tinymce.init({
      selector: '#postContent',
      height: 500,
      menubar: false,
      plugins: [
        'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
        'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
        'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
      ],
      toolbar: 'undo redo | blocks | ' +
        'bold italic forecolor | alignleft aligncenter ' +
        'alignright alignjustify | bullist numlist outdent indent | ' +
        'removeformat | image link | code fullscreen | help',
      content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; }',
      images_upload_handler: (blobInfo, progress) => self.uploadTinyMCEImage(blobInfo, progress),
      automatic_uploads: true,
      file_picker_types: 'image',
      setup: (editor) => {
        self.tinymceEditor = editor;
        editor.on('init', () => {
          editor.setContent(content);
        });
      }
    });
  }

  /**
   * Upload image from TinyMCE
   * @param {Object} blobInfo - Blob info from TinyMCE
   * @param {Function} progress - Progress callback
   * @returns {Promise<string>} Image URL
   */
  async uploadTinyMCEImage(blobInfo, progress) {
    const formData = new FormData();
    formData.append('file', blobInfo.blob(), blobInfo.filename());

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      if (data.status === 'success' && data.upload?.uuid) {
        return `${this.baseUrl}/api/v1/upload/download/public/${data.upload.uuid}`;
      }

      throw new Error('Upload failed');
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }

  /**
   * Edit a post
   * @param {string} postId - Post ID
   */
  async editPost(postId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/posts/${postId}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load post');
      }

      const data = await response.json();

      if (data.status === 'success' && data.post) {
        this.openEditor(data.post);
      } else {
        throw new Error(data.message || 'Failed to load post');
      }
    } catch (error) {
      console.error('Error loading post:', error);
      this.showToast('Failed to load post', 'error');
    }
  }

  /**
   * Save post
   * @param {string} status - Status to save with
   */
  async savePost(status) {
    const title = this.postTitleInput?.value.trim();

    if (!title) {
      this.showToast('Title is required', 'error');
      return;
    }

    const content = this.tinymceEditor?.getContent() || '';

    const payload = {
      title,
      slug: this.postSlugInput?.value.trim() || this.slugify(title),
      content,
      excerpt: this.postExcerptInput?.value.trim() || null,
      status,
      category_ids: Array.from(this.selectedCategoryIds),
      tag_ids: Array.from(this.selectedTagIds),
      featured_image_uuid: this.featuredImageUuid,
      published_at: status === 'scheduled' && this.publishDateInput?.value
        ? new Date(this.publishDateInput.value).toISOString()
        : null
    };

    try {
      const isEditing = !!this.editingPost;
      const url = isEditing
        ? `${this.baseUrl}/api/v1/admin/blog/posts/${this.editingPost.id}`
        : `${this.baseUrl}/api/v1/admin/blog/posts`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save post');
      }

      const data = await response.json();

      if (data.status === 'success') {
        const actionText = status === 'published' ? 'published' : 'saved';
        this.showToast(`Post ${actionText} successfully`, 'success');
        this.closeEditor();
      } else {
        throw new Error(data.message || 'Failed to save post');
      }
    } catch (error) {
      console.error('Error saving post:', error);
      this.showToast(error.message || 'Failed to save post', 'error');
    }
  }

  /**
   * Confirm delete post
   * @param {string} postId - Post ID
   */
  confirmDeletePost(postId) {
    const post = this.posts.find(p => String(p.id) === String(postId));
    if (!post) return;

    this.pendingAction = () => this.deletePost(postId);
    this.openConfirmModal('Delete Post', `Are you sure you want to delete "${post.title}"?`);
  }

  /**
   * Delete a post
   * @param {string} postId - Post ID
   */
  async deletePost(postId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/posts/${postId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Post deleted successfully', 'success');
        this.loadPosts();
      } else {
        throw new Error(data.message || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      this.showToast('Failed to delete post', 'error');
    }
  }

  /**
   * Duplicate a post
   * @param {string} postId - Post ID
   */
  async duplicatePost(postId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/posts/${postId}/duplicate`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate post');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Post duplicated successfully', 'success');
        this.loadPosts();
      } else {
        throw new Error(data.message || 'Failed to duplicate post');
      }
    } catch (error) {
      console.error('Error duplicating post:', error);
      this.showToast('Failed to duplicate post', 'error');
    }
  }

  /**
   * Render category select options
   */
  renderCategorySelect() {
    if (!this.categorySelect) return;

    const buildOptions = (categories, depth = 0) => {
      let html = '';
      categories.forEach(cat => {
        const isSelected = this.selectedCategoryIds.has(cat.id);
        const indent = '&nbsp;&nbsp;'.repeat(depth);
        html += `
          <div class="multi-select__option ${isSelected ? 'multi-select__option--selected' : ''}" data-id="${cat.id}">
            <input type="checkbox" class="multi-select__checkbox" ${isSelected ? 'checked' : ''}>
            <span class="multi-select__label">${indent}${this.escapeHtml(cat.name)}</span>
          </div>
        `;
        if (cat.children && cat.children.length > 0) {
          html += buildOptions(cat.children, depth + 1);
        }
      });
      return html;
    };

    // Build tree structure
    const tree = this.buildCategoryTree(this.categories);
    this.categorySelect.innerHTML = buildOptions(tree);

    // Bind change events
    this.categorySelect.querySelectorAll('.multi-select__option').forEach(option => {
      option.addEventListener('click', (e) => {
        const id = parseInt(option.dataset.id, 10);
        const checkbox = option.querySelector('.multi-select__checkbox');
        checkbox.checked = !checkbox.checked;

        if (checkbox.checked) {
          this.selectedCategoryIds.add(id);
          option.classList.add('multi-select__option--selected');
        } else {
          this.selectedCategoryIds.delete(id);
          option.classList.remove('multi-select__option--selected');
        }
        this.renderSelectedCategories();
      });
    });
  }

  /**
   * Build category tree from flat list
   * @param {Array} categories - Flat category list
   * @returns {Array} Tree structure
   */
  buildCategoryTree(categories) {
    const map = new Map();
    const roots = [];

    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    categories.forEach(cat => {
      const node = map.get(cat.id);
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * Render tag select options
   */
  renderTagSelect() {
    if (!this.tagSelect) return;

    this.tagSelect.innerHTML = this.tags.map(tag => {
      const isSelected = this.selectedTagIds.has(tag.id);
      return `
        <div class="multi-select__option ${isSelected ? 'multi-select__option--selected' : ''}" data-id="${tag.id}">
          <input type="checkbox" class="multi-select__checkbox" ${isSelected ? 'checked' : ''}>
          <span class="multi-select__label">${this.escapeHtml(tag.name)}</span>
        </div>
      `;
    }).join('');

    // Bind change events
    this.tagSelect.querySelectorAll('.multi-select__option').forEach(option => {
      option.addEventListener('click', (e) => {
        const id = parseInt(option.dataset.id, 10);
        const checkbox = option.querySelector('.multi-select__checkbox');
        checkbox.checked = !checkbox.checked;

        if (checkbox.checked) {
          this.selectedTagIds.add(id);
          option.classList.add('multi-select__option--selected');
        } else {
          this.selectedTagIds.delete(id);
          option.classList.remove('multi-select__option--selected');
        }
        this.renderSelectedTags();
      });
    });
  }

  /**
   * Handle category checkbox change
   */
  handleCategoryChange(e) {
    // Handled by click event on option
  }

  /**
   * Handle tag checkbox change
   */
  handleTagChange(e) {
    // Handled by click event on option
  }

  /**
   * Render selected categories
   */
  renderSelectedCategories() {
    if (!this.selectedCategories) return;

    if (this.selectedCategoryIds.size === 0) {
      this.selectedCategories.innerHTML = '<span class="selected-items__empty">No categories selected</span>';
      return;
    }

    const selectedCats = this.categories.filter(c => this.selectedCategoryIds.has(c.id));
    this.selectedCategories.innerHTML = selectedCats.map(cat => `
      <span class="selected-item">
        ${this.escapeHtml(cat.name)}
        <button class="selected-item__remove" data-id="${cat.id}" data-type="category" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `).join('');

    // Bind remove buttons
    this.selectedCategories.querySelectorAll('[data-type="category"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        this.selectedCategoryIds.delete(id);
        this.renderCategorySelect();
        this.renderSelectedCategories();
      });
    });
  }

  /**
   * Render selected tags
   */
  renderSelectedTags() {
    if (!this.selectedTags) return;

    if (this.selectedTagIds.size === 0) {
      this.selectedTags.innerHTML = '<span class="selected-items__empty">No tags selected</span>';
      return;
    }

    const selectedTags = this.tags.filter(t => this.selectedTagIds.has(t.id));
    this.selectedTags.innerHTML = selectedTags.map(tag => `
      <span class="selected-item">
        ${this.escapeHtml(tag.name)}
        <button class="selected-item__remove" data-id="${tag.id}" data-type="tag" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `).join('');

    // Bind remove buttons
    this.selectedTags.querySelectorAll('[data-type="tag"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        this.selectedTagIds.delete(id);
        this.renderTagSelect();
        this.renderSelectedTags();
      });
    });
  }

  /**
   * Render featured image preview
   */
  renderFeaturedImage() {
    if (!this.featuredImagePreview) return;

    if (this.featuredImageUuid) {
      const imageUrl = `${this.baseUrl}/api/v1/upload/download/public/${this.featuredImageUuid}?variant=medium`;
      this.featuredImagePreview.innerHTML = `
        <img src="${imageUrl}" alt="Featured image">
        <button class="featured-image__remove" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      // Bind remove button
      const removeBtn = this.featuredImagePreview.querySelector('.featured-image__remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.featuredImageUuid = null;
          this.renderFeaturedImage();
        });
      }
    } else {
      this.featuredImagePreview.innerHTML = `
        <div class="featured-image__placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Click to select image</span>
        </div>
      `;
    }
  }

  /**
   * Open image picker modal
   */
  async openImagePicker() {
    if (!this.imagePickerModal) return;

    this.imagePickerModal.classList.add('image-picker-modal--visible');
    await this.loadAvailableImages();
  }

  /**
   * Close image picker modal
   */
  closeImagePicker() {
    if (!this.imagePickerModal) return;
    this.imagePickerModal.classList.remove('image-picker-modal--visible');
  }

  /**
   * Load available images for picker
   */
  async loadAvailableImages() {
    const imageGrid = this.imagePickerModal?.querySelector('.image-grid');
    if (!imageGrid) return;

    imageGrid.innerHTML = '<div class="loading-spinner"><div class="loading-spinner__icon"></div></div>';

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/uploads?storage_type=public&limit=50`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load images');
      }

      const data = await response.json();

      if (data.status === 'success') {
        // Filter only images
        this.availableImages = (data.uploads || []).filter(u => u.mime_type.startsWith('image/'));
        this.renderImageGrid();
      }
    } catch (error) {
      console.error('Error loading images:', error);
      imageGrid.innerHTML = '<p class="empty-state">Failed to load images</p>';
    }
  }

  /**
   * Render image grid in picker
   */
  renderImageGrid() {
    const imageGrid = this.imagePickerModal?.querySelector('.image-grid');
    if (!imageGrid) return;

    if (this.availableImages.length === 0) {
      imageGrid.innerHTML = '<p class="empty-state">No images available. Upload one!</p>';
      return;
    }

    imageGrid.innerHTML = this.availableImages.map(img => {
      const isSelected = this.tempSelectedImageUuid === img.uuid;
      const thumbUrl = `${this.baseUrl}/api/v1/upload/download/public/${img.uuid}?variant=thumb`;
      return `
        <div class="image-grid-item ${isSelected ? 'image-grid-item--selected' : ''}" data-uuid="${img.uuid}">
          <img src="${thumbUrl}" alt="${this.escapeHtml(img.original_name)}">
        </div>
      `;
    }).join('');

    // Bind click events
    imageGrid.querySelectorAll('.image-grid-item').forEach(item => {
      item.addEventListener('click', () => {
        imageGrid.querySelectorAll('.image-grid-item').forEach(i => i.classList.remove('image-grid-item--selected'));
        item.classList.add('image-grid-item--selected');
        this.tempSelectedImageUuid = item.dataset.uuid;
      });
    });
  }

  /**
   * Select featured image from picker
   */
  selectFeaturedImage() {
    if (this.tempSelectedImageUuid) {
      this.featuredImageUuid = this.tempSelectedImageUuid;
      this.renderFeaturedImage();
    }
    this.closeImagePicker();
    this.tempSelectedImageUuid = null;
  }

  /**
   * Upload new image
   */
  async uploadImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
          method: 'POST',
          headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          },
          credentials: 'include',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        if (data.status === 'success' && data.upload?.uuid) {
          this.showToast('Image uploaded successfully', 'success');
          await this.loadAvailableImages();
          this.tempSelectedImageUuid = data.upload.uuid;
          this.renderImageGrid();
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        this.showToast('Failed to upload image', 'error');
      }
    };

    input.click();
  }

  /**
   * Open confirm modal
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   */
  openConfirmModal(title, message) {
    if (!this.confirmModal) return;

    const titleEl = this.confirmModal.querySelector('.confirm-modal__title');
    const messageEl = this.confirmModal.querySelector('.confirm-modal__message');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    this.confirmModal.classList.add('confirm-modal--visible');
  }

  /**
   * Close confirm modal
   */
  closeConfirmModal() {
    if (!this.confirmModal) return;
    this.confirmModal.classList.remove('confirm-modal--visible');
    this.pendingAction = null;
  }

  /**
   * Render pagination
   */
  renderPagination() {
    if (!this.pagination) return;

    const totalPages = Math.ceil(this.totalPosts / this.itemsPerPage);

    if (totalPages <= 1) {
      this.pagination.innerHTML = '';
      return;
    }

    const { startPage, endPage } = this.calculatePageWindow(this.currentPage, totalPages);

    let html = '<nav class="pagination" aria-label="Pagination">';
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="1">First</button>`;
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Prev</button>`;

    html += '<div class="pagination__pages">';
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      html += `<button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}" data-page="${i}" ${isActive ? 'disabled' : ''}>${i}</button>`;
    }
    html += '</div>';

    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Next</button>`;
    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">Last</button>`;

    html += `<div class="pagination__goto"><input type="number" class="pagination__input" min="1" max="${totalPages}" placeholder="Page"><button class="pagination__btn" data-action="goto">Go</button></div>`;
    html += '</nav>';

    this.pagination.innerHTML = html;

    // Bind events
    this.pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadPosts();
        }
      });
    });

    const goBtn = this.pagination.querySelector('[data-action="goto"]');
    const input = this.pagination.querySelector('.pagination__input');
    if (goBtn && input) {
      goBtn.addEventListener('click', () => {
        const page = parseInt(input.value, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadPosts();
        }
      });
    }
  }

  /**
   * Calculate page window for pagination
   */
  calculatePageWindow(currentPage, totalPages) {
    const maxVisible = 7;
    const halfWindow = 3;

    let startPage, endPage;

    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else if (currentPage <= halfWindow + 1) {
      startPage = 1;
      endPage = maxVisible;
    } else if (currentPage >= totalPages - halfWindow) {
      startPage = totalPages - maxVisible + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - halfWindow;
      endPage = currentPage + halfWindow;
    }

    return { startPage, endPage };
  }

  /**
   * Render loading state
   */
  renderLoading() {
    if (!this.postsTable) return;
    this.postsTable.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="loading-spinner">
            <div class="loading-spinner__icon"></div>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    if (!this.postsTable) return;
    this.postsTable.innerHTML = `
      <tr>
        <td colspan="6" class="posts-table__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p>Failed to load posts. Please try again.</p>
        </td>
      </tr>
    `;
  }

  /**
   * Slugify a string
   * @param {string} str - String to slugify
   * @returns {string} Slugified string
   */
  slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Format date
   * @param {string} dateStr - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
