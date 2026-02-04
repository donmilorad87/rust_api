import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * PostEditorPage Controller
 *
 * Handles the dedicated post editor page:
 * - Quill rich text editor
 * - Featured image selection
 * - Tag management with autocomplete
 * - Category selection
 * - SEO settings
 * - Post publishing (draft, publish, schedule)
 */
export class PostEditorPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // Form elements
    this.postForm = document.getElementById('postForm');
    this.postIdInput = document.getElementById('postId');
    this.postTitleInput = document.getElementById('postTitle');
    this.postSlugInput = document.getElementById('postSlug');
    this.postContentTextarea = document.getElementById('postContent');
    this.postExcerptInput = document.getElementById('postExcerpt');
    this.postStatusSelect = document.getElementById('postStatus');
    this.postVisibilitySelect = document.getElementById('postVisibility');
    this.postPasswordInput = document.getElementById('postPassword');
    this.postScheduleDateInput = document.getElementById('postScheduleDate');
    this.postCategorySelect = document.getElementById('postCategory');
    this.postTagsInput = document.getElementById('postTags');

    // Featured image elements
    this.featuredImagePicker = document.getElementById('featuredImagePicker');
    this.featuredImagePreview = document.getElementById('featuredImagePreview');
    this.featuredImagePlaceholder = document.getElementById('featuredImagePlaceholder');
    this.featuredImageImg = document.getElementById('featuredImageImg');
    this.featuredImageUuidInput = document.getElementById('featuredImageUuid');
    this.featuredImageAltInput = document.getElementById('featuredImageAlt');
    this.removeFeaturedImageBtn = document.getElementById('removeFeaturedImageBtn');

    // Image modal elements
    this.imageModal = document.getElementById('imageModal');
    this.imageGrid = document.getElementById('imageGrid');
    this.imageSearch = document.getElementById('imageSearch');
    this.imagePagination = document.getElementById('imagePagination');
    this.selectImageBtn = document.getElementById('selectImageBtn');
    this.uploadZone = document.getElementById('uploadZone');
    this.imageUploadInput = document.getElementById('imageUpload');
    this.uploadProgress = document.getElementById('uploadProgress');
    this.uploadProgressFill = document.getElementById('uploadProgressFill');
    this.uploadProgressText = document.getElementById('uploadProgressText');

    // Tags elements
    this.tagsInput = document.getElementById('tagsInput');
    this.selectedTags = document.getElementById('selectedTags');
    this.tagSearch = document.getElementById('tagSearch');
    this.tagSuggestions = document.getElementById('tagSuggestions');

    // Category modal
    this.addCategoryBtn = document.getElementById('addCategoryBtn');
    this.categoryModal = document.getElementById('categoryModal');
    this.newCategoryForm = document.getElementById('newCategoryForm');

    // SEO elements
    this.seoTitleInput = document.getElementById('seoTitle');
    this.seoDescriptionTextarea = document.getElementById('seoDescription');
    this.seoKeywordsInput = document.getElementById('seoKeywords');
    this.seoTitleCount = document.getElementById('seoTitleCount');
    this.seoDescriptionCount = document.getElementById('seoDescriptionCount');
    this.seoPreviewTitle = document.getElementById('seoPreviewTitle');
    this.seoPreviewDescription = document.getElementById('seoPreviewDescription');
    this.seoPreviewUrl = document.getElementById('seoPreviewUrl');

    // Action buttons
    this.saveDraftBtn = document.getElementById('saveDraftBtn');
    this.publishBtn = document.getElementById('publishBtn');
    this.generateSlugBtn = document.getElementById('generateSlugBtn');

    // Groups to show/hide
    this.scheduleDateGroup = document.getElementById('scheduleDateGroup');
    this.passwordGroup = document.getElementById('passwordGroup');

    // Unsaved changes modal
    this.unsavedModal = document.getElementById('unsavedModal');
    this.discardChangesBtn = document.getElementById('discardChangesBtn');
    this.saveBeforeLeaveBtn = document.getElementById('saveBeforeLeaveBtn');

    // State
    this.quillEditor = null;
    this.postContentHidden = document.getElementById('postContentHidden');
    this.availableImages = [];
    this.selectedImageUuid = null;
    this.availableTags = [];
    this.selectedTagIds = new Set();
    this.hasUnsavedChanges = false;
    this.isSaving = false;
    this.isEditMode = false;
    this.postId = null;

    // Check if editing existing post
    if (this.postIdInput && this.postIdInput.value) {
      this.isEditMode = true;
      this.postId = this.postIdInput.value;
    }

    // Initialize existing tags from template
    this.initExistingTags();

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.initQuill();
    this.loadAvailableTags();
    this.initSeoCounters();
    this.initCollapsiblePanels();
  }

  /**
   * Initialize existing tags from the template
   */
  initExistingTags() {
    if (!this.postTagsInput) return;

    const tagIds = this.postTagsInput.value;
    if (tagIds) {
      tagIds.split(',').forEach(id => {
        const numId = parseInt(id.trim(), 10);
        if (!isNaN(numId)) {
          this.selectedTagIds.add(numId);
        }
      });
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Save buttons
    if (this.saveDraftBtn) {
      this.saveDraftBtn.addEventListener('click', () => this.savePost('draft'));
    }

    if (this.publishBtn) {
      this.publishBtn.addEventListener('click', () => this.savePost('published'));
    }

    // Slug generation
    if (this.generateSlugBtn) {
      this.generateSlugBtn.addEventListener('click', () => this.generateSlug());
    }

    // Auto-generate slug on title change (for new posts only)
    if (this.postTitleInput && !this.isEditMode) {
      this.postTitleInput.addEventListener('input', () => this.autoGenerateSlug());
    }

    // Status change - show/hide schedule date
    if (this.postStatusSelect) {
      this.postStatusSelect.addEventListener('change', () => this.handleStatusChange());
    }

    // Visibility change - show/hide password
    if (this.postVisibilitySelect) {
      this.postVisibilitySelect.addEventListener('change', () => this.handleVisibilityChange());
    }

    // Featured image picker
    if (this.featuredImagePicker) {
      this.featuredImagePicker.addEventListener('click', (e) => {
        if (!e.target.closest('.image-picker__remove')) {
          this.openImageModal();
        }
      });

      this.featuredImagePicker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openImageModal();
        }
      });
    }

    // Remove featured image
    if (this.removeFeaturedImageBtn) {
      this.removeFeaturedImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFeaturedImage();
      });
    }

    // Image modal events
    this.bindImageModalEvents();

    // Tags input events
    this.bindTagEvents();

    // Add category button
    if (this.addCategoryBtn) {
      this.addCategoryBtn.addEventListener('click', () => this.openCategoryModal());
    }

    // Category modal
    this.bindCategoryModalEvents();

    // SEO inputs
    this.bindSeoEvents();

    // Track unsaved changes
    this.bindChangeTracking();

    // Form submission prevention
    if (this.postForm) {
      this.postForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // Modal close buttons
    document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.closeModal(modal);
      });
    });

    // Modal backdrop clicks
    document.querySelectorAll('.modal__backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        const modal = backdrop.closest('.modal');
        if (modal) this.closeModal(modal);
      });
    });
  }

  /**
   * Bind image modal events
   */
  bindImageModalEvents() {
    // Tab switching
    const tabs = document.querySelectorAll('.image-modal-tabs__tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchImageTab(tabName);
      });
    });

    // Image search
    if (this.imageSearch) {
      let debounceTimer;
      this.imageSearch.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.searchImages(), 300);
      });
    }

    // Select image button
    if (this.selectImageBtn) {
      this.selectImageBtn.addEventListener('click', () => this.confirmImageSelection());
    }

    // Upload zone
    if (this.uploadZone) {
      this.uploadZone.addEventListener('click', () => this.imageUploadInput?.click());

      this.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.uploadZone.classList.add('upload-zone--dragover');
      });

      this.uploadZone.addEventListener('dragleave', () => {
        this.uploadZone.classList.remove('upload-zone--dragover');
      });

      this.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.uploadZone.classList.remove('upload-zone--dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.uploadImages(files);
        }
      });
    }

    // File input change
    if (this.imageUploadInput) {
      this.imageUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.uploadImages(e.target.files);
        }
      });
    }
  }

  /**
   * Bind tag input events
   */
  bindTagEvents() {
    if (!this.tagSearch) return;

    let debounceTimer;
    this.tagSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.searchTags(), 200);
    });

    this.tagSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = this.tagSearch.value.trim();
        if (query) {
          this.addNewTag(query);
        }
      } else if (e.key === 'Escape') {
        this.hideSuggestions();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSuggestions(e.key === 'ArrowDown' ? 1 : -1);
      }
    });

    this.tagSearch.addEventListener('focus', () => {
      if (this.tagSearch.value.trim()) {
        this.searchTags();
      }
    });

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
      if (!this.tagsInput?.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    // Handle tag removal
    if (this.selectedTags) {
      this.selectedTags.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.tags-input__tag-remove');
        if (removeBtn) {
          const tag = removeBtn.closest('.tags-input__tag');
          if (tag) {
            const tagId = parseInt(tag.dataset.id, 10);
            this.removeTag(tagId);
          }
        }
      });
    }
  }

  /**
   * Bind category modal events
   */
  bindCategoryModalEvents() {
    if (!this.newCategoryForm) return;

    this.newCategoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createCategory();
    });
  }

  /**
   * Bind SEO input events
   */
  bindSeoEvents() {
    if (this.seoTitleInput) {
      this.seoTitleInput.addEventListener('input', () => {
        this.updateSeoCount('title');
        this.updateSeoPreview();
      });
    }

    if (this.seoDescriptionTextarea) {
      this.seoDescriptionTextarea.addEventListener('input', () => {
        this.updateSeoCount('description');
        this.updateSeoPreview();
      });
    }

    // Update SEO preview when title/slug changes
    if (this.postTitleInput) {
      this.postTitleInput.addEventListener('input', () => this.updateSeoPreview());
    }

    if (this.postSlugInput) {
      this.postSlugInput.addEventListener('input', () => this.updateSeoPreview());
    }
  }

  /**
   * Bind change tracking for unsaved changes warning
   */
  bindChangeTracking() {
    const inputs = this.postForm?.querySelectorAll('input, textarea, select');
    inputs?.forEach(input => {
      input.addEventListener('change', () => {
        this.hasUnsavedChanges = true;
      });
    });

    // Warn before leaving
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges && !this.isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Initialize Quill editor
   */
  initQuill() {
    if (typeof Quill === 'undefined') {
      console.error('Quill not loaded. Please check if the CDN is accessible.');
      this.showToast('Editor failed to load. Please refresh the page.', 'error');
      return;
    }

    const self = this;
    const editorContainer = document.getElementById('postContent');
    if (!editorContainer) return;

    // Configure Quill toolbar
    const toolbarOptions = [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
      ['clean']
    ];

    // Initialize Quill
    this.quillEditor = new Quill('#postContent', {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions
      },
      placeholder: 'Write your post content here...'
    });

    // Track changes
    this.quillEditor.on('text-change', () => {
      self.hasUnsavedChanges = true;
      // Sync content to hidden input
      if (self.postContentHidden) {
        self.postContentHidden.value = self.quillEditor.root.innerHTML;
      }
    });

    // Custom image handler for uploading
    const toolbar = this.quillEditor.getModule('toolbar');
    toolbar.addHandler('image', () => this.quillImageHandler());
  }

  /**
   * Handle image insertion in Quill
   */
  quillImageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
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
          const imageUrl = `${this.baseUrl}/api/v1/upload/download/public/${data.upload.uuid}`;
          const range = this.quillEditor.getSelection(true);
          this.quillEditor.insertEmbed(range.index, 'image', imageUrl);
          this.quillEditor.setSelection(range.index + 1);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Image upload error:', error);
        this.showToast('Failed to upload image', 'error');
      }
    };
  }

  /**
   * Initialize SEO character counters
   */
  initSeoCounters() {
    this.updateSeoCount('title');
    this.updateSeoCount('description');
    this.updateSeoPreview();
  }

  /**
   * Initialize collapsible panels
   */
  initCollapsiblePanels() {
    document.querySelectorAll('.editor-panel--collapsible .editor-panel__header').forEach(header => {
      header.addEventListener('click', () => {
        const panel = header.closest('.editor-panel--collapsible');
        const content = panel?.querySelector('.editor-panel__content');
        const isExpanded = header.getAttribute('aria-expanded') === 'true';

        header.setAttribute('aria-expanded', !isExpanded);
        content?.classList.toggle('editor-panel__content--collapsed');
      });
    });
  }

  /**
   * Update SEO character count
   */
  updateSeoCount(type) {
    if (type === 'title' && this.seoTitleInput && this.seoTitleCount) {
      this.seoTitleCount.textContent = this.seoTitleInput.value.length;
    } else if (type === 'description' && this.seoDescriptionTextarea && this.seoDescriptionCount) {
      this.seoDescriptionCount.textContent = this.seoDescriptionTextarea.value.length;
    }
  }

  /**
   * Update SEO preview
   */
  updateSeoPreview() {
    const title = this.seoTitleInput?.value || this.postTitleInput?.value || 'Post Title';
    const description = this.seoDescriptionTextarea?.value || this.postExcerptInput?.value || 'Your post description will appear here...';
    const slug = this.postSlugInput?.value || 'post-slug';

    if (this.seoPreviewTitle) {
      this.seoPreviewTitle.textContent = title;
    }
    if (this.seoPreviewDescription) {
      this.seoPreviewDescription.textContent = description.substring(0, 160);
    }
    if (this.seoPreviewUrl) {
      this.seoPreviewUrl.textContent = `${this.baseUrl}/blog/${slug}`;
    }
  }

  /**
   * Handle status select change
   */
  handleStatusChange() {
    const status = this.postStatusSelect?.value;
    if (this.scheduleDateGroup) {
      this.scheduleDateGroup.style.display = status === 'scheduled' ? 'block' : 'none';
    }
  }

  /**
   * Handle visibility select change
   */
  handleVisibilityChange() {
    const visibility = this.postVisibilitySelect?.value;
    if (this.passwordGroup) {
      this.passwordGroup.style.display = visibility === 'password' ? 'block' : 'none';
    }
  }

  /**
   * Auto-generate slug from title
   */
  autoGenerateSlug() {
    if (!this.postSlugInput || this.isEditMode) return;
    this.postSlugInput.value = this.slugify(this.postTitleInput?.value || '');
    this.updateSeoPreview();
  }

  /**
   * Generate slug from title
   */
  generateSlug() {
    if (!this.postSlugInput) return;
    this.postSlugInput.value = this.slugify(this.postTitleInput?.value || '');
    this.updateSeoPreview();
  }

  /**
   * Open image picker modal
   */
  openImageModal() {
    if (!this.imageModal) return;

    this.imageModal.setAttribute('aria-hidden', 'false');
    this.selectedImageUuid = this.featuredImageUuidInput?.value || null;
    this.loadImages();
  }

  /**
   * Close a modal
   */
  closeModal(modal) {
    modal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Switch image modal tab
   */
  switchImageTab(tabName) {
    const tabs = document.querySelectorAll('.image-modal-tabs__tab');
    const panels = document.querySelectorAll('.image-modal-panel');

    tabs.forEach(tab => {
      tab.classList.toggle('image-modal-tabs__tab--active', tab.dataset.tab === tabName);
    });

    panels.forEach(panel => {
      const panelId = panel.id;
      panel.style.display = panelId === `${tabName}Tab` ? 'block' : 'none';
    });
  }

  /**
   * Load images for picker
   */
  async loadImages(search = '') {
    if (!this.imageGrid) return;

    this.imageGrid.innerHTML = '<div class="loading-spinner"><div class="loading-spinner__icon"></div></div>';

    try {
      let url = `${this.baseUrl}/api/v1/admin/uploads?storage_type=public&limit=50`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load images');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.availableImages = (data.uploads || []).filter(u => u.mime_type.startsWith('image/'));
        this.renderImageGrid();
      }
    } catch (error) {
      console.error('Error loading images:', error);
      this.imageGrid.innerHTML = '<p class="empty-state">Failed to load images</p>';
    }
  }

  /**
   * Search images
   */
  searchImages() {
    const query = this.imageSearch?.value || '';
    this.loadImages(query);
  }

  /**
   * Render image grid
   */
  renderImageGrid() {
    if (!this.imageGrid) return;

    if (this.availableImages.length === 0) {
      this.imageGrid.innerHTML = '<p class="empty-state">No images available. Upload one!</p>';
      return;
    }

    this.imageGrid.innerHTML = this.availableImages.map(img => {
      const isSelected = this.selectedImageUuid === img.uuid;
      const thumbUrl = `${this.baseUrl}/api/v1/upload/download/public/${img.uuid}?variant=thumb`;
      return `
        <div class="image-grid__item ${isSelected ? 'image-grid__item--selected' : ''}" data-uuid="${img.uuid}">
          <img src="${thumbUrl}" alt="${this.escapeHtml(img.original_name)}" loading="lazy">
          <div class="image-grid__check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    this.imageGrid.querySelectorAll('.image-grid__item').forEach(item => {
      item.addEventListener('click', () => {
        this.imageGrid.querySelectorAll('.image-grid__item').forEach(i => i.classList.remove('image-grid__item--selected'));
        item.classList.add('image-grid__item--selected');
        this.selectedImageUuid = item.dataset.uuid;
        if (this.selectImageBtn) {
          this.selectImageBtn.disabled = false;
        }
      });
    });
  }

  /**
   * Upload images
   */
  async uploadImages(files) {
    if (!files || files.length === 0) return;

    if (this.uploadProgress) {
      this.uploadProgress.style.display = 'block';
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const progress = Math.round((i / files.length) * 100);
      if (this.uploadProgressFill) {
        this.uploadProgressFill.style.width = `${progress}%`;
      }
      if (this.uploadProgressText) {
        this.uploadProgressText.textContent = `Uploading ${i + 1} of ${files.length}...`;
      }

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
          this.selectedImageUuid = data.upload.uuid;
        }
      } catch (error) {
        console.error('Upload error:', error);
        this.showToast(`Failed to upload ${file.name}`, 'error');
      }
    }

    if (this.uploadProgress) {
      this.uploadProgress.style.display = 'none';
    }
    if (this.uploadProgressFill) {
      this.uploadProgressFill.style.width = '0';
    }

    // Reset file input
    if (this.imageUploadInput) {
      this.imageUploadInput.value = '';
    }

    // Reload images and switch to library tab
    await this.loadImages();
    this.switchImageTab('library');
    this.showToast('Images uploaded successfully', 'success');
  }

  /**
   * Confirm image selection
   */
  confirmImageSelection() {
    if (!this.selectedImageUuid) return;

    // Update hidden input
    if (this.featuredImageUuidInput) {
      this.featuredImageUuidInput.value = this.selectedImageUuid;
    }

    // Update preview
    const imageUrl = `${this.baseUrl}/api/v1/upload/download/public/${this.selectedImageUuid}?variant=medium`;
    if (this.featuredImageImg) {
      this.featuredImageImg.src = imageUrl;
    }

    // Show preview, hide placeholder
    if (this.featuredImagePreview) {
      this.featuredImagePreview.classList.remove('hidden');
    }
    if (this.featuredImagePlaceholder) {
      this.featuredImagePlaceholder.classList.add('hidden');
    }

    this.hasUnsavedChanges = true;
    this.closeModal(this.imageModal);
  }

  /**
   * Remove featured image
   */
  removeFeaturedImage() {
    if (this.featuredImageUuidInput) {
      this.featuredImageUuidInput.value = '';
    }

    if (this.featuredImagePreview) {
      this.featuredImagePreview.classList.add('hidden');
    }
    if (this.featuredImagePlaceholder) {
      this.featuredImagePlaceholder.classList.remove('hidden');
    }

    this.selectedImageUuid = null;
    this.hasUnsavedChanges = true;
  }

  /**
   * Load available tags
   */
  async loadAvailableTags() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/tags?limit=1000`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.status === 'success') {
        this.availableTags = data.tags || [];
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  /**
   * Search tags
   */
  searchTags() {
    const query = this.tagSearch?.value.toLowerCase().trim();
    if (!query) {
      this.hideSuggestions();
      return;
    }

    const matches = this.availableTags
      .filter(tag =>
        tag.name.toLowerCase().includes(query) &&
        !this.selectedTagIds.has(tag.id)
      )
      .slice(0, 10);

    this.showSuggestions(matches, query);
  }

  /**
   * Show tag suggestions
   */
  showSuggestions(tags, query) {
    if (!this.tagSuggestions) return;

    let html = '';

    if (tags.length > 0) {
      html = tags.map((tag, i) => `
        <div class="tags-input__suggestion ${i === 0 ? 'tags-input__suggestion--highlighted' : ''}" data-id="${tag.id}" data-name="${this.escapeHtml(tag.name)}" role="option">
          ${this.escapeHtml(tag.name)}
        </div>
      `).join('');
    }

    // Add "create new" option
    const exists = this.availableTags.some(t => t.name.toLowerCase() === query.toLowerCase());
    if (!exists && query) {
      html += `
        <div class="tags-input__suggestion tags-input__suggestion--create" data-name="${this.escapeHtml(query)}" role="option">
          Create "${this.escapeHtml(query)}"
        </div>
      `;
    }

    this.tagSuggestions.innerHTML = html;
    this.tagSuggestions.style.display = html ? 'block' : 'none';

    // Bind click events
    this.tagSuggestions.querySelectorAll('.tags-input__suggestion').forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        const tagId = suggestion.dataset.id;
        const tagName = suggestion.dataset.name;

        if (tagId) {
          this.selectTag(parseInt(tagId, 10), tagName);
        } else {
          this.addNewTag(tagName);
        }
      });
    });
  }

  /**
   * Hide tag suggestions
   */
  hideSuggestions() {
    if (this.tagSuggestions) {
      this.tagSuggestions.style.display = 'none';
    }
  }

  /**
   * Navigate suggestions with keyboard
   */
  navigateSuggestions(direction) {
    const suggestions = this.tagSuggestions?.querySelectorAll('.tags-input__suggestion');
    if (!suggestions || suggestions.length === 0) return;

    const current = this.tagSuggestions.querySelector('.tags-input__suggestion--highlighted');
    let index = Array.from(suggestions).indexOf(current);

    if (current) {
      current.classList.remove('tags-input__suggestion--highlighted');
    }

    index += direction;
    if (index < 0) index = suggestions.length - 1;
    if (index >= suggestions.length) index = 0;

    suggestions[index].classList.add('tags-input__suggestion--highlighted');
    suggestions[index].scrollIntoView({ block: 'nearest' });
  }

  /**
   * Select an existing tag
   */
  selectTag(tagId, tagName) {
    if (this.selectedTagIds.has(tagId)) return;

    this.selectedTagIds.add(tagId);
    this.addTagChip(tagId, tagName);
    this.updateTagsInput();
    this.hideSuggestions();
    if (this.tagSearch) {
      this.tagSearch.value = '';
    }
    this.hasUnsavedChanges = true;
  }

  /**
   * Add a new tag
   */
  async addNewTag(name) {
    // Check if already exists
    const existing = this.availableTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.selectTag(existing.id, existing.name);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/tags`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const data = await response.json();

      if (data.status === 'success' && data.tag) {
        this.availableTags.push(data.tag);
        this.selectTag(data.tag.id, data.tag.name);
        this.showToast(`Tag "${name}" created`, 'success');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      this.showToast('Failed to create tag', 'error');
    }
  }

  /**
   * Add tag chip to UI
   */
  addTagChip(id, name) {
    if (!this.selectedTags) return;

    const chip = document.createElement('span');
    chip.className = 'tags-input__tag';
    chip.dataset.id = id;
    chip.innerHTML = `
      ${this.escapeHtml(name)}
      <button type="button" class="tags-input__tag-remove" aria-label="Remove ${this.escapeHtml(name)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    this.selectedTags.appendChild(chip);
  }

  /**
   * Remove tag
   */
  removeTag(tagId) {
    this.selectedTagIds.delete(tagId);

    const chip = this.selectedTags?.querySelector(`[data-id="${tagId}"]`);
    chip?.remove();

    this.updateTagsInput();
    this.hasUnsavedChanges = true;
  }

  /**
   * Update hidden tags input
   */
  updateTagsInput() {
    if (this.postTagsInput) {
      this.postTagsInput.value = Array.from(this.selectedTagIds).join(',');
    }
  }

  /**
   * Open category modal
   */
  openCategoryModal() {
    if (this.categoryModal) {
      this.categoryModal.setAttribute('aria-hidden', 'false');

      // Populate parent category select
      const parentSelect = document.getElementById('newCategoryParent');
      if (parentSelect && this.postCategorySelect) {
        parentSelect.innerHTML = '<option value="">None (Top Level)</option>';
        const options = this.postCategorySelect.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value) {
            parentSelect.innerHTML += `<option value="${opt.value}">${opt.textContent}</option>`;
          }
        });
      }
    }
  }

  /**
   * Create new category
   */
  async createCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const parentSelect = document.getElementById('newCategoryParent');

    const name = nameInput?.value.trim();
    if (!name) {
      this.showToast('Category name is required', 'error');
      return;
    }

    // Generate slug from name
    const slug = this.slugify(name);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/categories`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name,
          slug,
          parent_category_id: parentSelect?.value ? parseInt(parentSelect.value, 10) : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create category');
      }

      const data = await response.json();

      if (data.status === 'success' && data.id) {
        // Add to select
        if (this.postCategorySelect) {
          const option = document.createElement('option');
          option.value = data.id;
          option.textContent = name;
          option.selected = true;
          this.postCategorySelect.appendChild(option);
        }

        this.showToast(`Category "${name}" created`, 'success');
        this.closeModal(this.categoryModal);

        // Clear form
        if (nameInput) nameInput.value = '';
      } else {
        throw new Error(data.message || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      this.showToast(error.message || 'Failed to create category', 'error');
    }
  }

  /**
   * Save post
   */
  async savePost(status) {
    if (this.isSaving) return;

    const title = this.postTitleInput?.value.trim();
    if (!title) {
      this.showToast('Title is required', 'error');
      this.postTitleInput?.focus();
      return;
    }

    this.isSaving = true;

    // Update button states
    const btn = status === 'draft' ? this.saveDraftBtn : this.publishBtn;
    const originalText = btn?.querySelector('span')?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Saving...';
    }

    try {
      const content = this.quillEditor?.root.innerHTML || this.postContentHidden?.value || '';

      const payload = {
        title,
        slug: this.postSlugInput?.value.trim() || this.slugify(title),
        content,
        excerpt: this.postExcerptInput?.value.trim() || null,
        status,
        category_id: this.postCategorySelect?.value ? parseInt(this.postCategorySelect.value, 10) : null,
        tag_ids: Array.from(this.selectedTagIds),
        featured_image_uuid: this.featuredImageUuidInput?.value || null,
        featured_image_alt: this.featuredImageAltInput?.value || null,
        visibility: this.postVisibilitySelect?.value || 'public',
        password: this.postPasswordInput?.value || null,
        scheduled_at: status === 'scheduled' && this.postScheduleDateInput?.value
          ? new Date(this.postScheduleDateInput.value).toISOString()
          : null,
        seo_title: this.seoTitleInput?.value || null,
        seo_description: this.seoDescriptionTextarea?.value || null,
        seo_keywords: this.seoKeywordsInput?.value || null
      };

      const url = this.isEditMode
        ? `${this.baseUrl}/api/v1/admin/blog/posts/${this.postId}`
        : `${this.baseUrl}/api/v1/admin/blog/posts`;

      const response = await fetch(url, {
        method: this.isEditMode ? 'PUT' : 'POST',
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
        this.hasUnsavedChanges = false;
        const actionText = status === 'published' ? 'Published' : 'Saved';
        this.showToast(`${actionText} successfully`, 'success');

        // If new post, redirect to edit page
        if (!this.isEditMode && data.post?.id) {
          window.location.href = `${this.baseUrl}/admin/blog/posts/${data.post.id}/edit`;
        }
      } else {
        throw new Error(data.message || 'Failed to save post');
      }
    } catch (error) {
      console.error('Error saving post:', error);
      this.showToast(error.message || 'Failed to save post', 'error');
    } finally {
      this.isSaving = false;
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span').textContent = originalText;
      }
    }
  }

  /**
   * Slugify a string
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
   * Escape HTML special characters
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
