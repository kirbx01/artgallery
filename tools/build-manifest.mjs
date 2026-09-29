import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'artworksbyme');
const manifestPath = join(dir, 'manifest.json');
const dataPath = join(root, 'js', 'data.js');
const configPath = join(root, 'gallery.config.json');
const readmePath = join(root, 'README.md');

const EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp'];

const START = '<!-- artworks:start -->';
const END = '<!-- artworks:end -->';

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

const pad = n => String(n).padStart(2, '0');

const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf8'))
  : {};
const columns = Math.max(1, Number(config.gridColumns) || 3);

const previous = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')).artworks
  : [];

// id is reused for a file we have seen before, so ?art=NN permalinks and
// README embeds keep pointing at the same artwork as the list grows.
const byFile = new Map(previous.map(a => [a.file, a]));
let nextId = previous.reduce((n, a) => Math.max(n, Number(a.id) || 0), 0) + 1;

const files = readdirSync(dir, { withFileTypes: true })
  .filter(d => d.isFile() && EXTS.includes('.' + d.name.split('.').pop().toLowerCase()))
  .map(d => d.name)
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

const artworks = files.map(file => {
  const seen = byFile.get(file);
  const id = seen ? pad(seen.id) : pad(nextId++);
  return { id, file, title: (seen && seen.title) || TITLES[file] || humanise(file) };
});

writeFileSync(manifestPath, JSON.stringify({ artworks }, null, 2) + '\n');
writeFileSync(dataPath, `window.ARTWORKS = ${JSON.stringify(artworks, null, 2)};\n\nwindow.ART_DIR = 'artworksbyme/';\n`);

const site = (config.siteUrl || '').replace(/\/+$/, '');
const head = [];

if (config.title) head.push('# ' + config.title, '');
if (config.tagline) head.push('> ' + config.tagline, '');
if (config.showcase) head.push(`![${config.showcaseAlt || 'showcase'}](${config.showcase})`, '');
if (config.description) head.push(config.description, '');

if (config.embed && config.embed.enabled) {
  const w = config.embed.width || 512;
  const h = config.embed.height || 512;
  head.push('## Embed a single artwork', '');
  head.push('Paste this into any README to drop one piece of art inline:', '');
  head.push('```html');
  head.push(`<iframe src="${site}/?embed=1&art=${config.embed.id || artworks[0].id}"`);
  head.push(`        width="${w}" height="${h}" frameborder="0" loading="lazy"></iframe>`);
  head.push('```');
  head.push(`Swap \`art=${config.embed.id || artworks[0].id}\` for any id from the table above.`, '');
}

if (artworks.length) {
  head.push('## Artworks', '');
  const cell = a => `<a href="${site}/?art=${a.id}"><img src="artworksbyme/${a.file}" width="240" alt="${a.title}"><br><sub>${a.id} · ${a.title}</sub></a>`;
  for (let i = 0; i < artworks.length; i += columns) {
    const row = artworks.slice(i, i + columns);
    head.push('| ' + row.map(cell).join(' | ') + ' |');
    head.push('| ' + row.map(() => ':---:').join(' | ') + ' |');
  }
  head.push('');
}

if (config.sections && config.sections.makeItYours) {
  head.push('## Make this yours', '');
  head.push('This gallery is meant to be forked. Three steps, no build step:', '');
  head.push('1. Drop your images into `artworksbyme/` (png, jpg, jpeg, gif, webp, avif, bmp).');
  head.push('2. Edit `gallery.config.json` — your name, tagline, description, grid width and embed size.');
  head.push('3. Run `npm run manifest` and commit.');
  head.push('');
  head.push('```bash');
  head.push('cp your-art.png artworksbyme/');
  head.push('npm run manifest');
  head.push('git add artworksbyme/ js/data.js README.md');
  head.push('git commit -m "Add your-art"');
  head.push('```');
  head.push('');
  head.push('Filenames become titles automatically (`my_new_art.png` → "My New Art"). To set one by hand, add it to the `TITLES` map in `tools/build-manifest.mjs`.');
  head.push('');
  head.push('Artwork ids are stable: adding or removing a file never renumbers the others, so existing `?art=NN` links and embeds keep working.');
  head.push('');
  head.push('Put drafts in `artworksbyme/randoms_drafts/` — subfolders are skipped by the build.');
  head.push('');
}

if (config.sections && config.sections.credits) {
  head.push('## Credits', '');
  head.push(`Built with vanilla HTML, CSS and JavaScript. Artwork is ${config.owner ? '© ' + config.owner : 'the artist'}.`);
  head.push('');
}

const generated = head.join('\n');
const existing = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
const kept = existing.includes(END) ? existing.slice(existing.indexOf(END) + END.length) : '';
const managed = [START, generated.trimEnd(), END, ''].join('\n');

writeFileSync(readmePath, existing.includes(START) && existing.includes(END)
  ? existing.slice(0, existing.indexOf(START)) + managed + kept
  : managed + kept);

console.log(`manifest: ${artworks.length} artworks`);
artworks.forEach(a => console.log(`  ${a.id}  ${a.title.padEnd(24)} ${a.file}`));
if (previous.length && artworks.some(a => !previous.some(p => p.file === a.file))) {
  console.log('new ids assigned; existing ids preserved');
}
const skipped = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
if (skipped.length) console.log(`ignored folders: ${skipped.join(', ')}`);
if (!config.siteUrl) console.log('warning: gallery.config.json has no siteUrl, embed links will be relative');
