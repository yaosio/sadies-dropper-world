// A way of playing: a game that lives in its room (a use with `play`: Brickbuster's wall, the Music
// Room's instruments, the Good Morning Machine). Stepping up: your view eases back (and up) until the
// whole game fits the screen, looking at it square on. Then the controls go to the game: steering
// with the keys, nudging with the mouse or a finger; or, for a game that wants them (`key`, `touch`:
// an instrument), every key and every press on the screen. Stepping back (Esc, W, S or STEP BACK):
// back to where you stood. The game is told when to start and stop.
//
// Any place, inside or out, can have a use with `play`: nothing here knows which game it is.
// `you` is what the clubhouse lends a way of playing (see clubhouse.js, "ways of playing").
const TILT = 0.12;   // the view looks up at it a little, from a bit below its middle
// (or, if the game says `down`, looks down on it from that far above: a keyboard lying flat)

export function arcade(you) {
  const { $, canvas, cam, touchy, me, held, drag, EYE, KEYS } = you;
  const HINT = touchy ? 'SLIDE A FINGER TO MOVE' : '<kbd>A D</kbd> OR <kbd>MOUSE</kbd> MOVE &nbsp; <kbd>ESC</kbd> STEP BACK';
  $('#arcadeHint').innerHTML = HINT;
  let game = null;
  const pressing = new Set();
  // held keys that steer: -1 left, 1 right
  const steering = () => (held.has('r') || held.has('tr') ? 1 : 0) - (held.has('l') || held.has('tl') ? 1 : 0);
  function view(u) {
    const v = u.play.view, tv = Math.tan(cam.fov * Math.PI / 360), th = tv * cam.aspect, a = v.down ?? -TILT;
    const dist = Math.max(v.h / 2 / tv, v.w / 2 / th) * 1.04;
    const x = v.center.x + v.normal.x * dist * Math.cos(a), z = v.center.z + v.normal.z * dist * Math.cos(a);
    // metres along the game per pixel on the screen, so things move exactly as far as your finger
    if (game) game.mpp = 2 * dist * th / Math.max(1, canvas.clientWidth);
    return { x, z, eye: v.center.y + dist * Math.sin(a) - EYE, yaw: Math.atan2(v.normal.x, v.normal.z), pitch: -a };
  }
  function stepUp(u) {
    held.clear();
    game = { u, from: { x: me.x, z: me.z, eye: me.eye, yaw: me.yaw, pitch: me.pitch }, mpp: 0.01 };
    u.play.start();   // now, while the key or the tap is still going on: browsers allow sound only then
    // (a game that takes presses needs the mouse free to point with)
    if (u.play.touch && document.pointerLockElement) document.exitPointerLock();
    $('#arcadeHint').innerHTML = (touchy ? u.play.hint?.touch : u.play.hint?.keys) || HINT;
    you.glideTo(view(u), 0.8, () => { you.mode = 'arcade'; you.showTarget(); });
  }
  function stepBack() {
    if (!game) return;
    game.u.play.stop(); held.clear(); drag.id = null; pressing.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    // back where you stood, or (the game's over) where it says to watch from; on the floor either way
    const after = game.u.play.over && game.u.play.after;
    const back = after ? { ...after, eye: me.y } : game.from;
    you.glideTo(back, 0.6, () => { game = null; you.mode = 'play'; you.showTarget(); });
  }
  const playing = () => you.mode === 'arcade' ? game.u.play : null;

  return {
    // a use with `play`: step up to it
    takes: u => !!u.play,
    use: stepUp,
    stepBack,
    // whether you're at a game (stepped up to it, or on your way there or back)
    at: () => !!game,
    // whether STEP BACK on a phone has to be held (a game that asks for it, with `holdToLeave`)
    holdToLeave: () => !!playing()?.holdToLeave,
    // a key, while you're playing: handled here (true), whatever it is
    key(e) {
      const pl = playing(); if (!pl) return false;
      // a game that takes the keys itself (an instrument: every key is a note) gets them all; only
      // Esc steps back
      if (pl.key) { if (!e.ctrlKey && !e.metaKey && !e.altKey && pl.key(e.code, true, e.repeat)) e.preventDefault(); return true; }
      const k = KEYS[e.code];
      if (k === 'f' || k === 'b') { e.preventDefault(); stepBack(); } else { pl.begin?.(); if (k) { e.preventDefault(); held.add(k); } }
      return true;
    },
    keyUp(e) { playing()?.key?.(e.code, false); },
    mouse(e) { if (you.locked()) playing()?.nudge?.(e.movementX * game.mpp); },
    press(e) {
      const pl = playing(); if (!pl) return false;
      pl.begin?.();   // (a game that waits for a touch or a click: this is it)
      if (pl.touch) { pressing.add(e.pointerId); pl.touch(e.pointerId, you.pointAt(e), 'down'); }
      else if (drag.id === null) Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY });
      else return true;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      return true;
    },
    move(e) {
      const pl = playing(); if (!pl) return false;
      if (pl.touch) { if (pressing.has(e.pointerId)) pl.touch(e.pointerId, you.pointAt(e), 'move'); return true; }
      // the mouse (just moving it) or a finger (sliding it) moves along with the game, as far on the
      // screen as you moved
      if (e.pointerType === 'mouse' && !you.locked()) pl.nudge?.(e.movementX * game.mpp);
      else if (e.pointerId === drag.id) { pl.nudge?.((e.clientX - drag.x) * game.mpp); drag.x = e.clientX; drag.y = e.clientY; }
      return true;
    },
    letGo(e) { if (pressing.delete(e.pointerId) && game) game.u.play.touch?.(e.pointerId, null, 'up'); },
    frame(dt) {
      const pl = playing(); if (!pl) return;
      Object.assign(me, view(game.u));   // (again every frame: the screen might have turned)
      pl.steer?.(steering(), dt);
      if (pl.over) stepBack();         // the game's over (Brickbuster broke): step back and watch
    },
    pause() { playing()?.stop(); },
    // back from the pause menu: straight back into the game, if you were at one
    resume() { if (!game) return false; you.mode = 'arcade'; game.u.play.start(); return true; },
  };
}
