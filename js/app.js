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

function showArtwork(index, { updateUrl = true, scroll = true } = {}) {
  state.index = clampIndex(index);
  const item = window.ARTWORKS[state.index];

  el.artwork.classList.add('is-loading');
  el.artwork.alt = item.title + ' - ' + item.blurb;
  el.artwork.src = item.art;

  el.title.textContent = 'myARTGALLERY - ' + item.title;
  el.name.textContent = item.title;
  el.size.textContent = item.blurb;

  const permalink = new URL(location.href);
  permalink.searchParams.set('art', item.id);
  permalink.searchParams.delete('embed');
  el.permalink.href = permalink.href;
  el.permalink.textContent = '?art=' + item.id;

  const embedUrl = new URL(location.href);
  embedUrl.searchParams.set('art', item.id);
  embedUrl.searchParams.set('embed', '1');
  embedUrl.searchParams.delete('grid');
  el.embedLink.href = embedUrl.href;
  el.embedLink.textContent = 'embed';
  el.embedArt.src = item.art;
  el.embedArt.alt = item.title;

  el.stView.innerHTML = 'Viewing: <strong>' + item.title + '</strong>';
  el.stIndex.textContent = state.square
    ? item.id + ' of ' + indexToId(state.limit - 1) + '  (' + state.cols + 'x' + state.cols + ')'
    : item.id + ' of ' + indexToId(window.ARTWORKS.length - 1);
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
    btn.title = item.title + ' - ' + item.blurb + '  (?art=' + item.id + ')';

    const img = document.createElement('img');
    img.className = 'thumb__img';
    img.src = item.art;
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
  const total = window.ARTWORKS.length;
  state.square = count != null;
  state.limit = count == null ? total : Math.min(Math.max(1, count), total);
  state.cols = Math.ceil(Math.sqrt(state.limit));

  el.tray.classList.toggle('is-square', state.square);
  el.tray.style.setProperty('--cols', String(state.cols));
  el.trayLabel.textContent = state.square
    ? 'Square grid - ' + state.limit + ' artworks (' + state.cols + ' x ' + state.cols + ')'
    : 'Gallery - click a thumbnail to open it';

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
