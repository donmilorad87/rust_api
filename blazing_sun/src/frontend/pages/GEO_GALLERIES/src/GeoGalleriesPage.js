import L from 'leaflet';
import { getCsrfHeaders, getCsrfToken } from '../../GLOBAL/src/js/csrf.js';

export class GeoGalleriesPage {
  constructor({
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
  }) {
    this.baseUrl = baseUrl;
    this.mapEl = mapEl;
    this.filters = filters;
    this.stats = stats;
    this.placeForm = placeForm;
    this.placeUseLocationBtn = placeUseLocationBtn;
    this.placeGalleryModal = placeGalleryModal;
    this.placeGalleryTitle = placeGalleryTitle;
    this.placeGalleryMeta = placeGalleryMeta;
    this.placeGalleryGrid = placeGalleryGrid;
    this.placeGalleryEmpty = placeGalleryEmpty;
    this.placeImageForm = placeImageForm;
    this.placeImageInput = placeImageInput;
    this.placeImageMetaList = placeImageMetaList;
    this.placeImagePlaceId = placeImagePlaceId;
    this.detailPathTemplate = detailPathTemplate;
    this.isAdmin = isAdmin;
    this.showToast = showToast;

    this.map = null;
    this.layers = {
      galleries: L.layerGroup(),
      restaurants: L.layerGroup(),
      cafes: L.layerGroup(),
      lodgings: L.layerGroup()
    };
    this.galleries = [];
    this.places = [];
    this.currentPlace = null;
    this.placeImageFiles = [];
    this.placeImageMetadata = [];

    this.init();
  }

  init() {
    this.setupMap();
    this.setupFilters();
    this.setupPlaceForm();
    this.setupPlaceGalleryModal();
    this.loadData();
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

    Object.values(this.layers).forEach((layer) => layer.addTo(this.map));

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

  setupFilters() {
    this.filters.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const layerKey = checkbox.dataset.filter;
        if (!layerKey || !this.layers[layerKey]) return;

        if (checkbox.checked) {
          this.layers[layerKey].addTo(this.map);
        } else {
          this.layers[layerKey].removeFrom(this.map);
        }
      });
    });
  }

  setupPlaceForm() {
    if (!this.placeForm) return;

    this.placeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitPlace();
    });

    if (this.placeUseLocationBtn) {
      this.placeUseLocationBtn.addEventListener('click', () => this.useCurrentPlaceLocation());
    }
  }

  setupPlaceGalleryModal() {
    if (!this.placeGalleryModal) return;

    const closeButtons = this.placeGalleryModal.querySelectorAll('[data-geo-modal-close]');
    closeButtons.forEach((button) => {
      button.addEventListener('click', () => this.closePlaceGallery());
    });

    if (this.placeImageForm) {
      this.placeImageForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.submitPlaceImages();
      });
    }

    if (this.placeImageInput) {
      this.placeImageInput.addEventListener('change', (event) => {
        this.handlePlaceImageSelect(event);
      });
    }
  }

  async loadData() {
    try {
      const [galleriesResponse, placesResponse] = await Promise.all([
        fetch(`${this.baseUrl}/api/v1/geo-galleries`, {
          method: 'GET',
          credentials: 'include',
          headers: getCsrfHeaders({ Accept: 'application/json' })
        }),
        fetch(`${this.baseUrl}/api/v1/geo-places`, {
          method: 'GET',
          credentials: 'include',
          headers: getCsrfHeaders({ Accept: 'application/json' })
        })
      ]);

      if (!galleriesResponse.ok) {
        throw new Error('Failed to load geo galleries');
      }

      if (!placesResponse.ok) {
        throw new Error('Failed to load geo places');
      }

      const galleriesData = await galleriesResponse.json();
      const placesData = await placesResponse.json();

      this.galleries = galleriesData.galleries || [];
      this.places = placesData.places || [];

      this.renderGalleries();
      this.renderPlaces();
      this.updateStats();
      this.fitMapBounds();
    } catch (error) {
      console.error('Failed to load map data', error);
      this.showToast(error.message || 'Failed to load map data', 'error');
    }
  }

  renderGalleries() {
    this.layers.galleries.clearLayers();

    this.galleries.forEach((gallery) => {
      const marker = this.createGalleryMarker(gallery);
      marker.addTo(this.layers.galleries);
    });
  }

  renderPlaces() {
    this.layers.restaurants.clearLayers();
    this.layers.cafes.clearLayers();
    this.layers.lodgings.clearLayers();

    this.places.forEach((place) => {
      const marker = this.createPlaceMarker(place);
      const layerKey = `${place.place_type}s`;
      if (this.layers[layerKey]) {
        marker.addTo(this.layers[layerKey]);
      }
    });
  }

  createGalleryMarker(gallery) {
    const icon = L.divIcon({
      className: 'geo-marker geo-marker--gallery',
      html: `
        <div class="geo-marker__pin">
          <div class="geo-marker__image" style="background-image: url('${gallery.cover_image_url}')"></div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 52],
      popupAnchor: [0, -46]
    });

    const marker = L.marker([gallery.latitude, gallery.longitude], { icon });
    marker.bindPopup(this.buildGalleryPopup(gallery), {
      maxWidth: 260,
      className: 'geo-popup'
    });

    return marker;
  }

  createPlaceMarker(place) {
    const iconMap = {
      restaurant: 'R',
      cafe: 'C',
      lodging: 'L'
    };

    const icon = L.divIcon({
      className: `geo-marker geo-marker--place geo-marker--${place.place_type}`,
      html: `<div class="geo-marker__icon">${iconMap[place.place_type] || '📍'}</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -40]
    });

    const marker = L.marker([place.latitude, place.longitude], { icon });
    marker.bindPopup(this.buildPlacePopup(place), {
      maxWidth: 240,
      className: 'geo-popup'
    });

    marker.on('popupopen', (event) => {
      const popupEl = event.popup?.getElement();
      const galleryBtn = popupEl?.querySelector('[data-action="place-gallery"]');
      if (galleryBtn) {
        galleryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openPlaceGallery(place);
        });
      }
    });

    return marker;
  }

  buildGalleryPopup(gallery) {
    const description = gallery.description ? this.escapeHtml(gallery.description) : 'Nature photo gallery';
    const tags = Array.isArray(gallery.tags) && gallery.tags.length > 0
      ? gallery.tags.map((tag) => `<span class="geo-tag">${this.escapeHtml(tag)}</span>`).join('')
      : '';
    const detailPath = this.detailPathTemplate
      ? this.detailPathTemplate.replace('__UUID__', encodeURIComponent(gallery.gallery_uuid))
      : `/geo_gallery/${encodeURIComponent(gallery.gallery_uuid)}`;

    return `
      <div class="geo-popup__content">
        <img src="${gallery.cover_image_url}" alt="${this.escapeHtml(gallery.title)}" class="geo-popup__image">
        <h3 class="geo-popup__title">${this.escapeHtml(gallery.title)}</h3>
        <p class="geo-popup__description">${description}</p>
        ${tags ? `<div class="geo-popup__tags">${tags}</div>` : ''}
        <a class="geo-popup__link" href="${detailPath}">View Gallery</a>
      </div>
    `;
  }

  buildPlacePopup(place) {
    const count = Number.isFinite(place.image_count) ? place.image_count : 0;
    const galleryLabel = count > 0 ? `View gallery (${count})` : 'View gallery';

    return `
      <div class="geo-popup__content">
        <h3 class="geo-popup__title">${this.escapeHtml(place.name)}</h3>
        <p class="geo-popup__description">${this.escapeHtml(place.description || 'Nearby spot for hikers')}</p>
        <p class="geo-popup__meta">${this.formatPlaceType(place.place_type)}</p>
        <button type="button" class="geo-popup__link" data-action="place-gallery">${galleryLabel}</button>
      </div>
    `;
  }

  updateStats() {
    if (this.stats?.galleries) {
      this.stats.galleries.textContent = this.galleries.length.toString();
    }
    if (this.stats?.places) {
      this.stats.places.textContent = this.places.length.toString();
    }
  }

  fitMapBounds() {
    const points = [];

    this.galleries.forEach((gallery) => {
      points.push([gallery.latitude, gallery.longitude]);
    });

    this.places.forEach((place) => {
      points.push([place.latitude, place.longitude]);
    });

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  async submitPlace() {
    if (!this.placeForm) return;

    const formData = new FormData(this.placeForm);
    const name = formData.get('name')?.toString().trim();
    const placeType = formData.get('place_type');
    const description = formData.get('description')?.toString().trim() || null;
    const latitude = parseFloat(formData.get('latitude'));
    const longitude = parseFloat(formData.get('longitude'));

    if (!name) {
      this.showToast('Place name is required', 'error');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.showToast('Valid latitude and longitude are required', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/geo-places`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({
          name,
          place_type: placeType,
          description,
          latitude,
          longitude
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add place');
      }

      this.showToast('Place added to map', 'success');
      this.placeForm.reset();
      await this.loadData();
    } catch (error) {
      console.error('Failed to add place', error);
      this.showToast(error.message || 'Failed to add place', 'error');
    }
  }

  openPlaceGallery(place) {
    if (!this.placeGalleryModal) return;
    this.currentPlace = place;

    if (this.placeGalleryTitle) {
      this.placeGalleryTitle.textContent = place.name;
    }

    if (this.placeGalleryMeta) {
      const description = place.description ? ` · ${place.description}` : '';
      this.placeGalleryMeta.textContent = `${this.formatPlaceType(place.place_type)}${description}`;
    }

    if (this.placeImagePlaceId) {
      this.placeImagePlaceId.value = place.id;
    }

    this.placeImageFiles = [];
    this.placeImageMetadata = [];
    if (this.placeImageInput) {
      this.placeImageInput.value = '';
    }
    this.renderPlaceImageMetaList();

    this.placeGalleryModal.classList.add('geo-modal--open');
    this.placeGalleryModal.setAttribute('aria-hidden', 'false');

    this.loadPlaceImages(place.id);
  }

  closePlaceGallery() {
    if (!this.placeGalleryModal) return;
    this.placeGalleryModal.classList.remove('geo-modal--open');
    this.placeGalleryModal.setAttribute('aria-hidden', 'true');
  }

  async loadPlaceImages(placeId) {
    if (!placeId) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/geo-places/${placeId}/images`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load place images');
      }

      const data = await response.json();
      this.renderPlaceImages(data.images || []);
    } catch (error) {
      console.error('Failed to load place images', error);
      this.showToast(error.message || 'Failed to load place images', 'error');
    }
  }

  renderPlaceImages(images) {
    if (!this.placeGalleryGrid) return;

    this.placeGalleryGrid.innerHTML = '';

    if (!images.length) {
      if (this.placeGalleryEmpty) {
        this.placeGalleryEmpty.style.display = 'block';
      }
      return;
    }

    if (this.placeGalleryEmpty) {
      this.placeGalleryEmpty.style.display = 'none';
    }

    images.forEach((image) => {
      const card = document.createElement('article');
      card.className = 'geo-gallery-card';
      card.innerHTML = `
        <div class="geo-gallery-card__image">
          <img src="${image.url}" alt="${this.escapeHtml(image.title || 'Place photo')}">
        </div>
        <div class="geo-gallery-card__content">
          <h4 class="geo-gallery-card__title">${this.escapeHtml(image.title || 'Untitled')}</h4>
          ${image.tag ? `<span class="geo-tag">${this.escapeHtml(image.tag)}</span>` : ''}
          ${image.description ? `<p class="geo-gallery-card__description">${this.escapeHtml(image.description)}</p>` : ''}
          ${this.formatCoordinates(image.latitude, image.longitude)}
        </div>
      `;
      this.placeGalleryGrid.appendChild(card);
    });
  }

  handlePlaceImageSelect(event) {
    const files = Array.from(event.target.files || []);
    this.placeImageFiles = files;

    const latitude = this.currentPlace?.latitude ?? '';
    const longitude = this.currentPlace?.longitude ?? '';
    const tag = this.currentPlace?.place_type ?? '';

    this.placeImageMetadata = files.map(() => ({
      title: '',
      description: '',
      tag,
      latitude,
      longitude
    }));

    this.renderPlaceImageMetaList();
  }

  renderPlaceImageMetaList() {
    if (!this.placeImageMetaList) return;

    this.placeImageMetaList.innerHTML = '';

    if (!this.placeImageFiles.length) {
      return;
    }

    this.placeImageFiles.forEach((file, index) => {
      const metadata = this.placeImageMetadata[index] || {};
      const item = document.createElement('div');
      item.className = 'geo-upload-item';
      item.dataset.index = index.toString();

      item.innerHTML = `
        <div class="geo-upload-item__preview">
          <img alt="${this.escapeHtml(file.name)}">
        </div>
        <div class="geo-upload-item__fields">
          <label>Title
            <input type="text" data-field="title" placeholder="Mountain sunrise">
          </label>
          <label>Description
            <textarea data-field="description" rows="2" placeholder="Short description"></textarea>
          </label>
          <label>Tag
            <input type="text" data-field="tag" placeholder="trailhead">
          </label>
          <div class="geo-upload-item__coords">
            <label>Latitude
              <input type="number" data-field="latitude" step="any" required>
            </label>
            <label>Longitude
              <input type="number" data-field="longitude" step="any" required>
            </label>
          </div>
          <button type="button" class="geo-upload-item__remove" data-action="remove">Remove</button>
        </div>
      `;

      const img = item.querySelector('img');
      if (img) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      const fields = item.querySelectorAll('[data-field]');
      fields.forEach((field) => {
        const fieldName = field.dataset.field;
        if (fieldName && metadata[fieldName] !== undefined) {
          field.value = metadata[fieldName];
        }
        field.addEventListener('input', (e) => {
          const target = e.currentTarget;
          const fieldName = target.dataset.field;
          if (!fieldName) return;
          this.placeImageMetadata[index] = {
            ...this.placeImageMetadata[index],
            [fieldName]: target.value
          };
        });
      });

      const removeBtn = item.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.placeImageFiles.splice(index, 1);
          this.placeImageMetadata.splice(index, 1);
          this.renderPlaceImageMetaList();
        });
      }

      this.placeImageMetaList.appendChild(item);
    });
  }

  async submitPlaceImages() {
    if (!this.isAdmin) return;
    if (!this.currentPlace) {
      this.showToast('Select a place first', 'error');
      return;
    }

    if (!this.placeImageFiles.length) {
      this.showToast('Add at least one image', 'error');
      return;
    }

    const submitBtn = this.placeImageForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
    }

    try {
      for (let i = 0; i < this.placeImageFiles.length; i += 1) {
        const file = this.placeImageFiles[i];
        const metadata = this.placeImageMetadata[i] || {};
        const latitude = parseFloat(metadata.latitude);
        const longitude = parseFloat(metadata.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error('Each image needs latitude and longitude');
        }

        const uploadId = await this.uploadFile(file);
        await this.addPlaceImage(this.currentPlace.id, {
          upload_id: uploadId,
          title: metadata.title || file.name,
          description: metadata.description || null,
          tag: metadata.tag || null,
          latitude,
          longitude
        });
      }

      this.showToast('Place images uploaded', 'success');
      this.placeImageFiles = [];
      this.placeImageMetadata = [];
      if (this.placeImageInput) {
        this.placeImageInput.value = '';
      }
      this.renderPlaceImageMetaList();
      await this.loadPlaceImages(this.currentPlace.id);
      await this.loadData();
    } catch (error) {
      console.error('Failed to upload place images', error);
      this.showToast(error.message || 'Failed to upload place images', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }

    const data = await response.json();
    return data.id;
  }

  async addPlaceImage(placeId, payload) {
    const response = await fetch(`${this.baseUrl}/api/v1/admin/geo-places/${placeId}/images`, {
      method: 'POST',
      credentials: 'include',
      headers: getCsrfHeaders({ Accept: 'application/json' }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add place image');
    }

    return response.json();
  }

  useCurrentPlaceLocation() {
    const latitudeInput = this.placeForm?.querySelector('input[name="latitude"]');
    const longitudeInput = this.placeForm?.querySelector('input[name="longitude"]');

    if (!latitudeInput || !longitudeInput) return;

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      this.showToast('Location requires HTTPS or localhost. Enter coordinates manually.', 'error');
      return;
    }

    if (!navigator.geolocation) {
      this.showToast('Geolocation is not supported by this browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitudeInput.value = position.coords.latitude.toString();
        longitudeInput.value = position.coords.longitude.toString();
        this.showToast('Location added', 'success');
      },
      (error) => {
        let message = 'Unable to retrieve your location';
        if (error && error.code === 1) {
          message = 'Location permission denied. Enable it in your browser settings.';
        } else if (error && error.code === 2) {
          message = 'Location unavailable. Try again or enter coordinates manually.';
        } else if (error && error.code === 3) {
          message = 'Location request timed out. Try again.';
        }

        this.showToast(message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  formatPlaceType(type) {
    const labels = {
      restaurant: 'Restaurant',
      cafe: 'Cafe',
      lodging: 'Lodging'
    };
    return labels[type] || 'Place';
  }

  formatCoordinates(latitude, longitude) {
    const latValue = typeof latitude === 'number' ? latitude : parseFloat(latitude);
    const lngValue = typeof longitude === 'number' ? longitude : parseFloat(longitude);
    if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
      return '';
    }
    return `<p class="geo-gallery-card__meta">${latValue.toFixed(6)}, ${lngValue.toFixed(6)}</p>`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
