<!-- artworks:start -->
# artgallery

> A retro MS Paint art gallery you can embed straight into your GitHub README

![demo of the live view](image.png)

This is an artwork gallery made with mainfocus for artists to be able to embed their artworks directly on readme, since gh is a nice platform to show your art (atleast you can perceive it as one), not restricted to 2D Artworks, be it png, svg, jpg.

## Embed a single artwork

Paste this into any README to drop one piece of art inline:

```html
<iframe src="https://kirbx01.github.io/artgallery/?embed=1&art=01"
        width="512" height="512" frameborder="0" loading="lazy"></iframe>
```
Swap `art=01` for any id from the table above.

## Artworks

| <a href="https://kirbx01.github.io/artgallery/?art=01"><img src="artworksbyme/angrypup.png" width="240" alt="Angry Pup"><br><sub>01 · Angry Pup</sub></a> | <a href="https://kirbx01.github.io/artgallery/?art=02"><img src="artworksbyme/blockart_unfinished_Anatomylesson.png" width="240" alt="Anatomy Lesson (Blockart)"><br><sub>02 · Anatomy Lesson (Blockart)</sub></a> | <a href="https://kirbx01.github.io/artgallery/?art=03"><img src="artworksbyme/CID_funartposter.png" width="240" alt="CID Fun Art Poster"><br><sub>03 · CID Fun Art Poster</sub></a> |
| :---: | :---: | :---: |
| <a href="https://kirbx01.github.io/artgallery/?art=04"><img src="artworksbyme/eminem_potrait_lineart.png" width="240" alt="Eminem Portrait Lineart"><br><sub>04 · Eminem Portrait Lineart</sub></a> | <a href="https://kirbx01.github.io/artgallery/?art=05"><img src="artworksbyme/foofighters_jjba.png" width="240" alt="Foo Fighters JJBA"><br><sub>05 · Foo Fighters JJBA</sub></a> | <a href="https://kirbx01.github.io/artgallery/?art=06"><img src="artworksbyme/invincible.png" width="240" alt="Invincible"><br><sub>06 · Invincible</sub></a> |
| :---: | :---: | :---: |

## Make this yours

This gallery is meant to be forked. Three steps, no build step:

1. Drop your images into `artworksbyme/` (png, jpg, jpeg, gif, webp, avif, bmp).
2. Edit `gallery.config.json` — your name, tagline, description, grid width and embed size.
3. Run `npm run manifest` and commit.

```bash
cp your-art.png artworksbyme/
npm run manifest
git add artworksbyme/ js/data.js README.md
git commit -m "Add your-art"
```

Filenames become titles automatically (`my_new_art.png` -> "My New Art"). To set one by hand, add it to the `TITLES` map in `tools/build-manifest.mjs`.

Artwork ids are stable: adding or removing a file never renumbers the others, so existing `?art=NN` links and embeds keep working.

Put drafts in `artworksbyme/randoms_drafts/` subfolders are skipped by the build.

## Credits

Built with vanilla HTML, CSS and JavaScript. Artwork is © kirbx01.
<!-- artworks:end -->
