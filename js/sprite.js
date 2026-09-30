/* Toolbox icon sprite sheet.
 *
 * Point `url` at a PNG laid out as a uniform grid of tool icons and the whole
 * toolbox switches to it; leave it null and the inline SVG glyphs in index.html
 * stay in use. Nothing is applied until the sheet actually loads, so a bad path
 * degrades to the SVGs rather than blanking the buttons.
 *
 *   url    sheet image, relative to the page
 *   cell   icon size in sheet pixels (the grid pitch is cell + gap)
 *   gap    transparent gutter between cells, in sheet pixels
 *   scale  integer factor the icons are drawn at; keep it a whole number or
 *          `image-rendering: pixelated` has uneven pixels to resample
 *   sheet  intrinsic pixel size of the PNG
 *   map    tool name -> [column, row], matching data-tool on each button
 */
window.TOOL_SPRITE = {
  url: null,
  cell: 16,
  gap: 0,
  scale: 1,
  sheet: { width: 0, height: 0 },
  map: {}
};
