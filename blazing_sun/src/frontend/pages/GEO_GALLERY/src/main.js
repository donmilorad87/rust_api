/**
 * GEO_GALLERY Page Entry Point
 */
import './styles/main.scss';
import { GeoGalleryPage } from './GeoGalleryPage.js';

function createToastFunction() {
  const colors = {
    success: 'linear-gradient(to right, #00b09b, #96c93d)',
    error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
    info: 'linear-gradient(to right, #667eea, #764ba2)'
  };

  return function showToast(message, type = 'success') {
    if (typeof Toastify !== 'undefined') {
      Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        style: {
          background: colors[type] || colors.info
        }
      }).showToast();
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
}

function initPage() {
  const root = document.querySelector('.geo-gallery');
  if (!root) {
    console.error('GeoGalleryPage: root container not found');
    return;
  }

  const galleryUuid = root.dataset.galleryUuid;
  if (!galleryUuid) {
    console.error('GeoGalleryPage: gallery UUID missing');
    return;
  }

  const mapEl = document.getElementById('geoGalleryMap');
  if (!mapEl) {
    console.error('GeoGalleryPage: map container not found');
    return;
  }

  const showToast = createToastFunction();

  const page = new GeoGalleryPage({
    baseUrl: window.BASE_URL || '',
    galleryUuid,
    mapEl,
    titleEl: document.getElementById('geoGalleryTitle'),
    descriptionEl: document.getElementById('geoGalleryDescription'),
    statusEl: document.getElementById('geoGalleryStatus'),
    carouselEl: document.getElementById('geoGalleryCarousel'),
    emptyEl: document.getElementById('geoGalleryEmpty'),
    showAllToggle: document.getElementById('geoGalleryShowAll'),
    selectedMetaEl: document.getElementById('geoGallerySelectedMeta'),
    editButton: document.getElementById('geoGalleryEditButton'),
    saveButton: document.getElementById('geoGallerySaveButton'),
    cancelButton: document.getElementById('geoGalleryCancelButton'),
    editActionsEl: document.getElementById('geoGalleryEditActions'),
    showToast
  });

  if (typeof window !== 'undefined') {
    window.geoGalleryPage = page;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
