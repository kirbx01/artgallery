const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {
  window: $('#window'),
  title: $('#titlebar-text'),
  artwork: $('#artwork'),
  frame: $('#canvas-frame'),
  name: $('#art-name'),
  size: $('#art-size'),
  artMeta: $('#art-meta'),
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
  items: [],
  index: 0,
  tool: 'Select',
  colour: '#000000',
  grid: false,
  checker: true,
  square: false,
  cols: 3,
  limit: 0,
  embed: false,
  welcome: false
};

function clampIndex(i) {
  const n = state.items.length;
  return n ? ((i % n) + n) % n : 0;
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
  return state.square ? state.items.slice(0, state.limit) : state.items;
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

async function loadArtworks() {
  try {
    const res = await fetch(window.ART_DIR + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (Array.isArray(data.artworks) && data.artworks.length) return data.artworks;
  } catch { }
  return window.ARTWORKS;
}

function showArtwork(index, { updateUrl = true, scroll = true } = {}) {
  state.welcome = false;
  state.index = clampIndex(index);
  const item = state.items[state.index];
  const src = window.ART_DIR + item.file;

  el.artwork.classList.add('is-loading');
  el.artwork.alt = item.title;
  el.artwork.src = src;

  el.title.textContent = 'myARTGALLERY - ' + item.title;
  el.name.textContent = item.title;
  el.size.textContent = item.file;

  const permalink = new URL(location.href);
  permalink.searchParams.set('art', item.id);
  permalink.searchParams.delete('embed');
  el.permalink.href = permalink.href;
  el.permalink.textContent = '?art=' + item.id;
  el.permalink.hidden = false;
  el.artMeta.hidden = false;

  const embedUrl = new URL(location.href);
  embedUrl.searchParams.set('art', item.id);
  embedUrl.searchParams.set('embed', '1');
  embedUrl.searchParams.delete('grid');
  el.embedLink.href = embedUrl.href;
  el.embedLink.textContent = 'embed';
  el.embedLink.hidden = false;
  el.embedArt.src = src;
  el.embedArt.alt = item.title;

  el.stView.innerHTML = 'Viewing: <strong>' + item.title + '</strong>';
  el.stIndex.textContent = state.square
    ? item.id + ' of ' + indexToId(state.limit - 1) + '  (' + state.cols + 'x' + state.cols + ')'
    : item.id + ' of ' + indexToId(state.items.length - 1);
  el.stTool.textContent = 'Tool: ' + state.tool;
  el.stMsg.textContent = state.colour.toUpperCase() + ' / #FFFFFF';

  $$('.thumb', el.tray).forEach(t => {
    const active = Number(t.dataset.index) === state.index;
    t.setAttribute('aria-current', active ? 'true' : 'false');
    t.tabIndex = active ? 0 : -1;
  });
  if (scroll) scrollThumbIntoView();
  if (updateUrl) writeUrl({ keepSquare: state.square });
}

function buildTray() {
  el.tray.textContent = '';
  const frag = document.createDocumentFragment();

  visibleArtworks().forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.dataset.index = String(i);
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-current', 'false');
    btn.title = item.title + '  (?art=' + item.id + ')';

    const img = document.createElement('img');
    img.className = 'thumb__img';
    img.src = window.ART_DIR + item.file;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';

    const cap = document.createElement('span');
    cap.className = 'thumb__cap';
    cap.textContent = item.id + ' ' + item.title;

    btn.append(img, cap);
    frag.append(btn);
  });

  el.tray.append(frag);
}

function buildPalette() {
  const frag = document.createDocumentFragment();
  window.PALETTE.forEach(colour => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'swatch';
    sw.style.background = colour;
    sw.title = colour.toUpperCase();
    sw.setAttribute('aria-label', 'Colour ' + colour);
    const fill = document.createElement('span');
    fill.className = 'swatch__fill';
    fill.style.background = colour;
    sw.append(fill);
    frag.append(sw);
  });
  el.palette.append(frag);
  paintActiveSwatch();
}

function paintActiveSwatch() {
  $$('.swatch', el.palette).forEach(sw => {
    sw.classList.toggle('is-active', rgbToHex(getComputedStyle(sw).backgroundColor) === state.colour);
  });
}

function applySquareMode(count) {
  const total = state.items.length;
  state.square = count != null && total > 0;
  state.limit = count == null ? total : Math.min(Math.max(1, count), total);
  state.cols = Math.ceil(Math.sqrt(state.limit));

  el.tray.classList.toggle('is-square', state.square);
  el.tray.style.setProperty('--cols', String(state.cols));
  el.trayLabel.textContent = state.square
    ? 'Samples grid - ' + state.limit + ' artworks (' + state.cols + ' x ' + state.cols + ')'
    : 'Samples - click a thumbnail to open it in the editor';

  buildTray();
}

function wireToolbox() {
  $$('.tool').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tool').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      state.tool = btn.dataset.tool;
      el.stTool.textContent = 'Tool: ' + state.tool;
      flashStatus(state.tool + ' tool selected');
    });
  });
}

function wireTitlebarButtons() {
  $('#btn-max').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => flashStatus('Fullscreen unavailable'));
    }
  });

  $('#btn-close').addEventListener('click', () => {
    if (confirm('myARTGALLERY cannot be closed.\n\n[OK] to return to the gallery.')) {
      flashStatus('Nice try. The gallery is immortal.');
    }
  });

  window.addEventListener('blur', () => el.window.classList.add('is-idle'));
  window.addEventListener('focus', () => el.window.classList.remove('is-idle'));
}

function closeMenus(buttons) {
  buttons.forEach(b => {
    b.setAttribute('aria-expanded', 'false');
    $('#menu-' + b.dataset.menu).hidden = true;
  });
}

function wireMenus() {
  const buttons = $$('.menubar__item[data-menu]');

  buttons.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menu = $('#menu-' + btn.dataset.menu);
      const opening = menu.hidden;
      closeMenus(buttons);
      menu.hidden = !opening;
      btn.setAttribute('aria-expanded', String(opening));
    });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.menu, .menubar__item')) closeMenus(buttons);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenus(buttons);
  });

  $$('.menu__item[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      closeMenus(buttons);
      runAction(item.dataset.action, item);
    });
  });
}

async function runAction(action, item) {
  switch (action) {
    case 'next':
      showArtwork(state.index + 1);
      break;
    case 'prev':
      showArtwork(state.index - 1);
      break;
    case 'reload':
      location.reload();
      break;
    case 'copy-link':
      await copyText(el.permalink.href);
      flashStatus('Link copied to clipboard');
      break;
    case 'toggle-grid':
      state.grid = !state.grid;
      el.frame.classList.toggle('is-grid', state.grid);
      item.setAttribute('aria-checked', String(state.grid));
      break;
    case 'toggle-bg':
      state.checker = !state.checker;
      el.frame.classList.toggle('is-plain', !state.checker);
      item.setAttribute('aria-checked', String(state.checker));
      break;
    case 'grid':
      applySquareMode(state.limit);
      showArtwork(state.index);
      break;
    case 'strip':
      applySquareMode(null);
      showArtwork(state.index);
      break;
    case 'fullscreen':
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen?.().catch(() => flashStatus('Fullscreen unavailable'));
      }
      break;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch { }
    ta.remove();
  }
}

function wireTray() {
  el.tray.addEventListener('click', e => {
    const thumb = e.target.closest('.thumb');
    if (!thumb) return;
    if (state.square) applySquareMode(null);
    showArtwork(Number(thumb.dataset.index));
  });
}

function wirePalette() {
  el.palette.addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    state.colour = rgbToHex(getComputedStyle(sw).backgroundColor);
    paintActiveSwatch();
    el.stMsg.textContent = state.colour.toUpperCase() + ' / #FFFFFF';
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // On the editor welcome screen any navigation key opens the first sample.
    if (state.welcome && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      showArtwork(0);
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        showArtwork(state.index + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        showArtwork(state.index - 1);
        break;
      case 'Home':
        e.preventDefault();
        showArtwork(0);
        break;
      case 'End':
        e.preventDefault();
        showArtwork(state.items.length - 1);
        break;
      case 'g':
      case 'G':
        e.preventDefault();
        runAction(state.square ? 'strip' : 'grid');
        break;
      case 'l':
      case 'L':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          runAction('copy-link');
        }
        break;
    }
  });
}

function wireHistory() {
  window.addEventListener('popstate', () => {
    const p = params();
    const grid = p.get('grid');
    applySquareMode(grid == null ? null : parseInt(grid, 10) || null);
    const i = idToIndex(p.get('art') ?? '');
    if (i >= 0) showArtwork(i, { updateUrl: false });
  });
}

function wireCanvasImage() {
  el.artwork.addEventListener('load', () => {
    el.artwork.classList.remove('is-loading');
    const img = el.artwork;
    if (img.naturalWidth) {
      el.size.textContent = img.naturalWidth + ' x ' + img.naturalHeight;
    }
  });
  el.artwork.addEventListener('error', () => {
    el.artwork.classList.remove('is-loading');
    flashStatus('Could not load image');
  });
  if (el.artwork.complete) el.artwork.classList.remove('is-loading');
}

async function init() {
  const p = params();

  state.embed = p.get('embed') === '1';
  if (state.embed) document.documentElement.classList.add('is-embed');

  state.items = await loadArtworks();

  const grid = p.get('grid');
  applySquareMode(grid == null ? null : parseInt(grid, 10) || null);

  buildPalette();
  wireToolbox();
  wireTitlebarButtons();
  wireMenus();
  wireTray();
  wirePalette();
  wireKeyboard();
  wireHistory();
  wireCanvasImage();

  const readme = p.get('readme');
  if (readme) el.back.href = readme;

  const requested = p.get('art');
  // Editor-first: no ?art= link means land in the paint editor with the
  // upload prompt; permalinks and embeds keep loading their artwork.
  const welcome = typeof window.showWelcome === 'function' &&
    !state.embed && requested == null && grid == null;

  if (!state.items.length) {
    if (welcome) {
      window.showWelcome();
      flashStatus('No samples yet - upload an image to start');
    } else {
      el.stView.textContent = 'No artworks found';
      el.title.textContent = 'myARTGALLERY';
      el.name.textContent = 'Add images to artworksbyme/';
      el.size.textContent = 'then run node tools/build-manifest.mjs';
    }
    return;
  }

  if (welcome) {
    window.showWelcome();
    flashStatus(state.items.length + ' artworks in Samples');
    return;
  }

  const resolved = requested == null ? 0 : idToIndex(requested);
  showArtwork(resolved >= 0 ? resolved : 0, { updateUrl: false });

  writeUrl({ keepSquare: state.square });

  flashStatus(state.items.length + ' artworks loaded');
}

document.addEventListener('DOMContentLoaded', init);
