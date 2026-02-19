import { renderApp, handleSearch } from './ui.js';
import { openAddModal } from './modal.js';

function init() {
  document.getElementById('add-btn').addEventListener('click', openAddModal);

  let debounce;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => handleSearch(e.target.value), 200);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'a' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      openAddModal();
    }
  });

  renderApp();
}

document.addEventListener('DOMContentLoaded', init);
