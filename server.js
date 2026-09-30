const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const CREDS = path.join(ROOT, 'spotifycrendentials.yaml');
const TOKEN_URL = process.env.SPOTIFY_TOKEN_URL || 'https://accounts.spotify.com/api/token';
const API = process.env.SPOTIFY_API_URL || 'https://api.spotify.com/v1/me/player';

if (!fs.existsSync(CREDS)) {
  console.error('Missing ' + path.basename(CREDS) + '. Copy spotifycrendentials.yaml.example and fill it in.');
  process.exit(1);
}

const { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN } =
  yaml.load(fs.readFileSync(CREDS, 'utf8')) || {};

for (const [k, v] of Object.entries({ CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN })) {
  if (!v) {
    console.error('spotifycrendentials.yaml is missing "' + k.toLowerCase() + '".');
    process.exit(1);
  }
}

let cached = null;

async function getAccessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error('token refresh failed: HTTP ' + res.status + ' ' + (data.error_description || data.error || ''));
  }

  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

async function spotify(pathname, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(API + pathname, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) }
  });
  if (res.status === 204) return { empty: true };
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('spotify ' + res.status + ' ' + detail.slice(0, 160));
  }
  return res.json();
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const idle = (res) => res.json({ playing: false, error: null });

app.get('/api/now-playing', async (req, res) => {
  try {
    const data = await spotify('/currently-playing');
    if (data.empty || !data.is_playing || !data.item) return idle(res);

    const images = data.item.album && data.item.album.images;
    res.json({
      playing: true,
      title: data.item.name,
      artist: (data.item.artists || []).map((a) => a.name).join(', '),
      album: (data.item.album && data.item.album.name) || '',
      albumArt: images && images.length ? images[images.length - 1].url : null,
      progressMs: data.progress_ms || 0,
      durationMs: (data.item.duration_ms || 0)
    });
  } catch (error) {
    console.error('[now-playing]', error.message);
    res.status(502).json({ playing: false, error: 'upstream' });
  }
});

const command = (name, fn) => async (req, res) => {
  try {
    await fn();
    res.json({ ok: true });
  } catch (error) {
    console.error('[' + name + ']', error.message);
    res.status(502).json({ ok: false, error: name });
  }
};

app.post('/api/toggle-playback', command('toggle', async () => {
  const now = await spotify('/currently-playing');
  const playing = !now.empty && now.is_playing;
  await spotify(playing ? '/pause' : '/play', { method: 'PUT' });
}));

app.post('/api/next-track', command('next', () => spotify('/next', { method: 'POST' })));
app.post('/api/previous-track', command('previous', () => spotify('/previous', { method: 'POST' })));

const FORBIDDEN = /(^\/|\/)(spotifycrendentials\.ya?ml|\.git|\.gitignore|package(-lock)?\.json|server\.js|\.env)/i;

app.use((req, res, next) => {
  const target = decodeURIComponent(req.path);
  if (FORBIDDEN.test(target)) return res.status(404).type('text/plain').send('Not found');
  next();
});

app.use(express.static(ROOT, { dotfiles: 'ignore', index: 'index.html' }));

app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Retro MS Paint gallery + Spotify bridge on http://localhost:' + PORT);
    console.log('Open http://localhost:' + PORT + ' - the Now Playing panel needs no config here.');
    console.log('For GitHub Pages, add to index.html:');
    console.log('  <meta name="np-bridge" content="https://your-bridge.vercel.app">');
  });
}

module.exports = app;
