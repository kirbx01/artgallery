# artgallery

A retro Windows 98 / Vista pixel-art gallery. Pure HTML, CSS and JS — no build step, no dependencies. Drop it on any static host.

**Live demo:** `https://kirbx01.github.io/artgallery/`

Published straight from the `main` branch — no build step, so the repo *is* the site. To turn it on: **Settings → Pages → Deploy from a branch → `main` / `root`**.

## Link it from your README

Set `BASE` to your deployed URL, then paste any block below.

```bash
BASE="https://kirbx01.github.io/artgallery"
```

### Show N artworks in a square grid at once

`?grid=N` opens straight into a square grid. Columns are `√N`, rounded up, so only perfect squares come out perfectly square.

| Want | Link | Result |
| --- | --- | --- |
| 1 | `$BASE?grid=1` | 1 × 1 |
| 4 | `$BASE?grid=4` | 2 × 2 |
| 9 | `$BASE?grid=9` | 3 × 3 |
| 16 | `$BASE?grid=16` | 4 × 4 |
| 6 | `$BASE?grid=6` | 3 × 2 (not square) |

`N` is clamped to the number of artworks you have, so `?grid=16` with 8 artworks shows all 8 in 3 columns.

Combine with an artwork to have it preselected: `$BASE?grid=9&art=03`

### Square grid of image thumbnails

`?embed=1` renders one artwork with no window chrome, so it works as a plain image source inside a markdown table.

```markdown
| 01 | 02 | 03 |
| :-: | :-: | :-: |
| [![01](BASE?art=01&embed=1)](BASE?art=01) | [![02](BASE?art=02&embed=1)](BASE?art=02) | [![03](BASE?art=03&embed=1)](BASE?art=03) |
```

Generate a row per table, skipping IDs you don't have:

```bash
BASE="https://kirbx01.github.io/artgallery"
TOTAL=8    # how many artworks exist
PERROW=3   # artworks per row

for ((row=0; row<TOTAL; row+=PERROW)); do
  cells=""
  for ((c=0; c<PERROW; c++)); do
    i=$((row + c + 1))
    (( i > TOTAL )) && continue
    id=$(printf '%02d' "$i")
    cells="$cells| [![$id]($BASE?art=$id&embed=1)]($BASE?art=$id) "
  done
  echo "$cells|"
done
```

Output:

```markdown
| [![01](BASE?art=01&embed=1)](BASE?art=01) | [![02](BASE?art=02&embed=1)](BASE?art=02) | [![03](BASE?art=03&embed=1)](BASE?art=03) |
| [![04](BASE?art=04&embed=1)](BASE?art=04) | [![05](BASE?art=05&embed=1)](BASE?art=05) | [![06](BASE?art=06&embed=1)](BASE?art=06) |
| [![07](BASE?art=07&embed=1)](BASE?art=07) | [![08](BASE?art=08&embed=1)](BASE?art=08) |
```

### Badge and single artwork

```markdown
[![gallery](https://img.shields.io/badge/gallery-%3Fgrid%3D9-000080?style=flat-square)](https://kirbx01.github.io/artgallery/?grid=9)
[![art 03](https://img.shields.io/badge/art-03-c0c0c0?style=flat-square)](https://kirbx01.github.io/artgallery/?art=03)
```

## URL parameters

| Parameter | Effect |
| --- | --- |
| `?art=03` | Open artwork `03`. Wraps around; bad values fall back to `01`. |
| `?grid=N` | Open as a square grid of `N` artworks. Clamped to what exists. |
| `?embed=1` | Chrome-less single image, for README thumbnails. |
| `?readme=URL` | Point the `← Back to README` button at your own repo. |

## Keyboard

`←` `→` previous / next · `Home` `End` first / last · `Ctrl+G` toggle grid · `Ctrl+L` copy link · `Esc` close menu

## Adding your own art

Everything lives in `js/data.js`. Either swap in real image URLs:

```js
{ id: '09', title: 'My Art', blurb: 'PNG - 320x200', art: 'art/my-art.png' }
```

or draw it as an ASCII pixel map — one character per pixel, `.` is transparent:

```js
{
  id: '09',
  title: 'My Art',
  blurb: '16x16 - drawn in code',
  art: makePixelArt([
    '................',
    '....bbbb........',
    '...bWWWWb.......'
  ], { b: '#0000ff', W: '#ffffff' })
}
```

Keep every row the same length. The array order defines the number in `?art=NN`.

## Files

```
index.html      markup only
css/style.css   all styling
js/data.js      artwork registry and pixel art generator
js/app.js       state, rendering and events
```

## Local preview

```bash
python3 -m http.server 8000
```
