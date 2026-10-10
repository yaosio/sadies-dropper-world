# Ways of playing

How you play things in a room. Each kind of control is a file of its own in `src/clubhouse/play/`
(`arcade.js` for a use with `play`, `paint.js` for a `brush`). A new kind of control goes there, as
something any place can use, never in `clubhouse.js` or a room. Read when changing how you play
something. How the clubhouse passes keys and presses on: `docs/clubhouse/world/walking.md`.

## A thing you use: `act`
A use with `act` (in the place's `uses`) just does something when you press E (turning a dial or a
sign).
- Its `label` can change; `button` names it on a phone (where the label shows beside the button too).
- It can show what it is, small, by the label: `swatch` (a colour, any css background: a paint pot)
  and `icon` (a little picture: a tool on a pegboard).
- `act` is handed `{ from, EYE, glide }`: where you stand, and `glide(to, secs, then)`, which eases
  your view to `to` (`x`, `z`, `eye`, `yaw`, `pitch`) and then calls `then`. Once a `then` doesn't
  glide on, you have the controls back. A `to` with `y` also sets where you stand once there.

## A game: `play`
A use with `play` is a game (mode `arcade`):
- `view`: the middle, facing way, width and height the screen has to fit. The view glides back until
  it fits, looking at it square on from a little below.
- `start()` (called during the press, so sound is allowed), `stop()`.
- `steer(v, dt)`: held keys, -1 to 1 (A/D, the arrows). `nudge(metres)`: the mouse without
  clicking, or a finger sliding anywhere, already turned into metres across the game.
- `begin`: called on every touch, click or key press while playing: a game that waits for the player (one that holds each new ball on the paddle till then) starts on it.
- `holdToLeave`: set it and, on a phone, the STEP BACK button has to be held about half a second (a game where a sliding thumb hits it by accident).
- `over`: set when the game ends; the clubhouse steps you back. Esc, W, S or STEP BACK also glide
  you back to where you stood; the pause menu stops the game too.

## An instrument: `key` and `touch`
A `play` use can be an instrument instead:
- `key(code, down, repeat)` gets every key and returns true for the ones it used (only Esc steps
  back then; W and S are notes).
- `touch(id, ray, 'down' | 'move' | 'up')`: every press on the screen as a line out into the room
  (`origin`, `dir`), for it to find what's under it.
- Its `view` can say `down` (how far, in radians, to look down on it: a keyboard lying flat).
- `hint` (`keys`, `touch`) is what the hint at the top says while you play it. On a phone it
  wraps to a second line rather than run off the screen, but keep `touch` short: one line on a normal
  phone. `touch` can be a getter, read each time you step up, for a hint that depends on the screen.
  A room's checks can call `hintFits` (`tests/shared/browser.mjs`): it fails if the hint runs off the
  screen or takes more than two lines.

## Painting a place: `brush`
A place with `brush(id, ray, 'down' | 'move' | 'up')`: you walk about as normal, and pressing
paints the place itself.
- With the mouse locked, holding its button presses where the dot in the middle of the view is
  (`#aim`, shown only then).
- On a phone or with the mouse free, the LOOK and PAINT buttons (`#paint`, each turning itself on)
  say whether pressing looks around or paints where you press. The thumb stick still walks. It goes
  back to LOOK when you leave or pause; picking something up leaves it be.
- The YOU'RE HOLDING box (`#holding`) shows what you're holding and how to use it right now.
- The place gets each press as a line out into it (`origin`, `dir`) when it goes down, every frame
  while it's held (so walking or turning while you hold it paints a stroke), and when it lets go.
  What it does with the line is its own business.
- `brushLook()` says what you're holding: `{ color` (the PAINT button's border, the dot and
  pointer), `tool` (its name), `icon` (a little picture), `paint` (its name, or none), `verb` (PAINT,
  STAMP...), `drags` (whether dragging paints a line), `picks }` (a count that goes up each time
  something's picked up).
