import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'artworksbyme');
const manifestPath = join(dir, 'manifest.json');
const dataPath = join(root, 'js', 'data.js');

const EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp'];
const IGNORE_DIRS = ['randoms_drafts'];

const TITLES = {
  'angrypup.png': 'Angry Pup',
  'blockart_unfinished_Anatomylesson.png': 'Anatomy Lesson (Blockart)',
  'CID_funartposter.png': 'CID Fun Art Poster',
  'eminem_potrait_lineart.png': 'Eminem Portrait Lineart',
  'foofighters_jjba.png': 'Foo Fighters JJBA',
  'invincible.png': 'Invincible'
};

const humanise = f => f
  .replace(/\.[^.]+$/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, c => c.toUpperCase());

const previous = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')).artworks
  : [];
const known = new Map(previous.map(a => [a.file, a.title]));

const files = readdirSync(dir, { withFileTypes: true })
  .filter(d => d.isFile() && EXTS.includes('.' + d.name.split('.').pop().toLowerCase()))
  .map(d => d.name)
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

const artworks = files.map((file, i) => ({
  id: String(i + 1).padStart(2, '0'),
  file,
  title: known.get(file) || TITLES[file] || humanise(file)
}));

writeFileSync(manifestPath, JSON.stringify({ artworks }, null, 2) + '\n');

writeFileSync(dataPath, `window.ARTWORKS = ${JSON.stringify(artworks, null, 2)};\n\nwindow.ART_DIR = 'artworksbyme/';\n`);

console.log(`manifest: ${artworks.length} artworks`);
artworks.forEach(a => console.log(`  ${a.id}  ${a.title.padEnd(24)} ${a.file}`));
const skipped = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
if (skipped.length) console.log(`ignored folders: ${skipped.join(', ')}`);
