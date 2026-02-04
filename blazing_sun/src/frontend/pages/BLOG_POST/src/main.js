/**
 * BLOG_POST Page Entry Point
 * Editorial Magazine Experience
 *
 * Features:
 * - Reading progress indicator
 * - Smooth scroll for TOC links
 * - Active TOC state tracking
 * - Copy link to clipboard
 * - Smooth page animations
 */

import './styles/main.scss';

/**
 * Reading Progress Controller
 * Shows a progress bar indicating how much of the article has been read
 */
class ReadingProgress {
  constructor() {
    this.progressBar = document.getElementById('reading-progress-bar');
    this.progressContainer = document.querySelector('.reading-progress');
    this.articleContent = document.getElementById('article-content');

    if (!this.progressBar || !this.articleContent) {
      return;
    }

    this.init();
  }

  init() {
    // Throttled scroll handler for performance
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.updateProgress();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Initial update
    this.updateProgress();
  }

  updateProgress() {
    const articleRect = this.articleContent.getBoundingClientRect();
    const articleTop = articleRect.top + window.scrollY;
    const articleHeight = this.articleContent.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollY = window.scrollY;

    // Calculate progress based on article position
    const startReading = articleTop - windowHeight;
    const endReading = articleTop + articleHeight - windowHeight;
    const scrollRange = endReading - startReading;

    let progress = 0;

    if (scrollY <= startReading) {
      progress = 0;
    } else if (scrollY >= endReading) {
      progress = 100;
    } else {
      progress = ((scrollY - startReading) / scrollRange) * 100;
    }

    // Update progress bar
    this.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;

    // Update ARIA attribute
    this.progressContainer.setAttribute('aria-valuenow', Math.round(progress));
  }
}

/**
 * Table of Contents Controller
 * Handles smooth scrolling and active state tracking
 */
class TableOfContents {
  constructor() {
    this.tocLinks = document.querySelectorAll('[data-toc-link]');
    this.headings = [];
    this.activeLink = null;

    if (this.tocLinks.length === 0) {
      return;
    }

    this.init();
  }

  init() {
    // Collect all heading elements referenced by TOC
    this.tocLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const heading = document.getElementById(href.substring(1));
        if (heading) {
          this.headings.push({
            element: heading,
            link: link,
            id: href.substring(1)
          });
        }
      }
    });

    // Add click handlers for smooth scrolling
    this.tocLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleClick(e, link));
    });

    // Track scroll position
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.updateActiveState();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Initial state
    this.updateActiveState();
  }

  handleClick(e, link) {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    const target = document.getElementById(href.substring(1));
    if (!target) return;

    e.preventDefault();

    // Smooth scroll with offset for fixed header
    const offset = 100;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });

    // Update URL hash without jumping
    history.pushState(null, '', href);
  }

  updateActiveState() {
    const scrollY = window.scrollY;
    const offset = 120; // Offset to trigger active state earlier

    // Find the current active heading
    let currentActive = null;

    for (let i = this.headings.length - 1; i >= 0; i--) {
      const heading = this.headings[i];
      const rect = heading.element.getBoundingClientRect();
      const top = rect.top + scrollY;

      if (scrollY >= top - offset) {
        currentActive = heading;
        break;
      }
    }

    // Update active class on links
    if (currentActive !== this.activeLink) {
      // Remove active from all links
      this.tocLinks.forEach(link => {
        link.classList.remove('active');
      });

      // Add active to current
      if (currentActive) {
        currentActive.link.classList.add('active');

        // Also update any duplicate TOC (sidebar)
        document.querySelectorAll(`[data-toc-link][href="#${currentActive.id}"]`).forEach(link => {
          link.classList.add('active');
        });
      }

      this.activeLink = currentActive;
    }
  }
}

/**
 * Copy Link Controller
 * Handles copying the article URL to clipboard
 */
class CopyLink {
  constructor() {
    this.copyBtn = document.getElementById('copy-link-btn');

    if (!this.copyBtn) {
      return;
    }

    this.init();
  }

  init() {
    this.copyBtn.addEventListener('click', () => this.handleCopy());
  }

  async handleCopy() {
    const url = this.copyBtn.dataset.url || window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      this.showSuccess();
    } catch {
      // Fallback for older browsers
      this.fallbackCopy(url);
    }
  }

  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      this.showSuccess();
    } catch {
      console.error('Failed to copy link');
    }

    document.body.removeChild(textarea);
  }

  showSuccess() {
    const iconLink = this.copyBtn.querySelector('.icon-link');
    const iconCheck = this.copyBtn.querySelector('.icon-check');

    if (iconLink && iconCheck) {
      iconLink.style.display = 'none';
      iconCheck.style.display = 'block';
    }

    this.copyBtn.classList.add('copied');

    // Reset after 2 seconds
    setTimeout(() => {
      if (iconLink && iconCheck) {
        iconLink.style.display = 'block';
        iconCheck.style.display = 'none';
      }
      this.copyBtn.classList.remove('copied');
    }, 2000);
  }
}

/**
 * Smooth Scroll for Anchor Links
 * Makes all anchor links on the page scroll smoothly
 */
class SmoothScroll {
  constructor() {
    this.init();
  }

  init() {
    // Add smooth scroll to all hash links in the content
    const contentLinks = document.querySelectorAll('.prose a[href^="#"]');

    contentLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleClick(e, link));
    });
  }

  handleClick(e, link) {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.getElementById(href.substring(1));
    if (!target) return;

    e.preventDefault();

    const offset = 100;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });

    history.pushState(null, '', href);
  }
}

/**
 * Image Lazy Loading Enhancement
 * Adds fade-in animation when images load
 */
class ImageLoader {
  constructor() {
    this.init();
  }

  init() {
    const images = document.querySelectorAll('.prose img[loading="lazy"]');

    images.forEach(img => {
      // Add loading class
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.3s ease';

      if (img.complete) {
        img.style.opacity = '1';
      } else {
        img.addEventListener('load', () => {
          img.style.opacity = '1';
        });
      }
    });
  }
}

/**
 * Initialize Page
 */
function initPage() {
  // Initialize reading progress
  new ReadingProgress();

  // Initialize table of contents
  new TableOfContents();

  // Initialize copy link button
  new CopyLink();

  // Initialize smooth scroll for anchor links
  new SmoothScroll();

  // Initialize image loader
  new ImageLoader();

  // Log initialization
  console.log('[BLOG_POST] Editorial Magazine experience initialized');
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
