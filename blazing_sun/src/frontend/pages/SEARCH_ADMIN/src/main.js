/**
 * Search Admin Page - Main Entry Point
 */

import './styles/main.scss';
import { SearchAdminPage } from './SearchAdminPage.js';

function initPage() {
  const baseUrl = window.BASE_URL || '';

  const controller = new SearchAdminPage({
    baseUrl,
    statsContainer: {
      indexedDocs: document.getElementById('statIndexedDocs'),
      indexHealth: document.getElementById('statIndexHealth'),
      indexSize: document.getElementById('statIndexSize'),
    },
    itemsContainer: document.getElementById('indexedItemsContainer'),
    itemsPagination: document.getElementById('itemsPagination'),
    blogsListContainer: document.getElementById('blogsList'),
    blogsPagination: document.getElementById('blogsPagination'),
    modal: document.getElementById('indexModal'),
  });

  // Quick action buttons
  document.getElementById('btnOpenIndexModal')?.addEventListener('click', () => controller.openModal());
  document.getElementById('btnCloseModal')?.addEventListener('click', () => controller.closeModal());
  document.getElementById('btnModalClose')?.addEventListener('click', () => controller.closeModal());
  document.getElementById('btnReindexAll')?.addEventListener('click', () => controller.indexAllBlogs());
  document.getElementById('btnIndexNotIndexed')?.addEventListener('click', () => controller.indexNotIndexedBlogs());
  document.getElementById('btnRefreshStats')?.addEventListener('click', () => controller.loadStats());
  document.getElementById('btnIndexEverything')?.addEventListener('click', () => controller.indexAllBlogs());
  document.getElementById('btnIndexAllBlogs')?.addEventListener('click', () => controller.indexAllBlogs());
  document.getElementById('btnIndexNotIndexedBlogs')?.addEventListener('click', () => controller.indexNotIndexedBlogs());

  // Tab switching
  document.querySelectorAll('.tabs__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Update tab buttons
      document.querySelectorAll('.tabs__btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.tab === tabId);
        b.setAttribute('aria-selected', b.dataset.tab === tabId ? 'true' : 'false');
      });

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('is-active', content.id === `tab-${tabId}`);
      });

      // Load data for the tab
      if (tabId === 'blogs') {
        controller.loadBlogs(1);
      }
    });
  });

  // Close modal on backdrop click
  document.getElementById('indexModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      controller.closeModal();
    }
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && controller.isModalOpen) {
      controller.closeModal();
    }
  });

  if (typeof window !== 'undefined') {
    window.searchAdminController = controller;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
