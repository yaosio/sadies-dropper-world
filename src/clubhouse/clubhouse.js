// Sadie's clubhouse: the clubhouse you walk around. You start at the front gate (the first time, Sadie's
// letter invites you in), walk through the front door into the entrance hall (the bottom of the cat
// tree), up the stairs to the landings where the activities have their doors, and into a room; or
// out across the town square, or round the house, to a building of its own.
//
// Every place (outside, the hall, each activity's room) is its own separate scene, joined only by
// doorways. There are no loading screens: an open doorway shows the place on its other side (drawn
// from where you'd be standing if you'd already walked through), and walking through it just moves
// you there. Only the place you're in, and through the open doorways in front of you (the nearest
// three: two doors on the landing can be open at once), get drawn.
//
// Controls are a normal game's: WASD or the arrows and the mouse (click to look around), a thumb
// stick and dragging on a phone. E (or the button on a phone) uses what you're looking at. Esc or the
// pause button pauses; the pause menu can also start things over, and save or load a backup.
//
// Starting an activity takes the whole clubhouse out of the page before the activity goes in. When
// you come back (the page reloads), you're standing at that activity's computer.
//
// Some games live in their room instead of on a computer (Brickbuster '96): their card has a `room`
// that builds the whole room from the kit handed to it here, and something in it you can play. A use
// with `act` just does something there and then (turning a sign). Every other kind of control is a
// way of playing in a file of its own (src/clubhouse/play/: stepping up to a game, painting), which
// any place can use; this file only passes it the keys, presses and frames (see "ways of playing").
import {
  WebGLRenderer, PerspectiveCamera, WebGLRenderTarget, NearestFilter, Matrix4, Vector3, Vector4, Plane, LinearSRGBColorSpace, Box3, Mesh, BoxGeometry,
} from 'three';
import { res, light, drawTextures, disposeLook, made, handedBack, loadImage, psx, keep, tex, words, C, picture, doorBack, skyMat, sadieSprite } from './look.js';
import { timers } from './timers.js';
import { buildOutside } from './outside.js';
import { makeThings } from './things.js';
import { makeMeter } from './meter.js';
import { buildHall } from './hall.js';
import { buildRoom } from './room.js';
import { kit, wallGeometry, doorway, WALKER } from './build.js';
import { strict, realPlace, hallView, outsideView, doorView } from './neighbours.js';
import { oops, unoops, NO_3D, STUCK } from '../shared/oops.js';
import { store, tabNote, saveBox, saveRoom, backup, inspectBackup, loadBackup, forget, reloading } from '../shared/storage.js';
import { showCredits } from './credits.js';
import { makeTheme } from './music/theme.js';
import { makeWeather } from './weather/sky.js';
import { arcade } from './play/arcade.js';
import { painting } from './play/paint.js';
import { controls } from './controls.js';
import { setVolume, youAreIn, closeSounds, paused as soundsPaused, soundState, LEVELS, BUSES } from '../shared/sound.js';
import P from './pictures.js';
import page from './clubhouse.html';
import styles from './clubhouse.css';

const EYE = 1.6, SPEED = 3.2, TURN = 2.2, STICK = 40;   // STICK: how far the thumb stick's knob goes, in screen pixels
// things that happen once, remembered in the browser (the pause menu can undo each)
const INVITED = 'mansion.invited';
const BACK = 'mansion.back';          // which activity you left for (kept only until the page comes back)
const VOLUME = b => 'mansion.' + b;   // the pause menu's MUSIC, SOUNDS and VOICES buttons: 'on', 'soft' or 'off'

export async function open(cards, enter) {
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('afterbegin', page);
  const root = document.getElementById('clubhouse');
  const $ = s => root.querySelector(s);
  const off = new AbortController(), on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal: off.signal, ...o });
  const touchy = matchMedia('(pointer: coarse)').matches;
  // the main theme (music/): it fades out while any other music plays, and where a place asks (`hush`)
  const loud = {};
  for (const b of BUSES) { loud[b] = LEVELS[store.get(VOLUME(b), 'on')] !== undefined ? store.get(VOLUME(b), 'on') : 'on'; setVolume(b, LEVELS[loud[b]]); }
  const theme = makeTheme();

  // ---------- the places, and the doorways between them ----------
  // Only the garden and the hall (and the buildings outside you can see from the gate, below) are
  // built before the clubhouse opens; the rest of the buildings outside straight after. Each room is built later, one at a time: while you stand
  // still, or as you walk up to its door (which stays shut until it's ready). A room that's far away
  // (three doors or more, for a while) is put away again, if it can be: its things go back to the
  // graphics card, and it's built again from its save as you come near. So the house can have any
  // number of rooms without a longer wait to open, or more memory held for rooms you're nowhere near.
  const opened = performance.now();
  const load = src => src ? loadImage(src) : null;
  // (the lettering, and the pictures, at the same time)
  const font = Promise.race([document.fonts.load('8px Silkscreen'), new Promise(ok => setTimeout(ok, 1500))]).catch(() => {});
  const [, awake, asleep, boxes, doorPics] = await Promise.all([font, load(P.sadie), load(P.sadieBlink),
    Promise.all(cards.map(c => load(c.box?.front))), Promise.all(cards.map(c => load(c.door)))]);
  const T = drawTextures(awake, asleep);
  const shared = new Set(made());   // (the textures every place uses: never put away with a room)
  const t0 = performance.now();
  const outside = buildOutside(T, cards), hall = buildHall(T, cards, doorPics);
  // the weather, over every place out of doors (weather/): whoever makes it just says which (the kit's `weather`)
  const weather = makeWeather(T, outside);
  for (const x of made()) shared.add(x);   // (its things go with no room)
  // what a room is lent of the hall, and a building of the outside (neighbours.js: only what the docs list)
  const lent = { hall: hallView(hall, outside), outside: outsideView(outside) };
  const took = Math.round(performance.now() - t0);
  const speed = { places: { 'outside and hall': took }, bits: { 'outside and hall': took }, first: 0 };
  // a room per card: `place` once it's built
  // (its doors: one on the landing, or a building's outside, which it hands over when it's first built;
  // `key`: which of the room's own doors each one leads to)
  const slots = cards.map((c, i) => ({ card: c, i, name: 'room:' + c.id, place: null, building: null, far: 0, portals: [] }));
  const portals = [{ a: outside.doors.front, wa: outside, b: hall.doors.front, wb: hall, open: 0 }];
  for (const r of slots) if (hall.doors[r.card.id]) { const p = { a: hall.doors[r.card.id], wa: hall, b: null, wb: null, open: 0, slot: r, key: 'door' }; portals.push(p); r.portals.push(p); }
  // a building of its own outside: on a plot round the town square (`lot`) or in the grounds round the house (`grounds`)
  const outdoors = c => !!c.room && (Number.isInteger(c.lot) || Number.isInteger(c.grounds));
  // each doorway seen from its own side (only those whose rooms are built): where it is, and where it leads
  let sides = [], places = [];
  function relink() {
    const up = portals.filter(p => p.b);
    sides = up.flatMap(p => [{ d: p.a, w: p.wa, to: p.b, tw: p.wb, p }, { d: p.b, w: p.wb, to: p.a, tw: p.wa, p }]);
    places = [outside, hall, ...slots.filter(r => r.place).map(r => r.place)];
  }
  // Building a room: one at a time (so each one's things are known, to put away later), from the
  // clubhouse's building kit if it's a game that lives in its room. A room's code is a file of its own,
  // fetched the first time it's built: if that fails (the network hiccuped) or the room won't build,
  // its door stays shut and it's tried again a little later, a few times (`again`), and nothing else waits on it.
  let queue = Promise.resolve();
  const again = r => !r.tries || (r.tries < TRIES && performance.now() - r.failed > 3000 * r.tries);
  function build(r) {
    if (r.place) return Promise.resolve(r.place);
    return r.building ||= (queue = queue.then(async () => {
      const c = r.card, i = r.i, code = c.room && await c.room(), before = r.before = new Set(made());   // (its file first: fetching isn't building)
      // A room can take a breath between its big parts (`await m.breathe()`): if it's been busy for
      // more than a few milliseconds, the next picture is drawn before it carries on, so building a
      // big room never holds the game up for long. (How long it was busy in all, and the longest bit.)
      let at = performance.now(), busy = 0, bit = 0;
      const breathe = async () => {
        const now = performance.now(), d = now - at;
        if (d < BITE) return;
        busy += d; bit = Math.max(bit, d);
        await new Promise(ok => { requestAnimationFrame(() => ok()); setTimeout(ok, 50); });   // (a hidden page draws nothing)
        at = performance.now();
      };
      let w;
      const clock = timers(() => mode === 'menu');
      if (!c.room) w = buildRoom(T, c, boxes[i], doorPics[i]);
      else {
        const leaf = doorPics[i] ? { front: doorBack(doorPics[i]), back: picture(doorPics[i]) } : T.leafL;
        // (asking it for anything else is an error: neighbours.js)
        w = await code.buildRoom(strict('the kit', { T, C, psx, keep, tex, words, picture, loadImage, kit, wallGeometry, doorway, walker: WALKER, card: c, leaf, breathe,
          sadie: (width, o) => sadieSprite(T, width, o), after: clock.after,
          doorImage: doorPics[i], landingDoor: doorView(hall.doors[c.id]), hall: lent.hall, outside: outdoors(c) ? lent.outside : null,
          lot: Number.isInteger(c.lot) ? outside.lots[c.lot] : null, ground: Number.isInteger(c.grounds) ? outside.grounds[c.grounds] : null,
          skyMat, snapshot, house: r.house ?? null, ears, paused: () => mode === 'menu', saves: saveBox(c.id), weather: weather.kit,
          overlay: css => overlay(r, css), testing, checks: (name, hook) => hook && checking(r, name, hook) }));
      }
      const update = w.update || (() => {}); w.update = (t, dt) => { clock.step(dt); update(t, dt); };   // (its timers run on the game's time: timers.js)
      const last = performance.now() - at;
      speed.places[r.name] = Math.round(busy + last); speed.bits[r.name] = Math.round(Math.max(bit, last));
      r.mine = made().filter(x => !before.has(x));   // everything it made (to hand back if it's put away)
      // a building of its own outside (its card has a `lot` or `grounds`): its front door leads
      // straight in (and any other door it has, `doors`, to the room's door of that name)
      if (w.house && !r.portals.length) for (const [key, d] of Object.entries(w.house.doors || { door: w.house.door })) {
        outside.doors[key === 'door' ? c.id : c.id + '.' + key] = d;
        const p = { a: d, wa: outside, open: 0, slot: r, key }; portals.push(p); r.portals.push(p);
      }
      r.house = w.house;   // (kept when the room's put away: it's part of the outside)
      for (const p of r.portals) {
        p.b = w.doors[p.key]; p.wb = w; p.open = 0;
        p.b.swing = -1;   // every door swings into the place further in
      }
      r.place = w; r.building = null; r.far = 0;
      relink();
      warm(w);
      return w;
    }).catch(e => {
      console.warn(`couldn't build ${r.name}:`, e);
      cleanUp(r);   // (what it started before it failed goes, so a retry doesn't pile a copy on top)
      r.building = null; r.tries = (r.tries || 0) + 1; r.failed = performance.now();
      return null;
    }));
  }
  // Putting a room away (any room but the one you're in, or one that says it's `busy()` or is holding
  // its door open): its own `putAway()`, if it has one, takes back what it put in other places. What it made goes back to the graphics card, unless another place uses it.
  function putAway(r) {
    const w = r.place;
    if (!w || w === me.world || r.building || w.holding || w.busy?.()) return false;
    try { w.putAway?.(); } catch (e) { console.warn(`${r.name}'s putAway failed:`, e); }   // (its mistake mustn't stop the rest being taken back)
    closeSounds(r.name); dropExtras(r);   // (everything it started stops, whatever it forgot; its boxes on the page and test hooks go)
    for (const p of r.portals) { p.b = p.wb = null; p.open = 0; p.a.setOpen(0); if (lastThrough === p) lastThrough = null; }
    const mine = new Set(r.mine);
    for (const sc of w.scenes || [w.scene]) things(sc, mine);
    r.place = null; relink();
    const inUse = new Set(shared);
    for (const p of places) for (const sc of p.scenes || [p.scene]) things(sc, inUse);
    const gone = [...mine].filter(x => !inUse.has(x));
    for (const x of gone) x.dispose();
    handedBack(gone); r.mine = null;
    return true;
  }
  // A room's test hook (`checks(name, hook)` in its kit, for the browser checks): put on the page while
  // the room's built, gone when it's put away, so a put-away room's whole state isn't kept alive by it.
  function checking(r, name, hook) {
    globalThis[name] = hook;
    (r.undo ||= []).push(() => { if (globalThis[name] === hook) delete globalThis[name]; });
    return hook;
  }
  function dropExtras(r) {
    for (const o of r.overlays || []) o.remove();
    for (const u of r.undo || []) u();
    r.overlays = r.undo = null;
  }
  // A room that failed to build: what it started goes, and what it made that nothing else uses goes back
  // to the graphics card (the same as being put away, without a place to take things from).
  function cleanUp(r) {
    closeSounds(r.name); dropExtras(r);
    if (!r.before) return;
    const inUse = new Set(shared);
    for (const p of places) for (const sc of p.scenes || [p.scene]) things(sc, inUse);
    const gone = made().filter(x => !r.before.has(x) && !inUse.has(x));
    for (const x of gone) x.dispose();
    handedBack(gone); r.before = null;
  }
  // A room's own box on the page (`overlay(css)`): a layer just over the 3D view, under the pause menu
  // and the buttons, with its styles; it's gone from the page when the room's put away.
  function overlay(r, css) {
    const layer = document.createElement('div'); layer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    const style = document.createElement('style'); style.textContent = css || '';
    document.head.appendChild(style); canvas.after(layer);
    (r.overlays ||= []).push(layer, style);
    return layer;
  }
  // the test version (its label's on the page): a room can show things only for checking (the aquarium's sound tester)
  const testing = !!document.getElementById('testBadge');
  // every shape, material and picture in a scene
  function things(scene, into) {
    scene.traverse(o => {
      if (o.geometry) into.add(o.geometry);
      for (const m of [].concat(o.material || [])) {
        into.add(m);
        for (const u of Object.values(m.uniforms || {})) if (u.value?.isTexture) into.add(u.value);
        for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k]?.isTexture) into.add(m[k]);
      }
    });
    if (scene.background?.isTexture) into.add(scene.background);
  }
  // how many doors away each place is from where you are (a room not built yet: one past its door)
  function doorsAway() {
    const d = new Map([[me.world, 0]]), todo = [me.world];
    while (todo.length) {
      const w = todo.shift();
      for (const p of portals) for (const [x, y] of [[p.wa, p.wb], [p.wb, p.wa]]) if (x === w && y && !d.has(y)) { d.set(y, d.get(w) + 1); todo.push(y); }
    }
    return r => (r.place ? d.get(r.place) : Math.min(98, ...r.portals.map(p => d.get(p.wa) ?? 98)) + 1) ?? 99;
  }
  // every frame: build the nearest room not built yet (while you're still, or as you come up to its
  // door), and put away rooms three doors off for a while (there's no cap on how many stay built)
  const FAR_DOORS = 3, FAR_SECS = 20, NEAR_DOOR = 7, BITE = 6, TRIES = 6;
  let stillFor = 0, onlyDoors = false;   // (onlyDoors: the checks: a room's built only as you walk up to its door, and never put away by itself)
  function tend(dt, doorFor) {
    const away = doorsAway();
    let next = null, best = 1e9;
    for (const r of slots) if (!r.place && !r.building && r.portals.length && again(r)) {
      const n = away(r); if (n > 2) continue;
      const dd = Math.min(99, ...r.portals.filter(p => p.wa === me.world).map(p => Math.hypot(me.x - p.a.pos.x, me.z - p.a.pos.z)));
      const score = n * 100 + dd;
      if (doorFor === r || (!onlyDoors && (dd < NEAR_DOOR || stillFor > 0.25))) if (score < best) { best = score; next = r; }
    }
    // (a building outside the gate that didn't build at the start has no door yet: tried again too)
    next ||= slots.find(r => !r.place && !r.building && !r.portals.length && outdoors(r.card) && again(r));
    if (next && !slots.some(r => r.building)) build(next);
    const built = slots.filter(r => r.place);
    for (const r of built) r.far = away(r) >= FAR_DOORS ? r.far + dt : 0;
    if (!onlyDoors) for (const r of built) if (r.far > FAR_SECS) putAway(r);
  }
  // A building outside the gate that's far off (FAR_HOUSE metres from where you are, or from the door
  // you're looking out of) is drawn as a plain block its size instead (made the first time it's
  // needed): with a big town of houses, only the near ones are drawn in full.
  let FAR_HOUSE = 90;
  // Where outside is seen from: you, out there, or the open door you're looking out of (null: it
  // can't be seen). Worked out once a frame, before the places update (`ears().outside`).
  let seenFrom = null;
  function outsideSeenFrom() {
    let from = me.world === outside ? me : null;
    if (!from) for (const s of sides) if (s.w === me.world && s.tw === outside && s.p.open > 0.02) from = s.to.pos;
    return from;
  }
  // Where the sky is seen from, for the weather: each place out of doors (one with a `sky`) you can
  // see, nearest first: the one you're in, and each one through an open doorway in front of you
  // ([{ place, x, z }]: where you are, or that doorway on its far side)
  function skySeen() {
    const seen = me.world.sky ? [{ place: me.world, x: me.x, z: me.z, d: 0 }] : [];
    for (const s of sides) if (s.w === me.world && s.tw.sky && s.p.open > 0.02 && !seen.some(q => q.place === s.tw))
      seen.push({ place: s.tw, x: s.to.pos.x, z: s.to.pos.z, d: Math.hypot(me.x - s.d.pos.x, me.z - s.d.pos.z) });
    return seen.sort((a, b) => a.d - b.d);
  }
  function farHouses() {
    const from = seenFrom;
    for (const r of slots) {
      const g = r.house?.group; if (!g) continue;
      const far = !!from && Math.hypot(from.x - r.house.door.pos.x, from.z - r.house.door.pos.z) > FAR_HOUSE;
      if (far && !r.standIn) {
        // (the size of the building itself, as the house says: `body`)
        const b = new Box3(); g.updateMatrixWorld(true);
        for (const o of r.house.body || [g]) b.expandByObject(o, true);
        const size = b.getSize(new Vector3()), mid = b.getCenter(new Vector3());
        r.standIn = new Mesh(keep(new BoxGeometry(size.x, size.y, size.z)), psx(null, { tint: r.house.farTint ?? 0xb89a78, unlit: 0.35 }));
        r.standIn.position.copy(mid); outside.scene.add(r.standIn);
      }
      g.visible = !far; if (r.standIn) r.standIn.visible = far;
    }
  }
  // A picture of something in a place, taken once (not every frame): `obj` on its own (nothing else in
  // its place shows; the rest is see-through), from `from` looking at `at`, `fov` degrees tall, w x h
  // pixels, lit as `place` is. A place that can't see the real thing shows the picture instead, so
  // it's never out of date: the hedge maze's view of the clubhouse over its hedges.
  function snapshot(obj, place, { from, at, fov = 40, w = 256, h = 256 }) {
    place = realPlace(place);   // (a room has the outside lent to it: neighbours.js)
    const target = keep(new WebGLRenderTarget(w, h, { minFilter: NearestFilter, magFilter: NearestFilter }));
    const c = new PerspectiveCamera(fov, w / h, 0.5, 400); c.position.set(...from); c.lookAt(...at); c.updateMatrixWorld();
    const was = res.clone(), alpha = renderer.getClearAlpha(), hid = [];
    obj.parent?.updateMatrixWorld(true);
    // (only it: everything else in its place hidden for a moment)
    for (const o of obj.parent?.children || []) if (o !== obj && o.visible) { o.visible = false; hid.push(o); }
    const bg = place.scene.background; place.scene.background = null;
    res.set(w, h); light(place.light); renderer.setClearAlpha(0);
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(place.scene, c); renderer.setRenderTarget(null);
    renderer.setClearAlpha(alpha); res.copy(was); place.scene.background = bg;
    for (const o of hid) o.visible = true;
    return target.texture;
  }
  // (what a room just built needs on the graphics card goes there now, not the first time you see it)
  function warm(w) {
    try {
      for (const sc of w.scenes || [w.scene]) sc.traverse(o => { for (const m of [].concat(o.material || [])) for (const u of Object.values(m.uniforms || {})) if (u.value?.isTexture && u.value.image) renderer.initTexture(u.value); });
    } catch {}
  }

  const canvas = $('#view');
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: false }); } catch (e) { oops(NO_3D); throw e; }   // (no 3D here: say so, don't sit blank)
  // the graphics card letting go of the picture (a phone short of memory): say so, and take it back down if it returns
  on(canvas, 'webglcontextlost', e => { e.preventDefault(); oops(STUCK); });
  on(canvas, 'webglcontextrestored', unoops);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  // a picture per open doorway in view (the nearest few): each doorway shows its own
  const throughs = [0, 1, 2].map(() => new WebGLRenderTarget(320, 240, { minFilter: NearestFilter, magFilter: NearestFilter }));
  for (const t of throughs) shared.add(t.texture);   // (never handed back with a room)
  const cam = new PerspectiveCamera(70, 1, 0.1, 300);   // not too near: phones' depth is coarse
  cam.rotation.order = 'YXZ';   // turn round the upright first, then look up or down: the view never tips over
  const vcam = new PerspectiveCamera(); vcam.matrixAutoUpdate = false; vcam.matrixWorldAutoUpdate = false;

  let drawnAt = '';
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    // big chunky pixels, but never more than 960 across the long side: a phone held upright and a wide
    // desktop screen get about the same detail, so the little painted words stay readable on both
    const k = Math.max(1, Math.ceil(Math.max(w, h) / 960));
    const iw = Math.ceil(w / k), ih = Math.ceil(h / k);
    if (drawnAt === iw + 'x' + ih) return;                      // resizing wipes the picture: only when it really changed
    drawnAt = iw + 'x' + ih;
    renderer.setSize(iw, ih, false); for (const t of throughs) t.setSize(iw, ih); res.set(iw, ih);
    cam.aspect = iw / ih;
    // a wide view on a wide screen; on a tall phone, not so tall that the walls lean when you look up or down
    cam.fov = Math.min(68, Math.max(55, 2 * Math.atan(Math.tan(80 * Math.PI / 360) / cam.aspect) * 180 / Math.PI));
    cam.updateProjectionMatrix();
    draw();
  }

  // you (declared before any room's built: its kit's `ears()` and `paused()` read them), and where
  // your ears are: your eye, where you're looking, and where outside is seen from (`outside`)
  const me = { world: outside, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, eye: 0, bob: 0 };
  let mode = 'play';           // 'letter', 'play', 'menu', 'going' (into an activity), 'arcade' (playing a game in its room) or 'gliding' (easing your view somewhere)
  function ears() { return { place: me.world, x: me.x, y: me.eye + EYE, z: me.z, yaw: me.yaw, pitch: me.pitch, outside: seenFrom }; }

  // you start at the gate, or (coming back from an activity) at its computer: that room's built first
  let back = null;
  back = tabNote.take(BACK);
  const backSlot = slots.find(r => r.card.id === back);
  // (and the buildings outside you can see from the gate as you start. The ones behind you are built
  // straight after the first picture, before you've had time to turn round)
  const start = outside.spots.start, ahead = r => {
    const at = Number.isInteger(r.card.lot) ? outside.lots[r.card.lot] : outside.grounds[r.card.grounds];
    return !backSlot && (at.x - start.x) * -Math.sin(start.yaw) + (at.z - start.z) * -Math.cos(start.yaw) > 0;
  };
  for (const r of slots) if (outdoors(r.card) && ahead(r)) await build(r);
  if (backSlot) await build(backSlot);
  const backRoom = backSlot?.place;
  relink();

  // ---------- things in the world (things.js): built as you come near, put away as you go ----------
  // The outside lists its things (a place, a size, how to build one and take it down again); this
  // looks after the rest: what a thing made goes back to the graphics card when it is put away, and
  // a thing that is far but in view is drawn as a plain block its size.
  const keeper = makeThings();
  function release(mine) {
    const inUse = new Set(shared);
    for (const p of places) for (const sc of p.scenes || [p.scene]) things(sc, inUse);
    const gone = mine.filter(x => !inUse.has(x));
    for (const x of gone) x.dispose();
    handedBack(gone);
  }
  for (const d of outside.things) {
    let handle = null, mine = null, block = null;
    keeper.add({ id: d.id, x: d.x, z: d.z, r: d.r, near: d.near, watched: d.watched, busy: () => !!handle?.busy?.(),
      show(state) {
        if (state === 'near') {
          if (!handle) {
            const before = new Set(made()), at = performance.now();
            try { handle = d.build(); } catch (e) { release(made().filter(x => !before.has(x))); throw e; }
            mine = made().filter(x => !before.has(x));
            speed.places['thing:' + d.id] = speed.bits['thing:' + d.id] = Math.round(performance.now() - at);
          }
          if (block) block.visible = false;
          return;
        }
        if (handle) { handle.putAway(); handle = null; release(mine); mine = null; }
        if (state === 'far') {
          if (!block) {
            block = new Mesh(keep(new BoxGeometry(d.body.w, d.body.h, d.body.d)), psx(null, { tint: d.tint ?? 0xb89a78, unlit: 0.35 }));
            block.position.set(d.x, d.body.h / 2, d.z); outside.scene.add(block);
          }
          block.visible = true;
        } else if (block) block.visible = false;
      } });
  }
  // (everything near the gate is built before the first picture, so nothing pops in as you start)
  keeper.step(0, outside.spots.start);
  while (keeper.busy()) await new Promise(ok => setTimeout(ok, 0));

  // ---------- you ----------
  function place(world, spot) {
    me.world = world; me.x = spot.x; me.z = spot.z; me.yaw = spot.yaw; me.pitch = spot.pitch || 0;
    me.y = me.eye = spot.y ?? world.floor(spot.x, spot.z, 0) ?? 0;
  }
  if (backRoom) place(backRoom, backRoom.spots.computer); else place(outside, outside.spots.start);

  // where you can stand: the place's own floor, or the threshold of an open doorway in it
  function floorAt(w, x, z, y) {
    for (const s of sides) if (s.w === w && s.p.open > 0.3 && Math.abs(y - s.d.pos.y) < 0.6) {
      const [lx, lz] = s.d.local(x, z);
      if (Math.abs(lx) < s.d.w / 2 - 0.3 && lz > -0.6 && lz < 0.8) return s.d.pos.y;
    }
    return w.floor(x, z, y);
  }
  // Walking: straight there if you can, else sliding along whatever's in the way. Crossing an open
  // doorway takes you to the same spot on its other side, turned round, in the other place.
  function move(dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (!mx && !mz) continue;
      const nx = me.x + mx, nz = me.z + mz;
      for (const s of sides) if (s.w === me.world && s.p.open > 0.6 && Math.abs(me.y - s.d.pos.y) < 0.6) {
        const [, z0] = s.d.local(me.x, me.z), [lx, lz] = s.d.local(nx, nz);
        if (z0 >= 0 && lz < 0 && Math.abs(lx) < s.d.w / 2) { cross(s, lx, lz); return true; }
      }
      const h = floorAt(me.world, nx, nz, me.y);
      if (h !== null) { me.x = nx; me.z = nz; me.y = h; return true; }
    }
    return false;
  }
  let lastThrough = null;   // the doorway you walked through last
  function cross(s, lx, lz) {
    lastThrough = s.p;
    const t = s.to, c = Math.cos(t.yaw), sn = Math.sin(t.yaw), bx = -lx, bz = -lz;
    me.x = t.pos.x + bx * c + bz * sn; me.z = t.pos.z - bx * sn + bz * c;
    const rise = t.pos.y - s.d.pos.y;
    me.y += rise; me.eye += rise;
    me.yaw += t.yaw + Math.PI - s.d.yaw;
    me.world = s.tw;
  }

  // ---------- the camera through a doorway ----------
  // The place beyond is drawn from where you'd be if you'd already walked through, with everything
  // on the near side of its doorway cut away (the near plane tilted to lie in the doorway).
  const Fa = new Matrix4(), Fb = new Matrix4(), M = new Matrix4(), FLIP = new Matrix4().makeRotationY(Math.PI);
  const cut = new Plane(), clip = new Vector4(), q = new Vector4(), tmp = new Vector3();
  function lookThrough(s) {
    Fa.makeRotationY(s.d.yaw).setPosition(s.d.pos); Fb.makeRotationY(s.to.yaw).setPosition(s.to.pos);
    M.multiplyMatrices(Fb, FLIP).multiply(Fa.invert());
    vcam.matrixWorld.multiplyMatrices(M, cam.matrixWorld);
    vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    vcam.projectionMatrix.copy(cam.projectionMatrix);
    vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    // Right at the doorway the tilted near plane would pass through your eye, and the maths falls
    // apart (a frame of black as you step through). So within 40 cm, don't tilt it: the far side's
    // own door bits are hidden anyway, and nothing else of that place is that close behind its wall.
    if (tmp.copy(cam.position).sub(s.d.pos).dot(s.d.normal) < 0.4) return;
    cut.setFromNormalAndCoplanarPoint(s.to.normal, tmp.copy(s.to.pos).addScaledVector(s.to.normal, -0.01));
    cut.applyMatrix4(vcam.matrixWorldInverse);
    clip.set(cut.normal.x, cut.normal.y, cut.normal.z, cut.constant);
    const e = vcam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
    vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
  }

  // the doorway you're walking up to: in this place, close, in front of you and roughly ahead
  function doorAhead() {
    let best = null, near = 1e9;
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    for (const s of sides) if (s.w === me.world && Math.abs(me.y - s.d.pos.y) < 1.5) {
      const [lx, lz] = s.d.local(me.x, me.z);
      if (lz < -0.6 || lz > 3.4 || Math.abs(lx) > 2.4) continue;
      // not facing it (and not in it, and not just through it: then it waits till you're out of its swing)
      if (lz > (s.p === lastThrough ? 2.4 : 0.8) && -(fx * s.d.normal.x + fz * s.d.normal.z) < 0.25) continue;
      const d = Math.hypot(lx, lz); if (d < near) { near = d; best = s; }
    }
    return best;
  }

  // the room behind a door you're walking up to that isn't built yet (same test as doorAhead's)
  function unbuiltAhead() {
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    for (const r of slots) for (const p of r.portals) if (!r.place && p.wa === me.world) {
      const d = p.a;
      if (Math.abs(me.y - d.pos.y) > 1.5) continue;
      const [lx, lz] = d.local(me.x, me.z);
      if (lz < -0.6 || lz > 3.4 || Math.abs(lx) > 2.4) continue;
      if (lz > 0.8 && -(fx * d.normal.x + fz * d.normal.z) < 0.25) continue;
      return r;
    }
    return null;
  }

  let viewing = null;   // the nearest doorway being looked through this frame
  function draw() {
    // how far you can see: a place can say (the open sea, from the aquarium)
    const far = me.world.far || 300;
    if (cam.far !== far) { cam.far = far; cam.updateProjectionMatrix(); }
    cam.position.set(me.x, me.eye + EYE + Math.sin(me.bob) * 0.03, me.z);
    // exactly on a doorway's line (to a tenth of a millimetre) the drawing maths has nothing to work
    // with, so draw from that far off it: far too little to see
    for (const s of sides) if (s.w === me.world) {
      const [lx, lz] = s.d.local(cam.position.x, cam.position.z);
      if (Math.abs(lx) < s.d.w / 2 + 0.5 && Math.abs(lz) < 1e-4) cam.position.addScaledVector(s.d.normal, (lz < 0 ? -1e-4 : 1e-4) - lz);
    }
    cam.rotation.set(me.pitch, me.yaw, 0);
    cam.updateMatrixWorld();
    for (const f of me.world.faces) {
      // (something in a turned house, which sets its `turn`: the camera's side of it, less the house's turn)
      const turn = f.parent?.userData.turn;
      if (turn === undefined) f.rotation.y = Math.atan2(cam.position.x - f.position.x, cam.position.z - f.position.z);
      else { const e = f.matrixWorld.elements; f.rotation.y = Math.atan2(cam.position.x - e[12], cam.position.z - e[14]) - turn; }
    }
    // each open doorway you're in front of (the nearest few) shows its other side, in its own picture
    const open = [];
    for (const s of sides) if (s.w === me.world && s.p.open > 0.02) {
      tmp.copy(cam.position).sub(s.d.pos);
      if (tmp.dot(s.d.normal) < -0.05) continue;
      const d = tmp.length(); if (d < 25) open.push([d, s]);
    }
    open.sort((a, b) => a[0] - b[0]);
    viewing = open.length ? open[0][1] : null;
    open.slice(0, throughs.length).forEach(([, s], i) => {
      lookThrough(s);
      light(s.tw.light);
      s.to.group.visible = false;   // the far side's frame, leaves and doorway box: never seen from behind
      renderer.setRenderTarget(throughs[i]); renderer.render(s.tw.scene, vcam); renderer.setRenderTarget(null);
      s.to.group.visible = true;
      s.d.see.material.uniforms.pic.value = throughs[i].texture;
      s.d.see.material.uniforms.uOn.value = 1;
    });
    light(me.world.light);
    renderer.render(me.world.scene, cam);
  }

  // ---------- controls (controls.js) ----------
  // (what it needs of the rest of this file, filled in as they come: it only uses them once you press something)
  let moved = false;
  const pieces = { mode: () => mode, ways: () => ways, game: () => game, paint: () => paint,
    resume: () => resume(), pause: () => pause(), closeLetter: () => closeLetter(), use: u => use(u), target: () => target };
  const { held, stick, drag, KEYS, pointAt, middle, locked } = controls({ $, on, canvas, cam, me, touchy, STICK }, pieces);
  // ---------- ways of playing (src/clubhouse/play/) ----------
  // Each kind of control a place can ask for is a file of its own there, which any place, inside or
  // out, can use: stepping up to a game in its room (a use with `play`), painting (a place with a
  // `brush`). This is all they're lent: they never touch the rest of the clubhouse. A new kind of control
  // goes there too, not in this file (tests/clubhouse/run.mjs checks the clubhouse names no room).
  const you = {
    $, canvas, cam, touchy, on, me, held, drag, EYE, KEYS, pointAt, middle,
    get mode() { return mode; }, set mode(m) { mode = m; },
    locked, glideTo: (...a) => glideTo(...a), showTarget: () => showTarget(),
  };
  const game = arcade(you), paint = painting(you), ways = [game, paint];

  // ---------- using things: the computer in an activity's room ----------
  let target = null;
  const fwd = new Vector3();
  function findTarget() {
    cam.getWorldDirection(fwd);
    let best = null, most = 0.7;   // (the one most nearly straight ahead, when a few are in reach)
    for (const u of me.world.uses) {
      tmp.copy(u.pos).sub(cam.position); const d = tmp.length();
      const dot = tmp.normalize().dot(fwd);
      if (d < u.reach && dot > most) { best = u; most = dot; }
    }
    return best;
  }
  function showTarget() {
    const hint = $('#useHint'), btn = $('#use'), inGame = mode === 'arcade';
    // (on a phone too, beside the button, so you know what it'll do: what you'd pick up, say)
    hint.hidden = !target || mode !== 'play'; hint.classList.toggle('touch', touchy);
    btn.hidden = !((target && mode === 'play') || inGame) || !touchy;
    $('#arcadeHint').hidden = !inGame;
    $('#stick').hidden = !touchy || inGame || !!me.world.watch;   // (no walking while you're made to watch something)
    if (inGame) $('#keysHint').hidden = true;
    if (inGame) btn.textContent = game.holdToLeave() ? 'HOLD TO LEAVE' : 'STEP BACK';
    else if (target) {
      hint.querySelector('span').textContent = target.label; btn.textContent = target.act ? target.button || 'USE' : 'PLAY';
      // a use can show what it is, little: `swatch` (a colour, any css background) and `icon` (a picture)
      const pic = hint.querySelector('canvas'), g = pic.getContext('2d');
      pic.hidden = !target.swatch && !target.icon; pic.style.background = target.swatch || '';
      g.clearRect(0, 0, 16, 16); if (target.icon) g.drawImage(target.icon, 0, 0, 16, 16);
    }
  }
  // (a game with `holdToLeave`: STEP BACK on a phone only works held for a moment, not on a quick tap)
  let holding = null;
  const letGo = () => { clearTimeout(holding); holding = null; };
  on($('#use'), 'pointerdown', () => { if (mode === 'arcade' && game.holdToLeave()) { letGo(); holding = setTimeout(() => { holding = null; if (mode === 'arcade') game.stepBack(); }, 600); } });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) on($('#use'), ev, letGo);
  on($('#use'), 'click', () => { if (mode === 'arcade') { if (!game.holdToLeave()) game.stepBack(); } else if (target && mode === 'play') use(target); });
  // Sit down at the computer: you lean in until the screen fills the view, then the program starts.
  let going = null;
  function use(u) {
    for (const w of ways) if (w.takes?.(u)) { w.use(u); return; }
    // something in the room that just does something when pressed (a dial, a sign), or moves your
    // view about by itself (tapping the aquarium's glass): it's handed where you stand and a way to
    // glide your view, a step at a time; once a step's `then` doesn't glide on, you have the controls back
    if (u.act) {
      held.clear();
      const step = (to, secs, then) => glideTo(to, secs, () => { then?.(); if (!glide) { mode = 'play'; showTarget(); } });
      u.act({ from: { x: me.x, z: me.z, eye: me.eye, yaw: me.yaw, pitch: me.pitch }, EYE, glide: step });
      showTarget();
      return;
    }
    mode = 'going'; held.clear(); showTarget();
    if (document.pointerLockElement) document.exitPointerLock();
    const d = tmp.copy(u.pos).sub(cam.position);
    going = { u, t: 0, from: { x: me.x, z: me.z, eye: me.eye, yaw: me.yaw, pitch: me.pitch },
      yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
  }
  function lean(dt) {
    going.t += dt / 0.9;
    const k = Math.min(1, going.t), e = k * k * (3 - 2 * k), f = going.from, u = going.u;
    const tx = u.pos.x - Math.sin(going.yaw) * -0.32, tz = u.pos.z - Math.cos(going.yaw) * -0.32;   // just in front of the screen
    me.x = f.x + (tx - f.x) * e; me.z = f.z + (tz - f.z) * e;
    me.eye = f.eye + (u.pos.y - EYE - f.eye) * e;
    const dy = going.yaw - f.yaw; me.yaw = f.yaw + Math.atan2(Math.sin(dy), Math.cos(dy)) * e; me.pitch = f.pitch + (0 - f.pitch) * e;
    if (going.t >= 1 && !going.done) {
      going.done = true; $('#flash').hidden = false;
      tabNote.put(BACK, u.card.id);
      setTimeout(() => { close(); enter(u.card); }, 120);
    }
  }

  // ---------- easing your view somewhere (stepping up to a game and back, the aquarium's glass) ----------
  let glide = null;
  function glideTo(to, secs, then) {
    mode = 'gliding'; showTarget();
    glide = { from: { x: me.x, z: me.z, eye: me.eye, yaw: me.yaw, pitch: me.pitch }, to, t: 0, secs, then };
  }
  function glideOn(dt) {
    glide.t += dt / glide.secs;
    const k = Math.min(1, glide.t), e = k * k * (3 - 2 * k), f = glide.from, to = glide.to;
    me.x = f.x + (to.x - f.x) * e; me.z = f.z + (to.z - f.z) * e; me.eye = f.eye + (to.eye - f.eye) * e;
    const dy = to.yaw - f.yaw; me.yaw = f.yaw + Math.atan2(Math.sin(dy), Math.cos(dy)) * e; me.pitch = f.pitch + (to.pitch - f.pitch) * e;
    if (k >= 1) { if (to.y !== undefined) me.y = to.y; const then = glide.then; glide = null; then(); }
  }

  // ---------- Sadie's letter (the first time only), and the pause menu ----------
  function closeLetter() { store.set(INVITED, true); $('#letter').hidden = true; mode = 'play'; }
  on($('#ok'), 'click', closeLetter);
  if (!store.get(INVITED, false) && !backRoom) {
    mode = 'letter'; $('#letter').hidden = false;
    document.fonts.load('17px "Patrick Hand"').catch(() => {}).finally(() => drawLetter($('#letterArt')));
    drawLetter($('#letterArt'));
  }
  function pause() {
    for (const w of ways) w.pause?.();
    mode = 'menu'; held.clear(); $('#menu').hidden = false; showTarget(); showSaves();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function resume() {
    $('#menu').hidden = true; $('#credits').hidden = true; $('#speed').hidden = true; ask(false);
    if (!ways.some(w => w.resume?.())) mode = 'play';
    showTarget();
  }
  on($('#pause'), 'click', e => { e.stopPropagation(); if (mode === 'play' || mode === 'arcade') pause(); });
  on($('#resume'), 'click', resume);
  on($('#creditsBtn'), 'click', () => { const box = $('#credits'); if (box.hidden) { showCredits(box); box.hidden = false; box.scrollIntoView?.({ block: 'nearest' }); } else box.hidden = true; });
  // SPEED: how fast the game is running here, to read out (meter.js): frames a second now, in this place and in the
  // slowest, and what's held in memory. Hidden until you open it; the numbers are from before you paused.
  const meter = makeMeter();
  const mb = n => (n / 1e6).toFixed(1);
  function speedLines() {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'), mem = performance.memory, info = renderer.info.memory;
    let bytes = 0;
    for (const x of made()) if (x.isTexture && x.image?.width) bytes += x.image.width * x.image.height * 4;
    if (mem) meter.note('heap', mem.usedJSHeapSize);
    return [
      `GRAPHICS CARD HOLDS: ${info.geometries} SHAPES, ${info.textures} PICTURES (ABOUT ${mb(bytes)} MB OF PICTURES)`,
      mem ? `PAGE MEMORY: ${mb(mem.usedJSHeapSize)} MB NOW, ${mb(meter.peak('heap'))} MB AT MOST SINCE THE COUNT BEGAN, ${mb(mem.jsHeapSizeLimit)} MB ALLOWED` : "PAGE MEMORY: THIS BROWSER WON'T SAY",
      navigator.deviceMemory ? `THIS DEVICE SAYS IT HAS ABOUT ${navigator.deviceMemory} GB (A ROUGH GUESS)` : null,
      `PLACES BUILT: ${places.length}, ROOMS: ${slots.filter(r => r.place).length} OF ${slots.length}`,
      `PICTURE SIZE: ${canvas.width} BY ${canvas.height}`,
      ext ? `GRAPHICS CHIP: ${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : null,
    ].filter(Boolean);
  }
  function showSpeed() {
    $('#speedLines').replaceChildren(...meter.report(me.world.name, speedLines()).map(l => Object.assign(document.createElement('p'), { textContent: l })));
  }
  on($('#speedBtn'), 'click', () => { const box = $('#speed'); if (box.hidden) { showSpeed(); box.hidden = false; box.scrollIntoView?.({ block: 'nearest' }); } else box.hidden = true; });
  on($('#speedClear'), 'click', () => { meter.clear(); showSpeed(); });
  // how loud: MUSIC, SOUNDS and VOICES (Sadie, Clyde), each ON, SOFT or OFF (src/shared/sound.js)
  const showVolumes = () => { for (const b of BUSES) $('#vol-' + b).textContent = `${b.toUpperCase()}: ${loud[b].toUpperCase()}`; };
  for (const b of BUSES) on($('#vol-' + b), 'click', () => setLoud(b, { on: 'soft', soft: 'off', off: 'on' }[loud[b]]));
  function setLoud(b, v) { loud[b] = v; store.set(VOLUME(b), v); setVolume(b, LEVELS[v]); showVolumes(); }
  showVolumes();
  $('#how').innerHTML = touchy ? 'LEFT THUMB: WALK<br>RIGHT THUMB: LOOK AROUND<br>WALK INTO A DOOR TO GO IN'
    : 'W A S D: WALK &middot; ARROWS: WALK AND TURN<br>CLICK, THEN MOUSE: LOOK AROUND<br>E: USE &middot; ESC: PAUSE';
  // Starting over, from the pause menu: everything at once, or one thing at a time. Nothing is
  // erased until you say yes.
  // (every save the game has: the clubhouse's own, and what each card keeps. Never the whole browser
  // storage: on a shared address, other pages keep their things there)
  const ALL = ['mansion.', ...cards.flatMap(c => c.keeps || [])];
  const resets = [
    ['EVERYTHING', 'EVERYTHING IN THE CLUBHOUSE', () => forget(ALL)],
    ["SADIE'S INVITATION", "SADIE'S INVITATION", () => forget([INVITED])],
    ...cards.filter(c => c.keeps).map(c => [c.name.toUpperCase(), c.name.toUpperCase(), () => forget(c.keeps)]),
  ];
  let undoing = null;
  // the question shows where it was asked, in place of that section's buttons, so it can't be missed
  function ask(show, yes = 'YES, ERASE IT', from = $('#resets')) {
    $('#resets').hidden = $('#backups').hidden = false;
    if (show) { from.after($('#sure')); from.hidden = true; }
    $('#sure').hidden = !show; $('#sureYes').textContent = yes;
    if (show) { $('#sure').scrollIntoView({ block: 'nearest' }); $('#sureNo').focus(); }
    else undoing = null;
  }
  for (const [name, what, undo] of resets) {
    const b = document.createElement('button'); b.textContent = name;
    on(b, 'click', () => {
      undoing = undo;
      $('#sureAsk').innerHTML = `START ${what.replace(/&/g, '&amp;').replace(/</g, '&lt;')} OVER?<br>IT'S ERASED FOR GOOD.`;
      ask(true);
    });
    $('#resets').appendChild(b);
  }
  // (then the page starts afresh, with nothing saved on the way out: a room's last save would put
  // back what was just erased)
  on($('#sureYes'), 'click', () => { if (undoing && undoing() !== false) { reloading(); location.reload(); } });
  on($('#sureNo'), 'click', () => ask(false));

  // Your saves (src/shared/storage.js): how much room they take, a warning when they're nearly
  // full (past that, a save quietly fails), and a backup: one file with every save in the
  // clubhouse, to keep anywhere and put back later, on any browser.
  function showSaves(say) {
    const r = saveRoom(), trouble = r.failed ? "A SAVE DIDN'T FIT!" : r.nearlyFull ? 'YOUR SAVES ARE NEARLY FULL!' : '';
    $('#saveNote').classList.toggle('full', !!trouble);
    $('#saveNote').innerHTML = say || (trouble ? `${trouble}<br>SAVE A BACKUP, THEN START SOMETHING OVER.`
      : `SAVES: ${r.used < 1e5 ? Math.max(1, Math.round(r.used / 1e3)) + ' KB' : (r.used / 1e6).toFixed(1) + ' MB'} OF ABOUT ${r.of / 1e6} MB`);
  }
  const backupName = () => `sadies-clubhouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  on($('#saveBackup'), 'click', async () => {
    const text = backup(ALL), name = backupName();
    // on the game page, the page asks first (claude.ai's own way to hand you a file); anywhere else, a plain download
    let files = null;
    try { files = await window.claude?.use?.('downloads'); } catch {}
    if (files) {
      try { await files.save({ filename: name, data: text }); showSaves('BACKUP SAVED!'); }
      catch (e) { showSaves(e?.code === 'declined' ? 'NO BACKUP SAVED.' : "COULDN'T SAVE A BACKUP HERE."); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    showSaves('BACKUP SAVED!');
  });
  on($('#loadBackup'), 'click', () => { $('#backupFile').value = ''; $('#backupFile').click(); });
  on($('#backupFile'), 'change', async () => {
    const f = $('#backupFile').files[0];
    if (!f) return;
    if (f.size > 6e6) { showSaves("THAT FILE'S TOO BIG TO BE A BACKUP."); return; }
    const text = await f.text().catch(() => '');
    const seen = inspectBackup(text, ALL);
    if (seen.error) { showSaves(seen.error + '.'); return; }
    undoing = () => { const why = loadBackup(text, ALL); if (why) { ask(false); showSaves(why + '.'); return false; } };
    $('#sureAsk').innerHTML = `PUT THIS BACKUP BACK?${seen.made ? `<br>MADE ${seen.made}, ${seen.saves.length} SAVES.` : ''}<br>WHAT'S SAVED NOW IS REPLACED.`;
    showSaves(); ask(true, 'YES, LOAD IT', $('#backups'));
  });

  // ---------- the loop ----------
  let raf = 0, last = performance.now(), frames = 0, played = 0, hintGone = false, watching = false;
  const born = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; played += dt; const t = now / 1000;
    resize();
    if (mode === 'play' && me.world.watch) {
      // something in this place everyone has to watch (Brickbuster's yarn ball getting out): your
      // view follows it, and you can't walk or look away until it's gone
      const w = me.world.watch, dx = w.x - me.x, dz = w.z - me.z, dy = w.y - (me.eye + EYE);
      const yaw = Math.atan2(-dx, -dz), pitch = Math.max(-0.95, Math.min(0.95, Math.atan2(dy, Math.hypot(dx, dz))));   // (a bit further up or down than you can look yourself)
      const k = Math.min(1, dt * 10), dyaw = yaw - me.yaw;
      me.yaw += Math.atan2(Math.sin(dyaw), Math.cos(dyaw)) * k; me.pitch += (pitch - me.pitch) * k;
      me.bob *= 0.85;
      // (it can also say where you're to be while you watch: `at`, {x, z, y}, eased there, or
      // straight there with `snap`: sat in Space Adventure's pilot seat)
      if (w.at) {
        const e = w.at.snap ? 1 : Math.min(1, dt * 3);
        me.x += (w.at.x - me.x) * e; me.z += (w.at.z - me.z) * e;
        if (w.at.y !== undefined) { me.y = w.at.y; if (w.at.snap) me.eye = me.y; }
        if (w.at.snap) { me.yaw = yaw; me.pitch = pitch; }
      }
    } else if (mode === 'play') {
      const tr = (held.has('tl') ? 1 : 0) - (held.has('tr') ? 1 : 0);
      me.yaw += tr * TURN * dt;
      let f = (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0) - stick.y, st = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0) + stick.x;
      const m = Math.hypot(f, st); if (m > 1) { f /= m; st /= m; }
      let walked = false;
      if (m > 0.05) {
        const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
        const v = (me.world.speed || SPEED) * dt;   // (a place can be quicker to get about: the aquarium's boat)
        walked = move((-sy * f + cy * st) * v, (-cy * f - sy * st) * v);
        if (walked) moved = true;
      }
      me.bob = walked ? me.bob + dt * 10 : me.bob * 0.85;
      // walking with the thumb stick, your gaze drifts back to level (like any phone game)
      if (walked && stick.id !== null && drag.id === null) me.pitch *= Math.max(0, 1 - dt * 1.5);
    } else if (mode === 'going') lean(dt);
    else if (mode === 'gliding') glideOn(dt);
    for (const w of ways) w.frame?.(dt);
    if (mode !== 'going' && mode !== 'gliding' && !game.at()) me.eye += (me.y - me.eye) * Math.min(1, dt * 12);   // smooth over steps
    if (!hintGone && ((moved && now - born > 4000) || now - born > 15000)) { hintGone = true; $('#keysHint').style.opacity = 0; }
    // a door opens as you come up to it facing it (only one at a time), and closes behind you
    const opening = doorAhead();
    // (walking up to a door whose room isn't built yet: it's built now, and the door opens once it's ready)
    const waiting = opening ? null : unbuiltAhead();
    // (still: not walking, or reading Sadie's letter, or paused)
    if ((mode === 'play' && !held.size && !stick.x && !stick.y) || mode === 'letter' || mode === 'menu') stillFor += dt; else stillFor = 0;
    tend(dt, waiting);
    for (const p of portals) {
      if (!p.b) continue;
      // (or while something in the place on either side holds it open: an escaping yarn ball)
      // (a place can also slam its own door shut for a moment: its `shut`, Cats Only's button)
      const want = p.wb.shut !== p.b && (opening?.p === p || p.wa.holding === p.a || p.wb.holding === p.b);
      p.open += ((want ? 1 : 0) - p.open) * Math.min(1, dt * 5);
      p.a.setOpen(p.open); p.b.setOpen(p.open);
    }
    seenFrom = outsideSeenFrom();
    keeper.step(dt, seenFrom);
    soundsPaused(mode === 'menu');   // (nothing new sounds behind the pause menu but music)
    weather.update(t, dt, places, skySeen(), ears());
    const heard = ears();   // (a place hears you only while you're in it)
    for (const w of places) guard(w.name, () => w.update(t, dt, w === me.world ? heard : null));
    // the main theme: it makes way for any other music by itself (the sound system hears it), and
    // for a place that asks for quiet (its `hush`: the Music Room, Space Adventure's cockpit and radio)
    youAreIn(me.world.name, ears());   // (a room's music is only heard in it; sounds fade with how far off they are)
    const hush = me.world.hush;
    theme.tick(typeof hush === 'function' ? !!hush() : !!hush);
    farHouses();
    // (a house outside the gate, whether or not its room's built: it's part of outside)
    for (const r of slots) if (r.house) guard(r.name + ' house', () => r.house.update(t, dt, ears()));
    draw();
    const was = target; target = mode === 'play' ? findTarget() : null;   // (nothing to use while playing a game in its room)
    if (was !== target || watching !== !!me.world.watch) { watching = !!me.world.watch; showTarget(); }
    if (!frames) { speed.first = Math.round(performance.now() - opened); speed.atFirst = slots.filter(r => r.place).map(r => r.name); }
    frames++;
  }
  // One place's mistake mustn't stop the game: it's said once, and the next frame carries on without it.
  const said = new Set();
  function guard(name, fn) {
    try { fn(); } catch (e) { if (!said.has(name)) { said.add(name); console.warn(`${name} failed in a frame:`, e); } }
  }
  let broken = 0;   // frames failing one after another
  let prevTick = 0, beat = 0;
  function tick(now) {
    const began = performance.now();
    try { frame(now); broken = 0; } catch (e) {
      if (!said.has('frame')) { said.add('frame'); console.warn('a frame failed:', e); }
      if (++broken === 60) oops(STUCK);   // (one slip is carried past; a whole second of them means the picture is stuck)
    }
    if (mode !== 'menu' && prevTick) meter.frame(me.world.name, now - prevTick, performance.now() - began);   // (the speed readout: frames behind the pause menu aren't counted)
    prevTick = now;
    if (++beat % 120 === 0 && performance.memory) meter.note('heap', performance.memory.usedJSHeapSize);
    raf = requestAnimationFrame(tick);
  }

  function close() {
    cancelAnimationFrame(raf); off.abort(); theme.close(); closeSounds();   // (every sound, a house's own too)
    if (document.pointerLockElement) document.exitPointerLock();
    for (const t of throughs) t.dispose(); disposeLook(); renderer.dispose(); renderer.forceContextLoss();
    root.remove(); style.remove();
    delete window.__clubhouse;
  }

  // for the checks (tests/clubhouse/browser.mjs): where you are, and a way to stand somewhere
  // (a check going to a room that isn't built yet: built first)
  const later = (name, then) => { const r = slots.find(r => r.name === name); return r ? build(r).then(w => w ? then() : false) : false; };
  window.__clubhouse = {
    frames: () => frames,
    played: () => played,   // (seconds the game has run: slower than the clock when frames are slow)
    mode: () => mode,
    where: () => ({ place: me.world.name, x: me.x, y: me.y, z: me.z, yaw: me.yaw }),
    target: () => target?.label || null,
    looking: () => viewing ? viewing.tw.name : null,
    // how many doorways are showing what's through them right now (not black)
    showing: () => sides.filter(s => s.w === me.world && s.d.see.material.uniforms.uOn.value > 0.5).length,
    // hold a doorway open, as if something were going through it (null to let it go)
    holdOpen(name, door) { const w = places.find(p => p.name === name); if (w) w.holding = door ? w.doors[door] : null; },
    // every place, built or not (a room not built yet is built when a check goes there)
    places: () => ['outside', 'hall', ...slots.map(r => r.name)],
    // the rooms that are buildings outside (their card has a `lot` or `grounds`)
    outsideRooms: () => slots.filter(r => outdoors(r.card)).map(r => r.name),
    // stand at one of a place's spots (or at {x, z, yaw, y}), and look straight ahead
    put(name, spot) {
      const w = places.find(p => p.name === name);
      if (!w) return later(name, () => window.__clubhouse.put(name, spot));
      place(w, typeof spot === 'string' ? w.spots[spot] : spot); return true;
    },
    // the rooms built so far, whether they're all built, building one now (and waiting for that), and
    // putting one away now (as if you'd been far from it long enough)
    built: () => slots.filter(r => r.place).map(r => r.name),
    settled: () => !slots.some(r => r.building) && slots.every(r => r.place || !(r.portals.length || outdoors(r.card))),
    build: name => { const r = slots.find(r => r.name === name); return r ? build(r).then(w => !!w) : false; },
    putAway: name => { const r = slots.find(r => r.name === name); return r ? putAway(r) : false; },
    onlyDoors: on => { onlyDoors = on; },
    // make a place's update fail every frame (or put it right again), to check one place's mistake can't stop the game
    sabotage(name, on) {
      const w = places.find(p => p.name === name); if (!w) return false;
      if (on) { w.realUpdate ||= w.update; w.update = () => { throw new Error('sabotaged for a check'); }; }
      else if (w.realUpdate) { w.update = w.realUpdate; w.realUpdate = null; }
      return true;
    },
    // how far off a building outside the gate becomes a plain block (and which are, right now)
    farHouse: metres => { FAR_HOUSE = metres; farHouses(); },
    // the things in the world and their states (near, far or gone); every range pulled in or pushed out by a factor
    things: () => keeper.states(),
    thingRange: k => keeper.setScale(k),
    thingWatch: (id, on) => keeper.watch(id, on),
    houses: () => slots.filter(r => r.house?.group).map(r => ({ name: r.name, far: !r.house.group.visible })),
    // how quick the clubhouse is: ms to the first picture, ms to build each place, and what's held on
    // the graphics card (and in the kit's list of things to hand back)
    speed: () => ({ ...speed, places: { ...speed.places }, bits: { ...speed.bits }, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures, kept: made().length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null }),
    // every doorway's see-through box faces that a flat surface sits on (within 2 cm): they'd fight over the pixels (tools/clubhouse/audit-doors.mjs)
    audit() {
      const out = [], V = new Vector3();
      for (const s of sides) {
        const d = s.d, D = Math.max(1.3, (d.group.children.filter(c => c.isGroup).length === 1 ? d.w : d.w / 2)) + 0.1, hits = {};
        const bx = d.w / 2, bh = d.h;
        s.w.scene.updateMatrixWorld(true);
        s.w.scene.traverse(o => {
          if (!o.isMesh || o === d.see || !o.geometry?.attributes?.position) return;
          if (o.material?.uniforms?.uOn) return;
          const pos = o.geometry.attributes.position, idx = o.geometry.index;
          const loc = i => { V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); const [lx, lz] = d.local(V.x, V.z); return [lx, V.y - d.pos.y, lz]; };
          const n = idx ? idx.count : pos.count;
          for (let t = 0; t < n; t += 3) {
            const a = [0, 1, 2].map(k => loc(idx ? idx.getX(t + k) : t + k));
            for (const [axis, planes] of [[1, [0.02, bh + 0.01]], [0, [-bx - 0.01, bx + 0.01]], [2, [-D]]]) {
              const v = a.map(q => q[axis]);
              if (Math.max(...v) - Math.min(...v) > 1e-3) continue;   // (flat in this axis)
              const near = planes.find(pl => Math.abs(v[0] - pl) < 0.019); if (near === undefined) continue;
              // overlaps the box in the other two axes
              const ok = [0, 1, 2].filter(k => k !== axis).every(k => { const lo = Math.min(...a.map(q => q[k])), hi = Math.max(...a.map(q => q[k])); const [bl, bhh] = k === 0 ? [-bx, bx] : k === 1 ? [0, bh] : [-D, 0]; return hi > bl + 1e-3 && lo < bhh - 1e-3; });
              if (!ok) continue;
              const key = (axis === 1 ? 'y' : axis === 0 ? 'x' : 'z') + '=' + near.toFixed(2) + ' off ' + (v[0] - near).toFixed(3) + ' mesh ' + (o.name || o.parent?.name || o.geometry.type);
              hits[key] = (hits[key] || 0) + 1;
            }
          }
        });
        out.push({ w: s.w.name, to: s.tw.name, hits });
      }
      return out;
    },
    turnTo(yaw, pitch = 0) { me.yaw = yaw; me.pitch = pitch; },
    // the LOOK | PAINT switch in a place with a brush (on PAINT: pressing paints), and how many presses are painting
    painting: () => paint.on(),
    brushes: () => paint.presses(),
    // the main theme: what it's doing; the sound system: what's playing, whose, and how loud
    music: () => theme.state(),
    sound: () => soundState(),
    // the weather: how it's going, a new one, and how fast it changes (k times quicker)
    weather: () => weather.state(),
    setWeather: (kind, o) => weather.set(kind, o),
    weatherSpeed: k => weather.speed(k),
    // the places out of doors (a `sky`) built now, and how bright a place's sunlight is
    outdoors: () => places.filter(w => w.sky).map(w => w.name),
    // the built places that always keep the main theme out (`hush: true`)
    quiet: () => places.filter(w => w.hush === true).map(w => w.name),
    sunlight: name => places.find(w => w.name === name)?.light.sun ?? null,
    // take a step of d metres straight ahead (through a doorway, if there's one there), and draw
    step(d) { const r = move(-Math.sin(me.yaw) * d, -Math.cos(me.yaw) * d); draw(); return r; },
    // how far the view leans over sideways (0: not at all), and how open the last doorway walked through is
    tilt: () => Math.abs(new Vector3(1, 0, 0).applyQuaternion(cam.quaternion).y),
    lastDoorOpen: () => lastThrough ? lastThrough.open : null,
    floorAt: (name, x, z, y) => places.find(p => p.name === name)?.floor(x, z, y) ?? null,
    // (the outside itself, for the check that its ground has levels: it adds a bridge and takes it away again)
    outside: () => outside,
    doorAt: (name, door) => { const d = places.find(p => p.name === name)?.doors[door]; return d && { x: d.pos.x, z: d.pos.z }; },
    // stand in front of a doorway in this place, facing it (d metres out)
    faceDoor(name, door, d = 2) {
      const w = places.find(p => p.name === name), dd = w?.doors[door];
      if (!w) return later(name, () => window.__clubhouse.faceDoor(name, door, d));
      if (!dd) return false;
      place(w, { x: dd.pos.x + dd.normal.x * d, z: dd.pos.z + dd.normal.z * d, y: dd.pos.y, yaw: dd.yaw, pitch: 0 }); return true;
    },
  };

  resize();
  raf = requestAnimationFrame(tick);
  for (const r of slots) if (outdoors(r.card)) build(r);   // (the rest of the buildings outside, first in the queue)
}

// Sadie's letter: handwriting in hard pixels, big and bold enough to read easily.
function drawLetter(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const px = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px('#6a3a88', 0, 0, W, H); px('#fff4e4', 1, 1, W - 2, H - 2);
  for (let x = 3; x < W - 3; x++) { px(x % 6 < 3 ? '#ff8ec8' : '#8ad8ff', x, 3); px(x % 6 < 3 ? '#ff8ec8' : '#8ad8ff', x, H - 4); }
  for (let y = 26; y < H - 16; y += 26) for (let x = 14; x < W - 14; x += 2) px('#dccff4', x, y + 22);
  const t = document.createElement('canvas'); t.width = W; t.height = H; const k = t.getContext('2d', { willReadFrequently: true });   // (read back below: kept off the graphics card)
  // written twice, a hair apart, so the strokes are thick enough to survive being made into pixels
  const write = (text, x, y) => { k.fillText(text, x, y); k.fillText(text, x + 0.7, y); k.fillText(text, x, y + 0.5); };
  k.font = '25px "Patrick Hand", "Comic Sans MS", "Trebuchet MS", sans-serif'; k.fillStyle = '#000'; k.textBaseline = 'top';
  ['Dear friend,', 'I have decided to share my', 'clubhouse with all my friends.', 'You are invited.', 'Come in. Wipe your paws.', 'Do not sit in my chair.']
    .forEach((l, i) => write(l, 18, 20 + i * 26));
  k.font = '32px "Patrick Hand", "Comic Sans MS", "Trebuchet MS", sans-serif'; write('Sadie', W - 130, 16 + 6 * 26);
  const d = k.getImageData(0, 0, W, H);
  for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] > 80; d.data[i] = 42; d.data[i + 1] = 26; d.data[i + 2] = 110; d.data[i + 3] = on ? 255 : 0; }
  k.putImageData(d, 0, 0); g.drawImage(t, 0, 0);
  // her paw print, in pink ink, and a wax seal
  const pawX = W - 40, pawY = H - 36, pink = '#e0509a';
  px(pink, pawX, pawY + 7, 8, 6); px(pink, pawX + 1, pawY + 13, 6, 1);
  for (const [x, y] of [[-2, 3], [1, 0], [5, 0], [8, 3]]) px(pink, pawX + x, pawY + y, 3, 3);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y < 40) px((x + y) % 3 ? '#e83a3a' : '#a02030', W - 20 + x, 16 + y);
  px('#ffb0b0', W - 22, 15, 4, 3);
}
