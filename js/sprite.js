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
  map: {
    Select: [0, 0],
    Eraser: [1, 0],
    Pencil: [2, 0],
    Brush: [3, 0],
    Fill: [4, 0],
    Text: [5, 0],
    Line: [6, 0],
    Rectangle: [7, 0],
    Ellipse: [0, 1],
    Pick: [1, 1],
    Magnify: [2, 1],
    Erase: [3, 1]
  }
};

(function () {
  const cfg = window.TOOL_SPRITE;
  if (!cfg) return;

  const { url, cell, gap, scale, sheet, map } = cfg;
  if (!url || !cell || !scale || !sheet || !sheet.width || !sheet.height) return;

  function apply() {
    const tools = [...document.querySelectorAll('.tool')].filter(
      tool => map[tool.dataset.tool]
    );
    if (!tools.length) return;

    const root = document.documentElement.style;
    root.setProperty('--sprite-url', `url("${url}")`);
    root.setProperty('--sprite-size', `${sheet.width * scale}px ${sheet.height * scale}px`);
    root.setProperty('--sprite-box', `${cell * scale}px`);

    const step = (cell + gap) * scale;
    tools.forEach(tool => {
      const [col, row] = map[tool.dataset.tool];
      tool.style.setProperty('--sprite-pos', `${-col * step}px ${-row * step}px`);
      tool.classList.add('is-sprite');
    });
  }
})();
