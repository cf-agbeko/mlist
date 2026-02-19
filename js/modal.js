import { Storage } from './storage.js';
import { showToast, renderApp } from './ui.js';

export const GENRE_PRESETS = [
  'Action', 'Adventure', 'Animation', 'Anime', 'Biography',
  'Comedy', 'Crime', 'Cartoon', 'Documentary', 'Drama', 'Fantasy',
  'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi',
  'Slice of Life', 'Sports', 'Thriller', 'War', 'Western',
];

let _editingId     = null;
let _posterDataUrl = '';
let _selectedGenres = [];
let _score         = 0;
let _epCurrent     = 0;
let _epTotal       = 0;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// -------------------------------------------------------
// OPEN MODALS
// -------------------------------------------------------
export function openAddModal() {
  _editingId = null; _posterDataUrl = ''; _selectedGenres = [];
  _score = 0; _epCurrent = 0; _epTotal = 0;
  _renderEditModal(null);
}

export function openEditModal(id) {
  const entry = Storage.getById(id);
  if (!entry) return;
  _editingId      = id;
  _posterDataUrl  = entry.posterDataUrl || '';
  _selectedGenres = [...(entry.genres || [])];
  _score          = entry.score || 0;
  _epCurrent      = entry.epCurrent || 0;
  _epTotal        = entry.epTotal || 0;
  _renderEditModal(entry);
}

export function openDetailModal(id) {
  const entry = Storage.getById(id);
  if (!entry) return;

  const percent      = entry.epTotal > 0
    ? Math.round((entry.epCurrent / entry.epTotal) * 100)
    : (entry.status === 'completed' ? 100 : 0);
  const circumference = 2 * Math.PI * 28;
  const typeIcon      = { movie:'🎬', series:'📺', anime:'✨', documentary:'🎥', short:'⚡' };

  document.getElementById('modal-backdrop').innerHTML = `
    <div class="modal detail-modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h2 class="modal__title">Details</h2>
        <button class="modal__close" id="modal-close-btn">×</button>
      </div>
      <div class="modal__body">
        <div class="detail-modal__hero">
          <div class="detail-modal__poster">
            ${entry.posterDataUrl
              ? `<img src="${entry.posterDataUrl}" alt="${_esc(entry.title)}">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;color:var(--text-muted)">${typeIcon[entry.type] || '🎬'}</div>`}
          </div>
          <div class="detail-modal__info">
            <div>
              <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:4px">${entry.type}</div>
              <div class="detail-modal__title">${_esc(entry.title)}</div>
            </div>
            <div class="detail-modal__meta-row">
              <span class="media-card__badge badge--${entry.status}" style="position:static">${_statusLabel(entry.status)}</span>
              ${(entry.genres || []).map(g => `<span class="genre-tag" style="cursor:default">${g}</span>`).join('')}
            </div>
            ${entry.type !== 'movie' ? `
            <div class="detail-modal__ep-info">
              <div class="detail-modal__ep-label">Progress</div>
              <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
                <div class="progress-ring">
                  <svg width="80" height="80" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" stroke-width="5"/>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="var(--sage-green)" stroke-width="5"
                      stroke-dasharray="${circumference}"
                      stroke-dashoffset="${circumference - (percent / 100) * circumference}"
                      stroke-linecap="round"/>
                  </svg>
                  <div class="progress-ring__text">${percent}%</div>
                </div>
                <div>
                  <div class="detail-modal__ep-value">${entry.epCurrent || 0} / ${entry.epTotal || '?'}</div>
                  <div class="detail-modal__ep-label">Episodes watched</div>
                </div>
              </div>
            </div>` : ''}
            ${entry.score > 0 ? `
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px">
              <div class="detail-modal__score-display">${entry.score}</div>
              <div class="detail-modal__score-label">/ 10 · ${_scoreStars(entry.score)}</div>
            </div>` : ''}
          </div>
        </div>
        ${entry.notes ? `
        <div class="detail-modal__notes">
          <h4>Notes</h4>
          <p>${_esc(entry.notes)}</p>
        </div>` : ''}
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button class="btn btn--ghost btn--sm" id="detail-edit-btn">✏️ Edit</button>
          <button class="btn btn--danger btn--sm" id="detail-delete-btn">🗑 Delete</button>
        </div>
      </div>
    </div>
  `;

  _openBackdrop();
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    closeModal();
    setTimeout(() => openEditModal(id), 50);
  });
  document.getElementById('detail-delete-btn').addEventListener('click', () => {
    if (confirm(`Delete "${entry.title}"?`)) {
      Storage.remove(id);
      closeModal();
      renderApp();
      showToast('Entry deleted');
    }
  });
}

// -------------------------------------------------------
// EDIT / ADD MODAL
// -------------------------------------------------------
function _renderEditModal(entry) {
  const isEdit = !!entry;

  document.getElementById('modal-backdrop').innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h2 class="modal__title">${isEdit ? 'Edit Entry' : 'Add to Library'}</h2>
        <button class="modal__close" id="modal-close-btn">×</button>
      </div>
      <div class="modal__body">
        <div class="modal__layout">

          <div class="modal__poster-col">
            <div class="image-upload" id="image-upload-wrapper">
              ${_posterDataUrl
                ? `<div class="image-upload__preview">
                    <img src="${_posterDataUrl}" alt="Poster">
                    <button class="image-upload__preview-remove" id="remove-poster-btn">×</button>
                   </div>`
                : `<div class="image-upload__zone" id="upload-zone">
                    <div class="image-upload__icon">🖼️</div>
                    <div class="image-upload__text"><strong>Click or drag</strong><br>to upload poster</div>
                   </div>`}
              <input type="file" id="poster-input" class="image-upload__input" accept="image/*">
            </div>
          </div>

          <div class="modal__form-col">
            <div class="form-group">
              <label class="form-label">Title *</label>
              <input class="form-input" id="input-title" type="text" placeholder="Movie or series name…"
                value="${entry ? _esc(entry.title) : ''}">
            </div>

            <div class="modal__form-row">
              <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-select" id="input-type">
                  ${['movie','series','anime','documentary','short'].map(t =>
                    `<option value="${t}" ${entry?.type === t ? 'selected' : ''}>${_capitalize(t)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="input-status">
                  ${[['watching','Watching'],['completed','Completed'],['plan','Plan to Watch'],['paused','On Hold'],['dropped','Dropped']].map(([v,l]) =>
                    `<option value="${v}" ${entry?.status === v ? 'selected' : ''}>${l}</option>`
                  ).join('')}
                </select>
              </div>
            </div>

            <div id="ep-section" class="modal__form-row">
              <div class="form-group">
                <label class="form-label">Episode (current / total)</label>
                <div class="ep-tracker">
                  <button class="ep-tracker__btn" id="ep-dec-btn" type="button">−</button>
                  <input class="ep-tracker__input" id="ep-current-input" type="number" min="0" value="${_epCurrent}" placeholder="0">
                  <span style="color:var(--text-muted);font-size:13px">/</span>
                  <input class="ep-tracker__input" id="ep-total-input" type="number" min="0" value="${_epTotal || ''}" placeholder="?">
                  <button class="ep-tracker__btn" id="ep-inc-btn" type="button">+</button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Score (1–10)</label>
                <div class="star-rating" id="star-rating">
                  ${[1,2,3,4,5,6,7,8,9,10].map(n =>
                    `<button class="star-rating__star ${_score >= n ? 'active' : ''}" type="button" data-score="${n}">★</button>`
                  ).join('')}
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Genres</label>
              <div class="genre-tag-list" id="genre-preset-list">
                ${GENRE_PRESETS.map(g =>
                  `<span class="genre-tag ${_selectedGenres.includes(g) ? 'selected' : ''}" data-genre="${g}">${g}</span>`
                ).join('')}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-textarea" id="input-notes" placeholder="Your thoughts…">${entry ? _esc(entry.notes || '') : ''}</textarea>
            </div>
          </div>
        </div>

        <div class="modal__footer">
          ${isEdit ? `<button class="btn btn--danger btn--sm" type="button" id="modal-delete-btn">🗑 Delete</button>` : ''}
          <button class="btn btn--ghost" type="button" id="modal-cancel-btn">Cancel</button>
          <button class="btn btn--primary" type="button" id="modal-save-btn">${isEdit ? '💾 Save Changes' : 'Add to Library'}</button>
        </div>
      </div>
    </div>
  `;

  _openBackdrop();
  _bindEditEvents(entry);
}

function _bindEditEvents(entry) {
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

  document.getElementById('modal-delete-btn')?.addEventListener('click', () => {
    if (confirm(`Delete "${entry.title}"?`)) {
      Storage.remove(entry.id);
      closeModal();
      renderApp();
      showToast('Entry deleted');
    }
  });

  // Type → show/hide episodes
  const typeSelect = document.getElementById('input-type');
  const epSection  = document.getElementById('ep-section');
  const toggleEp   = () => { epSection.style.display = typeSelect.value === 'movie' ? 'none' : ''; };
  typeSelect.addEventListener('change', toggleEp);
  toggleEp();

  // Episode +/−
  const epCurInput = document.getElementById('ep-current-input');
  document.getElementById('ep-inc-btn').addEventListener('click', () => {
    _epCurrent = Math.max(0, parseInt(epCurInput.value || 0) + 1);
    epCurInput.value = _epCurrent;
  });
  document.getElementById('ep-dec-btn').addEventListener('click', () => {
    _epCurrent = Math.max(0, parseInt(epCurInput.value || 0) - 1);
    epCurInput.value = _epCurrent;
  });
  epCurInput.addEventListener('input', () => { _epCurrent = parseInt(epCurInput.value) || 0; });
  document.getElementById('ep-total-input').addEventListener('input', e => { _epTotal = parseInt(e.target.value) || 0; });

  // Stars
  const stars = document.querySelectorAll('.star-rating__star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      _score = parseInt(star.dataset.score);
      stars.forEach((s, i) => s.classList.toggle('active', i < _score));
    });
    star.addEventListener('mouseover', () => {
      const h = parseInt(star.dataset.score);
      stars.forEach((s, i) => s.classList.toggle('active', i < h));
    });
    star.addEventListener('mouseout', () => {
      stars.forEach((s, i) => s.classList.toggle('active', i < _score));
    });
  });

  // Genres
  document.querySelectorAll('#genre-preset-list .genre-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const g = tag.dataset.genre;
      if (_selectedGenres.includes(g)) {
        _selectedGenres = _selectedGenres.filter(x => x !== g);
        tag.classList.remove('selected');
      } else {
        _selectedGenres.push(g);
        tag.classList.add('selected');
      }
    });
  });

  // Image upload
  const posterInput = document.getElementById('poster-input');
  const uploadZone  = document.getElementById('upload-zone');

  if (uploadZone) {
    uploadZone.addEventListener('click', () => posterInput.click());
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', async e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        _posterDataUrl = await readFileAsDataURL(file);
        _refreshPoster();
      }
    });
  }

  posterInput.addEventListener('change', async () => {
    const file = posterInput.files[0];
    if (file) { _posterDataUrl = await readFileAsDataURL(file); _refreshPoster(); }
  });

  document.getElementById('remove-poster-btn')?.addEventListener('click', () => {
    _posterDataUrl = '';
    _refreshPoster();
  });

  // Save
  document.getElementById('modal-save-btn').addEventListener('click', _saveEntry);
}

function _refreshPoster() {
  const wrapper = document.getElementById('image-upload-wrapper');
  if (!wrapper) return;

  if (_posterDataUrl) {
    wrapper.innerHTML = `
      <div class="image-upload__preview">
        <img src="${_posterDataUrl}" alt="Poster">
        <button class="image-upload__preview-remove" id="remove-poster-btn">×</button>
      </div>
      <input type="file" id="poster-input" class="image-upload__input" accept="image/*">
    `;
    document.getElementById('remove-poster-btn').addEventListener('click', () => { _posterDataUrl = ''; _refreshPoster(); });
  } else {
    wrapper.innerHTML = `
      <div class="image-upload__zone" id="upload-zone">
        <div class="image-upload__icon">🖼️</div>
        <div class="image-upload__text"><strong>Click or drag</strong><br>to upload poster</div>
      </div>
      <input type="file" id="poster-input" class="image-upload__input" accept="image/*">
    `;
    const zone  = document.getElementById('upload-zone');
    const input = document.getElementById('poster-input');
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (file) { _posterDataUrl = await readFileAsDataURL(file); _refreshPoster(); }
    });
  }
}

function _saveEntry() {
  const title = document.getElementById('input-title').value.trim();
  if (!title) {
    document.getElementById('input-title').focus();
    showToast('Please enter a title', true);
    return;
  }

  const data = {
    title,
    type:          document.getElementById('input-type').value,
    status:        document.getElementById('input-status').value,
    score:         _score,
    epCurrent:     parseInt(document.getElementById('ep-current-input')?.value || 0),
    epTotal:       parseInt(document.getElementById('ep-total-input')?.value || 0),
    genres:        [..._selectedGenres],
    notes:         document.getElementById('input-notes').value.trim(),
    posterDataUrl: _posterDataUrl,
  };

  if (_editingId !== null) {
    Storage.update(_editingId, data);
    showToast('Entry updated ✓');
  } else {
    Storage.add(data);
    showToast('Added to library ✓');
  }

  closeModal();
  renderApp();
}

// -------------------------------------------------------
// BACKDROP
// -------------------------------------------------------
function _openBackdrop() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); }, { once: true });
  document.addEventListener('keydown', _handleEsc);
  requestAnimationFrame(() => backdrop.classList.add('open'));
}

export function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.remove('open');
  document.removeEventListener('keydown', _handleEsc);
  setTimeout(() => { backdrop.innerHTML = ''; }, 300);
}

function _handleEsc(e) { if (e.key === 'Escape') closeModal(); }

// -------------------------------------------------------
// UTILS
// -------------------------------------------------------
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function _statusLabel(s) {
  return { watching:'Watching', completed:'Completed', dropped:'Dropped', plan:'Plan to Watch', paused:'On Hold' }[s] || s;
}

function _scoreStars(score) {
  const full = Math.round(score / 2);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}
