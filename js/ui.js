import { Storage } from './storage.js';
import { openDetailModal, openEditModal } from './modal.js';

// -------------------------------------------------------
// TOAST
// -------------------------------------------------------
export function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' toast--error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// -------------------------------------------------------
// FILTER STATE
// -------------------------------------------------------
let _activeStatus = 'all';
let _activeGenre  = 'all';
let _searchQuery  = '';

// -------------------------------------------------------
// RENDER APP
// -------------------------------------------------------
export function renderApp() {
  const entries = Storage.getAll();
  renderStats(entries);
  renderFilters(entries);
  renderGrid(entries);
}

// -------------------------------------------------------
// STATS
// -------------------------------------------------------
function renderStats(entries) {
  const bar = document.getElementById('stats-bar');
  if (!bar) return;

  const total     = entries.length;
  const watching  = entries.filter(e => e.status === 'watching').length;
  const completed = entries.filter(e => e.status === 'completed').length;
  const scored    = entries.filter(e => e.score > 0);
  const avgScore  = scored.length
    ? (scored.reduce((s, e) => s + e.score, 0) / scored.length).toFixed(1)
    : '—';

  bar.innerHTML = [
    ['. 📽.ᐟ', total,     'Total'],
    ['[ ▶︎ ]',  watching,  'Watching'],
    ['ꪜ', completed, 'Completed'],
    ['⋆˙⟡', avgScore,  'Avg Score'],
  ].map(([icon, val, label]) => `
    <div class="stat-chip">
      <span>${icon}</span>
      <span class="stat-chip__value">${val}</span>
      <span>${label}</span>
    </div>
  `).join('');
}

// -------------------------------------------------------
// FILTERS
// -------------------------------------------------------
function renderFilters(entries) {
  const statusBar = document.getElementById('filter-status');
  const genreBar  = document.getElementById('filter-genre');
  if (!statusBar || !genreBar) return;

  const statusLabels = {
    all:'All', watching:'Watching', completed:'Completed',
    plan:'Plan', paused:'On Hold', dropped:'Dropped'
  };

  statusBar.innerHTML = ['all','watching','completed','plan','paused','dropped'].map(s => `
    <button class="filter-pill ${_activeStatus === s ? 'active' : ''}" data-status="${s}">
      ${statusLabels[s]}
    </button>
  `).join('');

  const genres = ['all', ...Storage.getAllGenres()];
  genreBar.innerHTML = genres.map(g => `
    <button class="filter-pill ${_activeGenre === g ? 'active' : ''}" data-genre="${g}">
      ${g === 'all' ? 'All Genres' : g}
    </button>
  `).join('');

  statusBar.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => { _activeStatus = btn.dataset.status; renderApp(); });
  });

  genreBar.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => { _activeGenre = btn.dataset.genre; renderApp(); });
  });
}

// -------------------------------------------------------
// FILTER LOGIC
// -------------------------------------------------------
function _applyFilters(entries) {
  return entries.filter(e => {
    const matchStatus = _activeStatus === 'all' || e.status === _activeStatus;
    const matchGenre  = _activeGenre === 'all'  || (e.genres || []).includes(_activeGenre);
    const matchSearch = !_searchQuery
      || e.title.toLowerCase().includes(_searchQuery)
      || (e.notes || '').toLowerCase().includes(_searchQuery);
    return matchStatus && matchGenre && matchSearch;
  });
}

// -------------------------------------------------------
// GRID
// -------------------------------------------------------
export function renderGrid(entries) {
  const container = document.getElementById('grid-container');
  if (!container) return;

  const filtered = _applyFilters(entries);

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎬</div>
        <div class="empty-state__title">${entries.length === 0 ? 'Your library is empty' : 'No results'}</div>
        <div class="empty-state__body">
          ${entries.length === 0
            ? 'Start building your library by adding your first movie or series!'
            : 'No entries match your current filters.'}
        </div>
        ${entries.length === 0
          ? `<button class="btn btn--primary" id="empty-add-btn">Add First Entry</button>`
          : `<button class="btn btn--ghost" id="empty-clear-btn">Clear Filters</button>`}
      </div>
    `;
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      import('./modal.js').then(m => m.openAddModal());
    });
    document.getElementById('empty-clear-btn')?.addEventListener('click', () => {
      _activeStatus = 'all';
      _activeGenre  = 'all';
      _searchQuery  = '';
      document.getElementById('search-input').value = '';
      renderApp();
    });
    return;
  }

  // Group by first genre
  const genreMap = new Map();
  if (_activeGenre !== 'all') {
    genreMap.set(_activeGenre, filtered);
  } else {
    filtered.forEach(entry => {
      const g = entry.genres && entry.genres.length ? entry.genres[0] : 'Uncategorized';
      if (!genreMap.has(g)) genreMap.set(g, []);
      genreMap.get(g).push(entry);
    });
  }

  const sections = [...genreMap.entries()].sort(([a], [b]) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  container.innerHTML = sections.map(([genre, items], i) => `
    <div class="genre-section" style="animation-delay:${i * 0.05}s">
      <div class="genre-section__header">
        <h2 class="genre-section__title">${genre}</h2>
        <span class="genre-section__count">${items.length}</span>
        <div class="genre-section__line"></div>
      </div>
      <div class="genre-grid">
        ${items.map(entry => _renderCard(entry)).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.media-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    card.addEventListener('click', e => {
      if (!e.target.closest('.card-edit-btn')) openDetailModal(id);
    });
    card.querySelector('.card-edit-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(id);
    });
  });
}

// -------------------------------------------------------
// CARD
// -------------------------------------------------------
function _renderCard(entry) {
  const isSeries    = entry.type !== 'movie';
  const percent     = (isSeries && entry.epTotal > 0)
    ? Math.round((entry.epCurrent / entry.epTotal) * 100)
    : (entry.status === 'completed' ? 100 : 0);
  const showProgress = isSeries && (entry.status === 'watching' || entry.status === 'paused');

  const statusShort = { watching:'▶', completed:'✓', dropped:'✕', plan:'○', paused:'⏸' };
  const typeIcon    = { movie:'🎬', series:'📺', anime:'✨', documentary:'🎥', short:'⚡' };

  return `
    <div class="media-card" data-id="${entry.id}" tabindex="0" role="button" aria-label="View ${_esc(entry.title)}">
      <div class="media-card__poster">
        ${entry.posterDataUrl
          ? `<img src="${entry.posterDataUrl}" alt="${_esc(entry.title)}" loading="lazy">`
          : `<div class="media-card__poster-placeholder">
               <span>${typeIcon[entry.type] || '🎞️'}</span>
               <span>${entry.type}</span>
             </div>`}
        <span class="media-card__badge badge--${entry.status}">${statusShort[entry.status] || entry.status}</span>
        ${entry.score > 0 ? `<span class="media-card__score">${entry.score}</span>` : ''}
        ${showProgress ? `
          <div class="media-card__progress">
            <div class="media-card__progress-fill" style="width:${percent}%"></div>
          </div>` : ''}
        <div class="media-card__overlay">
          <button class="btn btn--ghost btn--sm card-edit-btn">✏️ Edit</button>
        </div>
      </div>
      <div class="media-card__body">
        <div class="media-card__title" title="${_esc(entry.title)}">${_esc(entry.title)}</div>
        <div class="media-card__meta">
          <span class="media-card__type">${entry.type}</span>
          ${isSeries ? `<span class="media-card__ep">Ep ${entry.epCurrent || 0}${entry.epTotal ? '/' + entry.epTotal : ''}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------
// SEARCH
// -------------------------------------------------------
export function handleSearch(query) {
  _searchQuery = query.toLowerCase().trim();
  renderGrid(Storage.getAll());
}

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
