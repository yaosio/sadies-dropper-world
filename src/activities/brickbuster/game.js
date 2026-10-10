// Brickbuster '96's game, with no screen: the yarn ball, the paddle, the bricks and the cracks in
// the glass. Plain numbers, in metres, so the tests can play it in Node. room.js draws it.
//
// The machine starts out as the old one: a missed ball cracks the glass at the bottom, a ball hitting
// the top cracks it there, and three cracks on either side, or clearing the board, break it (room.js
// has it mend itself after). Once mended (`mended`) it's regular Breakout for good, with three lives:
// miss the paddle and the ball drops out of the bottom (a life gone, a new ball on the paddle); lose
// the third and it's GAME OVER (and a fresh game). Clear every brick and it's the next level: a new
// board (boards.js), the ball a little faster. Once you've knocked a way through the bricks the ball hits the top of the
// glass, and that cracks it (only before the first mend: after that the glass just bounces the ball).
// Up at the top the ball rattles between the glass and the bricks, so only its first hit there
// cracks it: the next crack waits until the ball's been back to the paddle.
//
// Every knocked-out brick falls out onto the floor of the room: `pile` is their colours, in the
// order they fell (room.js stacks them up in that order, HEAP spots; after that the oldest spot is
// swapped for the newest). Breaking the glass spills the rest onto it.
//
// x runs 0 to W across the glass, y 0 to H up it.
import { makeBoard, COLS, ROWS } from './boards.js';

export { COLS, ROWS };
export const W = 6.0, H = 6.6;                  // the glass
export const R = 0.16;                          // the yarn ball's radius
export const PADDLE = { w: 1.3, h: 0.46, y: 0.7, speed: 6 };   // y: its middle
export const EXTRA_LIFE = 3000;   // an extra life at every 3000 points, up to LIVES (Yaosio, 2026-10-10)
export const CRACKS = 3, CRACK_HITS = 1, LIVES = 3, HEAP = 100;   // CRACK_HITS: how many times the ball has to hit the top for it to crack (one: as fast as it always was)
const BRICK = { w: 0.4, h: 0.24, gap: 0.04, top: H - 1.25 };    // top: the top row's top edge, with room above to break through into
// metres a second: faster with every level, up to level `cap` and no further (Claude's numbers)
export const SPEED = { start: 4.2, step: 0.2, cap: 15, get most() { return this.start + (this.cap - 1) * this.step; } };
export const speedFor = level => SPEED.start + (Math.min(Math.max(1, level), SPEED.cap) - 1) * SPEED.step;
const ANGLE = 1.05;                             // how far off straight up the paddle can send it (radians, at its very end)
const LEFT = (W - COLS * BRICK.w) / 2;          // the gap at the glass's sides

export function makeGame(seed = 1, high = 0) {
  const g = {
    ball: { x: W / 2, y: 0, vx: 0, vy: 0, spin: 0 },
    paddle: W / 2,
    bricks: [],                        // every cell of the grid, with `alive` for the ones that are bricks now
    cracks: { top: [], bottom: [] },   // each { x, seed }: where it hit, and how its lines run
    score: 0, lifeMark: 0, high, lives: LIVES, level: 1, speed: speedFor(1), serving: true,
    seed: Math.max(1, Math.floor(seed)),   // this game's: its boards are made from it and the level
    rng: Math.max(1, Math.floor(seed) * 7919 % 2147483646),
    board: null,                       // the shape the board is
    topReady: true,                    // whether the top can be hit again (not since the ball was last on the paddle)
    topHits: 0,                        // the hits at the top since the last crack
    pile: [], pileNext: 0,             // the colours of the bricks on the floor, in the order they fell (and which spot is swapped next once it's full)
    mended: false,                     // once the machine has mended itself it is mended for good: the glass never cracks again
    broken: null,                      // 'top' once the glass has broken (null: it hasn't)
    over: false,                       // GAME OVER: out of lives, till room.js starts the next game
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    g.bricks.push({ row: r, col: c, tone: r, alive: false,
      x: LEFT + BRICK.gap / 2 + c * BRICK.w, y: BRICK.top - (r + 1) * (BRICK.h + BRICK.gap) + BRICK.gap / 2,
      w: BRICK.w - BRICK.gap, h: BRICK.h });
  }
  newBoard(g);
  serve(g);
  return g;
}
export const brickPoints = b => (ROWS - b.row) * 10;
export function random(g) { g.rng = (g.rng * 16807) % 2147483647; return g.rng / 2147483647; }
export const bricksLeft = g => g.bricks.reduce((n, k) => n + (k.alive ? 1 : 0), 0);

// the board for this game's level
export function newBoard(g) {
  const b = makeBoard(g.seed, g.level);
  g.board = b.name;
  for (const k of g.bricks) k.alive = false;
  for (const c of b.cells) { const k = g.bricks[c.row * COLS + c.col]; k.alive = true; k.tone = c.tone; }
  g.speed = speedFor(g.level);
}

// the next game after GAME OVER: back to level 1, three lives, a new seed (so new boards); the high
// score stays, and so does the glass as it is (cracked or not) and the heap on the floor
export function restart(g) {
  g.seed = 1 + Math.floor(random(g) * 999999);
  g.level = 1; g.lives = LIVES; g.score = 0; g.lifeMark = 0; g.over = false;
  newBoard(g);
  g.topReady = true;
  serve(g);
}

// the ball sits on the paddle until it's sent off
export function serve(g) {
  g.serving = true; g.speed = speedFor(g.level);
  Object.assign(g.ball, { x: g.paddle, y: PADDLE.y + PADDLE.h / 2 + R, vx: 0, vy: 0 });
}
export function launch(g) {
  if (!g.serving || g.over || g.broken) return;
  const a = (0.25 + random(g) * 0.35) * (random(g) < 0.5 ? -1 : 1);
  g.serving = false; g.ball.vx = Math.sin(a) * g.speed; g.ball.vy = Math.cos(a) * g.speed;
}

// the paddle: to a spot (dragging, the mouse), or pushed along (the keys: -1 to 1)
const half = PADDLE.w / 2;
export function movePaddle(g, x) {
  g.paddle = Math.max(half, Math.min(W - half, x));
  if (g.serving) g.ball.x = g.paddle;
}
export const pushPaddle = (g, v, dt) => movePaddle(g, g.paddle + v * PADDLE.speed * dt);

// Runs the game on by dt seconds. Returns what happened, for the sounds and faces:
// { type: 'paddle', off }, { type: 'brick', brick, slot }, { type: 'wall' }, { type: 'crack', level, x },
// { type: 'glass' } (the top, already cracked all it can), { type: 'miss', lives } (the ball got past),
// { type: 'level', level } (a new board), { type: 'over', score, high, record } (no lives left), and
// last of all { type: 'break', spilled, slots } (the bricks still up there, now falling out too).
// Once it's broken, or over, nothing more happens.
export function step(g, dt) {
  const out = [];
  if (g.serving || g.broken || g.over) return out;
  const n = Math.max(1, Math.ceil(dt * 240));
  for (let i = 0; i < n && !g.broken && !g.over && !g.serving; i++) sub(g, dt / n, out);
  return out;
}
// a brick falls to the floor: its spot on the heap
function toPile(g, tone) {
  if (g.pile.length < HEAP) { g.pile.push(tone); return g.pile.length - 1; }
  const slot = g.pileNext; g.pile[slot] = tone; g.pileNext = (slot + 1) % HEAP;
  return slot;
}
function breakGlass(g, out, why = 'top') {
  const spilled = g.bricks.filter(k => k.alive), slots = [];
  for (const k of spilled) { k.alive = false; slots.push(toPile(g, k.tone)); }
  g.broken = 'top';
  out.push({ type: 'break', why, spilled, slots });
}

function sub(g, dt, out) {
  const b = g.ball;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.spin += Math.hypot(b.vx, b.vy) * dt / R;
  // the sides of the glass
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); out.push({ type: 'wall' }); }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); out.push({ type: 'wall' }); }
  // the top cracks
  if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); hitGlass(g, out); if (g.broken) return; }
  // past the paddle and out of the bottom: a life gone
  if (b.y < -R) { miss(g, out); return; }
  // the paddle: only on the way down, so a ball that's got below it goes on down
  const top = PADDLE.y + PADDLE.h / 2;
  if (b.vy < 0 && b.y - R < top && b.y > PADDLE.y - PADDLE.h / 2 && Math.abs(b.x - g.paddle) < half + R * 0.7) {
    const off = Math.max(-1, Math.min(1, (b.x - g.paddle) / half)), a = off * ANGLE;
    b.vx = Math.sin(a) * g.speed; b.vy = Math.cos(a) * g.speed; b.y = top + R;
    g.topReady = true;
    out.push({ type: 'paddle', off });
  }
  // the bricks: one at a time, bouncing off whichever face it went in furthest from
  for (const k of g.bricks) {
    if (!k.alive) continue;
    const nx = Math.max(k.x, Math.min(k.x + k.w, b.x)), ny = Math.max(k.y, Math.min(k.y + k.h, b.y));
    if ((b.x - nx) ** 2 + (b.y - ny) ** 2 >= R * R) continue;
    k.alive = false; g.score += brickPoints(k); if (g.score > g.high) g.high = g.score;
    const mark = Math.floor(g.score / EXTRA_LIFE);
    if (mark > g.lifeMark) {   // every 3000 points: a life back (if there's one missing)
      g.lifeMark = mark;
      if (g.lives < LIVES) { g.lives++; out.push({ type: 'oneup', x: b.x, y: b.y, lives: g.lives }); }
    }
    const px = Math.min(b.x + R - k.x, k.x + k.w - (b.x - R)), py = Math.min(b.y + R - k.y, k.y + k.h - (b.y - R));
    if (px < py) b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
    else b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
    const s = Math.hypot(b.vx, b.vy); b.vx *= g.speed / s; b.vy *= g.speed / s;
    out.push({ type: 'brick', brick: k, slot: toPile(g, k.tone) });   // slot: its place in the pile
    if (bricksLeft(g) === 0 && !g.mended) breakGlass(g, out, 'cleared');   // (the old machine: clearing it breaks it, like the original)
    else if (bricksLeft(g) === 0) {   // the next level: a new board
      g.level++; newBoard(g); serve(g); g.topReady = true; g.topHits = 0;
      out.push({ type: 'level', level: g.level });
    }
    break;
  }
}

function miss(g, out) {
  if (!g.mended) {   // the machine's still the old one: a missed ball cracks the glass at the bottom, three and it breaks (no life lost)
    const list = g.cracks.bottom;
    list.push({ x: Math.max(0, Math.min(W, g.ball.x)), seed: 1 + Math.floor(random(g) * 99999) });
    out.push({ type: 'crack', side: 'bottom', level: list.length, x: g.ball.x });
    if (list.length >= CRACKS) { breakGlass(g, out, 'bottom'); return; }
    out.push({ type: 'miss', lives: g.lives });
    serve(g);
    return;
  }
  g.lives--;
  out.push({ type: 'miss', lives: g.lives });
  if (g.lives <= 0) { g.over = true; out.push({ type: 'over', score: g.score, high: g.high, record: g.score > 0 && g.score >= g.high }); }
  else serve(g);
}

function hitGlass(g, out) {
  const list = g.cracks.top;
  if (g.mended || list.length >= CRACKS || !g.topReady) { out.push({ type: 'glass' }); return; }
  g.topReady = false;
  if (++g.topHits < CRACK_HITS) { out.push({ type: 'glass' }); return; }   // (it holds, this time)
  g.topHits = 0;
  list.push({ x: g.ball.x, seed: 1 + Math.floor(random(g) * 99999) });
  out.push({ type: 'crack', level: list.length, x: g.ball.x });
  if (list.length >= CRACKS) breakGlass(g, out);
}

// what's kept between visits: where everything is, the ball too (so leaving just before a miss and
// coming back puts it in the same place), the cracks, the score and the high score. v: which shape
// of save (the first Brickbuster had none)
export function save(g) {
  // GAME OVER is kept as the next game, ready to start
  if (g.over) {
    const c = makeGame(1 + Math.floor(g.seed * 31 % 999999), g.high);
    c.cracks = g.cracks; c.topReady = g.topReady; c.topHits = g.topHits; c.mended = g.mended; c.pile = g.pile; c.pileNext = g.pileNext; c.paddle = g.paddle; c.rng = g.rng;
    return save(c);
  }
  const b = g.ball, r = n => Math.round(n * 1e4) / 1e4;
  return { v: 2, seed: g.seed, level: g.level, lives: g.lives, score: g.score, lifeMark: g.lifeMark, high: g.high, rng: g.rng, topReady: g.topReady, topHits: g.topHits,
    bricks: g.bricks.map(k => k.alive ? 1 : 0).join(''), paddle: r(g.paddle), serving: g.serving,
    ball: { x: r(b.x), y: r(b.y), vx: r(b.vx), vy: r(b.vy), spin: r(b.spin % 6.2832) },
    pile: g.pile.join(''), pileNext: g.pileNext, cracks: g.cracks, broken: g.broken, mended: g.mended };
}
const num = (v, lo, hi, d) => Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d;
export function load(g, s) {
  if (!s || typeof s !== 'object') return g;
  const v2 = s.v === 2;
  if (v2) {
    g.seed = Math.floor(num(s.seed, 1, 2147483646, g.seed));
    g.level = Math.floor(num(s.level, 1, 1e6, 1));
    g.lives = Math.floor(num(s.lives, 1, LIVES, LIVES));
    g.rng = Math.floor(num(s.rng, 1, 2147483646, g.rng));
    newBoard(g);
    // which bricks of this level's board are still there (all of them, if the save doesn't match)
    if (typeof s.bricks === 'string' && s.bricks.length === g.bricks.length) {
      g.bricks.forEach((k, i) => { k.alive = k.alive && s.bricks[i] === '1'; });
      if (bricksLeft(g) === 0) newBoard(g);
    }
  }
  // (the first Brickbuster's score becomes the high score, and the game starts from the top)
  g.score = v2 ? Math.floor(num(s.score, 0, 1e9, 0)) : 0;
  g.lifeMark = Math.floor(num(s.lifeMark, 0, 1e6, Math.floor(g.score / EXTRA_LIFE)));
  g.high = Math.max(g.score, Math.floor(num(v2 ? s.high : s.score, 0, 1e9, 0)));
  g.mended = !!s.mended && !s.broken;
  if (s.broken) g.broken = 'top';   // (the first one could also break at the bottom, or by clearing it: all just broken now)
  if (g.broken) for (const k of g.bricks) k.alive = false;
  // the cracks at the top and bottom
  const lb = s.cracks?.bottom;
  if (Array.isArray(lb) && !g.mended) g.cracks.bottom = lb.filter(c => c && Number.isFinite(+c.x) && Number.isFinite(+c.seed)).slice(0, CRACKS - 1).map(c => ({ x: +c.x, seed: +c.seed }));
  const l = s.cracks?.top;
  if (Array.isArray(l)) g.cracks.top = l.filter(c => c && Number.isFinite(+c.x) && Number.isFinite(+c.seed)).slice(0, CRACKS).map(c => ({ x: +c.x, seed: +c.seed }));
  if (typeof s.topReady === 'boolean') g.topReady = s.topReady;
  g.topHits = Math.floor(num(s.topHits, 0, CRACK_HITS - 1, 0));
  // the heap: as saved (colours 0 to 7) as far as it makes sense, else made up (the first one's was a string of rows)
  if (typeof s.pile === 'string' && /^[0-7]*$/.test(s.pile)) g.pile = [...s.pile].slice(-HEAP).map(Number);
  else g.pile = [];
  g.pileNext = g.pile.length < HEAP ? 0 : Math.floor(num(s.pileNext, 0, HEAP - 1, 0));
  if (v2) {
    g.paddle = num(s.paddle, half, W - half, W / 2);
    // the ball, where it was (anything that doesn't make sense: back on the paddle)
    const b = s.ball, ok = b && [b.x, b.y, b.vx, b.vy].every(n => Number.isFinite(+n)) && +b.x >= R && +b.x <= W - R && +b.y >= 0 && +b.y <= H - R;
    if (!s.serving && ok && Math.hypot(b.vx, b.vy) > 0.1 && !g.broken) {
      const f = g.speed / Math.hypot(b.vx, b.vy);
      Object.assign(g.ball, { x: +b.x, y: +b.y, vx: b.vx * f, vy: b.vy * f, spin: num(b.spin, 0, 7, 0) });
      g.serving = false;
    } else serve(g);
  } else serve(g);
  return g;
}

// the machine mends itself: the heap gone, the cracks gone, and the game carries on where it was
// (the same level, score and lives, on a whole new board)
export function mend(g) {
  g.cracks = { top: [], bottom: [] }; g.topReady = true; g.topHits = 0; g.pile = []; g.pileNext = 0; g.broken = null; g.over = false; g.mended = true;
  newBoard(g);
  serve(g);
}
