function makePixelArt(rows, map, scale = 24) {
  const h = rows.length;
  const w = rows[0].length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const colour = map[rows[y][x]];
      if (colour) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + colour + '"/>';
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w * scale) + '" height="' + (h * scale) +
    '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' + rects + '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}

const SKY = { m: '#ff7b3d', B: '#4a1c8c', y: '#ffd447', W: '#fff6d5' };
const DARK = { D: '#2b2140', d: '#171129' };
const GREEN = { G: '#1f7a3d', g: '#2ea84f' };

window.ARTWORKS = [
  {
    id: '01',
    title: 'Sunset Ridge',
    blurb: '16x16 - dusk over the far mountains',
    art: makePixelArt([
      '................',
      '..mMMMMMMMMMMm..',
      '..mBBBBBBBBBBm..',
      '..mMMMMMMMMMMm..',
      '..mBBBBBBBBBBm..',
      '..yWWyBBBByWWy..',
      '..yWWyBBBByWWy..',
      '...yyBBBBBBByy..',
      '....BBBBBBBB....',
      '...DDDDDDDDDD...',
      '..DDDDDDDDDDDD..',
      '.DDDDDDDDDDDDDD.',
      '.DDDD...DDDDDDD.',
      '.DDD......DDDDD.',
      '.DD........DDD..',
      '................'
    ], { ...SKY, ...DARK })
  },
  {
    id: '02',
    title: 'Deep Space Probe',
    blurb: '16x16 - telemetry, somewhere far out',
    art: makePixelArt([
      '................',
      '......y....a....',
      '..a.....y.......',
      '..............y.',
      '.....ccc........',
      '....cCCCc.......',
      '....cCWWc..y....',
      '....cCCCc.......',
      '.....ccc....o...',
      '...........oOOo.',
      '......a..oOOOOo.',
      '..........oOOOOo',
      '.........oOOOOo.',
      '..........oOOo..',
      '...........o....',
      '................'
    ], { y: '#ffe680', a: '#ffffff', c: '#9aa4b2', C: '#c0c8d4', W: '#5f7ea8', o: '#a8571f', O: '#e08a3c' })
  },
  {
    id: '03',
    title: 'Desert Dunes',
    blurb: '16x16 - noon, sand, no shade',
    art: makePixelArt([
      '................',
      '..........o.....',
      '........ooo.....',
      '.......ooooo....',
      '.......ooooo....',
      '..aaaaaaaaaaaaaa',
      '..aaaaaaaaaaaaa.',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBBB',
      '.BBBBBBBBBBBBBB.',
      '.CCCCCCCCCCCCCCC',
      '.CCCCCCCCCC.CCCC',
      '.CCCCCCCCCC.CCCC',
      '.CCCCCCCCCCCCCC.',
      '.DDDDDDDDDDDDDD.',
      '.DDDDDDDDDDDDDD.'
    ], { o: '#fff2a8', a: '#f2c46b', B: '#e0a54a', C: '#c8873f', D: '#8f5a22' })
  },
  {
    id: '04',
    title: 'Ocean Waves',
    blurb: '16x16 - four bands of moving water',
    art: makePixelArt([
      '................',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '.cccccccccccccc.',
      '..bbbbbbbbbbbb..',
      '..bb..bbbb..bb..',
      '...bbbb..bbbb...',
      '..aaaaaaaaaaaaa.',
      '..aaaaaaaaaaaaa.',
      '.aaaaaaaaaaaaaa.',
      '..aaaaaaaaaaa...',
      '..aaaaaaaaaaaa..',
      '.dddddddddddddd.',
      '.dddddd..dddddd.',
      '.dddddddddddddd.',
      '................'
    ], { c: '#8fd6f0', b: '#4aa8d8', a: '#1f74b8', d: '#0b4a86' })
  },
  {
    id: '05',
    title: 'Cobalt Castle',
    blurb: '16x16 - battlements in flat blue',
    art: makePixelArt([
      '................',
      '................',
      '..B.BB.BB.B.B...',
      '..BBBBBBBBBBBBB.',
      '..BBBBBBBBBBBBB.',
      '..BBWBBBBBWBB...',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBWWWBBBWWBB.',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..'
    ], { B: '#1c48c8', W: '#f0f4ff' })
  },
  {
    id: '06',
    title: 'Neon Alley',
    blurb: '16x16 - signage reflected on wet tarmac',
    art: makePixelArt([
      '................',
      '..p....m.....p..',
      '..pp..mmm...pp..',
      '...p..mm....p...',
      '..ppp.mmm..ppp..',
      '.ppppp.mm.ppppp.',
      '.pPPPp.mm.pPPPp.',
      '.ppppp.mm.ppppp.',
      '..VVV..mm..VVV..',
      '...V...mm...V...',
      '.......mm.......',
      '..kkkkkmmkkkkk..',
      '..kkkkkmmkkkkk..',
      '..kkkkkmmkkkkk..',
      '...kkkk..kkkk...',
      '................'
    ], { p: '#ff2d95', P: '#ffd1ea', m: '#22d3ee', V: '#a855f7', k: '#1b1b26' })
  },
  {
    id: '07',
    title: 'Forest Ruin',
    blurb: '16x16 - canopy, stone, a little sun',
    art: makePixelArt([
      '................',
      '...g....g...g...',
      '..GGG..GGG..GGG.',
      '.GGGGG...GGGGGG.',
      '..ggg.....gggg..',
      '..............g.',
      '..s.............',
      '...s......s.....',
      '......s......s..',
      '..aaaaaaa.aaa...',
      '..a.....a..a....',
      '..aBBaBBa..a....',
      '..aBBaBBa..a....',
      '..aBBaBBa..a....',
      '..a.....a..a....',
      '..aaaaaaa.aaa...'
    ], { ...GREEN, s: '#ffe680', a: '#9a9384', B: '#3a352c' })
  },
  {
    id: '08',
    title: 'Pixel Comet',
    blurb: '16x16 - head and tail, no atmosphere',
    art: makePixelArt([
      '................',
      '................',
      '....y...........',
      '...yy....w......',
      '..yyyy..ww......',
      '.yyyyy.yww......',
      '..yyyy..w.......',
      '...yy...........',
      '................',
      '..a.............',
      '...a....a.......',
      '......a..a......',
      '.........a......',
      '..a.......a.....',
      '...a..a.........',
      '................'
    ], { y: '#ffe680', w: '#ffffff', a: '#c8d4ff' })
  }
];

window.PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
  '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'
];
