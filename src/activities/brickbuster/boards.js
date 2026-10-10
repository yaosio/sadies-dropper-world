// Brickbuster '96's boards: a new one for every level, made from the game's seed and the level number
// (so the same numbers always make the same board, and a saved game can rebuild the one it was on).
// Plain numbers with no screen, so the tests can make thousands of them.
//
// A board is a grid of COLS x ROWS cells, some with a brick. Each is one of a dozen shapes (stripes,
// diamonds, waves, Sadie's cat ears...), turned a little different every time, with a way of
// colouring it. The shapes come round in a shuffled order, so a shape never comes twice running.

export const COLS = 14, ROWS = 8;
export const MIN_BRICKS = 20;          // (Claude's number: fewer than this and the board is too quick)

// the same numbers every time from a seed
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (a, b) => {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
};

const MID = (COLS - 1) / 2, RMID = (ROWS - 1) / 2;
// pictures in 14 x 8: '#' is a brick (a smaller one, 11 wide, is put in the middle)
const ART = {
  cat: ['..#........#..', '.###......###.', '.############.', '.##..####..##.', '.############.', '..####..####..', '....######....', '..............'],
  heart: ['..####..####..', '.############.', '.############.', '..##########..', '...########...', '....######....', '.....####.....', '......##......'],
  invader: ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
};
// (the first two rows of cat and heart are 14 wide; this keeps them honest)
const art = (rows, r, c) => {
  const row = rows[r]; if (!row) return false;
  const off = Math.floor((COLS - row.length) / 2);
  return row[c - off] === '#';
};

// every shape: (r, c, p, ask) → whether there's a brick there. `p`: its numbers for this board.
const SHAPES = [
  { name: 'stripes', make: ask => ({ period: 2 + Math.floor(ask() * 2), off: Math.floor(ask() * 2), gap: ask() < 0.5 ? 0 : 3 + Math.floor(ask() * 3) }),
    at: (r, c, p) => (r + p.off) % p.period === 0 && (!p.gap || c % p.gap !== p.gap - 1) },
  { name: 'checker', make: ask => ({ n: ask() < 0.6 ? 2 : 3, off: Math.floor(ask() * 2) }),
    at: (r, c, p) => (r + c + p.off) % p.n === 0 },
  { name: 'diamond', make: ask => ({ size: 0.85 + ask() * 0.25, hollow: ask() < 0.45 ? 0.45 : 0 }),
    at: (r, c, p) => { const d = Math.abs(c - MID) / (COLS / 2) + Math.abs(r - RMID) / (ROWS / 2); return d <= p.size && d >= p.hollow; } },
  { name: 'pyramid', make: ask => ({ up: ask() < 0.5, step: 1.3 + ask() * 0.8 }),
    at: (r, c, p) => Math.abs(c - MID) <= ((p.up ? r : ROWS - 1 - r) + 1) * p.step - 0.4 },
  { name: 'waves', make: ask => ({ amp: 1.2 + ask() * 1.2, freq: 0.35 + ask() * 0.45, phase: ask() * 6.28, thick: 1.6 + ask() * 1.4, second: ask() < 0.5 }),
    at: (r, c, p) => {
      const y = RMID + Math.sin(c * p.freq + p.phase) * p.amp;
      if (Math.abs(r - y) < p.thick * 0.5) return true;
      return p.second && Math.abs(r - (ROWS - 1 - y)) < 0.55;
    } },
  { name: 'pillars', make: ask => ({ wide: 1 + Math.floor(ask() * 2), seedA: Math.floor(ask() * 1000) }),
    at: (r, c, p) => { const col = Math.floor(c / (p.wide + 1)); if (c % (p.wide + 1) === p.wide) return false; const h = 3 + (mix(p.seedA, col) % (ROWS - 2)); return r < h; } },
  { name: 'frame', make: ask => ({ gapSide: ask() < 0.5 }),
    at: (r, c, p) => { const d = Math.min(r, c, ROWS - 1 - r, COLS - 1 - c); return d % 2 === 0 && !(p.gapSide && d === 0 && c === Math.floor(MID)); } },
  { name: 'cross', make: ask => ({ thick: 0.9 + ask() * 0.6 }),
    at: (r, c, p) => { const dx = Math.abs(c - MID), dy = Math.abs(r - RMID); return Math.abs(dx - dy * 1.8) < p.thick; } },
  { name: 'scatter', make: ask => ({ density: 0.5 + ask() * 0.2, seedA: Math.floor(ask() * 100000) }),
    at: (r, c, p) => (mix(p.seedA, r * 31 + Math.min(c, COLS - 1 - c)) % 1000) / 1000 < p.density },
  { name: 'cat', make: () => ({}), at: (r, c) => art(ART.cat, r, c) },
  { name: 'heart', make: () => ({}), at: (r, c) => art(ART.heart, r, c) },
  { name: 'invader', make: () => ({}), at: (r, c) => art(ART.invader, r, c) },
];
export const SHAPE_NAMES = SHAPES.map(s => s.name);

// the order the shapes come in: shuffled from the seed, a new shuffle every time round, and the
// first of one never the last of the one before
function order(seed, cycle) {
  const ask = rng(mix(seed, 1000 + cycle)), a = SHAPES.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(ask() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function shapeFor(seed, level) {
  const n = SHAPES.length, cycle = Math.floor((level - 1) / n), i = (level - 1) % n, a = order(seed, cycle);
  if (cycle > 0 && i < 2) {
    const prev = order(seed, cycle - 1).at(-1);
    if (a[0] === prev) [a[0], a[1]] = [a[1], a[0]];
  }
  return a[i];
}

// ways of colouring a board (an index 0 to 7 for each brick)
const TONES = [
  r => r,                                     // bands, like the rainbow it always was
  (r, c) => Math.floor(c * 8 / COLS),         // up and down stripes
  (r, c) => (r + c) % 8,                      // slanted
  (r, c) => Math.abs(Math.floor(c - MID)) % 8,// out from the middle
];

// The board for a level: { shape, name, cells: [{ row, col, tone }] }
export function makeBoard(seed, level) {
  level = Math.max(1, Math.floor(level) || 1);
  const si = shapeFor(seed, level), shape = SHAPES[si], ask = rng(mix(seed, level * 7919 + 5));
  const picture = ['cat', 'heart', 'invader'].includes(shape.name);   // (a picture keeps its shape: no holes punched, never turned over)
  const p = shape.make(ask), mirror = ask() < 0.5, flip = ask() < 0.35 && !picture;
  const holes = !picture && ask() < 0.5 ? 0.04 + ask() * 0.08 : 0, holeSeed = Math.floor(ask() * 1e6), tone = TONES[Math.floor(ask() * TONES.length)];
  const cells = [];
  const build = withHoles => {
    cells.length = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let rr = flip ? ROWS - 1 - r : r, cc = mirror && c >= COLS / 2 ? COLS - 1 - c : c;   // (mirrored: left made, right copied)
      if (!shape.at(rr, cc, p)) continue;
      if (withHoles && holes && (mix(holeSeed, r * 29 + Math.min(c, COLS - 1 - c)) % 1000) / 1000 < holes) continue;
      cells.push({ row: r, col: c, tone: tone(r, c) % 8 });
    }
  };
  build(true);
  if (cells.length < MIN_BRICKS) build(false);   // (too thin with its holes punched: without)
  if (cells.length < MIN_BRICKS) {               // (still too thin: rows of bricks, always enough)
    cells.length = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c++) cells.push({ row: r, col: c, tone: r });
  }
  return { shape: si, name: shape.name, cells };
}
