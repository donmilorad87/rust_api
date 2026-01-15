/**
 * GEO_GALLERIES Page Entry Point
 */
import './styles/main.scss';
import { GeoGalleriesPage } from './GeoGalleriesPage.js';

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
  const mapEl = document.getElementById('geoGalleriesMap');
  if (!mapEl) {
    console.error('GeoGalleriesPage: map container not found');
    return;
  }

  const root = document.querySelector('.geo-galleries');
  const isAdmin = root?.dataset?.isAdmin === 'true';
  const detailPathTemplate = root?.dataset?.geoGalleryPath || '';
  const baseUrl = window.BASE_URL || '';
  const filters = Array.from(document.querySelectorAll('[data-filter]'));
  const stats = {
    galleries: document.getElementById('geoGalleryCount'),
    places: document.getElementById('geoPlacesCount')
  };
  const placeForm = document.getElementById('geoPlaceForm');
  const placeUseLocationBtn = document.getElementById('geoPlaceUseLocation');
  const placeGalleryModal = document.getElementById('geoPlaceGalleryModal');
  const placeGalleryTitle = document.getElementById('geoPlaceGalleryTitle');
  const placeGalleryMeta = document.getElementById('geoPlaceGalleryMeta');
  const placeGalleryGrid = document.getElementById('geoPlaceGalleryGrid');
  const placeGalleryEmpty = document.getElementById('geoPlaceGalleryEmpty');
  const placeImageForm = document.getElementById('geoPlaceImageForm');
  const placeImageInput = document.getElementById('geoPlaceImages');
  const placeImageMetaList = document.getElementById('geoPlaceImageMetaList');
  const placeImagePlaceId = document.getElementById('geoPlaceImagePlaceId');
  const showToast = createToastFunction();

  const page = new GeoGalleriesPage({
    baseUrl,
    mapEl,
    filters,
    stats,
    placeForm,
    placeUseLocationBtn,
    placeGalleryModal,
    placeGalleryTitle,
    placeGalleryMeta,
    placeGalleryGrid,
    placeGalleryEmpty,
    placeImageForm,
    placeImageInput,
    placeImageMetaList,
    placeImagePlaceId,
    detailPathTemplate,
    isAdmin,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.geoGalleriesPage = page;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
