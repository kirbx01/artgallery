import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };
const ok = msg => console.log('ok   ' + msg);

const read = p => readFileSync(join(root, p), 'utf8');
const html = read('index.html');
const jsFiles = readdirSync(join(root, 'js')).filter(f => f.endsWith('.js'));
const js = Object.fromEntries(jsFiles.map(f => [f, read('js/' + f)]));
const allJs = Object.values(js).join('\n');

// 1. every element id the scripts look up exists in index.html
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const wantedIds = new Set();
for (const src of Object.values(js)) {
  for (const re of [/getElementById\('([^']+)'\)/g, /\$f\('([^']+)'\)/g, /\$\('#([A-Za-z0-9_-]+)'\)/g]) {
    for (const m of src.matchAll(re)) wantedIds.add(m[1]);
  }
}
const missingIds = [...wantedIds].filter(id => !htmlIds.has(id));
if (missingIds.length) fail('ids referenced by JS but missing in index.html: ' + missingIds.join(', '));
else ok(`all ${wantedIds.size} JS element ids exist in index.html`);

// duplicate ids in the HTML are a bug source
const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
if (dupes.length) fail('duplicate ids in index.html: ' + [...new Set(dupes)].join(', '));
else ok('no duplicate ids in index.html');

// 2. every data-action in the HTML is handled by app.js or a feature script
const actions = [...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const unhandled = actions.filter(a =>
  !allJs.includes("case '" + a + "'") &&
  !allJs.includes('bindMenu(\'' + a + '\'') &&
  !allJs.includes('bindLater(\'' + a + '\'') &&
  !allJs.includes('data-action="' + a + '"'));
if (unhandled.length) fail('menu actions with no handler: ' + unhandled.join(', '));
else ok(`all ${actions.length} menu actions are handled`);

// 3. script/link/sheet references resolve
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (/^(https?:|data:|#|mailto:)/.test(ref)) continue;
  const clean = ref.split('?')[0];
  if (clean && !existsSync(join(root, clean))) fail('broken reference in index.html: ' + ref);
}
ok('local src/href references in index.html resolve');

// 4. manifest <-> data.js <-> generated square thumbnails stay in sync
const manifest = JSON.parse(read('artworksbyme/manifest.json')).artworks;
const dataJs = js['data.js'];
const dataIds = [...dataJs.matchAll(/"id":\s*"(\d+)"/g)].map(m => m[1]);
if (manifest.length !== dataIds.length) fail(`data.js has ${dataIds.length} ids, manifest has ${manifest.length}`);
else if (manifest.some((a, i) => a.id !== dataIds[i])) fail('data.js ids out of order vs manifest');
else ok('js/data.js mirrors artworksbyme/manifest.json');

// stable ids: zero padded, unique, never renumbered (monotone by file order is not
// required, but every id must be unique and 2+ digits)
const ids = manifest.map(a => a.id);
if (new Set(ids).size !== ids.length) fail('duplicate artwork ids in manifest');
else if (ids.some(id => !/^\d{2,}$/.test(id))) fail('artwork ids must be zero-padded numbers');
else ok(`artwork ids stable and unique (${ids.join(', ')})`);

for (const a of manifest) {
  if (!existsSync(join(root, 'artworksbyme', a.file))) fail('manifest points at missing file: ' + a.file);
}
for (const a of manifest) {
  const svgPath = join(root, 'generated', a.id + '.svg');
  if (!existsSync(svgPath)) fail('missing square thumbnail: generated/' + a.id + '.svg');
  else {
    const svg = readFileSync(svgPath, 'utf8');
    const box = svg.match(/width="(\d+)" height="(\d+)"/);
    if (!box || box[1] !== box[2]) fail('thumbnail not square: generated/' + a.id + '.svg');
  }
}
// prune stale thumbnails
for (const f of readdirSync(join(root, 'generated'))) {
  if (/^\d+\.svg$/.test(f) && !ids.includes(f.slice(0, -4))) fail('stale thumbnail: generated/' + f);
}
ok('square thumbnails exist for every artwork and no stale ones');

// 5. Go CLI uses the same conventions (id padding + square box size)
const manifestGo = read('cmd/artgallery/manifest.go');
if (!manifestGo.includes('func padID(n int) string { return fmt.Sprintf("%02d", n) }')) {
  fail('Go padID no longer matches padStart(2, "0")');
} else ok('Go CLI id padding matches the JS convention');

// 6. no Spotify leftovers anywhere in shipped sources
const scan = [...jsFiles.map(f => 'js/' + f), 'index.html', 'css/style.css', 'server.js', 'package.json', 'README.md'];
const spotifyHits = [];
for (const f of scan) {
  if (/spotify|nowplaying|now-playing/i.test(read(f))) spotifyHits.push(f);
}
if (spotifyHits.length) fail('Spotify leftovers in: ' + spotifyHits.join(', '));
else ok('no Spotify leftovers in shipped sources');

// 7. scripts load in dependency order (app before editor before readme)
const order = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);
const expect = ['data.js', 'palette.js', 'app.js', 'editor.js', 'readme.js'];
if (JSON.stringify(order) !== JSON.stringify(expect)) fail('script order changed: ' + order.join(', '));
else ok('script tags in dependency order');

// 8. every file under js/ is actually loaded (no orphan scripts)
for (const f of jsFiles) {
  if (!order.includes(f)) fail('js/' + f + ' is never included by index.html');
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
