import L from 'leaflet';
import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

export class GeoGalleryPage {
  constructor({
    baseUrl,
    galleryUuid,
    mapEl,
    titleEl,
    descriptionEl,
    statusEl,
    carouselEl,
    emptyEl,
    showAllToggle,
    selectedMetaEl,
    editButton,
    saveButton,
    cancelButton,
    editActionsEl,
    showToast
  }) {
    this.baseUrl = baseUrl;
    this.galleryUuid = galleryUuid;
    this.mapEl = mapEl;
    this.titleEl = titleEl;
    this.descriptionEl = descriptionEl;
    this.statusEl = statusEl;
    this.carouselEl = carouselEl;
    this.emptyEl = emptyEl;
    this.showAllToggle = showAllToggle;
    this.selectedMetaEl = selectedMetaEl;
    this.editButton = editButton;
    this.saveButton = saveButton;
    this.cancelButton = cancelButton;
    this.editActionsEl = editActionsEl;
    this.showToast = showToast;

    this.map = null;
    this.allMarkersLayer = L.layerGroup();
    this.selectedMarker = null;
    this.editMarker = null;
    this.mapClickHandler = null;

    this.gallery = null;
    this.pictures = [];
    this.selectedPicture = null;
    this.isOwner = false;
    this.pendingLatLng = null;

    this.init();
  }

  init() {
    this.setupMap();
    this.bindControls();
    this.loadGallery();
  }

  setupMap() {
    this.map = L.map(this.mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([45.8, 16.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.whenReady(() => {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => this.map.invalidateSize());
      } else {
        this.map.invalidateSize();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.map.invalidateSize());
    }
  }

  bindControls() {
    if (this.showAllToggle) {
      this.showAllToggle.addEventListener('change', () => this.toggleAllMarkers());
    }

    if (this.editButton) {
      this.editButton.addEventListener('click', () => this.enterEditMode());
    }

    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => this.saveEditLocation());
    }

    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', () => this.exitEditMode());
    }
  }

  async loadGallery() {
    this.setStatus('Loading gallery...');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/geo-galleries/${this.galleryUuid}`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load gallery');
      }

      const gallery = await response.json();
      this.gallery = gallery;
      this.isOwner = !!gallery.is_owner;

      if (this.titleEl) {
        this.titleEl.textContent = gallery.name || 'Geo Gallery';
      }

      if (this.descriptionEl) {
        this.descriptionEl.textContent = gallery.description || 'No description available.';
      }

      this.setStatus('');
      await this.loadPictures();
    } catch (error) {
      console.error('Failed to load gallery', error);
      this.setStatus(error.message || 'Failed to load gallery');
      this.showToast(error.message || 'Failed to load gallery', 'error');
    }
  }

  async loadPictures() {
    if (!this.gallery) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/galleries/${this.gallery.id}/pictures`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load gallery images');
      }

      const payload = await response.json();
      this.pictures = payload.pictures || [];

      this.renderCarousel();
      this.renderAllMarkers();

      if (this.pictures.length > 0) {
        this.selectPicture(this.pictures[0], { silent: true });
      } else {
        this.updateSelectedMeta(null);
      }
    } catch (error) {
      console.error('Failed to load gallery images', error);
      this.showToast(error.message || 'Failed to load gallery images', 'error');
      this.renderCarousel();
    }
  }

  renderCarousel() {
    if (!this.carouselEl) return;

    this.carouselEl.innerHTML = '';

    if (this.pictures.length === 0) {
      if (this.emptyEl) {
        this.emptyEl.style.display = 'block';
      }
      return;
    }

    if (this.emptyEl) {
      this.emptyEl.style.display = 'none';
    }

    this.pictures.forEach((picture) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'geo-carousel__item';
      button.dataset.pictureId = picture.id.toString();

      const title = picture.title || picture.upload?.original_name || 'Untitled';
      const imageUrl = picture.urls?.small || picture.urls?.medium || picture.urls?.full || '';
      const hasLocation = this.getPictureLatLng(picture) !== null;

      button.innerHTML = `
        <div class="geo-carousel__image" style="background-image: url('${imageUrl}')"></div>
        <div class="geo-carousel__caption">
          <span class="geo-carousel__title">${this.escapeHtml(title)}</span>
          ${hasLocation ? '<span class="geo-carousel__badge">Pinned</span>' : ''}
        </div>
      `;

      button.addEventListener('click', () => this.selectPicture(picture));
      this.carouselEl.appendChild(button);
    });
  }

  selectPicture(picture, options = {}) {
    if (this.editMarker) {
      this.exitEditMode();
    }

    this.selectedPicture = picture;
    this.highlightSelectedPicture();
    this.updateSelectedMeta(picture);
    this.showEditControls();

    const coords = this.getPictureLatLng(picture);
    if (coords) {
      this.updateSelectedMarker(coords);
      this.map.setView(coords, 13, { animate: true });
    } else {
      this.clearSelectedMarker();
      if (this.gallery?.latitude && this.gallery?.longitude) {
        this.map.setView([this.gallery.latitude, this.gallery.longitude], 11, { animate: true });
      }
      if (!options.silent) {
        this.showToast('This image has no location yet.', 'info');
      }
    }
  }

  highlightSelectedPicture() {
    if (!this.carouselEl || !this.selectedPicture) return;

    const items = this.carouselEl.querySelectorAll('.geo-carousel__item');
    items.forEach((item) => {
      const isSelected = item.dataset.pictureId === this.selectedPicture.id.toString();
      item.classList.toggle('is-active', isSelected);
    });
  }

  updateSelectedMeta(picture) {
    if (!this.selectedMetaEl) return;

    if (!picture) {
      this.selectedMetaEl.textContent = 'Select a photo to see its location.';
      return;
    }

    const coords = this.getPictureLatLng(picture);
    if (!coords) {
      this.selectedMetaEl.textContent = 'No location set for this photo.';
      return;
    }

    this.selectedMetaEl.textContent = `${coords[0].toString()}, ${coords[1].toString()}`;
  }

  showEditControls() {
    if (!this.isOwner || !this.editButton) return;

    this.editButton.style.display = 'inline-flex';
    if (this.editActionsEl) {
      this.editActionsEl.hidden = true;
    }
  }

  updateSelectedMarker(coords) {
    this.clearSelectedMarker();
    this.selectedMarker = L.marker(coords).addTo(this.map);
  }

  clearSelectedMarker() {
    if (this.selectedMarker) {
      this.map.removeLayer(this.selectedMarker);
      this.selectedMarker = null;
    }
  }

  renderAllMarkers() {
    this.allMarkersLayer.clearLayers();

    this.pictures.forEach((picture) => {
      const coords = this.getPictureLatLng(picture);
      if (!coords) return;

      const marker = L.circleMarker(coords, {
        radius: 6,
        color: '#1f2933',
        weight: 1,
        fillColor: '#f5b700',
        fillOpacity: 0.9
      });

      marker.on('click', () => this.selectPicture(picture));
      this.allMarkersLayer.addLayer(marker);
    });

    if (this.showAllToggle?.checked) {
      this.allMarkersLayer.addTo(this.map);
    }
  }

  toggleAllMarkers() {
    if (!this.showAllToggle) return;

    if (this.showAllToggle.checked) {
      this.allMarkersLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.allMarkersLayer);
    }
  }

  enterEditMode() {
    if (!this.isOwner || !this.selectedPicture) return;

    const coords = this.getPictureLatLng(this.selectedPicture);
    const fallback = this.getGalleryFallbackCoords();
    const startCoords = coords || fallback || this.map.getCenter();

    if (this.editButton) {
      this.editButton.style.display = 'none';
    }

    if (this.editActionsEl) {
      this.editActionsEl.hidden = false;
    }

    this.clearSelectedMarker();

    this.editMarker = L.marker(startCoords, { draggable: true }).addTo(this.map);
    this.pendingLatLng = this.editMarker.getLatLng();
    this.updateSelectedMeta({ latitude: this.pendingLatLng.lat, longitude: this.pendingLatLng.lng });

    this.editMarker.on('drag', () => {
      this.pendingLatLng = this.editMarker.getLatLng();
      this.updateSelectedMeta({ latitude: this.pendingLatLng.lat, longitude: this.pendingLatLng.lng });
    });

    this.mapClickHandler = (event) => {
      if (!this.editMarker) return;
      this.editMarker.setLatLng(event.latlng);
      this.pendingLatLng = event.latlng;
      this.updateSelectedMeta({ latitude: this.pendingLatLng.lat, longitude: this.pendingLatLng.lng });
    };

    this.map.on('click', this.mapClickHandler);
    this.showToast('Drag the marker or click the map to set a new location.', 'info');
  }

  async saveEditLocation() {
    if (!this.gallery || !this.selectedPicture || !this.editMarker) return;

    const latlng = this.editMarker.getLatLng();
    if (!Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) {
      this.showToast('Select a valid location on the map.', 'error');
      return;
    }

    if (this.saveButton) {
      this.saveButton.disabled = true;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/galleries/${this.gallery.id}/pictures/${this.selectedPicture.id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: getCsrfHeaders({ Accept: 'application/json' }),
          body: JSON.stringify({
            latitude: latlng.lat,
            longitude: latlng.lng
          })
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to update location');
      }

      this.selectedPicture.latitude = latlng.lat;
      this.selectedPicture.longitude = latlng.lng;

      this.exitEditMode();
      this.renderAllMarkers();
      this.selectPicture(this.selectedPicture);
      this.showToast('Location updated.', 'success');
    } catch (error) {
      console.error('Failed to update location', error);
      this.showToast(error.message || 'Failed to update location', 'error');
    } finally {
      if (this.saveButton) {
        this.saveButton.disabled = false;
      }
    }
  }

  exitEditMode() {
    if (this.editMarker) {
      this.map.removeLayer(this.editMarker);
      this.editMarker = null;
    }

    if (this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler);
      this.mapClickHandler = null;
    }

    this.pendingLatLng = null;

    if (this.editActionsEl) {
      this.editActionsEl.hidden = true;
    }

    if (this.editButton && this.isOwner) {
      this.editButton.style.display = 'inline-flex';
    }

    if (this.selectedPicture) {
      const coords = this.getPictureLatLng(this.selectedPicture);
      if (coords) {
        this.updateSelectedMarker(coords);
      }
      this.updateSelectedMeta(this.selectedPicture);
    }
  }

  getPictureLatLng(picture) {
    const lat = typeof picture.latitude === 'number' ? picture.latitude : parseFloat(picture.latitude);
    const lng = typeof picture.longitude === 'number' ? picture.longitude : parseFloat(picture.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return [lat, lng];
  }

  getGalleryFallbackCoords() {
    if (!this.gallery) return null;

    const lat = typeof this.gallery.latitude === 'number'
      ? this.gallery.latitude
      : parseFloat(this.gallery.latitude);
    const lng = typeof this.gallery.longitude === 'number'
      ? this.gallery.longitude
      : parseFloat(this.gallery.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return [lat, lng];
  }

  setStatus(message) {
    if (!this.statusEl) return;

    this.statusEl.textContent = message;
    this.statusEl.style.display = message ? 'block' : 'none';
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
}
