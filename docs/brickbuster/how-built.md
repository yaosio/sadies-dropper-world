# How Brickbuster is built

Which code file does what (in `src/activities/brickbuster/`), and being put away. Read before
changing the code. Its sounds and music are in `sounds.md`, its checks in `checks.md`.

## Files

- **`card.js`**: its card: no page and no `start()`, just `room` (loads `room.js`) and `door`.
  `keeps` its save for the pause menu's start-over button.
- **`game.js`**: the game with no screen, in metres (the glass 6 x 6.6): the ball, the paddle, the
  14 x 8 grid of bricks (`alive` for the ones that are bricks now), lives, level, score and high
  score, the cracks at the top, the heap (`pile`: the colours of the bricks on the floor, in the
  order they fell, and `pileNext` once it's full) and whether it's broken or GAME OVER; `step()`
  returns what happened (for the sounds and faces: `miss`, `level`, `over`, `crack`, `break`...; a
  brick's event says its spot on the heap). `restart` is the next game, `mend` is the machine
  mended. What's kept between visits (`save`, `load`: the ball too, a `v: 2` shape; the first
  Brickbuster's save still loads).
- **`boards.js`**: the board for a level, from the game's seed and the level number (`boards.md`).
- **`room.js`**: the room (10 x 13 m, 11 m tall, arcade carpet, the QUIET!! poster by the door,
  Sadie on her box), the case (zigzag 90s plastic, a copper-bar marquee with the score, FREE PLAY /
  NO COINS stickers), the glass (clear, no fake glare since it hid the board, and the cracks drawn on a see-through picture from each
  crack's seed: `crackLines`), the bricks (bits fall down inside when knocked out), the yarn ball
  and the paddle (an extruded rounded slab, its face a 32 x 10 picture per mood and gaze, plus sad
  and sighing), and the marquee (score, high score, level, hearts; GAME OVER, FIXING ITSELF,
  OUT OF ORDER). The heap (`pileSlots`: 100 spots, a layer at a time, nearest the hatch first;
  `heapZone`: where nobody walks), things flying on arcs to it, the break (`smash`), the yarn
  ball's way out (a list of hops, each with its noise), Sadie's run, the OUT OF ORDER sign
  (`outOfOrder`, painted on the landing's side of the door), and the mending (`startRepair`,
  `repairOn`, `dancesOn`, timed by `MEND`; `mending.md`). Hands the clubhouse its place (with
  `holding`, the door held open while they go out) and the `play` on the case (`over` once it's
  broken). `window.__brickbuster` for the checks (`knockOut` fills the heap without playing,
  `crackTop`, `loseLife`, `catchBall`, `throwBall`, `holdRepair`). It also saves, apart from the
  game, that Sadie's out (`sadie`: she stays out through the mending and when it's put away and
  built again).
- **`loose.js`**: the yarn ball loose in the hall, and Sadie chasing it, with no screen (the tests
  run it): bouncing with gravity off the hall's solid shape (which the hall hands over: its walls,
  post, landing and railing, stair treads and furniture), stopping, Sadie's leaps and whacks,
  popping it back if it's ever wedged. `stepLoose` says what happened (`pounce`, `whack`,
  `mighty`, `pop`), for her sounds. `room.js` draws them in the hall (lent by the clubhouse, see
  `docs/clubhouse/rooms/kit.md`, and Sadie borrowed from her box in it), and plays her sounds when
  you're in the hall (the clubhouse's `ears`: where you are).
- **`door.js`, `poster.js`**: its door on the landing (an arcade marquee, bricks, the yarn ball)
  and Sadie's QUIET!! poster (a speaker crossed out, her underneath with cross eyebrows). Drawn by
  `art/clubhouse/pictures.py`.

## Put away when you're far off

The clubhouse puts the room away when you've been three doors or more from it for a while (see
`docs/clubhouse/world/building-rooms.md`), but never mid-game or while the ball's getting out
(`busy()`, see `docs/clubhouse/rooms/place.md`). `putAway()` saves the game, closes its sounds,
and takes the yarn ball and Sadie out of the hall; when it's built again from its save, they're
back (once Sadie's gone out for the first time, she's always out in the hall, broken or mended). The OUT OF ORDER sign stays on the landing door
meanwhile (it's made once, and the room built again uses the same one), so the landing never shows
the door without it while it's broken. Never mid-game, mid-break or mid-mending (`busy()`).
