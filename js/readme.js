/*
 * js/readme.js — README panel: local import preview, snippet, copy.
 * Entirely client-side: the chosen file is read into an in-memory object URL
 * and never transmitted anywhere. The snippet mirrors `artgallery export
 * --readme` so the panel, the CLI and the README block stay interchangeable.
 */
(() => {
  'use strict';

  const overlay = document.getElementById('readme-overlay');
  if (!overlay) return;
  const $ = id => document.getElementById(id);

  const fileIn = $('rp-file');
  const nameEl = $('rp-name');
  const preview = $('rp-preview');
  const emptyEl = $('rp-empty');
  const titleIn = $('rp-title');
  const idIn = $('rp-id');
  const sizeIn = $('rp-size');
  const targetIn = $('rp-target');
  const baseRow = $('rp-base-row');
  const baseIn = $('rp-base');
  const snippetIn = $('rp-snippet');
  const copyBtn = $('rp-copy');

  const LOCAL_BASE = 'http://localhost:8080';                 // artgallery serve default
  const SITE_BASE = 'https://kirbx01.github.io/artgallery';   // siteUrl from gallery.config.json
  const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;

  let objectUrl = null;

  // same title convention as tools/build-manifest.mjs
  function humanize(name) {
    return name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // same escaping as tools/build-manifest.mjs
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function currentBase() {
    const v = targetIn.value;
    if (v === 'site') return SITE_BASE;
    if (v === 'custom') return baseIn.value.trim().replace(/\/+$/, '') || LOCAL_BASE;
    return LOCAL_BASE;
  }

  function buildSnippet() {
    const base = currentBase();
    const id = (idIn.value || '').trim() || '01';
    const w = Math.min(4096, Math.max(1, parseInt(sizeIn.value, 10) || 52));
    const title = (titleIn.value || '').trim() || 'Artwork';
    return '<p align="center">\n' +
      '  <a href="' + escapeHtml(base) + '/?art=' + escapeHtml(id) +
      '"><img src="' + escapeHtml(base) + '/artworks/generated/' + escapeHtml(id) +
      '.svg" width="' + w + '" alt="' + escapeHtml(title) + '"></a>\n' +
      '</p>\n';
  }

  function update() {
    snippetIn.value = buildSnippet();
  }

  function openPanel() {
    overlay.hidden = false;
    update();
    copyBtn.focus();
  }

  function closePanel() {
    overlay.hidden = true;
  }

  // Local-only import: object URLs are in-memory blobs, never uploaded.
  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    if (!IMAGE_RE.test(f.name) && !/^image\//.test(f.type || '')) {
      flashStatus('README: unsupported image type');
      fileIn.value = '';
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    preview.src = objectUrl;
    preview.hidden = false;
    emptyEl.hidden = true;
    nameEl.textContent = f.name;
    titleIn.value = humanize(f.name);
    update();
    flashStatus('Local preview: ' + f.name);
  });
  [titleIn, idIn, sizeIn, baseIn].forEach(el => el.addEventListener('input', update));
  targetIn.addEventListener('change', () => {
    baseRow.hidden = targetIn.value !== 'custom';
    update();
  });
  snippetIn.addEventListener('focus', () => snippetIn.select());

  copyBtn.addEventListener('click', async () => {
    update();
    await copyText(snippetIn.value);   // clipboard helper from app.js
    flashStatus('README snippet copied');
  });

  const menuBtn = document.querySelector('.menu__item[data-action="readme-panel"]');
  if (menuBtn) menuBtn.addEventListener('click', openPanel);
  $('rp-close').addEventListener('click', closePanel);

  document.addEventListener('keydown', e => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  });
})();
