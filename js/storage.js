/**
 * storage.js
 * Handles all data persistence via localStorage.
 * Data shape: { entries: MediaEntry[], nextId: number }
 */

const STORAGE_KEY = 'blueberry-media-logger';

/**
 * @typedef {Object} MediaEntry
 * @property {number}   id
 * @property {string}   title
 * @property {'movie'|'series'|'anime'|'documentary'|'short'} type
 * @property {string}   status   - 'watching' | 'completed' | 'dropped' | 'plan' | 'paused'
 * @property {number}   score    - 0–10
 * @property {number}   epCurrent
 * @property {number}   epTotal
 * @property {string[]} genres
 * @property {string}   notes
 * @property {string}   posterDataUrl  - base64 image or ''
 * @property {string}   createdAt  - ISO string
 * @property {string}   updatedAt  - ISO string
 */

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], nextId: 1 };
    return JSON.parse(raw);
  } catch {
    return { entries: [], nextId: 1 };
  }
}

function _save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Storage save failed:', e);
  }
}

export const Storage = {
  /** Get all entries */
  getAll() {
    return _load().entries;
  },

  /** Get single entry by id */
  getById(id) {
    return _load().entries.find(e => e.id === id) || null;
  },

  /** Add new entry, returns saved entry */
  add(data) {
    const state = _load();
    const entry = {
      ...data,
      id: state.nextId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.entries.unshift(entry);
    state.nextId++;
    _save(state);
    return entry;
  },

  /** Update existing entry by id, returns updated entry or null */
  update(id, data) {
    const state = _load();
    const idx = state.entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    state.entries[idx] = {
      ...state.entries[idx],
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    _save(state);
    return state.entries[idx];
  },

  /** Delete entry by id */
  remove(id) {
    const state = _load();
    state.entries = state.entries.filter(e => e.id !== id);
    _save(state);
  },

  /** Get all unique genres across entries */
  getAllGenres() {
    const entries = _load().entries;
    const set = new Set();
    entries.forEach(e => (e.genres || []).forEach(g => set.add(g)));
    return [...set].sort();
  },

  /** Clear everything (for dev/reset) */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
