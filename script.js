'use strict';

const STORAGE_KEY = 'mintbrain_hierarchy_v1';
const THEME_KEY = 'kb_theme';

const state = {
  notes: [],
  folder: 'Усі',
  query: '',
  favOnly: false,
  sort: 'new',
  currentId: null,
  pendingDeleteId: null
};

const $ = (sel) => document.querySelector(sel);
const els = {
  grid: $('#notesGrid'),
  empty: $('#emptyState'),
  folderSelect: $('#folderSelect'),
  search: $('#searchInput'),
  favOnly: $('#favOnly'),
  sort: $('#sortSelect'),
  info: $('#resultsInfo'),
  statTotal: $('#statTotal'),
  statFolders: $('#statFolders'),
  statFav: $('#statFav'),
  themeToggle: $('#themeToggle'),
  themeIcon: $('#themeIcon'),
  tpl: $('#noteCardTemplate'),

  exportBtn: $('#exportBtn'),
  importBtn: $('#importBtn'),
  importFile: $('#importFile'),

  modalEl: $('#noteModal'),
  modalTitle: $('#noteModalTitle'),
  viewPane: $('#viewPane'),
  viewFolder: $('#viewFolder'),
  viewDate: $('#viewDate'),
  viewTitle: $('#viewTitle'),
  viewContent: $('#viewContent'),
  viewTags: $('#viewTags'),
  viewWordStats: $('#viewWordStats'),
  copyContentBtn: $('#copyContentBtn'),
  viewFavBtn: $('#viewFavBtn'),
  viewEditBtn: $('#viewEditBtn'),
  viewDeleteBtn: $('#viewDeleteBtn'),

  form: $('#noteForm'),
  noteId: $('#noteId'),
  noteTitle: $('#noteTitle'),
  noteFolder: $('#noteFolder'),
  noteTags: $('#noteTags'),
  noteContent: $('#noteContent'),
  noteFav: $('#noteFav'),
  notePinned: $('#notePinned'),
  charCounter: $('#charCounter'),
  editorTools: $('#editorTools'),
  formCancelBtn: $('#formCancelBtn'),

  confirmEl: $('#confirmModal'),
  confirmDeleteBtn: $('#confirmDeleteBtn'),
  toastEl: $('#appToast'),
  toastBody: $('#toastBody')
};

const noteModal = new bootstrap.Modal(els.modalEl);
const confirmModal = new bootstrap.Modal(els.confirmEl);
const toast = new bootstrap.Toast(els.toastEl, { delay: 2600 });

const uid = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function highlight(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const q = escapeHtml(query.trim());
  if (!q) return safe;
  return safe.replace(new RegExp('(' + q + ')', 'gi'), '<mark class="kb-hl">$1</mark>');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function parseTags(str) {
  return str.split(',')
    .map(t => t.trim().replace(/^#/, '').toLowerCase())
    .filter(t => t)
    .slice(0, 8);
}

function showToast(message, icon = 'bi-check-circle-fill text-success') {
  els.toastBody.innerHTML = '<i class="bi ' + icon + ' me-2"></i>' + escapeHtml(message);
  toast.show();
}

function demoNotes() {
  const now = Date.now();
  return [
    {
      id: uid(),
      title: 'План захисту курсової роботи',
      folder: 'Навчання / РФКІТ / Курсова',
      pinned: true,
      content: '<b>Основні завдання для завершення:</b>\n- Реалізувати ієрархію папок\n- Перевірити швидкий пошук\n- Підготувати доповідь для викладача (Олександр Темнов)',
      tags: ['курсова', 'рфкіт', 'база-знань'],
      favorite: true,
      createdAt: new Date(now - 86400000).toISOString(),
      updatedAt: new Date(now - 86400000).toISOString()
    },
    {
      id: uid(),
      title: 'Документація по JavaScript ES6+',
      folder: 'Програмування / Web',
      pinned: false,
      content: '<code>LocalStorage API</code> використовується для збереження папок і нотаток без сервера.\nВикористовуємо <i>JSON.stringify()</i> та <i>JSON.parse()</i>.',
      tags: ['js', 'frontend', 'web'],
      favorite: false,
      createdAt: new Date(now - 172800000).toISOString(),
      updatedAt: new Date(now - 172800000).toISOString()
    }
  ];
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : demoNotes();
  } catch (e) {
    return demoNotes();
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  els.themeIcon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

function initTheme() {
  let theme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(theme);
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

function getVisibleNotes() {
  const q = state.query.trim().toLowerCase();
  return state.notes.filter(n => {
    if (state.folder !== 'Усі' && !n.folder.startsWith(state.folder)) return false;
    if (state.favOnly && !n.favorite) return false;
    if (!q) return true;
    const haystack = [n.title, n.content, n.folder, (n.tags || []).join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => haystack.includes(w));
  }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.createdAt) - new Date(a.createdAt));
}

function renderStats() {
  els.statTotal.textContent = state.notes.length;
  els.statFav.textContent = state.notes.filter(n => n.favorite).length;
  els.statFolders.textContent = new Set(state.notes.map(n => n.folder)).size;
}

function renderNotes() {
  const list = getVisibleNotes();
  els.grid.innerHTML = '';

  list.forEach(note => {
    const node = els.tpl.content.firstElementChild.cloneNode(true);
    const card = node.querySelector('.note-card');
    card.dataset.id = note.id;

    node.querySelector('.js-folder').innerHTML = '<i class="bi bi-folder me-1"></i>' + escapeHtml(note.folder);
    if (note.pinned) node.querySelector('.js-pinned').classList.remove('d-none');

    node.querySelector('.js-title').innerHTML = highlight(note.title, state.query);
    node.querySelector('.js-date').textContent = formatDate(note.createdAt);

    const cleanText = note.content.replace(/<[^>]*>?/gm, '');
    node.querySelector('.js-excerpt').innerHTML = highlight(cleanText.slice(0, 150) + '…', state.query);

    const tagsBox = node.querySelector('.js-tags');
    (note.tags || []).forEach(t => {
      const s = document.createElement('span');
      s.className = 'badge text-bg-light border';
      s.innerHTML = '#' + highlight(t, state.query);
      tagsBox.appendChild(s);
    });

    const fav = node.querySelector('.js-fav');
    fav.classList.toggle('text-warning', note.favorite);

    els.grid.appendChild(node);
  });

  els.empty.classList.toggle('d-none', list.length > 0);
  els.info.textContent = 'Знайдено нотаток: ' + list.length;
}

function renderAll() {
  renderStats();
  renderNotes();
}

const findNote = (id) => state.notes.find(n => n.id === id);

els.editorTools.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-format]');
  if (!btn) return;
  const format = btn.dataset.format;
  const txt = els.noteContent;
  const start = txt.selectionStart;
  const end = txt.selectionEnd;
  const sel = txt.value.substring(start, end);

  let replacement = '';
  if (format === 'bold') replacement = `<b>${sel || 'Текст'}</b>`;
  if (format === 'italic') replacement = `<i>${sel || 'Текст'}</i>`;
  if (format === 'list') replacement = `\n- ${sel || 'Елемент списку'}`;
  if (format === 'code') replacement = `<code>${sel || 'код'}</code>`;

  txt.value = txt.value.substring(0, start) + replacement + txt.value.substring(end);
  txt.focus();
});

els.folderSelect.addEventListener('change', (e) => { state.folder = e.target.value; renderNotes(); });
els.search.addEventListener('input', (e) => { state.query = e.target.value; renderNotes(); });
els.favOnly.addEventListener('change', (e) => { state.favOnly = e.target.checked; renderNotes(); });
els.themeToggle.addEventListener('click', toggleTheme);

$('#newNoteBtn').addEventListener('click', () => openForm());
$('#emptyNewBtn').addEventListener('click', () => openForm());

els.grid.addEventListener('click', (e) => {
  const card = e.target.closest('.note-card');
  if (!card) return;
  const id = card.dataset.id;
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    e.stopPropagation();
    const action = actionEl.dataset.action;
    if (action === 'fav') {
      const n = findNote(id);
      n.favorite = !n.favorite;
      saveNotes(); renderAll();
    }
    if (action === 'edit') openForm(id);
    if (action === 'delete') askDelete(id);
    return;
  }
  openView(id);
});

function openView(id) {
  const note = findNote(id);
  if (!note) return;
  state.currentId = id;
  els.viewFolder.innerHTML = '<i class="bi bi-folder me-1"></i>' + escapeHtml(note.folder);
  els.viewDate.textContent = formatDate(note.createdAt);
  els.viewTitle.textContent = note.title;
  els.viewContent.innerHTML = note.content;
  els.viewWordStats.textContent = note.content.length + ' символів';

  els.viewPane.classList.remove('d-none');
  els.form.classList.add('d-none');
  noteModal.show();
}

function openForm(id = null) {
  els.form.reset();
  const note = id ? findNote(id) : null;
  if (note) {
    state.currentId = id;
    els.noteId.value = note.id;
    els.noteTitle.value = note.title;
    els.noteFolder.value = note.folder;
    els.noteTags.value = (note.tags || []).join(', ');
    els.noteContent.value = note.content;
    els.noteFav.checked = note.favorite;
    els.notePinned.checked = !!note.pinned;
  } else {
    state.currentId = null;
    els.noteId.value = '';
  }
  els.viewPane.classList.add('d-none');
  els.form.classList.remove('d-none');
  noteModal.show();
}

function askDelete(id) {
  state.pendingDeleteId = id;
  confirmModal.show();
}

els.confirmDeleteBtn.addEventListener('click', () => {
  state.notes = state.notes.filter(n => n.id !== state.pendingDeleteId);
  saveNotes(); confirmModal.hide(); renderAll();
  showToast('Нотатку видалено');
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    title: els.noteTitle.value,
    folder: els.noteFolder.value,
    content: els.noteContent.value,
    tags: parseTags(els.noteTags.value),
    favorite: els.noteFav.checked,
    pinned: els.notePinned.checked
  };
  if (els.noteId.value) {
    Object.assign(findNote(els.noteId.value), data);
  } else {
    state.notes.unshift({ id: uid(), ...data, createdAt: new Date().toISOString() });
  }
  saveNotes(); noteModal.hide(); renderAll();
  showToast('Збережено');
});

function init() {
  $('#year').textContent = new Date().getFullYear();
  initTheme();
  state.notes = loadNotes();
  renderAll();
}

init();