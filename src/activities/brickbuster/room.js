// Brickbuster '96's room: a tall arcade room with the game built into it, not on a computer. The
// case fills the far wall (the glass is two storeys high), the paddle is a chunky plastic character
// with a face, the ball is a ball of yarn, and Sadie sits on a box beside it watching the ball.
//
// The clubhouse calls buildRoom(m) with its building kit (m: its shapes, its PS1 material, its
// textures and Sadie's sprite), so nothing here imports the clubhouse. It hands back a place like any
// room's, plus a `play` on the case: the clubhouse eases your view back until the whole glass fits,
// then passes the controls on to it (steer, nudge) until you step back.
import { Scene, Color, Mesh, Group, Vector2, Vector3, Shape, ExtrudeGeometry, ShapeGeometry, BoxGeometry, PlaneGeometry, SphereGeometry,
  DoubleSide, CanvasTexture, NearestFilter } from 'three';
import { makeGame, step, launch, movePaddle, pushPaddle, save, load, restart, mend, bricksLeft, W, H, R, PADDLE, HEAP, LIVES, CRACK_HITS } from './game.js';
import { makeSounds } from './sounds/index.js';
import { makeChatter } from './sounds/sadie.js';
import { makeArcade } from './music/player.js';
import { makeRepairMusic } from './music/repair.js';
import { soundsFor } from '../../shared/sound.js';
import { makeLoose, release, stepLoose, R as LR } from './loose.js';
import posterPic from './poster.js';

const KEY = 'game';
const RW = 5, RD = 6.5, RH = 11;     // the room: half its width and depth, and its height
const FY = 1.4, CZ = RD - 0.6;       // the glass's bottom edge above the floor, and the case's back
const Z = { play: 0.25, glass: 0.55 };   // in the case: where the game is, and the glass (towards you)
const TONES = [0xff3a3a, 0xff7a2a, 0xffa41e, 0xffe23a, 0x58d04a, 0x3ac8f0, 0x5a6af0, 0xb04af0];

export async function buildRoom(m) {
  const { T, psx, keep, tex, words, kit, doorway, card, leaf } = m;
  const scene = new Scene(); scene.background = new Color(0x0a0628);
  const { plane, cyl, shell } = kit(scene);

  // ---------- the room: tall walls, arcade carpet, the door ----------
  const paper = psx(T.damask, { rx: 1 / 1.3, ry: 1 / 1.3, tint: 0xd8ccff });
  shell({ w: RW, d: RD, h: RH, paper, wainscot: w => psx(T.wainscot, { rx: w / 0.9, decal: true }) });
  // the carpet every arcade had: black, with neon squiggles
  const carpet = tex(32, 32, g => {
    g.fillStyle = '#120a24'; g.fillRect(0, 0, 32, 32);
    const dots = [['#ff3ab4', [[3, 4], [4, 5], [5, 4], [6, 5], [7, 4]]], ['#3ae8ff', [[18, 10], [19, 9], [20, 10], [21, 11], [22, 10]]],
      ['#ffe23a', [[10, 20], [11, 20], [11, 21], [12, 22]]], ['#7a52f4', [[25, 25], [26, 24], [27, 25], [28, 26]]], ['#58d04a', [[4, 27], [5, 26], [6, 27]]]];
    for (const [c, pts] of dots) { g.fillStyle = c; for (const [x, y] of pts) g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#ffffff'; for (const [x, y] of [[14, 3], [28, 15], [8, 13], [21, 29]]) g.fillRect(x, y, 1, 1);
  });
  plane(2 * RW, 2 * RD, psx(carpet, { rx: 2 * RW / 1.6, ry: 2 * RD / 1.6 }), [0, 0, 0], [-Math.PI / 2, 0, 0], 8).renderOrder = -2;
  plane(2 * RW, 2 * RD, psx(null, { tint: 0x3a2a8e }), [0, RH, 0], [Math.PI / 2, 0, 0], 6);
  const door = doorway(scene, { pos: [0, 0, -RD], yaw: 0, w: 1.5, h: 2.45, leaves: [leaf], hinge: 1 });
  // the lamps: one high up, one lower over the door
  cyl(0.35, 0.5, 0.35, 8, psx(null, { tint: 0xfff08a, unlit: 0.85 }), [0, RH - 0.2, 0]);
  cyl(0.02, 0.02, 1.2, 3, psx(null, { tint: 0xffd23a }), [0, RH - 0.9, 0]);
  // Sadie's QUIET!! poster, on the wall by the door
  const pim = await m.loadImage(posterPic);
  const POSTER = new Vector3(RW - 0.06, 2.4, -RD + 2.6);
  plane(1.4, 1.84, psx(pim ? m.picture(pim) : T.dark, { decal: true, unlit: 0.3 }), POSTER.toArray(), [0, -Math.PI / 2, 0], 2);

  // ---------- the case: Brickbuster '96, built into the far wall ----------
  // Its own group, turned to face you: x runs across the glass left to right as you look at it, y up,
  // z out towards you. The glass runs from x -W/2 to W/2 and y 0 to H.
  const cab = new Group(); cab.position.set(0, FY, CZ); cab.rotation.y = Math.PI; scene.add(cab);
  const part = (mesh, pos, rot) => { mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); cab.add(mesh); return mesh; };
  const cbox = (w, h, d, mat, pos) => part(new Mesh(keep(new BoxGeometry(w, h, d, 2, 2, 2)), mat), pos);
  const cplane = (w, h, mat, pos, seg = 2) => part(new Mesh(keep(new PlaneGeometry(w, h, seg, seg)), mat), pos);
  // behind the glass: deep space, dithered
  const space = tex(32, 48, g => {
    for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
      const t = y / 47, b = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y % 4) * 4 + x % 4] / 16;
      g.fillStyle = t * 2 + b > 1.4 ? '#2a1766' : t * 2 + b > 0.7 ? '#1a0f40' : '#0a0628'; g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = '#ffffff'; for (const [x, y] of [[3, 5], [20, 9], [11, 17], [27, 24], [6, 33], [17, 40], [29, 44]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#ff8ec8'; for (const [x, y] of [[25, 3], [9, 26], [22, 36]]) g.fillRect(x, y, 1, 1);
  });
  cplane(W, H, psx(space, { rx: 2, ry: 2, unlit: 0.6 }), [0, H / 2, 0], 4);
  // the sides, the base with its coin door, and the marquee on top: loud 90s plastic
  const zig = tex(16, 16, g => {
    g.fillStyle = '#3a2a8e'; g.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) { const y = 3 + Math.abs((x % 8) - 4); g.fillStyle = '#3ae8ff'; g.fillRect(x, y, 1, 2); g.fillStyle = '#ff3ab4'; g.fillRect(x, y + 7, 1, 2); }
  });
  const plastic = psx(zig, { rx: 1, ry: 10 }), trim = psx(null, { tint: 0xffd23a });
  for (const s of [-1, 1]) {
    cbox(0.5, H + 3.0, 1.1, plastic, [s * (W / 2 + 0.25), H / 2 + 0.05, 0.4]);
    cbox(0.06, H + 3.0, 0.06, trim, [s * (W / 2 + 0.02), H / 2 + 0.05, 0.93]);
  }
  cbox(W + 1.0, FY, 1.3, psx(zig, { rx: 4, ry: 1 }), [0, -FY / 2, 0.45]);
  cbox(W + 1.0, 0.08, 1.34, trim, [0, 0, 0.45]);
  const coin = tex(72, 20, g => {
    g.fillStyle = '#1c1238'; g.fillRect(0, 0, 72, 20);
    for (const x of [24, 40]) { g.fillStyle = '#c89018'; g.fillRect(x, 3, 8, 12); g.fillStyle = '#1c1238'; g.fillRect(x + 3, 5, 2, 6); g.fillStyle = '#e83a3a'; g.fillRect(x + 1, 12, 6, 2); }
    // stickers, one peeling off
    g.fillStyle = '#fff4e4'; g.fillRect(2, 3, 20, 14); g.fillRect(51, 3, 19, 14);
    words(g, 'FREE', 12, 4, 1, '#e83a3a', { align: 'center' }); words(g, 'PLAY', 12, 11, 1, '#1c1238', { align: 'center' });
    words(g, 'NO', 61, 4, 1, '#e83a3a', { align: 'center' }); words(g, 'COINS', 61, 11, 1, '#1c1238', { align: 'center' });
    g.clearRect(66, 3, 4, 1); g.clearRect(68, 4, 2, 1);
  });
  cplane(2.9, 0.8, psx(coin, { decal: true, unlit: 0.2 }), [0, -0.65, 1.11]);
  cbox(W + 1.0, 1.6, 1.1, psx(null, { tint: 0x1c1238 }), [0, H + 0.8, 0.4]);
  const marquee = tex(256, 64, () => {}), mg = marquee.image.getContext('2d');
  cplane(W + 0.7, 1.55, psx(marquee, { unlit: 0.95 }), [0, H + 0.8, 0.96]);
  // the glass: clear (no fake glare: it hid the board), and the cracks drawn on a see-through picture over it
  const glint = tex(32, 48, () => {});
  const glass = [cplane(W, H, psx(glint, { unlit: 1, fade: 0.4 }), [0, H / 2, Z.glass])];
  const CW = Math.round(W / 0.05), CH = Math.round(H / 0.05);   // the cracks' picture, in its chunky pixels (5 cm each)
  const cracksTex = tex(CW, CH, () => {}), cg = cracksTex.image.getContext('2d');
  glass.push(cplane(W, H, psx(cracksTex, { unlit: 0.95, decal: true }), [0, H / 2, Z.glass + 0.01]));

  await m.breathe?.();   // (the clubhouse builds it a bit at a time, so nothing stutters)

  // ---------- inside: the bricks, the yarn ball and the paddle ----------
  const bevelTex = tex(8, 6, g => {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 8, 6); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 0, 1, 6);
    g.fillStyle = '#707070'; g.fillRect(0, 5, 8, 1); g.fillRect(7, 0, 1, 6); g.fillStyle = '#f0f0f0'; g.fillRect(1, 1, 2, 1);
  });
  const rowMats = TONES.map(c => psx(bevelTex, { tint: c, unlit: 0.45 }));
  const game = load(makeGame(Math.floor(Math.random() * 1e6) + 1), m.saves.get(KEY, null));   // (a new seed for every game, so its boards are new)
  const brickGeo = keep(new BoxGeometry(0.36, 0.22, 0.3));
  const bricks = game.bricks.map(k => part(new Mesh(brickGeo, rowMats[k.tone]), [k.x + k.w / 2 - W / 2, k.y + k.h / 2, Z.play]));
  const at = (x, y) => [x - W / 2, y];
  // the yarn ball: pink, wound round and round
  const yarn = tex(16, 16, g => {
    g.fillStyle = '#ff5ab4'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 16; i++) { g.fillStyle = '#c02a80'; g.fillRect(i, (i * 2) % 16, 1, 1); g.fillRect((i * 3 + 5) % 16, i, 1, 1); g.fillStyle = '#ffb0dc'; g.fillRect((i + 8) % 16, (i * 2 + 3) % 16, 1, 1); }
  });
  const ball = part(new Mesh(keep(new SphereGeometry(R, 8, 6)), psx(yarn, { rx: 2, unlit: 0.35 })), [0, 0, Z.play]);
  // the paddle: a chunky shiny plastic slab (a real 3D one, not a picture), with a face
  const shape = new Shape(), pw = PADDLE.w / 2 - 0.04, ph = PADDLE.h / 2 - 0.04, pr = 0.1;
  shape.moveTo(-pw + pr, -ph); shape.lineTo(pw - pr, -ph); shape.quadraticCurveTo(pw, -ph, pw, -ph + pr); shape.lineTo(pw, ph - pr);
  shape.quadraticCurveTo(pw, ph, pw - pr, ph); shape.lineTo(-pw + pr, ph); shape.quadraticCurveTo(-pw, ph, -pw, ph - pr);
  shape.lineTo(-pw, -ph + pr); shape.quadraticCurveTo(-pw, -ph, -pw + pr, -ph);
  const pgeo = keep(new ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 3 }).translate(0, 0, -0.11));
  const paddle = new Group(); part(paddle, [0, PADDLE.y, Z.play]);
  paddle.add(new Mesh(pgeo, psx(null, { tint: 0x2ad0c8, unlit: 0.3 })));
  const faces = drawFaces(m);
  const faceMat = psx(faces.focus[1], { unlit: 0.7 });
  const face = new Mesh(keep(new PlaneGeometry(PADDLE.w - 0.16, (PADDLE.w - 0.16) * 10 / 32)), faceMat);
  face.position.set(0, 0, 0.16); paddle.add(face);

  // ---------- where the bricks end up: a heap on the floor ----------
  // A knocked-out brick falls to the bottom of the glass, down a slot, and pops out of the BRICK
  // RETURN hatch at the foot of the machine onto the heap: along the front of the machine and down
  // its right side, where nobody needs to walk. The heap fills from the floor up, nearest the hatch
  // first, so it's always a proper pile. (game.pile: which rows fell, in order.)
  const hatchTex = tex(32, 16, g => {
    g.fillStyle = '#c89018'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#0a0628'; g.fillRect(2, 6, 28, 9);
    g.fillStyle = '#1c1238'; g.fillRect(1, 0, 30, 5); words(g, 'BRICK RETURN', 16, 0, 1, '#ffd23a', { align: 'center' });
  });
  cplane(0.8, 0.4, psx(hatchTex, { decal: true, unlit: 0.3 }), [1.6, -1.1, 1.11]);
  const HATCH = cab.localToWorld(new Vector3(1.6, -1.12, 1.2));
  const slots = pileSlots();
  const piled = [];   // the heap's bricks, in the order they fell
  const setPiled = (mesh, i) => { const s = slots[i]; mesh.position.set(s.x, s.y, s.z); mesh.rotation.set(s.tilt, s.yaw, s.roll); };
  function pileBrick(i, tone) {
    const b = new Mesh(brickGeo, rowMats[tone]); setPiled(b, i); landed(b, i); scene.add(b); return b;
  }
  // a brick comes to rest on its spot (the one that was there, once the heap's full, is swapped out)
  function landed(b, i) { const old = piled[i]; if (old && old !== b) scene.remove(old); piled[i] = b; }
  game.pile.forEach((tone, i) => pileBrick(i, tone));
  // things flying through the air on an arc (bricks to the heap, the paddle to the floor)
  const flights = [];
  function fly(mesh, to, { delay = 0, dur = 0.7, h = 0.8, spin = 8, land } = {}) {
    flights.push({ mesh, from: mesh.position.clone(), to, t: -delay, dur, h, spin: [(Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin], land });
  }
  // bits of brick falling down inside the glass, on their way to the slot
  const falling = [];
  // the extra-life sign: a big pink heart (the same hearts as the marquee's) with a white outline and
  // "1UP" under it in fat blocks. It pops up where the ball hit, floats up, and shrinks away.
  // (the main player has trouble reading, so the heart does the telling and the letters are huge)
  const ups = [];
  const upTex = tex(32, 32, g => {
    const heart = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
    const LET = { 1: ['.#.', '##.', '.#.', '.#.', '###'], U: ['#.#', '#.#', '#.#', '#.#', '###'], P: ['##.', '#.#', '##.', '#..', '#..'] };
    const blocks = (rows, x0, y0, s, col) => { g.fillStyle = col; rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') g.fillRect(x0 + x * s, y0 + y * s, s, s); })); };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blocks(heart, 5 + dx, 1 + dy, 2, '#ffffff');   // (the white outline)
    blocks(heart, 5, 1, 2, '#ff2e6e');
    let x = 3;
    for (const ch of '1UP') {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blocks(LET[ch], x + dx, 19 + dy, 2, '#1c1238');
      blocks(LET[ch], x, 19, 2, '#fff27a'); x += 9;
    }
  });
  const upMat = psx(upTex, { unlit: 1, decal: true });
  function showUp(x, y) {   // (x, y: where the ball hit, in the game's own numbers)
    const [px, py] = at(x, y);
    const mesh = cplane(0.85, 0.85, upMat, [Math.max(-W / 2 + 0.5, Math.min(W / 2 - 0.5, px)), Math.max(0.5, Math.min(H - 0.5, py)), Z.glass + 0.06]);
    mesh.scale.setScalar(0.001);
    ups.push({ mesh, t0: now, y0: mesh.position.y });
  }

  // ---------- Sadie, on a box beside the machine, watching the ball ----------
  const SADIE = new Vector3(4.15, 0.9, CZ - 1.2);
  const perch = new Group(); perch.position.set(SADIE.x, 0, SADIE.z); perch.rotation.y = -0.25; scene.add(perch);
  const cardboard = psx(T.cardboard, { rx: 1, ry: 1 });
  { const b = new Mesh(keep(new BoxGeometry(0.9, 0.85, 0.75, 2, 2, 2)), cardboard); b.position.y = 0.465; perch.add(b); }   // (4 cm off the floor, so the floor never shows through its bottom)
  const sadie = m.sadie(0.78, { unlit: 0.4 });
  sadie.position.copy(SADIE); scene.add(sadie);

  await m.breathe?.();   // (the clubhouse builds it a bit at a time, so nothing stutters)

  // ---------- broken: the glass gone but for a jagged edge, and glitter all over the floor ----------
  const edgeTex = tex(CW, CH, g => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const tooth = (x, y, dx, dy, len) => { for (let i = 0; i < len; i++) { const w = Math.round((1 - i / len) * 3); for (let j = -w; j <= w; j++) { g.fillStyle = i < 2 || Math.abs(j) === w ? '#ffffff' : '#bfe8ff'; g.fillRect(x + dx * i + dy * j, y + dy * i + dx * j, 1, 1); } } };
    for (let x = 2; x < CW - 2; x += 3 + Math.floor(r() * 4)) { tooth(x, 0, 0, 1, 2 + Math.floor(r() * 9)); tooth(x, CH - 1, 0, -1, 2 + Math.floor(r() * 9)); }
    for (let y = 2; y < CH - 2; y += 3 + Math.floor(r() * 4)) { tooth(0, y, 1, 0, 2 + Math.floor(r() * 7)); tooth(CW - 1, y, -1, 0, 2 + Math.floor(r() * 7)); }
  });
  const edges = cplane(W, H, psx(edgeTex, { unlit: 0.9, decal: true, side: DoubleSide }), [0, H / 2, Z.glass]);
  const glitter = tex(32, 32, g => {
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.3 ? '#ffffff' : r() < 0.5 ? '#bfe8ff' : '#8ad8ff'; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + (r() < 0.2 ? 1 : 0), 1); }
  });
  const shardsOnFloor = plane(7, 3.2, psx(glitter, { rx: 7 / 1.2, ry: 3.2 / 1.2, onFloor: true, unlit: 0.7 }), [0, 0, CZ - 3.3], [-Math.PI / 2, 0, 0], 4);
  shardsOnFloor.renderOrder = -1;
  const shardGeo = keep(new ShapeGeometry(new Shape([new Vector2(0, 0), new Vector2(0.22, 0.05), new Vector2(0.06, 0.3)])));
  const shardMat = psx(null, { tint: 0xd8f6ff, unlit: 0.8, side: DoubleSide });
  const shards = [];
  // the landing's side of the door: Sadie's OUT OF ORDER sign, taped on crooked (made once: it stays
  // on the landing's door while the room's put away, and the room built again uses the same one)
  const signed = m.doorImage ? signs.get(m.doorImage) || signs.set(m.doorImage, outOfOrder(m.doorImage, words)).get(m.doorImage) : null;

  // ---------- drawing the marquee and the cracks ----------
  // (big letters: they have to read from where you play, across the room)
  const logo = document.createElement('canvas'); logo.width = 256; logo.height = 20;
  { const g = logo.getContext('2d');
    words(g, "BRICKBUSTER '96", 128, 3, 3, '#ffffff', { align: 'center' });
    g.globalCompositeOperation = 'source-atop';
    ['#fffbd0', '#fff27a', '#ffe23a', '#ffc81e', '#ffc81e', '#ffa41e', '#ff7a2a', '#ff7a2a', '#ff5446', '#ff3a78', '#ff3a78', '#f030a8', '#c830d0', '#c830d0', '#9a3ce8']
      .forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 3 + i, 256, 1); }); }
  // what the marquee is showing: the score and the high score, then the level and the lives left (while you play),
  // or GAME OVER, FIXING ITSELF or OUT OF ORDER
  let shown = '', fixing = false, overRecord = false, active = false;
  const marqueeKey = () => [game.broken ? 'broken' : fixing ? 'fixing' : game.over ? 'over' : active ? 'play' : 'idle', game.score, game.high, game.level, game.lives, overRecord].join();
  const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  function drawMarquee() {
    shown = marqueeKey();
    mg.clearRect(0, 0, 256, 64); mg.fillStyle = '#12082e'; mg.fillRect(0, 0, 256, 64);
    // the name in copper bars, a colour per scanline, with a hard shadow
    words(mg, "BRICKBUSTER '96", 130, 5, 3, '#5a2a78', { align: 'center' });
    mg.drawImage(logo, 0, 0);
    mg.fillStyle = '#ffffff'; mg.fillRect(0, 22, 256, 1);
    const num = n => String(n).padStart(6, '0'), right = (text, y, col) => words(mg, text, 232 - (text.length * 8 - 2), y, 2, col);
    if (game.over) {
      words(mg, 'FINAL ' + num(game.score), 18, 28, 2, '#3ae8ff');
      if (overRecord) right('NEW HIGH SCORE', 28, '#ffe23a');
      else right('HIGH ' + num(game.high), 28, '#3ae8ff');
      words(mg, 'GAME OVER', 128, 44, 2, '#e83a3a', { align: 'center' });
    } else {
      words(mg, 'SCORE ' + num(game.score), 18, 28, 2, '#3ae8ff');
      right('HIGH ' + num(game.high), 28, '#3ae8ff');
      if (game.broken) words(mg, 'OUT OF ORDER', 128, 44, 2, '#e83a3a', { align: 'center' });
      else if (fixing) words(mg, 'FIXING ITSELF', 128, 44, 2, '#7af0a0', { align: 'center' });
      else if (!active) words(mg, 'FULL VERSION 99 LEVELS', 128, 44, 2, '#ff8ec8', { align: 'center' });
      else {
        words(mg, 'LEVEL ' + game.level, 18, 44, 2, '#ff8ec8');
        for (let i = 0; i < LIVES; i++) {
          const x0 = 232 - (LIVES - i) * 13 + 3, col = i < game.lives ? '#ff5ab4' : '#3a2a5e';
          mg.fillStyle = col; HEART.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') mg.fillRect(x0 + x * 2, 43 + y * 2, 2, 2); }));
        }
      }
    }
    marquee.needsUpdate = true;
  }
  function drawCracks() {
    cg.clearRect(0, 0, CW, CH);
    game.cracks.top.forEach((c, i) => crackLines(cg, c, i + 1, 'top', CW, CH));
    game.cracks.bottom.forEach((c, i) => crackLines(cg, c, i + 1, 'bottom', CW, CH));
    cracksTex.needsUpdate = true;
  }
  drawMarquee(); drawCracks();

  // ---------- playing ----------
  let go = false, wasServing = false;   // (a new ball waits on the paddle until you touch the screen or press a key: `begin`)
  let wait = 0, overAt = 0, dirty = false, savedAt = 0, mood = { name: 'calm', until: 0 }, pop = 0, now = 0;
  // its sounds, through the clubhouse's sound system (stopped by the clubhouse when the room's put away)
  const sfx = soundsFor('room:' + card.id);
  let sound = null, music = null, showing = 'calm', lastTock = 0;
  const keep_ = () => { m.saves.set(KEY, save(game)); dirty = false; };
  const stopLeaving = m.saves.onLeave(() => { if (dirty) keep_(); });   // (saved as the page is hidden or closed)
  function feel(name, secs) { mood = { name, until: now + secs }; }
  const clunk = () => { if (sound && now - lastTock > 0.07) { lastTock = now; sound.tock(); } };
  const play = {
    label: "PLAY BRICKBUSTER '96",
    hint: { keys: '<kbd>A D</kbd> OR <kbd>MOUSE</kbd> MOVE &nbsp; <kbd>CLICK</kbd> OR <kbd>SPACE</kbd> SEND THE BALL &nbsp; <kbd>ESC</kbd> STEP BACK', touch: 'TOUCH TO SEND THE BALL, SLIDE TO MOVE' },
    holdToLeave: true,   // on a phone, STEP BACK has to be held a moment (a thumb sliding about hits it by accident)
    // what the view has to fit: the glass, and a bit of the case round it
    // (the glass, the marquee, and the floor in front, where the bricks come out onto the heap; the
    // marquee's letters are big enough to read from there)
    view: { center: new Vector3(0, (-0.25 + FY + H + 1.75) / 2, CZ - Z.glass), normal: new Vector3(0, 0, -1), w: W + 0.9, h: FY + H + 1.75 + 0.25 },
    // where you watch from once it's broken: the middle of the room, on the floor, looking at it
    // (a corner well off the yarn ball's way out, and away from the door)
    after: { x: -3.4, z: 3.1, yaw: Math.PI + 0.5, pitch: 0.15 },
    over: false,   // broken: the clubhouse steps you back to watch
    start() {
      if (!sound) sound = makeSounds(sfx);
      sound.wake();
      if (!game.broken && !fixing) {
        if (game.over) nextGame();   // (stepped back at GAME OVER: the next game's ready)
        // (a game left half way carries on from the same moment, after a breath: the ball hangs where it was)
        active = true; wait = game.serving ? 0.9 : 0.6; dirty = true; go = false; wasServing = game.serving;
        // its arcade music (music/: the clubhouse's theme makes way for it by itself)
        (music ||= makeArcade(sfx)).play();
        drawMarquee();
      }
    },
    // a touch, a click or a key: the waiting ball is sent off
    begin() { if (active) go = true; },
    stop() { active = false; music?.stop(); if (dirty) keep_(); drawMarquee(); },
    steer(v, dt) { if (active && v) pushPaddle(game, v, dt); },
    nudge(dx) { if (active) movePaddle(game, game.paddle + dx); },
  };
  function happen(events) {
    for (const e of events) {
      if (e.type === 'paddle') { sound.boing(e.off); feel('happy', 0.35); pop = 1; }
      else if (e.type === 'wall') sound.tock();
      else if (e.type === 'glass') sound.tink();
      else if (e.type === 'brick') {
        sound.blip(e.brick.row); dirty = true;
        const i = game.bricks.indexOf(e.brick), src = bricks[i];
        const bit = part(new Mesh(brickGeo, rowMats[e.brick.tone]), [src.position.x, src.position.y, Z.play]);
        falling.push({ mesh: bit, vx: (Math.random() - 0.5) * 1.2, vy: 1.2, spin: (Math.random() - 0.5) * 12, slot: e.slot, tone: e.brick.tone });
      } else if (e.type === 'crack') {
        if (!game.broken) sound.crack(e.level);
        feel('wince', 1.1); drawCracks(); keep_();
      } else if (e.type === 'miss') {
        // the ball dropped out of the bottom: a life gone (a new ball on the paddle in a moment)
        if (game.mended) sound.miss();   // (before the first break a miss cracks the glass instead, which has its own sound)
        feel('wince', 0.9); wait = 1.1; keep_();
      } else if (e.type === 'oneup') {
        sound.oneup(); feel('happy', 1.4); showUp(e.x, e.y); keep_();
      } else if (e.type === 'level') {
        // a new board: its bricks pop in, one after another across the glass
        sound.level(); feel('happy', 1.4); wait = 1.3; newBoardLook(); keep_();
      } else if (e.type === 'over') {
        // out of lives: GAME OVER, for a few seconds, then the next game (the machine isn't hurt)
        sound.over(); feel('sad', 3.2); overAt = now + 3.6; overRecord = e.record; keep_();
      } else if (e.type === 'break') smash(e.spilled, e.slots);
    }
  }
  // the next game after GAME OVER: a new seed, a new first board, three lives again
  function nextGame() {
    restart(game); overAt = 0; overRecord = false; newBoardLook(); wait = 1.0; keep_();
  }
  // the bricks as the game has them (a new board: new colours, popping in one after another)
  const popIn = bricks.map(() => 0);
  function newBoardLook() {
    game.bricks.forEach((k, i) => { bricks[i].material = rowMats[k.tone]; popIn[i] = k.alive ? now + 0.25 + (k.row * 0.05 + k.col * 0.025) : 0; if (k.alive) bricks[i].scale.setScalar(0.001); });
  }

  // ---------- the break ----------
  // All the glass goes at once. The bricks still up there tumble out onto the heap, the paddle drops
  // out into the rubble, and the yarn ball escapes: a few loud bounces round the room, smack into
  // Sadie's QUIET!! poster (after which it never makes another sound), then out through the door,
  // with Sadie bolting after it.
  let escape = null;        // the yarn ball's way out: { hops, i, t }, then 'gone'
  let run = null;           // Sadie chasing it
  let doneAt = 0;
  function brokenLook() {
    for (const p of glass) p.visible = false;
    edges.visible = true; shardsOnFloor.visible = true;
    place.uses = [];
    drawMarquee();
  }
  function smash(spilled, slots) {
    active = false; play.over = true;
    music?.stop(0.15); sound.shatter(); feel('wince', 1.4);
    brokenLook(); keep_();
    // the glass flies out in bits
    for (let i = 0; i < 44; i++) {
      const s = new Mesh(shardGeo, shardMat);
      s.position.copy(cab.localToWorld(new Vector3((Math.random() - 0.5) * W, Math.random() * H, Z.glass)));
      s.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(s);
      shards.push({ mesh: s, v: new Vector3((Math.random() - 0.5) * 3, Math.random() * 2, -1 - Math.random() * 3), spin: (Math.random() - 0.5) * 14, rest: 0 });
    }
    // the bricks left up there spill out onto the heap
    spilled.forEach((k, j) => {
      const src = bricks[game.bricks.indexOf(k)], b = new Mesh(brickGeo, rowMats[k.tone]), slot = slots[j];
      b.position.copy(cab.localToWorld(src.position.clone())); scene.add(b);
      fly(b, slotPos(slot), { delay: 0.05 + Math.random() * 0.5, dur: 0.8 + Math.random() * 0.4, h: 0.9, spin: 10, land: () => { setPiled(b, slot); landed(b, slot); clunk(); } });
    });
    // the paddle drops out into the rubble
    scene.attach(paddle);
    fly(paddle, PADDLE_DOWN.clone(), { delay: 0.2, dur: 1.0, h: 0.6, spin: 4, land: () => { restPaddle(); clunk(); } });
    // the yarn ball gets out
    scene.attach(ball);
    const hops = [
      [new Vector3(-1.8, R, 2.6), 0.9, 'boing'], [new Vector3(-RW + R, 3.2, 0.6), 1.0, 'boing'], [new Vector3(1.2, R, -0.4), 1.4, 'boing'],
      [new Vector3(-RW + R, 6.4, -1.4), 0.8, 'boing'], [new Vector3(-0.5, R, -2.4), 0.3, 'boing'],
      [POSTER.clone().add(new Vector3(-R - 0.02, 0, 0)), 0.5, 'mute'],
      [new Vector3(1.6, R, -5.2), 0.6, null], [new Vector3(0.1, R, -6.2), 0.3, null], [new Vector3(0, R, -7.8), 0.2, null],
    ];
    escape = { hops, i: 0, t: 0, from: ball.position.clone() };
    place.watch = ball.position;   // everyone in the room watches it go
  }
  // Your view follows the yarn ball out, then Sadie after it, until she's out and the door has shut. Then
  // it glides back (WATCH_ALL: to the far end of the room, looking at the middle of the machine so all of
  // it shows) and, once it's there, the machine mends itself. It stays there till the mending's done.
  const WATCH_ALL = Object.assign(new Vector3(0, FY + H * 0.45, CZ - Z.glass), { at: { x: 0, z: -RD + 0.35, y: 0 } });
  const watchSadie = new Vector3();
  let viewing = false, viewSince = 0;   // (gliding back to see all of it, before the mending starts)
  function gatherView() { place.watch = WATCH_ALL; viewing = true; viewSince = now; repairAt = now + 4; }   // (4 s at most: it starts as soon as you're there)
  const PADDLE_DOWN = new Vector3(0.5, 0.66, CZ - 1.6);
  function restPaddle() { paddle.position.copy(PADDLE_DOWN); paddle.rotation.set(1.0, Math.PI, 0.14); paddle.scale.set(1, 1, 1); }
  function slotPos(i) { const s = slots[i]; return new Vector3(s.x, s.y, s.z); }
  function escapeOn(dt) {
    const e = escape, [to, h, noise] = e.hops[e.i];
    const dur = 0.25 + e.from.distanceTo(to) / 8.5;
    e.t += dt;
    const k = Math.min(1, e.t / dur);
    ball.position.lerpVectors(e.from, to, k); ball.position.y += 4 * h * k * (1 - k);
    ball.rotation.x += dt * 14; ball.rotation.z += dt * 9;
    if (k < 1) return;
    if (noise === 'boing') sound?.boing(Math.random() * 2 - 1);
    if (noise === 'mute') {
      sound?.mute(); place.holding = door;
      if (sadie.visible) run = { t: 0, from: sadie.position.clone() };   // (Sadie bolts after it; if she's out in the hall already, the door just waits for the ball to get out)
      else { run = 'gone'; doneAt = now + 2.4; }
    }
    e.from = to.clone(); e.t = 0; e.i++;
    if (e.i >= e.hops.length) { escape = 'gone'; ball.visible = false; outInTheHall(true); }
  }
  // Sadie: off her box and straight out the door after it
  function runOn(dt) {
    run.t += dt;
    const out = new Vector3(0, 0, -7.4), hop = 0.35, dist = run.from.distanceTo(out), dur = hop + dist / 5.5;
    if (run.t < hop) { const k = run.t / hop; sadie.position.lerpVectors(run.from, new Vector3(3.7, 0, CZ - 1.9), k); sadie.position.y = run.from.y * (1 - k) + 0.5 * Math.sin(k * Math.PI); }
    else { const k = Math.min(1, (run.t - hop) / (dur - hop)); sadie.position.lerpVectors(new Vector3(3.7, 0, CZ - 1.9), out, k); sadie.position.y = Math.abs(Math.sin(run.t * 16)) * 0.12; }
    if (run.t >= dur) { sadie.visible = false; run = 'gone'; doneAt = now + 0.5; }
  }
  // done: the door shuts, and the landing's side of it has her sign on
  let signUp = false;
  function unsign() { if (m.landingDoor) m.landingDoor.paint(null); signUp = false; }   // (her sign comes off: the door's own again)
  function putSignUp() { if (signed && m.landingDoor) { m.landingDoor.paint(signed); signUp = true; } }
  function finished() { place.holding = null; doneAt = 0; putSignUp(); gatherView(); }

  // ---------- mending itself ----------
  // Once Sadie's out and the door's shut (or, if it was left broken, when you come into the room), the
  // machine fixes itself to a whimsical tune: the paddle rises out of the rubble and puts itself back
  // in the machine, a new ball pops out of it, the glass puts itself back together, the heap of
  // knocked-out bricks dances up and out of the top, and a new board pops in. Then it can be played.
  const MEND = { paddle: 0.5, paddleIn: 3.4, ball: 4.2, glass: 4.8, glassBack: 8.0, bricks: 6.6, board: 10.4, end: 13.4 };
  let repairAt = 0, repairHold = false, repair = null, hideBoard = false, ballPop = 0, repairMusic = null;
  const dances = [];   // heap bricks on their way up and out
  function startRepair() {
    repairAt = 0; repair = { t0: now }; fixing = true; play.over = false; viewing = false; place.watch = WATCH_ALL;
    if (!sound) sound = makeSounds(sfx);
    sound.wake();
    (repairMusic ||= makeRepairMusic(sfx)).play();
    drawMarquee();
  }
  const ease = u => u * u * (3 - 2 * u);
  function repairOn(t) {
    const r = repair, k = t - r.t0;
    // the paddle rises out of the rubble, wobbles, then goes home into the machine
    if (k >= MEND.paddle && !r.home) {
      if (!r.from) { r.from = paddle.position.clone(); r.rot = paddle.rotation.clone(); r.hover = new Vector3(0.6, 2.6, CZ - 1.6); cab.updateWorldMatrix(true, false); r.target = cab.localToWorld(new Vector3(0, PADDLE.y, Z.play)); sound.boing(0); feel('happy', MEND.paddleIn - MEND.paddle + 1.2); }
      const q = Math.min(1, (k - MEND.paddle) / (MEND.paddleIn - MEND.paddle)), up = q < 0.5, u = up ? ease(q / 0.5) : ease((q - 0.5) / 0.5);
      if (up) paddle.position.lerpVectors(r.from, r.hover, u); else paddle.position.lerpVectors(r.hover, r.target, u);
      paddle.position.y += up ? 0 : 0.5 * Math.sin(u * Math.PI);
      const wob = Math.sin(k * 7) * 0.22 * (1 - (up ? 0 : u));
      paddle.rotation.set(r.rot.x * (1 - ease(Math.min(1, q * 1.6))), Math.PI, r.rot.z * (1 - q) + wob);
      paddle.scale.set(1 + 0.08 * Math.sin(k * 7), 1 - 0.08 * Math.sin(k * 7), 1);
      if (q >= 1) {
        r.home = true; cab.attach(paddle);
        paddle.position.set(0, PADDLE.y, Z.play); paddle.rotation.set(0, 0, 0); paddle.scale.set(1, 1, 1);
        // the machine is a new game now (the heap you can see is what's left to clear away)
        mend(game); hideBoard = true; for (const b of bricks) b.scale.setScalar(1);
        drawCracks(); keep_(); sound.boing(0.5); feel('happy', 1.4); pop = 1;
      }
    }
    // a new ball pops out of the paddle
    if (r.home && !r.ball && k >= MEND.ball) { r.ball = true; cab.attach(ball); ball.visible = true; ballPop = t; sound.pop(); }
    // the glass puts itself back together
    if (k >= MEND.glass && !r.glass) {
      r.glass = true; sound.mend();
      for (let i = 0; i < 44; i++) {
        const sh = new Mesh(shardGeo, shardMat);
        sh.position.set((Math.random() - 0.5) * 6.4, 0.03, CZ - 3.3 + (Math.random() - 0.5) * 3); sh.rotation.set(-Math.PI / 2, 0, Math.random() * 6); scene.add(sh);
        const to = cab.localToWorld(new Vector3((Math.random() - 0.5) * W, Math.random() * H, Z.glass));
        fly(sh, to, { delay: Math.random() * 2.4, dur: 0.9 + Math.random() * 0.5, h: 1.4, spin: 12, land: () => scene.remove(sh) });
      }
    }
    if (k >= MEND.glass + 0.8) shardsOnFloor.visible = false;
    if (k >= MEND.glassBack && !r.glassBack) { r.glassBack = true; for (const p of glass) p.visible = true; edges.visible = false; }
    // the heap of bricks dances up and out of the top of the machine
    if (k >= MEND.bricks && !r.bricks) {
      r.bricks = true;
      const here = piled.map((b, i) => b ? i : -1).filter(i => i >= 0);
      here.forEach((i, j) => {
        const b = piled[i], p = b.position;
        dances.push({ i, mesh: b, t: -(j / Math.max(1, here.length) * 2.8 + Math.random() * 0.2), dur: 2.2 + Math.random() * 0.5, x0: p.x, y0: p.y, z0: p.z,
          ph: Math.random() * 6.28, dir: Math.random() < 0.5 ? -1 : 1, r0: new Vector3().setFromEuler(b.rotation) });
      });
    }
    // a new board pops in
    if (k >= MEND.board && !r.board) { r.board = true; hideBoard = false; newBoardLook(); sound.level(); }
    if (k >= MEND.end && dances.length === 0) {
      repair = null; fixing = false; escape = null; run = null; play.over = false;
      place.uses = [useEntry]; unsign(); drawMarquee(); keep_();
      repairMusic?.stop(1.5);
    }
  }
  // the heap's bricks swaying up the front of the machine and over its top, spinning as they go
  function dancesOn(dt) {
    for (let n = dances.length - 1; n >= 0; n--) {
      const d = dances[n]; d.t += dt;
      if (d.t < 0) continue;
      const q = Math.min(1, d.t / d.dur), e = ease(q), p = d.mesh.position;
      p.x = d.x0 * (1 - q * 0.7) + Math.sin(q * Math.PI * 3 + d.ph) * 0.5 * (1 - q * 0.3);
      p.y = d.y0 + (FY + H + 2.0 - d.y0) * e;
      p.z = d.z0 + (CZ - 0.3 - d.z0) * Math.pow(q, 2);
      d.mesh.rotation.set(d.r0.x + q * 5 * d.dir, d.r0.y + q * 9 * d.dir, Math.sin(q * Math.PI * 4 + d.ph) * 0.7);
      const squash = 1 + 0.2 * Math.sin(q * Math.PI * 5 + d.ph), fade = q > 0.85 ? Math.max(0.001, (1 - q) / 0.15) : 1;
      d.mesh.scale.set(fade * (2 - squash), fade * squash, fade);
      if (q >= 1) { scene.remove(d.mesh); if (piled[d.i] === d.mesh) piled[d.i] = null; dances.splice(n, 1); }
    }
  }

  // ---------- out in the hall: the yarn ball loose for ever, and Sadie chasing it ----------
  // (loose.js has how; here they're drawn in the hall, which the clubhouse lends as m.hall: docs/clubhouse/rooms/kit.md)
  const hall = m.hall, loose = hall?.shape ? makeLoose(hall.shape, Math.floor(Math.random() * 1e6) + 1) : null;
  let hallBall = null, hallCat = null, outOfHall = [], giveSadieBack = null;
  // Sadie's sounds while she plays (sounds/sadie.js: rare and soft, never two close together),
  // heard only in the hall, fading the further off she is. The ball itself stays silent.
  const chatter = makeChatter(Math.floor(Math.random() * 1e6) + 1);
  function sadieHeard(said) {
    const e = m.ears?.();
    if (!said || !e || !hall.is(e.place)) return;
    if (!sound) sound = makeSounds(sfx);   // (it wakes on your next press or key, if the browser's still holding it back)
    sound.sadie(said, { x: loose.cat.x, y: loose.cat.y + 0.3, z: loose.cat.z });
  }
  if (loose) {
    hallBall = new Mesh(ball.geometry, ball.material); hallBall.visible = false;
    hallCat = new Mesh(sadie.geometry, psx(T.sadie, { unlit: 0.4 })); hallCat.visible = false;
    outOfHall = [hall.add(hallBall, hallCat), hall.face(hallCat)];   // (how to take them out again)
  }
  // just now: bouncing out of the door onto the landing, Sadie a moment behind it; or (it got out
  // before) somewhere on the ground floor, Sadie beside it
  function outInTheHall(now) {
    if (now) m.saves.set('sadie', 'out');   // (she's out there for good, whatever happens to the machine: built again, she's still out)
    if (!loose) return;
    giveSadieBack ||= hall.borrowSadie();   // her box in the sunbeam is empty: she's busy
    const d = m.landingDoor, s = hall.shape;
    if (now && d) {
      const n = d.normal, y = d.pos.y;
      release(loose, [d.pos.x + n.x * 0.4, y + LR + 0.4, d.pos.z + n.z * 0.4], [n.x * 4.5 + n.z * 1.2, 2, n.z * 4.5 - n.x * 1.2], [d.pos.x + n.x * 0.3, y, d.pos.z + n.z * 0.3], 1.7);
    } else {
      const a = Math.random() * Math.PI * 2, r = s.post + 2.5;
      release(loose, [Math.sin(a) * r, 0.8, Math.cos(a) * r], [0, 0, 0], [Math.sin(a + 0.25) * r, 0, Math.cos(a + 0.25) * r], 0);
    }
    hallBall.visible = true;
  }

  const useEntry = { pos: new Vector3(0, FY + 1.6, CZ - Z.glass), reach: 8.5, label: play.label, play };
  const place = {
    name: 'room:' + card.id, card, scene, doors: { door }, faces: [sadie],
    uses: game.broken ? [] : [useEntry],
    holding: null,   // a door being held open (the yarn ball and Sadie on their way out)
    // (the clubhouse puts the room away when you're far off, never mid-game or while the ball's getting
    // out; the yarn ball and Sadie leave the hall with it, and come back when it's built again; her sign
    // stays on the landing's door)
    busy: () => active || (escape && escape !== 'gone') || (run && run !== 'gone') || !!doneAt || !!repairAt || !!repair || dances.length > 0 || flights.length > 0 || falling.length > 0,
    putAway() {
      if (dirty) keep_();
      stopLeaving(); sfx.close(); repairMusic = null;
      for (const out of outOfHall) out();
      giveSadieBack?.();   // (back in her box in the sunbeam till the room's built again)
    },
    watch: null,     // what your view follows (the yarn ball, while it's getting out)
    light: { sun: 0.2, bulb: 0.8, lamp: [0, RH - 1.5, 0] },
    spots: { case: { x: 0, z: CZ - 7.5, yaw: Math.PI, pitch: 0.25, y: 0 } },
    floor(x, z) {
      const P = m.walker;
      if (Math.abs(x) > RW - P || z < -RD + P || z > RD - P) return null;
      if (heapZone(x, z, P)) return null;                                                   // the case, and the heap in front and down its side
      if (Math.abs(x - SADIE.x) < 0.5 + P && Math.abs(z - SADIE.z) < 0.45 + P) return null;   // Sadie's box
      return 0;
    },
    update(t, dt = 0) {
      now = t;
      if (active) {
        if (game.serving !== wasServing) { wasServing = game.serving; if (game.serving) go = false; }   // (every new ball waits for you)
        if (wait > 0) wait -= dt;
        else if (game.serving) { if (go) launch(game); }
        else { happen(step(game, dt)); dirty = true; }
        if (overAt && t > overAt) nextGame();
        // (the arcade music gets more exciting as the glass cracks)
        music?.tick(Math.min(1, (game.cracks.top.length + game.cracks.bottom.length) / 2));
        if (dirty && t - savedAt > 3) { savedAt = t; keep_(); }
      }
      // the bricks, the ball and the paddle where the game has them
      game.bricks.forEach((k, i) => {
        const b = bricks[i];
        b.visible = k.alive && !hideBoard;
        if (popIn[i]) { const q = Math.min(1, Math.max(0, (t - popIn[i]) / 0.3)); b.scale.setScalar(Math.max(0.001, q < 1 ? q * (1.2 - 0.2 * q) : 1)); if (q >= 1) popIn[i] = 0; }
      });
      if (!game.broken) {
        const [bx, by] = at(game.ball.x, game.ball.y);
        ball.position.set(bx, by + (active && game.serving && !go && wait <= 0 ? 0.06 + 0.06 * Math.sin(t * 5) : 0), Z.play);   // (it bobs on the paddle while it waits for you)
        ball.rotation.set(-game.ball.spin * Math.sign(game.ball.vy || 1) * 0.7, 0, -game.ball.spin * Math.sign(game.ball.vx || 1) * 0.7);
        paddle.position.x = at(game.paddle, 0)[0];
        pop = Math.max(0, pop - dt * 5);
        paddle.scale.set(1 + pop * 0.08, 1 - pop * 0.18, 1);
        // (a new ball pops out of the paddle and bounces up and onto it)
        if (ballPop) {
          const q = Math.min(1, (t - ballPop) / 0.55);
          ball.scale.setScalar(Math.max(0.001, q < 0.4 ? q / 0.4 * 1.15 : 1.15 - 0.15 * (q - 0.4) / 0.6)); ball.position.y += 1.1 * 4 * q * (1 - q);
          if (q >= 1) { ballPop = 0; ball.scale.setScalar(1); }
        }
      }
      // the extra-life signs: pop up big, float up, shrink away
      for (let i = ups.length - 1; i >= 0; i--) {
        const u = ups[i], k = t - u.t0;
        const s = k < 0.25 ? k / 0.25 * 1.2 : k < 0.4 ? 1.2 - 0.2 * (k - 0.25) / 0.15 : k < 1.6 ? 1 + 0.05 * Math.sin(k * 6) : Math.max(0.001, 1 - (k - 1.6) / 0.3);
        u.mesh.scale.setScalar(s); u.mesh.position.y = u.y0 + Math.min(k, 1.6) * 0.12;
        if (k > 1.95) { cab.remove(u.mesh); ups.splice(i, 1); }
      }
      // bits of brick falling inside the glass: down the slot, out of the hatch, onto the heap
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i]; f.vy -= 9 * dt;
        f.mesh.position.x += f.vx * dt; f.mesh.position.y += f.vy * dt; f.mesh.rotation.z += f.spin * dt;
        if (f.mesh.position.y > 0.1 && !game.broken) continue;
        cab.remove(f.mesh); falling.splice(i, 1);
        const b = new Mesh(brickGeo, rowMats[f.tone]); b.position.copy(HATCH); scene.add(b);
        fly(b, slotPos(f.slot), { delay: game.broken ? Math.random() * 0.4 : 0.25, dur: 0.55, h: 0.35, land: () => { setPiled(b, f.slot); landed(b, f.slot); clunk(); } });
      }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i]; f.t += dt;
        if (f.t < 0) continue;
        const k = Math.min(1, f.t / f.dur);
        f.mesh.position.lerpVectors(f.from, f.to, k); f.mesh.position.y += 4 * f.h * k * (1 - k);
        f.mesh.rotation.x += f.spin[0] * dt; f.mesh.rotation.y += f.spin[1] * dt; f.mesh.rotation.z += f.spin[2] * dt;
        if (k >= 1) { flights.splice(i, 1); f.land?.(); }
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        if (s.rest) { if (t > s.rest) { scene.remove(s.mesh); shards.splice(i, 1); } continue; }
        s.v.y -= 9 * dt; s.mesh.position.addScaledVector(s.v, dt); s.mesh.rotation.x += s.spin * dt; s.mesh.rotation.y += s.spin * 0.7 * dt;
        if (s.mesh.position.y < 0.02) { s.mesh.position.y = 0.02; s.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * 6); s.rest = t + 1.5 + Math.random(); }
      }
      if (escape && escape !== 'gone') escapeOn(dt);
      // (broken when it was last left: it mends itself the first time you're in the room)
      if (game.broken && escape === 'gone' && run === 'gone' && !repair && !repairAt && !doneAt) { const e = m.ears?.(); if (e && e.place === place) gatherView(); }
      if (repairAt && t > repairAt && !repairHold) startRepair();
      // (let go of your view once all of it is over)
      if (place.watch === WATCH_ALL && !viewing && !repair && !repairAt && !doneAt && !dances.length && !(escape && escape !== 'gone') && !(run && run !== 'gone')) place.watch = null;
      // (after the ball's out: your view stays with Sadie while she runs for the door)
      if (place.watch !== WATCH_ALL && run && run !== 'gone' && escape === 'gone') { sadie.getWorldPosition(watchSadie); watchSadie.y += 0.6; place.watch = watchSadie; }
      // (and when you've glided back to see all of it, the mending starts)
      if (viewing && repairAt) { const e = m.ears?.(); if (e && e.place === place && Math.hypot(e.x - WATCH_ALL.at.x, e.z - WATCH_ALL.at.z) < 0.3 && t - viewSince > 0.4) repairAt = t; }
      if (repair) repairOn(t);
      if (dances.length) dancesOn(dt);
      repairMusic?.tick();
      if (run && run !== 'gone') runOn(dt);
      if (doneAt && t > doneAt) finished();
      if (loose?.ball) {
        for (const ev of stepLoose(loose, dt)) sadieHeard(chatter.heard(ev, t));
        const b = loose.ball, c = loose.cat;
        hallBall.position.set(b.x, b.y, b.z); hallBall.rotation.set(b.spin * 0.7, 0, b.spin * 0.5);
        hallCat.visible = c.mode !== 'coming'; hallCat.position.set(c.x, c.y, c.z);
        hallCat.scale.set(c.mode === 'whack' ? 1.15 : 1, c.mode === 'whack' ? 0.9 : 1, 1);   // (a crouch before the swat)
      }
      // the paddle's face: calm while nobody's playing, focused while you are (nervous once the
      // glass has cracked), happy for a moment when it hits the ball, wincing at a crack; its eyes
      // follow the ball. Once it's broken: lying in the rubble, sad, sighing now and then.
      const cracked = game.cracks.top.length + game.cracks.bottom.length;
      let name = t < mood.until ? mood.name : !active ? 'calm' : cracked ? 'nervous' : 'focus';
      if (game.broken && t >= mood.until) {
        const sigh = (t % 7) > 5.6;
        name = sigh ? 'sigh' : 'sad';
        if (!flights.some(f => f.mesh === paddle)) paddle.scale.set(1, sigh ? 1 + 0.12 * Math.sin((t % 7 - 5.6) / 1.4 * Math.PI) : 1, 1);
      }
      const look = game.broken ? 1 : game.ball.x < game.paddle - 0.3 ? 0 : game.ball.x > game.paddle + 0.3 ? 2 : 1;
      faceMat.uniforms.map.value = faces[name][look]; showing = name;
      if (shown !== marqueeKey()) drawMarquee();
      // Sadie cranes up after the ball, and blinks now and then when nobody's playing
      if (!run) {
        sadie.scale.y = 1 + 0.07 * (game.ball.y / H);
        sadie.rotation.z = Math.sin(t * 0.7) * 0.03;
        if (active) sadie.userData.set(false); else sadie.userData.blink(dt);
      } else { sadie.scale.y = 1; sadie.rotation.z = 0; sadie.userData.set(false); }
    },
  };

  if (game.broken) {   // it broke before: how it's been left
    brokenLook(); scene.attach(paddle); restPaddle(); ball.visible = false; sadie.visible = false;
    escape = 'gone'; run = 'gone';
    putSignUp(); outInTheHall(false);
    m.saves.set('sadie', 'out');
  } else {
    edges.visible = shardsOnFloor.visible = false;
    if (m.saves.get('sadie', null) === 'out') {   // it broke before and mended itself: Sadie's still out chasing the ball
      sadie.visible = false; run = 'gone'; outInTheHall(false);
      game.mended = true;   // (a save from before "mended for good" existed: it has broken once, so that's that)
    }
  }

  // for the checks (tests/brickbuster/browser.mjs)
  m.checks('__brickbuster', {
    state: () => ({ active, serving: game.serving, score: game.score, high: game.high, level: game.level, lives: game.lives, board: game.board, over: game.over,
      paddle: game.paddle, ball: { ...game.ball },
      bricks: game.bricks.filter(k => k.alive).length, pile: piled.filter(Boolean).length, broken: game.broken,
      cracks: game.cracks.top.length, bottomCracks: game.cracks.bottom.length, ups: ups.length, mendedForGood: game.mended, fixing, mended: !!repair?.home, glassBack: glass[0].visible,
      escape: escape === 'gone' ? 'gone' : escape ? 'hop ' + escape.i : null, sadie: sadie.visible, doorHeld: !!place.holding, sign: signUp,
      yarn: ball.getWorldPosition(new Vector3()).toArray(), watched: !!place.watch, canPlay: place.uses.length > 0,
      hall: loose?.ball ? { ball: [loose.ball.x, loose.ball.y, loose.ball.z], cat: [loose.cat.x, loose.cat.y, loose.cat.z], mode: loose.cat.mode,
        whacks: loose.whacks, pops: loose.pops, shown: hallBall.visible && hallCat.visible, napping: !hall.sadieBorrowed() } : null,
      music: music ? { playing: music.playing, notes: music.played() } : null, repairMusic: repairMusic ? { playing: repairMusic.playing, notes: repairMusic.played() } : null,
      sounds: sound ? sound.played : 0, lastSound: sound ? sound.last : null, heard: sound ? sound.log.slice() : [], face: showing }),
    // put the ball back on the paddle (it stays there till it's thrown)
    catchBall() { game.serving = true; game.ball.vx = game.ball.vy = 0; game.ball.x = game.paddle; game.ball.y = PADDLE.y + PADDLE.h / 2 + R; wait = 600; },   // (it stays there for ten minutes, or till it's thrown)
    // Sadie makes one of her sounds right now, wherever she is (as if the chatter had picked it)
    sadieSays(name) { if (loose?.ball) sadieHeard({ name, variant: 0 }); },
    // send the ball somewhere (x, y along the glass, and which way)
    throwBall(x, y, vx, vy) { Object.assign(game.ball, { x, y, vx, vy }); game.serving = false; wait = 0; },
    // the ball into the top of the glass right now (so it cracks, and the third breaks it)
    crackTop() { game.topReady = true; game.topHits = CRACK_HITS - 1; Object.assign(game.ball, { x: W * 0.4, y: H - 0.3, vx: 0, vy: 4 }); game.serving = false; wait = 0; },
    // knock out bricks (all but `leave` of them) without playing, for checking the heap
    knockOut(leave = 0) {
      let n = 0;
      for (const k of game.bricks) if (k.alive && bricksLeft(game) > leave) {
        k.alive = false; n++;
        let slot = game.pile.length;
        if (slot < HEAP) game.pile.push(k.tone); else { slot = game.pileNext; game.pile[slot] = k.tone; game.pileNext = (slot + 1) % HEAP; }
        pileBrick(slot, k.tone);
      }
      keep_(); return n;
    },
    // hold the mending off (for taking pictures of the machine left broken)
    holdRepair(on) { repairHold = !!on; },
    // lose a life right now
    // a hair under the next 3000 points with a life missing, and the ball about to hit a brick
    oneUp() {
      const k = game.bricks.find(b => b.alive); if (!k) return;
      game.lives = Math.min(game.lives, LIVES - 1); game.score = 3000 * (Math.floor(game.score / 3000) + 1) - 1; game.lifeMark = Math.floor(game.score / 3000);
      Object.assign(game.ball, { x: k.x + k.w / 2, y: k.y - R - 0.02, vx: 0, vy: 4 }); game.serving = false; wait = 0;
    },
    loseLife() { Object.assign(game.ball, { x: game.paddle < W / 2 ? W - 0.4 : 0.4, y: 0.3, vx: 0, vy: -4 }); game.serving = false; wait = 0; },
  });
  return place;
}

// The machine and the heap of bricks round it, where nobody walks (with `pad` to spare round it).
export function heapZone(x, z, pad = 0) {
  return (z > CZ - 1.75 - pad && Math.abs(x) < W / 2 + 0.5 + pad) || (x < -W / 2 - 0.35 + pad && x > -4.65 - pad && z > CZ - 1.75 - pad);
}

// Where the heap's bricks go on the floor, nearest the hatch first, a layer at a time: 100 spots
// along the front of the machine and down its right side (as you look at it).
export function pileSlots() {
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [], front = CZ - 1.1;
  const add = (x, z, layer) => out.push({ x: x + (r() - 0.5) * 0.08, y: 0.11 + layer * 0.21, z: z + (r() - 0.5) * 0.08, layer,
    yaw: (r() - 0.5) * 0.7, tilt: (r() - 0.5) * 0.12, roll: (r() - 0.5) * 0.14 });
  for (let L = 0; L < 3; L++) for (const z of L < 2 ? [front - 0.2, front - 0.52] : [front - 0.36]) for (let x = -3.2 + 0.2 * L; x <= 3.2 - 0.2 * L + 1e-6; x += 0.4) add(x, z, L);
  for (let L = 0; L < 3; L++) for (const x of L === 0 ? [-3.85, -4.25] : [-4.05]) for (let i = 0; i < [6, 5, 2][L]; i++) add(x, 6.25 - 0.18 * L - i * 0.36, L);
  const hx = -1.6, hz = front;
  return out.map((p, i) => ({ ...p, k: p.layer * 100 + Math.hypot(p.x - hx, p.z - hz) + i * 1e-6 })).sort((a, b) => a.k - b.k).slice(0, HEAP);
}

const signs = new WeakMap();   // (the sign, per door picture)

// The landing's side of the door, with Sadie's sign taped on it: OUT OF ORDER in wobbly marker,
// crooked, signed with a paw print.
function outOfOrder(door, words) {
  const c = document.createElement('canvas'); c.width = door.width * 2; c.height = door.height * 2;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(door, 0, 0, c.width, c.height);
  const s = document.createElement('canvas'); s.width = 64; s.height = 38;
  const k = s.getContext('2d');
  k.fillStyle = '#b87838'; k.fillRect(0, 0, 64, 38); k.fillStyle = '#e8b070'; k.fillRect(1, 1, 62, 36);
  k.fillStyle = '#d8a060'; for (let x = 2; x < 62; x += 3) k.fillRect(x, 1, 1, 36);
  let wob = 5;
  const scrawl = (text, x, y, col) => { for (const ch of text) { wob = (wob * 7 + 3) % 11; words(k, ch, x, y + (wob % 3) - 1, 2, col); x += 8; } };
  scrawl('OUT OF', 8, 4, '#1c1238');
  scrawl('ORDER', 12, 17, '#e83a3a');
  k.fillStyle = '#e0509a';
  k.fillRect(50, 31, 5, 4); for (const [x, y] of [[48, 29], [50, 27], [53, 27], [55, 29]]) k.fillRect(x, y, 2, 2);
  g.save(); g.translate(c.width / 2, 40); g.rotate(-0.13); g.drawImage(s, -32, -19);
  g.fillStyle = '#f4f4e8cc'; g.fillRect(-36, -22, 10, 5); g.fillRect(26, 16, 10, 5);   // tape
  g.restore();
  const t = new CanvasTexture(c); t.magFilter = t.minFilter = NearestFilter; t.generateMipmaps = false;
  return t;
}

// The paddle's faces, a few moods (and once it's broken: sad, and sighing), each looking left, ahead or right: little pictures 32 x 10, big
// chunky pixels so they read from across the room.
function drawFaces(m) {
  const ink = '#1c1238', out = {};
  const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const draw = (name, look) => m.tex(32, 10, g => {
    px(g, '#ffffff', 2, 0, 6, 1); px(g, '#c8fff8', 1, 1, 2, 1);   // a glossy streak on the plastic
    const d = look - 1;
    for (const ex of [11, 20]) {
      const s = ex < 16 ? 1 : -1;
      if (name === 'happy') { px(g, ink, ex - 2, 3); px(g, ink, ex - 1, 2, 2, 1); px(g, ink, ex + 1, 3); }                 // ^ ^
      else if (name === 'sad') { px(g, ink, ex - 2 * s, 3); px(g, ink, ex - s, 2); px(g, ink, ex, 1); px(g, '#ffffff', ex - 1, 4, 3, 2); px(g, ink, ex, 5, 1, 1); }   // brows up in the middle, looking down
      else if (name === 'sigh') { px(g, ink, ex - 2, 4); px(g, ink, ex - 1, 5, 2, 1); px(g, ink, ex + 1, 4); }        // shut
      else if (name === 'wince') for (const [x, y] of [[-1, 1], [0, 2], [1, 3], [0, 4], [-1, 5]]) px(g, ink, ex + x * s, y);   // > <
      else if (name === 'calm') { px(g, ink, ex - 2, 3, 4, 1); px(g, '#ffffff', ex - 2, 4, 4, 1); px(g, ink, ex - 1 + d, 4, 2, 1); }   // sleepy
      else {                                                                                                                  // wide open, looking at the ball
        px(g, '#ffffff', ex - 2, 2, 4, 4);
        if (name === 'nervous') px(g, ink, ex - 1 + d + (d < 0 ? 0 : d > 0 ? 1 : 0), 3, 1, 2);
        else { px(g, ink, ex - 1 + d, 3, 2, 3); px(g, ink, ex - 2, s > 0 ? 1 : 0, 2, 1); px(g, ink, ex, s > 0 ? 0 : 1, 2, 1); }   // and cross determined brows
      }
    }
    if (name === 'happy') { px(g, ink, 13, 7, 6, 1); px(g, '#ff5a8a', 14, 8, 4, 1); px(g, ink, 13, 8); px(g, ink, 18, 8); }
    else if (name === 'wince') for (let x = 12; x < 20; x++) px(g, ink, x, 7 + (x % 2));
    else if (name === 'nervous') { for (let x = 13; x < 19; x++) px(g, ink, x, 7 + ((x >> 1) % 2)); px(g, '#8ad8ff', 27, 1, 1, 1); px(g, '#8ad8ff', 26, 2, 3, 2); }
    else if (name === 'calm') { px(g, ink, 14, 7); px(g, ink, 15, 8, 2, 1); px(g, ink, 17, 7); }
    else if (name === 'sad') { px(g, ink, 14, 7, 4, 1); px(g, ink, 13, 8); px(g, ink, 18, 8); px(g, '#8ad8ff', 8, 6, 1, 2); px(g, '#8ad8ff', 8, 8); }   // a frown, and a tear
    else if (name === 'sigh') { px(g, ink, 15, 7, 2, 1); px(g, ink, 14, 8); px(g, ink, 17, 8); px(g, ink, 15, 9, 2, 1); }
    else px(g, ink, 14, 8, 4, 1);
    if (name !== 'wince') { px(g, '#ff8ec8', 5, 6, 2, 1); px(g, '#ff8ec8', 25, 6, 2, 1); }   // rosy cheeks
  });
  for (const name of ['calm', 'focus', 'happy', 'wince', 'nervous', 'sad', 'sigh']) out[name] = [0, 1, 2].map(l => draw(name, l));
  return out;
}

// A crack in the glass where the ball hit: jagged lines running out from the spot, more and longer
// for each crack on that side (the third is a whole web). Drawn the same every time from its seed.
export function crackLines(g, c, level, side, w, h) {
  let s = c.seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const x0 = Math.round(c.x / W * (w - 1)), y0 = side === 'top' ? 0 : h - 1, dir = side === 'top' ? 1 : -1;
  const branches = [5, 8, 13][level - 1], reach = [16, 30, 62][level - 1];
  const dot = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < w && y >= 0 && y < h) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
  const ends = [];
  function line(x, y, a, len, depth) {
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a); y += Math.sin(a) * dir;
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      dot(x, y, '#ffffff'); if (r() < 0.5) dot(x + 1, y, '#9ad8ff');
      if (depth < 2 && r() < 0.06) line(x, y, a + (r() < 0.5 ? -0.8 : 0.8), len * 0.45, depth + 1);
    }
    ends.push([x, y]);
  }
  for (let b = 0; b < branches; b++) {
    const a = 0.15 + (b + r() * 0.8) / branches * (Math.PI - 0.3);
    line(x0, y0, a, reach * (0.55 + r() * 0.6), 0);
  }
  // rings joining the lines, like a real star crack
  if (level >= 2) for (const k of level === 3 ? [0.3, 0.55, 0.8] : [0.45]) {
    for (let a = 0.1; a < Math.PI - 0.1; a += 0.04) if (r() < 0.8) dot(x0 + Math.cos(a) * reach * k, y0 + Math.sin(a) * reach * k * dir, '#d8f4ff');
  }
  // the spot it hit: a white star
  for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, dir], [0, 2 * dir]]) dot(x0 + x, y0 + y, '#ffffff');
}
