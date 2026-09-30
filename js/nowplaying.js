(function () {
  'use strict';

  const CONFIG = {
    bridge: '',
    pollMs: 4000,
    maxBackoffMs: 60000,
    showControls: true,
    endpoints: {
      nowPlaying: '/api/now-playing',
      toggle: '/api/toggle-playback',
      next: '/api/next-track',
      previous: '/api/previous-track'
    }
  };

  const ui = {};
  let bridge = '';
  let controlsOk = true;
  let svgBadge = false;
  let timer = null;
  let delay = CONFIG.pollMs;
  let lastTrack = '';

  const url = (path) => bridge.replace(/\/$/, '') + path;

  const resolveBridge = () => {
    const meta = document.querySelector('meta[name="np-bridge"]');
    const attr = ui.panel && ui.panel.getAttribute('data-bridge');
    CONFIG.bridge = (attr || (meta && meta.content) || '').trim();
    bridge = CONFIG.bridge;
  };

  const fmtTime = (ms) => {
    if (!Number.isFinite(ms) || ms < 0) return '--:--';
    const t = Math.floor(ms / 1000);
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };

  function normalise(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw.item || raw.track || raw;
    if (item.is_playing === false || raw.playing === false) {
      return { playing: false, paused: true };
    }
    const title = item.name || item.title || '';
    if (!title) return { playing: false, paused: true };
    const imgs = item.album_images || (item.album && item.album.images) || item.images || item.image;
    const arr = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
    const last = arr[arr.length - 1] || {};
    const pick = (...vals) => { for (const v of vals) if (v != null) return Number(v) || 0; return 0; };
    return {
      playing: true,
      title: title,
      artist: [].concat(item.artists || item.artist || []).map((a) => a.name || a).filter(Boolean).join(', '),
      album: (item.album && item.album.name) || (typeof item.album === 'string' ? item.album : ''),
      image: last.url || last.src || item.albumArt || item.album_art || '',
      progressMs: pick(raw.progress_ms, item.progress_ms, item.progressMs),
      durationMs: pick(item.duration_ms, raw.duration_ms, item.durationMs)
    };
  }

  function setState(text, tone) {
    ui.state.textContent = text;
    ui.panel.dataset.tone = tone;
  }

  function fillNow(ms, total) {
    ui.elapsed.textContent = fmtTime(ms);
    ui.total.textContent = fmtTime(total);
    const pct = total ? Math.min(100, (ms / total) * 100) : 0;
    ui.progress.style.width = pct + '%';
    ui.progress.parentNode.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function renderIdle(why) {
    ui.screen.classList.remove('is-live');
    ui.track.textContent = why || 'Spotify: Idle';
    ui.track.classList.remove('is-marquee');
    ui.album.removeAttribute('src');
    svgBadge = false;
    fillNow(NaN, NaN);
    ui.toggle.textContent = '▶';
    ui.toggle.setAttribute('aria-label', 'Play');
    setState(why ? 'Link offline' : 'Spotify: Idle', 'idle');
  }

  function renderLive(d) {
    ui.screen.classList.add('is-live');
    svgBadge = false;
    const key = d.title + ' | ' + d.artist;
    if (key !== lastTrack) {
      lastTrack = key;
      ui.track.innerHTML = '';
      const name = document.createElement('span');
      name.className = 'np__line';
      name.textContent = d.artist ? d.title + ' — ' + d.artist : d.title;
      ui.track.appendChild(name);
      requestAnimationFrame(() => {
        ui.track.classList.toggle('is-marquee', name.scrollWidth > ui.track.clientWidth + 1);
      });
    }

    if (d.image && ui.album.getAttribute('src') !== d.image) ui.album.src = d.image;
    if (!d.image) ui.album.removeAttribute('src');

    fillNow(d.progressMs, d.durationMs);
    ui.toggle.textContent = '⏸';
    ui.toggle.setAttribute('aria-label', 'Pause');
    setState('Now Playing', 'live');
  }

  async function poll() {
    try {
      const res = await fetch(url(CONFIG.endpoints.nowPlaying), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const type = (res.headers.get('content-type') || '').toLowerCase();

      if (type.includes('image/svg')) {
        const svg = await res.text();
        if (!svgBadge) {
          ui.album.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          svgBadge = true;
        }
        ui.screen.classList.add('is-live');
        ui.track.textContent = 'Spotify: live';
        ui.track.classList.remove('is-marquee');
        fillNow(0, 0);
        ui.toggle.textContent = '⏸';
        ui.toggle.setAttribute('aria-label', 'Pause');
        setState('Now Playing', 'live');
      } else {
        const data = normalise(await res.json());
        if (data && data.playing) renderLive(data);
        else { lastTrack = ''; renderIdle(); }
      }
      delay = CONFIG.pollMs;
    } catch (err) {
      ui.panel.dataset.error = err && err.message ? err.message : String(err);
      lastTrack = '';
      renderIdle();
      delay = Math.min(CONFIG.maxBackoffMs, Math.round(delay * 1.5));
    }
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(poll, delay);
  }

  async function command(path, btn) {
    if (!controlsOk) return;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(url(path), { method: 'POST', cache: 'no-store' });
      if (res.status === 404 || res.status === 405) {
        controlsOk = false;
        ui.btns.hidden = true;
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      delay = CONFIG.pollMs;
      await poll();
    } catch (err) {
      setState('Command failed', 'error');
      delay = Math.min(CONFIG.maxBackoffMs, Math.round(delay * 1.5));
      schedule();
    } finally {
      btn.classList.remove('is-busy');
      btn.removeAttribute('aria-busy');
    }
  }

  function init() {
    ui.panel = $('#np');
    if (!ui.panel) return;
    ui.screen = $('#np-screen');
    ui.state = $('#np-state');
    ui.track = $('#np-track');
    ui.album = $('#np-art');
    ui.elapsed = $('#np-elapsed');
    ui.total = $('#np-total');
    ui.progress = $('#np-progress');
    ui.toggle = $('#np-toggle');
    ui.prev = $('#np-prev');
    ui.next = $('#np-next');
    ui.btns = $('.np__btns');

    resolveBridge();

    if (!CONFIG.showControls) {
      controlsOk = false;
      ui.btns.hidden = true;
    }

    ui.prev.addEventListener('click', () => command(CONFIG.endpoints.previous, ui.prev));
    ui.toggle.addEventListener('click', () => command(CONFIG.endpoints.toggle, ui.toggle));
    ui.next.addEventListener('click', () => command(CONFIG.endpoints.next, ui.next));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer);
      else poll();
    });

    renderIdle();
    poll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
