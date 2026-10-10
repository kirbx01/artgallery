/*
 * js/editor.js — real paint tools for the existing stage.
 * Pure client-side canvas editing: no backend, no dependencies, no uploads.
 * Extends app.js through its globals (state, flashStatus, paintActiveSwatch)
 * without modifying it.
 */
(() => {
  'use strict';

  const frame = document.getElementById('canvas-frame');
  const canvas = document.getElementById('paint');
  const artwork = document.getElementById('artwork');
  const selBox = document.getElementById('sel-box');
  const overlay = document.getElementById('adjust-overlay');
  if (!frame || !canvas || !artwork || !overlay) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const $f = id => document.getElementById(id);

  const MAX_UNDO = 10;
  const TEXT_FONT = '16px Tahoma, "MS Sans Serif", Verdana, sans-serif';
  const TEXT_LINE = 20;
  const FILTER_IDS = ['f-bright', 'f-contrast', 'f-sat', 'f-hue', 'f-blur', 'f-sharp', 'f-pix'];

  let hasArt = false;
  let activeDoc = null;       // { image, undo, redo } of the open artwork
  const docs = new Map();     // artwork id -> doc; edits survive navigation
  let size = 4;               // brush / eraser / outline size
  let lastTool = 'Select';    // eyedropper reverts to the previous tool
  let drag = null;            // active pointer gesture
  let sel = null;             // active selection { x, y, w, h }
  let textInput = null;       // open text entry
  let textPos = null;
  let textColour = '#000000';
  let filterBase = null;      // pixels from before the dialog opened
  let previewPending = false;

  // ---------- history (per artwork) ----------
  function snapshot() {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function pushUndo(pre) {
    if (!activeDoc) return;
    activeDoc.undo.push(pre || snapshot());
    if (activeDoc.undo.length > MAX_UNDO) activeDoc.undo.shift();
    activeDoc.redo.length = 0;
  }

  function restore(entry) {
    canvas.width = entry.width;
    canvas.height = entry.height;
    ctx.putImageData(entry, 0, 0);
  }

  function undo() {
    if (!overlay.hidden || drag) return;
    if (!hasArt || !activeDoc) { flashStatus('No artwork loaded'); return; }
    if (!activeDoc.undo.length) { flashStatus('Nothing to undo'); return; }
    activeDoc.redo.push(snapshot());
    restore(activeDoc.undo.pop());
    clearSel();
    flashStatus('Undo');
  }

  function redo() {
    if (!overlay.hidden || drag) return;
    if (!hasArt || !activeDoc) { flashStatus('No artwork loaded'); return; }
    if (!activeDoc.redo.length) { flashStatus('Nothing to redo'); return; }
    activeDoc.undo.push(snapshot());
    restore(activeDoc.redo.pop());
    clearSel();
    flashStatus('Redo');
  }

  // ---------- artwork lifecycle ----------
  function onArtworkLoad() {
    if (!state.items.length) return;
    hasArt = true;
    cancelText();
    if (activeDoc) activeDoc.image = snapshot();

    const item = state.items[state.index];
    const id = item ? item.id : String(state.index);
    let doc = docs.get(id);
    if (!doc) {
      doc = { image: null, undo: [], redo: [] };
      docs.set(id, doc);
    }
    doc.title = item.title;
    activeDoc = doc;
    clearSel();

    if (doc.image) {
      canvas.width = doc.image.width;
      canvas.height = doc.image.height;
      ctx.putImageData(doc.image, 0, 0);
    } else {
      canvas.width = artwork.naturalWidth;
      canvas.height = artwork.naturalHeight;
      ctx.drawImage(artwork, 0, 0);
    }
    frame.classList.add('is-editing');
  }

  artwork.addEventListener('load', onArtworkLoad);
  artwork.addEventListener('error', () => {
    frame.classList.remove('is-editing');
    hasArt = false;
  });

  // ---------- local image import (File → Open Image, Ctrl+O, drag & drop) ----------
  const fileIn = $f('open-file');
  const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;

  function humanName(name) {
    return name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase()) || 'Untitled';
  }

  // Draw a local file onto the paint canvas as its own document. The file is
  // read into memory only: the object URL is revoked right after decoding and
  // nothing is ever uploaded. Reopening the same file restores its edits.
  function openLocalImage(file) {
    if (!file) return;
    if (!IMAGE_RE.test(file.name) && !/^image\//.test(file.type || '')) {
      flashStatus('Unsupported image type');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      cancelText();
      if (activeDoc) activeDoc.image = snapshot();

      const key = 'local:' + file.name + ':' + file.size;
      let doc = docs.get(key);
      if (!doc) {
        doc = { image: null, undo: [], redo: [], title: humanName(file.name) };
        docs.set(key, doc);
      }
      if (activeDoc === doc) {
        flashStatus('Image already open');
        return;
      }
      activeDoc = doc;
      clearSel();

      artwork.classList.remove('is-loading');
      if (doc.image) {
        canvas.width = doc.image.width;
        canvas.height = doc.image.height;
        ctx.putImageData(doc.image, 0, 0);
      } else {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }
      hasArt = true;
      frame.classList.add('is-editing');

      el.title.textContent = 'myARTGALLERY - ' + doc.title;
      el.name.textContent = doc.title + ' (local)';
      el.size.textContent = canvas.width + ' x ' + canvas.height;
      flashStatus('Opened ' + file.name + ' — stays on this machine');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      flashStatus('Could not read image');
    };
    img.src = url;
  }

  if (fileIn) {
    fileIn.addEventListener('change', () => {
      openLocalImage(fileIn.files && fileIn.files[0]);
      fileIn.value = '';
    });
    bindLater('open-image', () => fileIn.click());
  }

  function bindLater(action, fn) {
    const b = document.querySelector('.menu__item[data-action="' + action + '"]');
    if (b) b.addEventListener('click', fn);
  }

  // ---------- pointer plumbing ----------
  function pt(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height)
    };
  }

  function clampi(v, max) {
    return Math.min(max - 1, Math.max(0, Math.floor(v)));
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { r: 0, g: 0, b: 0 };
    const n = parseInt(m[1], 16);
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
  }

  // ---------- freehand strokes (pencil / brush / eraser) ----------
  function stampDot(p) {
    ctx.save();
    if (drag.tool === 'Eraser') ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = drag.tool === 'Eraser' ? '#000' : drag.colour;
    if (drag.tool === 'Pencil') {
      ctx.fillRect(clampi(p.x, canvas.width), clampi(p.y, canvas.height), 1, 1);
    } else if (drag.tool === 'Eraser') {
      const s = drag.size;
      ctx.fillRect(clampi(p.x, canvas.width) - (s >> 1), clampi(p.y, canvas.height) - (s >> 1), s, s);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, drag.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function bresLine(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < canvas.width && y0 < canvas.height) ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function strokeSeg(a, b) {
    ctx.save();
    if (drag.tool === 'Eraser') ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = drag.tool === 'Eraser' ? '#000' : drag.colour;
    ctx.strokeStyle = drag.tool === 'Eraser' ? '#000' : drag.colour;
    if (drag.tool === 'Pencil') {
      bresLine(Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y));
    } else {
      ctx.lineWidth = drag.size;
      const round = drag.tool === 'Brush';
      ctx.lineCap = round ? 'round' : 'square';
      ctx.lineJoin = round ? 'round' : 'miter';
      ctx.beginPath();
      if (round) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.moveTo(Math.floor(a.x) + 0.5, Math.floor(a.y) + 0.5);
        ctx.lineTo(Math.floor(b.x) + 0.5, Math.floor(b.y) + 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- shapes (line / rectangle / ellipse) ----------
  function drawShape(c, kind, a, b, colour, lw, shift) {
    let bx = b.x, by = b.y;
    if (shift) {
      if (kind === 'Line') {
        const dx = bx - a.x, dy = by - a.y;
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        bx = a.x + Math.cos(ang) * len;
        by = a.y + Math.sin(ang) * len;
      } else {
        const side = Math.max(Math.abs(bx - a.x), Math.abs(by - a.y));
        bx = a.x + (bx < a.x ? -side : side);
        by = a.y + (by < a.y ? -side : side);
      }
    }
    const off = lw === 1 ? 0.5 : 0;
    c.save();
    c.strokeStyle = colour;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'miter';
    c.beginPath();
    if (kind === 'Line') {
      c.moveTo(a.x + off, a.y + off);
      c.lineTo(bx + off, by + off);
    } else if (kind === 'Rectangle') {
      c.rect(Math.min(a.x, bx) + off, Math.min(a.y, by) + off, Math.abs(bx - a.x), Math.abs(by - a.y));
    } else {
      c.ellipse((a.x + bx) / 2 + off, (a.y + by) / 2 + off,
        Math.abs(bx - a.x) / 2, Math.abs(by - a.y) / 2, 0, 0, Math.PI * 2);
    }
    c.stroke();
    c.restore();
  }

  function drawDashedRect(c, r) {
    c.save();
    c.strokeStyle = '#000';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(1, r.w - 1), Math.max(1, r.h - 1));
    c.restore();
  }

  function normRect(a, b) {
    return {
      x: Math.floor(Math.min(a.x, b.x)),
      y: Math.floor(Math.min(a.y, b.y)),
      w: Math.max(1, Math.round(Math.abs(b.x - a.x))),
      h: Math.max(1, Math.round(Math.abs(b.y - a.y)))
    };
  }

  // ---------- bucket fill (exact match, client-side) ----------
  function floodFill(p) {
    const w = canvas.width, h = canvas.height;
    const x = clampi(p.x, w), y = clampi(p.y, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const i0 = (y * w + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const fc = hexToRgb(state.colour);
    if (tr === fc.r && tg === fc.g && tb === fc.b && ta === 255) return false;
    pushUndo(img);
    const stack = [x, y];
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const i = (cy * w + cx) * 4;
      if (d[i] !== tr || d[i + 1] !== tg || d[i + 2] !== tb || d[i + 3] !== ta) continue;
      d[i] = fc.r; d[i + 1] = fc.g; d[i + 2] = fc.b; d[i + 3] = 255;
      stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
    ctx.putImageData(img, 0, 0);
    return true;
  }

  // ---------- eyedropper ----------
  function pickColour(p) {
    const x = clampi(p.x, canvas.width), y = clampi(p.y, canvas.height);
    const d = ctx.getImageData(x, y, 1, 1).data;
    state.colour = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    paintActiveSwatch();
    flashStatus(d[3] === 0 ? 'Transparent pixel' : 'Picked ' + state.colour.toUpperCase());
    const btn = document.querySelector('.tool[data-tool="' + lastTool + '"]');
    if (btn) btn.click();
  }
  // ---------- crop ----------
  function doCrop(x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(canvas.width, Math.ceil(x + w));
    const y1 = Math.min(canvas.height, Math.ceil(y + h));
    if (x1 - x0 < 1 || y1 - y0 < 1 ||
      (x0 === 0 && y0 === 0 && x1 === canvas.width && y1 === canvas.height)) {
      flashStatus('Nothing to crop');
      return;
    }
    pushUndo();
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    canvas.width = data.width;
    canvas.height = data.height;
    ctx.putImageData(data, 0, 0);
    clearSel();
    flashStatus('Cropped to ' + data.width + ' x ' + data.height);
  }

  // ---------- selection (marquee + move) ----------
  function showSelBoxRect(r) {
    const cr = canvas.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const sx = cr.width / canvas.width;
    const sy = cr.height / canvas.height;
    selBox.style.left = (cr.left - fr.left - frame.clientLeft + r.x * sx) + 'px';
    selBox.style.top = (cr.top - fr.top - frame.clientTop + r.y * sy) + 'px';
    selBox.style.width = (r.w * sx) + 'px';
    selBox.style.height = (r.h * sy) + 'px';
    selBox.hidden = false;
  }

  function clearSel() {
    sel = null;
    selBox.hidden = true;
  }

  function inSel(p) {
    if (!sel) return false;
    const x = Math.floor(p.x), y = Math.floor(p.y);
    return x >= sel.x && x < sel.x + sel.w && y >= sel.y && y < sel.y + sel.h;
  }

  function beginLift(d) {
    pushUndo(d.pre);
    d.lifted = ctx.getImageData(d.sel.x, d.sel.y, d.sel.w, d.sel.h);
    d.base = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bd = d.base.data;
    const x0 = Math.max(0, d.sel.x), x1 = Math.min(canvas.width, d.sel.x + d.sel.w);
    const y0 = Math.max(0, d.sel.y), y1 = Math.min(canvas.height, d.sel.y + d.sel.h);
    for (let y = y0; y < y1; y++) {
      let i = (y * canvas.width + x0) * 4 + 3;
      for (let x = x0; x < x1; x++, i += 4) bd[i] = 0;
    }
    d.moved = true;
  }

  // ---------- text tool ----------
  function openText(p) {
    cancelText();
    const cr = canvas.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const scale = cr.width / canvas.width;
    textPos = { x: Math.floor(p.x), y: Math.floor(p.y) };
    textColour = state.colour;
    textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'text-entry';
    textInput.style.left = (cr.left - fr.left - frame.clientLeft + textPos.x * scale) + 'px';
    textInput.style.top = (cr.top - fr.top - frame.clientTop + textPos.y * scale) + 'px';
    textInput.style.width = Math.max(90, Math.round(170 * scale)) + 'px';
    textInput.style.font = (16 * scale) + 'px Tahoma, "MS Sans Serif", Verdana, sans-serif';
    textInput.style.lineHeight = (TEXT_LINE * scale) + 'px';
    textInput.style.color = textColour;
    textInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitText();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelText();
      }
    });
    textInput.addEventListener('blur', commitText);
    frame.append(textInput);
    textInput.focus();
  }

  function commitText() {
    if (!textInput) return;
    const value = textInput.value;
    const pos = textPos, colour = textColour;
    detachText();
    if (!value || !pos || !hasArt) return;
    pushUndo();
    ctx.save();
    ctx.fillStyle = colour;
    ctx.font = TEXT_FONT;
    ctx.textBaseline = 'top';
    ctx.fillText(value, pos.x, pos.y);
    ctx.restore();
    flashStatus('Text added');
  }

  function cancelText() {
    detachText();
  }

  function detachText() {
    if (!textInput) return;
    const input = textInput;
    textInput = null;
    input.removeEventListener('blur', commitText);
    input.remove();
  }

  // ---------- save (local PNG download, never uploaded) ----------
  function savePng() {
    if (!hasArt) { flashStatus('No artwork loaded'); return; }
    commitText();
    const item = state.items[state.index];
    const fallback = (activeDoc && activeDoc.title) || (item && item.title) || 'artwork';
    const name = fallback.replace(/[\\/:*?"<>|]+/g, '_');
    canvas.toBlob(blob => {
      if (!blob) { flashStatus('Could not export PNG'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      flashStatus('Saved ' + name + '.png');
    }, 'image/png');
  }
  // ---------- filters & adjustments (real pixel work, never CSS) ----------
  function readFilters() {
    return {
      bright: +$f('f-bright').value,
      contrast: +$f('f-contrast').value,
      sat: +$f('f-sat').value,
      hue: +$f('f-hue').value,
      blur: +$f('f-blur').value,
      sharp: +$f('f-sharp').value,
      pix: +$f('f-pix').value,
      gray: $f('f-gray').checked,
      invert: $f('f-invert').checked
    };
  }

  function filtersDirty(o) {
    return Boolean(o.bright || o.contrast || o.sat || o.hue ||
      o.blur || o.sharp || o.pix >= 2 || o.gray || o.invert);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }

  function applyFilters(base, o) {
    const out = ctx.createImageData(base.width, base.height);
    out.data.set(base.data);
    const d = out.data;
    if (o.bright || o.contrast || o.sat || o.hue || o.gray || o.invert) {
      const bf = 1 + o.bright / 100;
      const cval = o.contrast * 2.55;
      const cf = (259 * (cval + 255)) / (255 * (259 - cval));
      const sf = 1 + o.sat / 100;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (o.bright) { r *= bf; g *= bf; b *= bf; }
        if (o.contrast) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128; }
        if (o.sat || o.hue) {
          const hsl = rgbToHsl(r, g, b);
          let h = hsl[0], s = hsl[1];
          if (o.hue) h = ((h + o.hue / 360) % 1 + 1) % 1;
          if (o.sat) s = Math.min(1, Math.max(0, s * sf));
          const rgb = hslToRgb(h, s, hsl[2]);
          r = rgb[0]; g = rgb[1]; b = rgb[2];
        }
        if (o.gray) { const lum = 0.299 * r + 0.587 * g + 0.114 * b; r = lum; g = lum; b = lum; }
        if (o.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    }
    if (o.blur > 0) boxBlur(out, o.blur);
    if (o.sharp > 0) sharpen(out, o.sharp / 100);
    if (o.pix >= 2) pixelate(out, o.pix);
    return out;
  }
  function boxBlur(img, r) {
    const w = img.width, h = img.height, d = img.data;
    const tmp = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rs = 0, gs = 0, bs = 0, as = 0, n = 0;
        for (let k = -r; k <= r; k++) {
          const xx = x + k;
          if (xx < 0 || xx >= w) continue;
          const i = (y * w + xx) * 4;
          rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; as += d[i + 3]; n++;
        }
        const o = (y * w + x) * 4;
        tmp[o] = rs / n; tmp[o + 1] = gs / n; tmp[o + 2] = bs / n; tmp[o + 3] = as / n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rs = 0, gs = 0, bs = 0, as = 0, n = 0;
        for (let k = -r; k <= r; k++) {
          const yy = y + k;
          if (yy < 0 || yy >= h) continue;
          const i = (yy * w + x) * 4;
          rs += tmp[i]; gs += tmp[i + 1]; bs += tmp[i + 2]; as += tmp[i + 3]; n++;
        }
        const o = (y * w + x) * 4;
        d[o] = rs / n; d[o + 1] = gs / n; d[o + 2] = bs / n; d[o + 3] = as / n;
      }
    }
  }

  function sharpen(img, amt) {
    const w = img.width, h = img.height, d = img.data;
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const il = (y * w + (x > 0 ? x - 1 : x)) * 4;
        const ir = (y * w + (x < w - 1 ? x + 1 : x)) * 4;
        const iu = ((y > 0 ? y - 1 : y) * w + x) * 4;
        const ib = ((y < h - 1 ? y + 1 : y) * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          d[i + c] = src[i + c] + amt * (4 * src[i + c] -
            src[il + c] - src[ir + c] - src[iu + c] - src[ib + c]);
        }
      }
    }
  }

  function pixelate(img, block) {
    const w = img.width, h = img.height, d = img.data;
    for (let by = 0; by < h; by += block) {
      for (let bx = 0; bx < w; bx += block) {
        const bw = Math.min(block, w - bx), bh = Math.min(block, h - by);
        let rs = 0, gs = 0, bs = 0, as = 0, n = 0;
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const i = (y * w + x) * 4;
            rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; as += d[i + 3]; n++;
          }
        }
        rs /= n; gs /= n; bs /= n; as /= n;
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const i = (y * w + x) * 4;
            d[i] = rs; d[i + 1] = gs; d[i + 2] = bs; d[i + 3] = as;
          }
        }
      }
    }
  }

  function schedulePreview() {
    if (previewPending || !filterBase) return;
    previewPending = true;
    requestAnimationFrame(() => {
      previewPending = false;
      renderPreview();
    });
  }

  function renderPreview() {
    if (!filterBase) return;
    ctx.putImageData(applyFilters(filterBase, readFilters()), 0, 0);
  }

  function resetFilters() {
    FILTER_IDS.forEach(id => {
      $f(id).value = '0';
      $f(id + '-v').textContent = '0';
    });
    $f('f-gray').checked = false;
    $f('f-invert').checked = false;
  }

  function openAdjust() {
    if (!hasArt) { flashStatus('No artwork loaded'); return; }
    commitText();
    clearSel();
    filterBase = snapshot();
    resetFilters();
    overlay.hidden = false;
    $f('f-apply').focus();
  }

  function closeAdjust(apply) {
    if (!filterBase) { overlay.hidden = true; return; }
    const dirty = apply && filtersDirty(readFilters());
    if (dirty) renderPreview();
    const base = filterBase;
    filterBase = null;
    overlay.hidden = true;
    if (dirty) {
      activeDoc.undo.push(base);
      if (activeDoc.undo.length > MAX_UNDO) activeDoc.undo.shift();
      activeDoc.redo.length = 0;
      flashStatus('Filters applied');
    } else {
      ctx.putImageData(base, 0, 0);
      flashStatus(apply ? 'No changes to apply' : 'Filters cancelled');
    }
  }

  FILTER_IDS.forEach(id => {
    $f(id).addEventListener('input', () => {
      $f(id + '-v').textContent = $f(id).value;
      schedulePreview();
    });
  });
  ['f-gray', 'f-invert'].forEach(id => $f(id).addEventListener('change', schedulePreview));
  $f('f-reset').addEventListener('click', () => { resetFilters(); schedulePreview(); });
  $f('f-cancel').addEventListener('click', () => closeAdjust(false));
  $f('adjust-close').addEventListener('click', () => closeAdjust(false));
  $f('f-apply').addEventListener('click', () => closeAdjust(true));
  // ---------- pointer handling ----------
  canvas.addEventListener('pointerdown', e => {
    if (drag) return;
    if (!hasArt) { flashStatus('No artwork loaded'); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    commitText();
    const tool = state.tool;
    const p = pt(e);

    if (tool === 'Pick') { pickColour(p); return; }
    if (tool === 'Fill') {
      if (floodFill(p)) flashStatus('Filled with ' + state.colour.toUpperCase());
      return;
    }
    if (tool === 'Text') { openText(p); return; }

    if (tool === 'Select') {
      if (inSel(p)) {
        drag = {
          tool: 'MoveSel', id: e.pointerId, start: p,
          sel: { x: sel.x, y: sel.y, w: sel.w, h: sel.h },
          pre: snapshot(), moved: false, off: { x: 0, y: 0 }
        };
      } else {
        if (sel) clearSel();
        drag = { tool: 'Marquee', id: e.pointerId, a: p, b: p };
      }
    } else if (tool === 'Pencil' || tool === 'Brush' || tool === 'Eraser') {
      pushUndo();
      drag = { tool, id: e.pointerId, colour: state.colour, size, last: p };
      stampDot(p);
    } else if (tool === 'Line' || tool === 'Rectangle' || tool === 'Ellipse') {
      drag = { tool, id: e.pointerId, colour: state.colour, size, a: p, b: p, pre: snapshot(), moved: false };
    } else if (tool === 'Crop') {
      drag = { tool: 'Crop', id: e.pointerId, a: p, b: p, pre: snapshot(), moved: false };
    }

    if (drag) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pt(e);
    switch (drag.tool) {
      case 'Pencil':
      case 'Brush':
      case 'Eraser':
        strokeSeg(drag.last, p);
        drag.last = p;
        break;
      case 'Line':
      case 'Rectangle':
      case 'Ellipse':
        drag.b = p;
        if (Math.hypot(p.x - drag.a.x, p.y - drag.a.y) >= 2) drag.moved = true;
        ctx.putImageData(drag.pre, 0, 0);
        if (drag.moved) drawShape(ctx, drag.tool, drag.a, p, drag.colour, drag.size, e.shiftKey);
        break;
      case 'Crop':
        drag.b = p;
        if (Math.hypot(p.x - drag.a.x, p.y - drag.a.y) >= 2) drag.moved = true;
        ctx.putImageData(drag.pre, 0, 0);
        if (drag.moved) drawDashedRect(ctx, normRect(drag.a, p));
        break;
      case 'Marquee':
        drag.b = p;
        showSelBoxRect(normRect(drag.a, p));
        break;
      case 'MoveSel':
        drag.off.x = Math.round(p.x - drag.start.x);
        drag.off.y = Math.round(p.y - drag.start.y);
        if (!drag.moved && (drag.off.x !== 0 || drag.off.y !== 0)) beginLift(drag);
        if (drag.moved) {
          ctx.putImageData(drag.base, 0, 0);
          ctx.putImageData(drag.lifted, drag.sel.x + drag.off.x, drag.sel.y + drag.off.y);
          showSelBoxRect({
            x: drag.sel.x + drag.off.x, y: drag.sel.y + drag.off.y,
            w: drag.sel.w, h: drag.sel.h
          });
        }
        break;
    }
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    try { canvas.releasePointerCapture(d.id); } catch (_) { /* ignore */ }
    const p = e ? pt(e) : d.a;
    switch (d.tool) {
      case 'Pencil':
      case 'Brush':
      case 'Eraser':
        break;
      case 'Line':
      case 'Rectangle':
      case 'Ellipse':
        ctx.putImageData(d.pre, 0, 0);
        if (d.moved) {
          pushUndo(d.pre);
          drawShape(ctx, d.tool, d.a, p, d.colour, d.size, e ? e.shiftKey : false);
        }
        break;
      case 'Crop':
        ctx.putImageData(d.pre, 0, 0);
        if (d.moved) {
          const r = normRect(d.a, p);
          doCrop(r.x, r.y, r.w, r.h);
        } else if (sel) {
          doCrop(sel.x, sel.y, sel.w, sel.h);
        } else {
          flashStatus('Drag a region to crop');
        }
        break;
      case 'Marquee': {
        const r = normRect(d.a, p);
        if (r.w >= 2 && r.h >= 2) {
          sel = r;
          showSelBoxRect(sel);
        } else {
          clearSel();
        }
        break;
      }
      case 'MoveSel':
        if (d.moved) {
          d.off.x = Math.round(p.x - d.start.x);
          d.off.y = Math.round(p.y - d.start.y);
          ctx.putImageData(d.base, 0, 0);
          ctx.putImageData(d.lifted, d.sel.x + d.off.x, d.sel.y + d.off.y);
          sel = { x: d.sel.x + d.off.x, y: d.sel.y + d.off.y, w: d.sel.w, h: d.sel.h };
          showSelBoxRect(sel);
          flashStatus('Selection moved');
        } else {
          showSelBoxRect(d.sel);
        }
        break;
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  // ---------- toolbox: size selector + eyedropper tool memory ----------
  document.querySelectorAll('.tool').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tool && btn.dataset.tool !== 'Pick') lastTool = btn.dataset.tool;
    });
  });

  const sizeBtns = Array.from(document.querySelectorAll('.size-btn'));
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      size = Number(btn.dataset.size) || 4;
      sizeBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      flashStatus('Size: ' + size + ' px');
    });
  });

  // ---------- menus (app.js runAction simply ignores these actions) ----------
  function bindMenu(action, fn) {
    const b = document.querySelector('.menu__item[data-action="' + action + '"]');
    if (b) b.addEventListener('click', fn);
  }
  bindMenu('undo', undo);
  bindMenu('redo', redo);
  bindMenu('adjust', openAdjust);
  bindMenu('save-as', savePng);

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    if (!overlay.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAdjust(false);
      }
      return;
    }
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!(e.ctrlKey || e.metaKey)) {
      if (e.key === 'Escape') clearSel();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (k === 'y') {
      e.preventDefault();
      redo();
    } else if (k === 's') {
      e.preventDefault();
      savePng();
    } else if (k === 'o') {
      e.preventDefault();
      if (fileIn) fileIn.click();
    }
  });

  // ---------- keep the selection box aligned on layout changes ----------
  window.addEventListener('resize', () => {
    if (sel) showSelBoxRect(sel);
  });
})();
