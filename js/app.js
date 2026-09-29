const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {
  window: $('#window'),
  title: $('#titlebar-text'),
  artwork: $('#artwork'),
  frame: $('#canvas-frame'),
  name: $('#art-name'),
  size: $('#art-size'),
  permalink: $('#art-link'),
  embedLink: $('#art-embed'),
  embedArt: $('#embed-art'),
  tray: $('#tray'),
  trayLabel: $('#tray-label'),
  palette: $('#palette'),
  stView: $('#status-viewing'),
  stIndex: $('#status-index'),
  stTool: $('#status-tool'),
  stMsg: $('#status-msg'),
  back: $('#back-link')
};

const state = {
  index: 0,
  tool: 'Select',
  colour: '#000000',
  grid: false,
  checker: true,
  square: false,
  cols: 3,
  limit: 0,
  embed: false
};

function clampIndex(i) {
  const n = window.ARTWORKS.length;
  return ((i % n) + n) % n;
}

function idToIndex(id) {
  const n = parseInt(String(id), 10);
  if (Number.isNaN(n) || n < 1) return -1;
  return clampIndex(n - 1);
}

function indexToId(i) {
  return String(i + 1).padStart(2, '0');
}

function params() {
  return new URL(location.href).searchParams;
}

function visibleArtworks() {
  return state.square ? window.ARTWORKS.slice(0, state.limit) : window.ARTWORKS;
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#000000';
  return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

function writeUrl({ keepSquare = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('art', indexToId(state.index));
  if (!keepSquare) url.searchParams.delete('grid');
  history.replaceState(history.state, '', url);
}

function scrollThumbIntoView() {
  if (state.square) return;
  const thumb = el.tray.children[state.index];
  if (!thumb) return;
  const t = thumb.offsetLeft - el.tray.clientWidth / 2 + thumb.offsetWidth / 2;
  el.tray.scrollTo({ left: Math.max(0, t), behavior: 'smooth' });
}

let flashTimer;
function flashStatus(msg) {
  clearTimeout(flashTimer);
  el.stMsg.textContent = msg;
  flashTimer = setTimeout(() => {
    el.stMsg.textContent = state.colour.toUpperCase() + ' / #FFFFFF';
  }, 1600);
}
