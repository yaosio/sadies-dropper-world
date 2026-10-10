// Brickbuster '96's headless checks: the game (game.js), its sounds (sounds/) and its cracks, run
// in Node with pretend players, seeded so every run is the same. A few seconds.
//
//   node tests/brickbuster/run.mjs
import { makeGame, step, launch, movePaddle, pushPaddle, save, load, restart, mend, bricksLeft, speedFor, newBoard, W, H, R, PADDLE, CRACKS, SPEED, ROWS, COLS, LIVES, HEAP } from '../../src/activities/brickbuster/game.js';
import { makeBoard, shapeFor, SHAPE_NAMES, MIN_BRICKS } from '../../src/activities/brickbuster/boards.js';
import { RATE } from '../../src/shared/retro.js';
import { crack, shatter, tink } from '../../src/activities/brickbuster/sounds/glass.js';
import { boing, blip, tock, miss, level, over, oneup } from '../../src/activities/brickbuster/sounds/machine.js';
import { pop, mend as mendSound } from '../../src/activities/brickbuster/sounds/repair.js';
import { mute } from '../../src/activities/brickbuster/sounds/quiet.js';
import { pat, chirp, trill, meow, makeChatter, VARIANTS, CHATTER, LOUD } from '../../src/activities/brickbuster/sounds/sadie.js';
import { crackLines, pileSlots, heapZone } from '../../src/activities/brickbuster/room.js';
import { makeLoose, release, stepLoose, floorBelow, R as LR } from '../../src/activities/brickbuster/loose.js';
import { makeTune, RANGE as TR, BPM } from '../../src/activities/brickbuster/music/tune.js';
import { SHAPES as TS } from '../../src/activities/brickbuster/music/player.js';
import { makeRepairTune, SHAPES as RS, RANGE as RR, SECS as REPAIR_SECS } from '../../src/activities/brickbuster/music/repair.js';
import { checker } from '../shared/check.mjs';

const { check, finish } = checker();
const DT = 1 / 60;

// A pretend player: `skill` 1 follows the ball perfectly (aiming off-centre now and then, to get a
// way through the bricks), 0 leaves the paddle where it is. It starts the next game after GAME OVER
// and mends the machine after it breaks, like the room does, and counts what happens on the way.
function play(seed, skill, secs, o = {}) {
  const g = o.g || makeGame(seed);
  if (o.level) { g.level = o.level; newBoard(g); }
  const st = { g, t: 0, out: 0, slow: 0, tunnels: 0, games: 0, breaks: 0, misses: 0, maxLevel: g.level, fastest: 0, events: [], firstBreak: Infinity };
  let aim = 0;
  for (let t = 0; t < secs; t += DT) {
    st.t = t;
    if (g.over) { st.games++; restart(g); }
    if (g.broken) { st.breaks++; st.firstBreak = Math.min(st.firstBreak, t); if (o.stopAtBreak) break; mend(g); }
    if (g.serving) launch(g);
    if (skill) {
      if (Math.floor(t * 0.5) !== Math.floor((t - DT) * 0.5)) aim = (((seed * 7 + Math.floor(t)) % 5) - 2) * 0.22;
      pushPaddle(g, Math.max(-1, Math.min(1, (g.ball.x - aim - g.paddle) * 8)) * skill, DT);
    }
    const prev = { y: g.ball.y, vy: g.ball.vy };
    const ev = step(g, DT);
    for (const e of ev) {
      if (e.type !== 'wall' && e.type !== 'brick' && e.type !== 'paddle') st.events.push({ ...e, t });
      if (e.type === 'miss') st.misses++;
    }
    st.maxLevel = Math.max(st.maxLevel, g.level);
    const b = g.ball;
    if (!g.serving && !g.over) {
      st.fastest = Math.max(st.fastest, Math.hypot(b.vx, b.vy));
      if (b.x < R - 1e-9 || b.x > W - R + 1e-9 || b.y < -3 * R || b.y > H - R + 1e-9) st.out++;
      if (Math.abs(b.vy) < 0.3 * g.speed) st.slow++;
      // coming down on the paddle and out of the other side without being hit
      const top = PADDLE.y + PADDLE.h / 2;
      if (prev.vy < 0 && prev.y - R >= top && b.y + R < PADDLE.y - PADDLE.h / 2 && Math.abs(b.x - g.paddle) < PADDLE.w / 2 - 0.05 && !ev.some(e => e.type === 'paddle' || e.type === 'miss')) st.tunnels++;
    }
    if (o.until && o.until(g)) break;
  }
  return st;
}

// 1. the ball stays in the glass, never gets stuck going sideways, and the machine copes with
// whatever it's given: game after game, level after level, breaking and mending as it goes
{
  let out = 0, slow = 0, secs = 0, fast = 0, games = 0, breaks = 0, levels = 0;
  for (let s = 1; s <= 12; s++) {
    const r = play(s * 101, s % 3 === 0 ? 0.15 : 0.6 + (s % 4) * 0.1, 900);
    out += r.out; slow += r.slow; secs += r.t; fast = Math.max(fast, r.fastest);
    games += r.games; breaks += r.breaks; levels = Math.max(levels, r.maxLevel);
  }
  check('the yarn ball never gets out of the glass, whatever happens (games lost, glass broken and mended)', !out, `${Math.round(secs / 60)} minutes of play, ${games} games over, ${breaks} breaks`);
  check('...never gets stuck bouncing sideways', !slow);
  check(`...goes up through the levels (to ${levels}), faster each one, but never past ${SPEED.most} m/s`, levels >= 2 && fast > SPEED.start && fast <= SPEED.most + 1e-6, `fastest ${fast.toFixed(2)} m/s`);
}

// 1b. there are no last levels: from the first to the hundred thousandth, the speed only goes up
// to its limit and stays there, and the ball is still caught by the paddle at top speed
{
  let ok = true, prev = 0;
  for (let l = 1; l <= 100000; l++) { const v = speedFor(l); if (v < prev - 1e-12 || v > SPEED.most + 1e-9 || v < SPEED.start - 1e-9) ok = false; prev = v; }
  check(`the speed rises with each level up to level ${SPEED.cap} (${SPEED.most.toFixed(1)} m/s) and then stays there, for a hundred thousand levels`, ok && speedFor(SPEED.cap) === SPEED.most && speedFor(100000) === SPEED.most, `${SPEED.start} to ${SPEED.most}`);
  let tunnels = 0, out = 0, fastest = 0, played = 0;
  for (const l of [1, 5, 14, 15, 16, 40, 1000, 99999]) {
    const r = play(l * 17, 1, 240, { level: l });
    tunnels += r.tunnels; out += r.out; played += r.t;
    fastest = Math.max(fastest, r.fastest);
    if (r.fastest > speedFor(r.maxLevel) + 1e-6) out++;
  }
  check('...and at any level the ball never goes through the paddle or out of the glass', !tunnels && !out, `${Math.round(played / 60)} minutes at levels 1 to 99999, fastest ${fastest.toFixed(2)} m/s`);
}

// 2. the paddle: straight up from its middle, off at an angle from its ends; a ball coming back up
// from beneath it goes through
{
  const g = makeGame(5); launch(g); movePaddle(g, 2);
  const hit = x => { Object.assign(g.ball, { x, y: PADDLE.y + PADDLE.h / 2 + R + 0.05, vx: 0, vy: -4 }); return step(g, 0.05).find(e => e.type === 'paddle') && Math.atan2(g.ball.vx, g.ball.vy); };
  const mid = hit(2), end = hit(2 + PADDLE.w / 2 - 0.02), other = hit(2 - PADDLE.w / 2 + 0.02);
  check('the paddle sends the ball straight up from its middle', Math.abs(mid) < 0.02, `${(mid * 57.3).toFixed(0)} degrees`);
  check('...and off at an angle from its ends', end > 0.8 && other < -0.8, `${(end * 57.3).toFixed(0)} and ${(other * 57.3).toFixed(0)} degrees`);
  Object.assign(g.ball, { x: 2, y: PADDLE.y - PADDLE.h / 2 - R - 0.02, vx: 0, vy: 4 });
  check('...and a ball coming back up from beneath it goes through', !step(g, 0.3).some(e => e.type === 'paddle') && g.ball.y > PADDLE.y + PADDLE.h / 2);
}

// 3a. before the machine has broken once, a miss cracks the glass at the bottom instead: three and it breaks, no life lost
{
  const g = makeGame(6), cr = [], br = [];
  for (let t = 0; t < 120 && !g.broken; t += DT) { if (g.serving) launch(g); for (const e of step(g, DT)) { if (e.type === 'crack' && e.side === 'bottom') cr.push(e.level); if (e.type === 'break') br.push(e.why); } }
  check('a fresh machine: each missed ball cracks the glass at the bottom (1, 2, 3), the third breaks it, and no life is lost', cr.join() === '1,2,3' && br.join() === 'bottom' && g.broken === 'top' && g.lives === LIVES && !g.over, `cracks ${cr.join(' ')}, broke ${br.join(' ')}, lives ${g.lives}`);
  check('...and a mended machine never takes cracks at the bottom', (() => { mend(g); const e = []; for (let t = 0; t < 20 && !g.over; t += DT) { if (g.serving) launch(g); e.push(...step(g, DT)); } return g.over && !g.cracks.bottom.length && !e.some(x => x.type === 'crack'); })());
}

// 3b. every 3000 points a life back, never past three, and a save doesn't give it twice
{
  const g = makeGame(11); g.mended = true; launch(g);
  const hit = () => { const k = g.bricks.find(b => b.alive); Object.assign(g.ball, { x: k.x + k.w / 2, y: k.y - R - 0.02, vx: 0, vy: 4 }); g.serving = false; return step(g, 0.05); };
  g.lives = 1; g.score = 2999; g.lifeMark = 0;
  const e = hit();
  check('3000 points with a life missing gives one back (and tells the room where the ball was)', g.lives === 2 && e.filter(x => x.type === 'oneup').length === 1 && Number.isFinite(e.find(x => x.type === 'oneup')?.x));
  const back = load(makeGame(12), save(g));
  check('...a save remembers it was given, so reloading never gives it twice', back.lifeMark === 1 && back.lives === 2);
  g.lives = LIVES; g.score = 5999; g.lifeMark = 1;
  const e2 = hit();
  check('...but never past three lives', g.lives === LIVES && !e2.some(x => x.type === 'oneup') && g.lifeMark === 2);
  restart(g);
  check('...and a new game starts counting again', g.lifeMark === 0 && g.lives === LIVES);
}

// 3. missing costs a life once mended: three and it's GAME OVER (and the glass isn't touched)
{
  const g = makeGame(7); g.high = 40; g.mended = true;
  const lives = [], overs = [];
  let t = 0;
  for (; t < 300 && !g.over; t += DT) { if (g.serving) launch(g); for (const e of step(g, DT)) { if (e.type === 'miss') lives.push(e.lives); if (e.type === 'over') overs.push(e); } }
  check(`leaving the paddle alone loses a life each miss: ${LIVES} lives, then GAME OVER, within a minute`, lives.join() === [2, 1, 0].join() && overs.length === 1 && g.over && t < 60, `lives left ${lives.join(' ')}, over after ${t.toFixed(0)} s`);
  check('...the glass is not cracked or broken by it, and nothing more happens', !g.cracks.top.length && !g.broken && !step(g, 1).length && g.lives === 0);
  check('...the final score and the high score are reported (the high score never goes down)', overs[0]?.high >= 40 && overs[0]?.score === g.score, `score ${overs[0]?.score}, high ${overs[0]?.high}`);
  const hi = g.high; restart(g);
  check('...and the next game starts from level 1 with three lives and a new board, keeping the high score', !g.over && g.level === 1 && g.lives === LIVES && g.score === 0 && g.high === hi && g.serving && bricksLeft(g) >= MIN_BRICKS);
  const s1 = save(Object.assign(makeGame(8), { over: true, lives: 0, level: 6 }));
  check('...a GAME OVER that gets saved comes back as the next game, ready to play', s1.lives === LIVES && s1.level === 1 && load(makeGame(9), s1).lives === LIVES);
}

// 4. playing well knocks a way through the bricks, and then the top cracks, three times
{
  const times = [];
  for (const s of [3, 11, 29, 47, 83]) {
    const r = play(s, 1, 1800, { stopAtBreak: true });
    times.push(r.firstBreak);
    if (r.g.broken) check(`...the break (seed ${s}) is by the top: three cracks, the glass broken and nothing left on the board`, r.g.cracks.top.length === CRACKS && r.g.broken === 'top' && bricksLeft(r.g) === 0 && !step(r.g, 1).length);
  }
  const worst = Math.max(...times);
  check('a good player breaks through the top: three cracks there, and it breaks', isFinite(worst), times.map(t => isFinite(t) ? (t / 60).toFixed(1) + ' min' : 'never').join(', '));
  // (this pretend player never misses and aims for the gaps: a person takes a good few minutes)
  check('...not in the first half minute, and within half an hour', Math.min(...times) > 30 && worst < 1800);
  const cs = play(5, 1, 600).events.filter(e => e.type === 'crack');
  check('...each crack worse than the last', cs.length >= CRACKS && cs.every((c, i) => c.level === (i % CRACKS) + 1), cs.map(c => c.level).join(' '));
}

// 5. bricks: knocking one out scores it and drops it on the floor; the last one is the next level
{
  const g = makeGame(9); launch(g);
  const k = g.bricks.filter(b => b.alive).sort((a, b) => b.row - a.row)[0];
  Object.assign(g.ball, { x: k.x + k.w / 2, y: k.y - R - 0.02, vx: 0, vy: 4 });
  const ev = step(g, 0.05);
  check('knocking out a brick scores it, bounces the ball back and drops it on the floor', !k.alive && g.score > 0 && g.ball.vy < 0 && ev.some(e => e.type === 'brick' && e.brick === k) && g.pile.join() === String(k.tone) && g.high === g.score);
  {   // (a fresh machine: clearing the board breaks it, like the original)
    const f = makeGame(10); launch(f); const l = f.bricks.filter(b => b.alive).at(-1);
    for (const b of f.bricks) if (b !== l) b.alive = false;
    Object.assign(f.ball, { x: l.x + l.w / 2, y: l.y - R - 0.02, vx: 0, vy: 4 });
    const e = step(f, 0.05);
    check('a fresh machine: knocking out the last brick breaks the glass (no next level yet)', f.broken === 'top' && e.some(x => x.type === 'break' && x.why === 'cleared') && f.level === 1);
  }
  g.mended = true;
  const last = g.bricks.filter(b => b.alive).at(-1), was = g.board;
  g.cracks.top.push({ x: 1, seed: 2 });
  for (const b of g.bricks) if (b !== last) b.alive = false;
  Object.assign(g.ball, { x: last.x + last.w / 2, y: last.y - R - 0.02, vx: 0, vy: 4 });
  const ev2 = step(g, 0.05);
  check('...and knocking out the last one is the next level: a new board, the cracks kept, a faster ball waiting on the paddle', ev2.some(e => e.type === 'level' && e.level === 2) && g.level === 2 && g.serving && !g.broken && bricksLeft(g) >= MIN_BRICKS && g.speed > speedFor(1) && g.lives === LIVES && g.cracks.top.length === 1, `${was} then ${g.board}`);
  // the heap holds HEAP bricks, and once full the oldest spot is swapped for the newest
  const h = makeGame(4), slots = new Set();
  h.mended = true;
  let mx = 0;
  for (let i = 0; i < 400; i++) {
    let kk = h.bricks.find(b => b.alive);
    if (!kk) { newBoard(h); kk = h.bricks.find(b => b.alive); }
    Object.assign(h.ball, { x: kk.x + kk.w / 2, y: kk.y - R - 0.02, vx: 0, vy: 4 }); h.serving = false; h.topReady = false;
    for (const e of step(h, 0.02)) if (e.type === 'brick') { slots.add(e.slot); mx = Math.max(mx, e.slot); }
    if (h.over || h.broken) break;
  }
  check(`...the heap never holds more than ${HEAP} bricks: after that each new one takes the oldest spot`, h.pile.length === HEAP && mx === HEAP - 1 && slots.size === HEAP && h.pileNext > 0, `${h.pile.length} on the floor after 400 bricks`);
}

// 5b. the boards: a new one for every level, made from the seed and the level number, whatever the number
{
  let thin = 0, big = 0, repeats = 0, odd = 0, same = 0;
  const seen = {};
  for (const seed of [1, 77, 4242, 999999]) {
    let prev = -1;
    for (let l = 1; l <= 4000; l++) {
      const b = makeBoard(seed, l), again = makeBoard(seed, l);
      if (b.cells.length < MIN_BRICKS) thin++;
      if (b.cells.length > ROWS * COLS) big++;
      if (b.cells.some(c => c.row < 0 || c.row >= ROWS || c.col < 0 || c.col >= COLS || !(c.tone >= 0 && c.tone < 8))) odd++;
      if (new Set(b.cells.map(c => c.row * COLS + c.col)).size !== b.cells.length) odd++;
      if (JSON.stringify(b) !== JSON.stringify(again)) same++;
      if (shapeFor(seed, l) === prev) repeats++;
      prev = shapeFor(seed, l);
      seen[b.name] = (seen[b.name] || 0) + 1;
    }
  }
  check(`every board for four thousand levels, four games over, is good: ${MIN_BRICKS} to ${ROWS * COLS} bricks, all inside the grid, none twice`, !thin && !big && !odd, `${thin} too thin, ${big} too big, ${odd} odd`);
  check('...the same game and level always make the same board', !same);
  check(`...every one of the ${SHAPE_NAMES.length} shapes turns up, and a shape never comes twice running`, Object.keys(seen).length === SHAPE_NAMES.length && !repeats, Object.entries(seen).map(([k, n]) => k + ' ' + n).join(', '));
  const boards = new Set([1, 2, 3, 4, 5, 6].map(s => JSON.stringify(makeBoard(s * 1000, 1).cells)));
  check('...and different games get different first boards', boards.size >= 4, `${boards.size} different out of 6`);
  const a = makeGame(11), b = makeGame(12);
  check('...every game picks its own boards from its seed', JSON.stringify(a.bricks.map(k => k.alive)) !== JSON.stringify(b.bricks.map(k => k.alive)) || a.board !== b.board);
}

// 6. what's kept between visits
{
  const r = play(13, 0.8, 400, { until: g => g.pile.length >= 12 && !g.serving });
  const s = JSON.parse(JSON.stringify(save(r.g)));
  const copy = load(makeGame(99), s);
  check('the board, the heap, the cracks, the level, the lives, the scores and the ball are kept between visits',
    save(copy).bricks === save(r.g).bricks && copy.pile.join() === r.g.pile.join() && copy.pile.length > 0 && JSON.stringify(copy.cracks) === JSON.stringify(r.g.cracks)
      && copy.score === r.g.score && copy.high === r.g.high && copy.level === r.g.level && copy.lives === r.g.lives && copy.board === r.g.board && copy.seed === r.g.seed,
    `level ${copy.level}, ${bricksLeft(copy)} bricks, ${copy.lives} lives, score ${copy.score}, high ${copy.high}`);
  check('...the ball too, exactly where it was and going the same way, so leaving just before a miss changes nothing',
    copy.serving === r.g.serving && Math.abs(copy.ball.x - r.g.ball.x) < 1e-3 && Math.abs(copy.ball.y - r.g.ball.y) < 1e-3
      && Math.abs(copy.ball.vx - r.g.ball.vx) < 1e-2 && Math.abs(copy.ball.vy - r.g.ball.vy) < 1e-2 && Math.abs(copy.paddle - r.g.paddle) < 1e-3);
  const e = makeGame(21); launch(e); Object.assign(e.ball, { x: 0.5, y: 0.4, vx: 0, vy: -4 }); e.paddle = 4.5; e.serving = false;
  const e2 = load(makeGame(22), JSON.parse(JSON.stringify(save(e))));
  const m1 = step(e, 0.2).filter(x => x.type === 'miss').length, m2 = step(e2, 0.2).filter(x => x.type === 'miss').length;
  check('...a ball about to miss, saved and loaded, still misses (once)', m1 === 1 && m2 === 1 && e2.lives === e.lives);
  let ok = true;
  const junks = [null, 5, 'x', {}, [], { v: 2 }, { v: 2, bricks: 'short', cracks: { top: [{ x: 'no' }, 1] }, score: -3, ball: { x: 'a' }, level: 'x', lives: 99 },
    { v: 2, cracks: { top: Array(9).fill({ x: 1, seed: 2 }) }, pile: 'zzzz9', level: -4, seed: -1, ball: { x: 99, y: 99, vx: 1e9, vy: 0 }, serving: false },
    { v: 2, level: 1e12, lives: 0, bricks: '0'.repeat(ROWS * COLS), paddle: 'x', pileNext: 1e9 }, { bricks: 'short', cracks: { bottom: Array(9).fill({ x: 1, seed: 2 }) }, score: -3, broken: 'bottom', pile: '01234567'.repeat(30) }];
  for (const junk of junks) {
    try {
      const g = load(makeGame(1), junk), b = g.ball;
      if (g.cracks.top.length > CRACKS || g.score < 0 || g.bricks.length !== ROWS * COLS || g.lives < 1 || g.lives > LIVES || g.level < 1 || g.pile.length > HEAP
        || !(bricksLeft(g) >= MIN_BRICKS || g.broken) || ![b.x, b.y, b.vx, b.vy, g.paddle].every(Number.isFinite) || b.x < 0 || b.x > W || g.pileNext < 0 || g.pileNext >= HEAP) ok = false;
      step(g, 1);
    } catch { ok = false; }
  }
  check('...and a broken save never breaks the game', ok);
  const old = load(makeGame(3), JSON.parse(JSON.stringify({ bricks: '1'.repeat(80), pile: '0123456701234567', cracks: { top: [], bottom: [{ x: 1, seed: 5 }] }, score: 740, broken: 'bottom' })));
  check("...a save from the first Brickbuster still loads: its score is the high score, it's still broken, the heap is still there", old.broken === 'top' && old.high === 740 && old.score === 0 && old.pile.length === 16 && old.bricks.every(k => !k.alive) && !step(old, 1).length);
  mend(old);
  check('...and mending a broken machine: the glass whole, the heap and cracks gone, a whole new board, the game carries on', !old.broken && !old.cracks.top.length && !old.pile.length && old.high === 740 && old.lives === LIVES && old.level === 1 && bricksLeft(old) >= MIN_BRICKS && old.serving);
  check('...and once mended the glass is mended for good: the top never cracks again, and a save remembers it', (() => {
    const m = load(makeGame(5), save(old));
    if (!m.mended) return false;
    for (let i = 0; i < 40; i++) { m.topReady = true; m.topHits = 5; m.cracks.top = []; Object.assign(m.ball, { x: 3, y: H - 0.3, vx: 0, vy: 5 }); m.serving = false; step(m, 1 / 30); }
    return !m.broken && !m.cracks.top.length;
  })());
  const mid = makeGame(31); mid.level = 7; mid.lives = 2; mid.score = 1234; mid.high = 5000; newBoard(mid); mid.cracks.top.push({ x: 1, seed: 2 }, { x: 2, seed: 3 }, { x: 3, seed: 4 }); mid.broken = 'top'; for (const k of mid.bricks) k.alive = false; mid.pile = [1, 2, 3];
  mend(mid);
  check('...in a game half way (level 7, 2 lives) it carries on at the same level with the same lives and score', mid.level === 7 && mid.lives === 2 && mid.score === 1234 && mid.high === 5000 && !mid.broken && bricksLeft(mid) >= MIN_BRICKS && mid.speed === speedFor(7));
}

// 7. the sounds: 8-bit, 11 kHz, never silent, never past full volume; the cracks get worse
{
  const stats = a => {
    let peak = 0, sum = 0, bits = true;
    for (const v of a) { peak = Math.max(peak, Math.abs(v)); sum += v * v; if (Math.abs(v * 127 - Math.round(v * 127)) > 1e-4) bits = false; }
    return { peak, rms: Math.sqrt(sum / a.length), bits, secs: a.length / RATE };
  };
  const c = [1, 2, 3].map(l => stats(crack(l)));
  const sh = stats(shatter()), mu = stats(mute()), me = stats(mendSound());
  const all = [...c, stats(boing(0)), stats(boing(1)), stats(blip(0)), stats(blip(5)), stats(tock()), stats(tink()), sh, mu, stats(miss()), stats(level()), stats(over()), stats(oneup()), stats(pop()), me];
  check('every sound is 8-bit, loud enough, and never past full volume', all.every(s => s.bits && s.peak > 0.2 && s.peak <= 1 && s.rms > 0.01), all.map(s => s.peak.toFixed(2)).join(' '));
  check('each crack is longer than the one before, the third a big one', c[0].secs < c[1].secs && c[1].secs < c[2].secs && c[2].secs > 1.5, c.map(s => s.secs.toFixed(2) + ' s').join(', '));
  check('...and louder', c[0].rms < c[2].rms, c.map(s => s.rms.toFixed(3)).join(' < '));
  check('the glass breaking is the biggest sound of all', sh.secs > c[2].secs && sh.rms > c[2].rms, `${sh.secs.toFixed(2)} s, ${sh.rms.toFixed(3)}`);
  check('the machine mending itself is softer than the glass breaking; a miss, a new level and GAME OVER are short', me.rms < sh.rms && stats(miss()).secs < 1.2 && stats(level()).secs < 1.2 && stats(over()).secs < 2 && stats(oneup()).secs < 1.4, `mend ${me.rms.toFixed(3)}`);
  check('the same crack sounds the same every time', crack(2).every((v, i) => v === crack(2)[i]));
  // Sadie's: 8-bit too, short, softer than the case's sounds, and each version a bit different
  const cat = { pat, chirp, trill, meow }, versions = Object.entries(cat).flatMap(([k, f]) => [...Array(VARIANTS)].map((_, v) => ({ k, v, a: f(v), s: stats(f(v)) })));
  check("Sadie's sounds are 8-bit, never silent, short", versions.every(x => x.s.bits && x.s.peak > 0.2 && x.s.peak <= 1 && x.s.rms > 0.01 && x.s.secs < 1), versions.map(x => x.k + x.v + ' ' + x.s.secs.toFixed(2) + ' s').filter((_, i) => i % VARIANTS === 0).join(', '));
  check('...and as loud as they play, softer than the smallest crack even right next to her', versions.every(x => x.s.rms * LOUD[x.k] < c[0].rms), versions.map(x => (x.s.rms * LOUD[x.k]).toFixed(3)).filter((_, i) => i % VARIANTS === 0).join(' ') + ' < ' + c[0].rms.toFixed(3));
  check('...and each of her versions sounds a bit different', Object.keys(cat).every(k => new Set(versions.filter(x => x.k === k).map(x => x.a.join())).size === VARIANTS));
}

// 8. the cracks' drawing: inside the glass, bigger each time, the same every time from its seed
{
  const CWi = Math.round(W / 0.05), CHi = Math.round(H / 0.05);
  const dots = (level, side, seed = 42) => {
    const pts = [];
    crackLines({ set fillStyle(c) {}, fillRect: (x, y) => pts.push([x, y]) }, { x: 1.3, seed }, level, side, CWi, CHi);
    return pts;
  };
  const n = [1, 2, 3].map(l => new Set(dots(l, 'top').map(p => p.join())).size);
  const inside = [1, 2, 3].every(l => dots(l, 'top').every(([x, y]) => x >= -1 && x <= CWi + 1 && y >= -1 && y <= CHi + 1));
  check('each crack drawn is bigger than the last', n[0] < n[1] && n[1] < n[2], n.join(' < ') + ' dots');
  check('...stays on the glass, and draws the same from its seed', inside && dots(3, 'top').join() === dots(3, 'top').join() && dots(3, 'top', 7).join() !== dots(3, 'top').join());
}

// 9. the heap on the floor: a spot for every brick, where nobody walks, filled from the floor up
{
  const spots = pileSlots();
  const apart = spots.every((a, i) => spots.every((b, j) => i === j || a.layer !== b.layer || Math.hypot(a.x - b.x, a.z - b.z) > 0.25));
  check(`the heap has a spot for every brick (${HEAP}), none on top of another`, spots.length === HEAP && apart);
  check('...all where nobody needs to walk', spots.every(p => heapZone(p.x, p.z)));
  const held = spots.every((p, i) => p.layer === 0 || spots.slice(0, i).some(q => q.layer === p.layer - 1 && Math.hypot(p.x - q.x, p.z - q.z) < 0.45));
  check('...and filled from the floor up: no brick lands on thin air', held);
}

// 10. loose in the hall: the yarn ball bounces round for ever and Sadie keeps whacking it off again
{
  // the hall's shape, as hall.js hands it over (a copy: these tests don't load the clubhouse; the
  // browser checks use the real one)
  const A = 8 * Math.cos(Math.PI / 16);
  const shape = { wall: A, post: 1.16, landing: { inner: 8 - 2.3, y: 4.6, thick: 0.18, rail: 1.0 }, top: 9.2,
    stairs: { r0: 1.45, r1: 3.05, th0: -2.1, turn: 0.29, rise: 4.6 / 22, treads: 26 },
    blocks: [{ x: -2.4, z: -6.9, r: 0.8 }, { x: -5.4, z: -4.5, r: 0.35 }, { x: 5.3, z: 2.0, r: 0.65 }].map(b => ({ ...b, h: 1.0 })) };
  const chat = { pat: 0, chirp: 0, trill: 0, meow: 0 }, said = [];
  let catThrough = 0, lazy = 0, away = 0, outside = 0, inSlab = 0, catOff = 0, whacks = 0, pops = 0, longest = 0, ground = 0, landing = 0, frames = 0;
  for (const seed of [1, 7, 42]) {
    const L = makeLoose(shape, seed), th = 10 * Math.PI / 8, dx = Math.sin(th), dz = Math.cos(th);
    release(L, [dx * (A - 0.4), 4.6 + LR + 0.4, dz * (A - 0.4)], [-dx * 4.5, 2, -dz * 4.5], [dx * (A - 0.3), 4.6, dz * (A - 0.3)], 1.7);
    let last = 0, pc = null;
    const chatter = makeChatter(seed);
    for (let t = 0; t < 1800; t += 1 / 60) {
      for (const e of stepLoose(L, 1 / 60)) {
        const x = chatter.heard(e, t);
        if (x) { chat[x.name]++; said.push({ ...x, t: seed * 1e4 + t }); } if (e === 'whack' || e === 'mighty') { whacks++; longest = Math.max(longest, t - last); last = t; } if (e === 'pop') pops++; }
      const b = L.ball, r = Math.hypot(b.x, b.z), c = L.cat;
      if (r > A - LR + 1e-6 || b.y < LR - 1e-6 || b.y > shape.top) outside++;
      if (r > shape.landing.inner + 0.01 && b.y + LR > 4.6 - 0.18 + 0.01 && b.y - LR < 4.6 - 0.01) inSlab++;
      if (Math.hypot(c.x, c.z) > A || (!c.leap && c.mode !== 'coming' && Math.abs(c.y - floorBelow(shape, c.x, c.z, c.y + 0.05)) > 0.01)) catOff++;
      if (b.on) { frames++; if (b.y > 4) landing++; else ground++; }
      // Sadie never goes through the landing, or through its railing below its top
      const cr = Math.hypot(c.x, c.z);
      if (cr > shape.landing.inner + 0.02 && c.y > 4.6 - 0.18 + 0.02 && c.y < 4.6 - 0.02) catThrough++;
      if (pc && (pc.r - shape.landing.inner) * (cr - shape.landing.inner) < 0 && Math.max(pc.y, c.y) > 4.6 - 0.18 && Math.min(pc.y, c.y) < 4.6 + 1.0) catThrough++;
      // and she's not lazy: while the ball's rolling away from her, she's after it
      if (c.mode === 'watch' && Math.hypot(b.x - c.x, b.z - c.z) > 4) { away++; if (!c.leap && pc && pc.x === c.x && pc.z === c.z) lazy++; }
      pc = { r: cr, y: c.y, x: c.x, z: c.z };
    }
  }
  check('loose in the hall, the yarn ball never gets out of it, or through the landing', !outside && !inSlab, `${outside} outside, ${inSlab} in the landing, over 90 minutes`);
  check('...Sadie keeps whacking it off again', whacks / 90 > 3 && longest < 60, `${(whacks / 90).toFixed(1)} a minute, longest wait ${longest.toFixed(0)} s`);
  check('...it spends time both up on the landing and down below', landing / frames > 0.1 && ground / frames > 0.1, `${(landing / frames * 100).toFixed(0)}% on the landing`);
  check('...Sadie always lands on something, inside the hall', !catOff);
  check('...never going through the landing or its railing', !catThrough, `${catThrough} times`);
  check('...and never just stands about while it rolls off', lazy / away < 0.25, `${(lazy / away * 100).toFixed(0)}% of the time it's more than 4 m off`);
  check('...and it hardly ever needs popping back', pops <= 3, `${pops} times`);
  // Sadie's sounds while she plays: now and then, never close together, never the same twice running
  let close = 0, voiceClose = 0, again = 0, busiest = 0;
  for (let i = 1; i < said.length; i++) {
    const gap = said[i].t - said[i - 1].t;
    if (gap < CHATTER.gap) close++;
    if (gap < 1e4 && said[i].name === said[i - 1].name && said[i].variant === said[i - 1].variant) again++;
  }
  const voiced = said.filter(x => x.name !== 'pat');
  for (let i = 1; i < voiced.length; i++) if (voiced[i].t - voiced[i - 1].t < CHATTER.voice) voiceClose++;
  for (const x of said) busiest = Math.max(busiest, said.filter(y => y.t >= x.t && y.t < x.t + 60).length);
  check("...Sadie makes her sounds now and then while she plays: pats, chirps, trills and the odd meow", Object.values(chat).every(n => n > 3) && said.length / 90 > 1.5 && said.length / 90 < 5, `${(said.length / 90).toFixed(1)} a minute: ${Object.entries(chat).map(([k, n]) => `${k} ${(n / 90).toFixed(2)}`).join(', ')} a minute`);
  check('...never two close together, and never more than 5 in any minute', !close && !voiceClose && busiest <= CHATTER.most, `${close} close, ${voiceClose} voices close, busiest minute ${busiest}`);
  check('...a meow at most twice a minute, and never the same sound twice running', chat.meow / 90 <= 2 && !again, `${(chat.meow / 90).toFixed(2)} meows a minute, ${again} repeats`);
  const L = makeLoose(shape, 3);
  release(L, [NaN, 2, 0], [0, 0, 0], [0, 0, 3], 0);
  check('a ball somewhere impossible pops back into the hall', stepLoose(L, 1 / 60).includes('pop') && Math.hypot(L.ball.x, L.ball.z) < A);
}

// ---------- the arcade music (music/): written as it plays ----------
{
  // twenty minutes at each heat (how cracked the glass is)
  const at = heat => {
    const tu = makeTune(heat * 10 + 4), bars = [];
    for (let t = 0; t < 1200;) { const b = tu.next(heat); bars.push(b); t += b.secs; }
    return bars;
  };
  const cool = at(0), warm = at(0.5), hot = at(1), all = [cool, warm, hot].flatMap(b => b.flatMap(x => x.notes));
  check('arcade music: a square-wave tune, a soft arpeggio and a triangle bass, no drums', all.every(n => ['sq', 'pulse', 'tri'].includes(n.voice)) && cool.flat().length > 100);
  check('...every note short, soft-edged and in its range', all.every(n => n.len > 0 && n.len <= 0.9 && n.vel > 0 && n.vel * TS[n.voice].gain < 0.4)
    && all.every(n => n.voice === 'tri' ? n.midi >= TR.bass[0] && n.midi <= TR.bass[1] : n.midi >= TR.lead[0] && n.midi <= TR.lead[1] + 12)
    && Object.values(TS).every(s => s.attack >= 0.005 && s.release >= 0.03), `longest ${Math.max(...all.map(n => n.len)).toFixed(2)} s`);
  const bpm = bars => 60 / (bars[0].secs / 4);
  check('...more exciting as the glass cracks: quicker, and the arpeggio joins in', bpm(cool) === BPM[0] && bpm(hot) === BPM[1] && bpm(warm) > bpm(cool)
    && !cool.some(b => b.notes.some(n => n.voice === 'pulse')) && warm.some(b => b.notes.some(n => n.voice === 'pulse')), `${bpm(cool)}, ${Math.round(bpm(warm))}, ${bpm(hot)} beats a minute`);
  // the tune takes a breath: the last bar of a round often has no tune
  const breaths = cool.filter((b, i) => i % 8 === 7 && !b.notes.some(n => n.voice === 'sq')).length / (cool.length / 8);
  check('...the tune takes a breath at the end of most rounds', breaths > 0.4, `${Math.round(breaths * 100)}%`);
  let repeats = 0;
  for (const bars of [cool, warm, hot]) {
    const seen = new Set();
    for (let i = 0; i + 8 <= bars.length; i += 8) {
      const k = bars.slice(i, i + 8).map(b => b.notes.map(n => n.midi + '@' + Math.round(n.at * 16)).join(' ')).join('|');
      if (seen.has(k)) repeats++; seen.add(k);
    }
  }
  check('...and it never plays the same round twice in twenty minutes', !repeats, `${repeats} repeats`);
}

// ---------- the repair tune (music/repair.js): the machine mending itself ----------
{
  const tunes = [1, 2, 3, 4, 5, 6, 7, 8].map(s => makeRepairTune(s * 31));
  const all = tunes.flatMap(t => t.notes);
  check('the mending tune is about fifteen seconds of notes, in order', tunes.every(t => t.secs > 12 && t.secs < 18 && t.notes.length > 40 && t.notes.every((n, i) => !i || n.at >= t.notes[i - 1].at)), `${REPAIR_SECS.toFixed(1)} s, ${tunes[0].notes.length} notes`);
  check('...every note soft-edged and in its range, none short enough to click or long enough to drone', all.every(n => n.len >= 0.1 && n.len <= 1.6 && n.vel > 0 && n.vel * RS[n.voice].gain < 0.4)
    && all.every(n => n.voice === 'tri' ? n.midi >= RR.bass[0] && n.midi <= RR.bass[1] + 7 : n.midi >= RR.lead[0] && n.midi <= RR.lead[1] + 12) && Object.values(RS).every(s => s.attack >= 0.004 && s.release >= 0.03), `longest ${Math.max(...all.map(n => n.len)).toFixed(2)} s`);
  check('...no steady row of notes: the bass is a couple a bar, and the tune has gaps', tunes.every(t => t.notes.filter(n => n.voice === 'tri').length <= 26 && t.notes.filter(n => n.voice === 'lead').length < 60));
  check('...a different tune every time, from a seed, the same from the same seed', new Set(tunes.map(t => JSON.stringify(t.notes))).size === tunes.length && JSON.stringify(makeRepairTune(31).notes) === JSON.stringify(tunes[0].notes));
}

finish('failed', 'all passed');
