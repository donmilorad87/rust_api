import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

export class CompetitionsPage {
  constructor({ baseUrl, listEl, emptyState, createForm, isAdmin, isLogged, showToast }) {
    this.baseUrl = baseUrl;
    this.listEl = listEl;
    this.emptyState = emptyState;
    this.createForm = createForm;
    this.isAdmin = isAdmin;
    this.isLogged = isLogged;
    this.showToast = showToast;

    this.competitions = [];
    this.geoGalleryIndex = new Map();
    this.userGalleries = null;

    this.init();
  }

  init() {
    this.setupCreateForm();
    this.loadGeoGalleries();
    this.loadCompetitions();
  }

  setupCreateForm() {
    if (!this.createForm) return;

    this.setupCreateFormDatePickers();

    this.createForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleCreateCompetition();
    });
  }

  setupCreateFormDatePickers() {
    const startInput = this.createForm.querySelector('input[name="start_date"]');
    const endInput = this.createForm.querySelector('input[name="end_date"]');

    if (!startInput || !endInput) return;

    const updateStartMin = () => {
      const now = this.roundToMinute(new Date());
      const startMin = this.formatDateTimeLocal(this.addHours(now, 1));
      startInput.min = startMin;

      if (startInput.value && this.isDateTimeBefore(startInput.value, startMin)) {
        startInput.value = startMin;
      }
    };

    const updateEndMin = () => {
      if (!startInput.value) {
        const now = this.roundToMinute(new Date());
        const fallbackMin = this.formatDateTimeLocal(this.addHours(now, 24));
        endInput.min = fallbackMin;

        if (endInput.value && this.isDateTimeBefore(endInput.value, fallbackMin)) {
          endInput.value = fallbackMin;
        }

        return;
      }

      const startDate = new Date(startInput.value);
      if (Number.isNaN(startDate.getTime())) return;

      const endMin = this.formatDateTimeLocal(this.addHours(startDate, 1));
      endInput.min = endMin;

      if (endInput.value && this.isDateTimeBefore(endInput.value, endMin)) {
        endInput.value = endMin;
      }
    };

    updateStartMin();
    updateEndMin();

    startInput.addEventListener('input', updateEndMin);
    startInput.addEventListener('change', updateEndMin);
    this.createForm.addEventListener('reset', () => {
      requestAnimationFrame(() => {
        updateStartMin();
        updateEndMin();
      });
    });
  }

  async loadGeoGalleries() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/geo-galleries`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load geo galleries');
      }

      const data = await response.json();
      const galleries = data.galleries || [];
      this.geoGalleryIndex = new Map(galleries.map((gallery) => [gallery.id, gallery]));
    } catch (error) {
      console.error('Failed to load geo galleries', error);
    }
  }

  async loadCompetitions() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/competitions`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load competitions');
      }

      const data = await response.json();
      this.competitions = data.competitions || [];

      this.renderCompetitions();
    } catch (error) {
      console.error('Failed to load competitions', error);
      this.showToast(error.message || 'Failed to load competitions', 'error');
      this.renderCompetitions();
    }
  }

  renderCompetitions() {
    this.listEl.innerHTML = '';

    if (!this.competitions.length) {
      this.emptyState.style.display = 'block';
      return;
    }

    this.emptyState.style.display = 'none';

    this.competitions.forEach((competition) => {
      const card = document.createElement('article');
      card.className = 'competition-card';
      card.dataset.competitionId = competition.id;

      card.innerHTML = `
        <div class="competition-card__header">
          <div>
            <p class="competition-card__eyebrow">${this.formatStatus(competition.status)}</p>
            <h2 class="competition-card__title">${this.escapeHtml(competition.title)}</h2>
            <p class="competition-card__description">${this.escapeHtml(competition.description)}</p>
          </div>
          <div class="competition-card__status competition-card__status--${competition.status}">
            ${this.formatStatus(competition.status)}
          </div>
        </div>
        <div class="competition-card__meta">
          <div>
            <span class="competition-card__label">Dates</span>
            <span>${this.formatDateRange(competition.start_date, competition.end_date)}</span>
          </div>
          <div>
            <span class="competition-card__label">Prize</span>
            <span>${this.formatPrize(competition.prize_cents)}</span>
          </div>
        </div>
        <div class="competition-card__actions">
          <button type="button" class="competition-card__toggle" data-action="toggle">View entries</button>
          ${this.isLogged && competition.status === 'active'
            ? '<button type="button" class="competition-card__join" data-action="join">Join</button>'
            : ''}
        </div>
        <div class="competition-card__details" hidden></div>
      `;

      const toggleBtn = card.querySelector('[data-action="toggle"]');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggleDetails(competition, card));
      }

      const joinBtn = card.querySelector('[data-action="join"]');
      if (joinBtn) {
        joinBtn.addEventListener('click', () => this.openJoinPanel(competition, card));
      }

      this.listEl.appendChild(card);
    });
  }

  async toggleDetails(competition, card) {
    const details = card.querySelector('.competition-card__details');
    if (!details) return;

    if (!details.dataset.loaded) {
      await this.loadCompetitionDetails(competition, details);
      details.dataset.loaded = 'true';
    }

    details.hidden = !details.hidden;
  }

  async loadCompetitionDetails(competition, detailsEl) {
    try {
      if (this.geoGalleryIndex.size === 0) {
        await this.loadGeoGalleries();
      }

      const response = await fetch(`${this.baseUrl}/api/v1/competitions/${competition.id}`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load competition details');
      }

      const data = await response.json();
      this.renderCompetitionDetails(competition, data, detailsEl);
    } catch (error) {
      console.error('Failed to load competition details', error);
      this.showToast(error.message || 'Failed to load competition details', 'error');
    }
  }

  renderCompetitionDetails(competition, data, detailsEl) {
    const competitionDetails = data.competition;
    const entries = data.entries || [];

    detailsEl.innerHTML = `
      <div class="competition-detail">
        <div class="competition-detail__summary">
          <div>
            <span class="competition-detail__label">Rules</span>
            <p class="competition-detail__text">${this.escapeHtml(competitionDetails.rules)}</p>
          </div>
          ${competitionDetails.winner_gallery_id ? `
            <div class="competition-detail__winner">
              Winner gallery ID: ${competitionDetails.winner_gallery_id}
            </div>
          ` : ''}
        </div>
        <div class="competition-detail__entries">
          <h3>Entries</h3>
          <div class="competition-entries"></div>
        </div>
      </div>
    `;

    const entriesContainer = detailsEl.querySelector('.competition-entries');
    if (entriesContainer) {
      entriesContainer.innerHTML = '';
      if (entries.length === 0) {
        entriesContainer.innerHTML = '<p class=\"competition-empty\">No entries submitted yet.</p>';
      } else {
        entries.forEach((entry) => {
          const entryCard = this.buildEntryCard(entry, competitionDetails);
          entriesContainer.appendChild(entryCard);
        });
      }
    }

    if (this.isLogged && competitionDetails.status === 'active') {
      const joinSection = document.createElement('div');
      joinSection.className = 'competition-detail__join';
      joinSection.innerHTML = `
        <h4>Join this competition</h4>
        <form class="competition-join-form">
          <select name="gallery_id" required></select>
          <button type="submit">Submit gallery</button>
        </form>
      `;

      const joinForm = joinSection.querySelector('.competition-join-form');
      const select = joinSection.querySelector('select');

      joinForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.submitJoinCompetition(competitionDetails.id, select.value);
      });

      this.populateJoinOptions(select);
      detailsEl.appendChild(joinSection);
    }

    if (this.isAdmin && competitionDetails.status === 'ended' && !competitionDetails.awarded_at) {
      const finalizeSection = document.createElement('div');
      finalizeSection.className = 'competition-detail__finalize';
      finalizeSection.innerHTML = `
        <button type="button" class="competition-finalize-btn">Finalize competition</button>
      `;
      const finalizeBtn = finalizeSection.querySelector('.competition-finalize-btn');
      finalizeBtn.addEventListener('click', () => this.finalizeCompetition(competitionDetails.id));
      detailsEl.appendChild(finalizeSection);
    }
  }

  buildEntryCard(entry, competitionDetails) {
    const gallery = this.geoGalleryIndex.get(entry.gallery_id);
    const title = gallery ? gallery.title : `Gallery #${entry.gallery_id}`;
    const description = gallery?.description || 'Geo gallery entry';
    const coverImage = gallery?.cover_image_url || '/assets/img/gallery-placeholder.svg';

    const entryCard = document.createElement('article');
    entryCard.className = 'competition-entry';

    entryCard.innerHTML = `
      <div class="competition-entry__media">
        <img src="${coverImage}" alt="${this.escapeHtml(title)}">
      </div>
      <div class="competition-entry__info">
        <h4>${this.escapeHtml(title)}</h4>
        <p>${this.escapeHtml(description)}</p>
        <div class="competition-entry__stats">
          <span>Likes: <strong>${entry.likes_count}</strong></span>
          <span>Admin votes: <strong>${entry.admin_votes_count}</strong></span>
          <span>Score: <strong>${(entry.score * 100).toFixed(1)}%</strong></span>
        </div>
      </div>
      <div class="competition-entry__actions"></div>
    `;

    const actions = entryCard.querySelector('.competition-entry__actions');
    entry._liked = false;

    if (this.isLogged) {
      const likeBtn = document.createElement('button');
      likeBtn.type = 'button';
      likeBtn.className = 'competition-entry__like';
      likeBtn.textContent = 'Like';
      likeBtn.addEventListener('click', () => this.toggleLike(entry, entryCard, likeBtn));
      actions.appendChild(likeBtn);
    }

    if (this.isAdmin && competitionDetails.status === 'active') {
      const voteBtn = document.createElement('button');
      voteBtn.type = 'button';
      voteBtn.className = 'competition-entry__vote';
      voteBtn.textContent = 'Admin vote';
      voteBtn.addEventListener('click', () => this.submitAdminVote(competitionDetails.id, entry, voteBtn, entryCard));
      actions.appendChild(voteBtn);
    }

    return entryCard;
  }

  async toggleLike(entry, entryCard, button) {
    try {
      let response;
      if (!entry._liked) {
        response = await fetch(`${this.baseUrl}/api/v1/galleries/${entry.gallery_id}/likes`, {
          method: 'POST',
          credentials: 'include',
          headers: getCsrfHeaders({ Accept: 'application/json' })
        });
      } else {
        response = await fetch(`${this.baseUrl}/api/v1/galleries/${entry.gallery_id}/likes`, {
          method: 'DELETE',
          credentials: 'include',
          headers: getCsrfHeaders({ Accept: 'application/json' })
        });
      }

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          entry._liked = true;
          button.textContent = 'Unlike';
          return;
        }
        if (response.status === 404) {
          entry._liked = false;
          button.textContent = 'Like';
          return;
        }
        throw new Error(error.error || 'Failed to update like');
      }

      const data = await response.json();
      entry.likes_count = data.likes_count;
      entry._liked = !entry._liked;
      button.textContent = entry._liked ? 'Unlike' : 'Like';
      this.updateEntryStats(entryCard, entry);
    } catch (error) {
      console.error('Failed to update like', error);
      this.showToast(error.message || 'Failed to update like', 'error');
    }
  }

  async submitAdminVote(competitionId, entry, button, entryCard) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/competitions/${competitionId}/admin-votes`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({ gallery_id: entry.gallery_id })
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          button.disabled = true;
          button.textContent = 'Voted';
          return;
        }
        throw new Error(error.error || 'Failed to submit vote');
      }

      entry.admin_votes_count += 1;
      button.disabled = true;
      button.textContent = 'Voted';
      this.updateEntryStats(entryCard, entry);
    } catch (error) {
      console.error('Failed to submit admin vote', error);
      this.showToast(error.message || 'Failed to submit admin vote', 'error');
    }
  }

  async submitJoinCompetition(competitionId, galleryId) {
    if (!galleryId) {
      this.showToast('Select a gallery to submit', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/competitions/${competitionId}/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({ gallery_id: Number(galleryId) })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join competition');
      }

      this.showToast('Gallery submitted to competition', 'success');
      this.loadCompetitions();
    } catch (error) {
      console.error('Failed to join competition', error);
      this.showToast(error.message || 'Failed to join competition', 'error');
    }
  }

  async populateJoinOptions(select) {
    if (!select) return;

    if (!this.userGalleries) {
      await this.loadUserGalleries();
    }

    select.innerHTML = '';

    if (!this.userGalleries || this.userGalleries.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No eligible galleries available';
      option.value = '';
      select.appendChild(option);
      select.disabled = true;
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.textContent = 'Select a gallery';
    placeholder.value = '';
    select.appendChild(placeholder);

    this.userGalleries.forEach((gallery) => {
      const option = document.createElement('option');
      option.value = gallery.id;
      option.textContent = gallery.name;
      select.appendChild(option);
    });
  }

  async loadUserGalleries() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/galleries`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load your galleries');
      }

      const data = await response.json();
      const galleries = data.galleries || [];

      this.userGalleries = galleries.filter(
        (gallery) =>
          gallery.is_public &&
          Number.isFinite(gallery.latitude) &&
          Number.isFinite(gallery.longitude)
      );
    } catch (error) {
      console.error('Failed to load user galleries', error);
      this.userGalleries = [];
    }
  }

  async handleCreateCompetition() {
    if (!this.createForm) return;

    const formData = new FormData(this.createForm);
    const title = formData.get('title')?.toString().trim();
    const description = formData.get('description')?.toString().trim();
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    const rules = formData.get('rules')?.toString().trim();

    if (!title || !description || !startDate || !endDate || !rules) {
      this.showToast('Please fill in all fields', 'error');
      return;
    }

    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate).toISOString();

    if (startIso >= endIso) {
      this.showToast('End date must be after the start date', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/competitions`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({
          title,
          description,
          start_date: startIso,
          end_date: endIso,
          rules
        })
      });

      if (!response.ok) {
        const errorMessage = await this.parseErrorMessage(response);
        throw new Error(errorMessage || 'Failed to create competition');
      }

      this.showToast('Competition created', 'success');
      this.createForm.reset();
      this.loadCompetitions();
    } catch (error) {
      console.error('Failed to create competition', error);
      this.showToast(error.message || 'Failed to create competition', 'error');
    }
  }

  async finalizeCompetition(competitionId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/competitions/${competitionId}/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });

      if (!response.ok) {
        const errorMessage = await this.parseErrorMessage(response);
        throw new Error(errorMessage || 'Failed to finalize competition');
      }

      this.showToast('Competition finalized', 'success');
      this.loadCompetitions();
    } catch (error) {
      console.error('Failed to finalize competition', error);
      this.showToast(error.message || 'Failed to finalize competition', 'error');
    }
  }

  async parseErrorMessage(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}));
      return payload.error || payload.message || response.statusText;
    }

    const text = await response.text().catch(() => '');
    const trimmed = text.trim();

    if (trimmed.startsWith('<')) {
      if (response.status === 401) {
        return 'Please sign in again.';
      }
      if (response.status === 403) {
        return 'Admin permissions required.';
      }
      return 'Unexpected server response. Please refresh and try again.';
    }

    return trimmed || response.statusText;
  }

  openJoinPanel(competition, card) {
    const details = card.querySelector('.competition-card__details');
    if (!details) return;

    if (details.hidden) {
      this.toggleDetails(competition, card).then(() => {
        const joinForm = details.querySelector('.competition-join-form');
        if (joinForm) {
          joinForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  updateEntryStats(entryCard, entry) {
    const stats = entryCard.querySelector('.competition-entry__stats');
    if (!stats) return;

    stats.innerHTML = `
      <span>Likes: <strong>${entry.likes_count}</strong></span>
      <span>Admin votes: <strong>${entry.admin_votes_count}</strong></span>
      <span>Score: <strong>${(entry.score * 100).toFixed(1)}%</strong></span>
    `;
  }

  formatDateTimeLocal(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  roundToMinute(date) {
    const rounded = new Date(date.getTime());
    rounded.setSeconds(0, 0);
    return rounded;
  }

  addHours(date, hours) {
    const updated = new Date(date.getTime());
    updated.setHours(updated.getHours() + hours);
    return updated;
  }

  isDateTimeBefore(value, minValue) {
    const valueDate = new Date(value);
    const minDate = new Date(minValue);

    if (Number.isNaN(valueDate.getTime()) || Number.isNaN(minDate.getTime())) {
      return false;
    }

    return valueDate.getTime() < minDate.getTime();
  }

  formatPrize(value) {
    const euros = (value || 0) / 100;
    return `${euros.toFixed(0)} EUR`;
  }

  formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }

  formatStatus(status) {
    const labels = {
      upcoming: 'Upcoming',
      active: 'Active',
      ended: 'Ended'
    };
    return labels[status] || 'Unknown';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
