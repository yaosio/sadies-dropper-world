# Brickbuster's checks

Its tests and its picture tool. Read before changing what's checked, or when a check fails.

- **`tests/brickbuster/run.mjs`**: headless: the arcade music (twenty minutes at each heat: only
  its three soft instruments, every note short and in range, quicker with an arpeggio as it heats
  up, a breath at the end of most rounds, never the same round twice) and the mending tune (about
  15 seconds, soft, in range, no steady row of notes, never the same twice), pretend players for
  three hours of play, game after game with the glass breaking and being mended on the way (the ball
  never leaves the glass or gets stuck sideways), the speed at every level up to a hundred thousand
  (never past its limit) and the ball still caught by the paddle at top speed at levels from 1 to
  99999, the paddle's angles, missing (a life each, GAME OVER after three, the glass untouched, the
  next game starting clean), good play breaking the top (three cracks), bricks, the next level, the
  heap holding 100, thousands of boards (every one good, the same every time from the seed, every
  shape, never the same shape twice running), saves (the ball kept exactly, a ball about to miss
  still misses, junk saves never break it, the first Brickbuster's save still loads, a mended
  machine carries on at the same level), the sounds (8-bit, never silent, each crack bigger, the
  shatter biggest, the mending softer than the shatter; Sadie's softer than any crack, each version
  different), the cracks' drawing, the heap's spots (100, where nobody walks, none on thin air), the
  ball loose in the hall for 90 minutes, and Sadie's sounds while she plays (now and then, rarely
  two close together, about 5 a minute at most, not the same twice running: soft guides, so the
  test only checks they stay roughly that rare). The levels never end, so these check what can be
  checked (a very large number of them, at the extremes) and nothing is promised for every level
  ever. About 25 seconds.
- **`tests/brickbuster/browser.mjs`**: phone and desktop, fatal errors only: through its door,
  stepping up, the paddle by keys, mouse and finger, a miss (a life gone), stepping back with the ball
  in the air and finding it where it was after a reload, cracking the top three times and breaking
  it (stepped back to watch and let go once the ball's out, the heap, the sign), the machine mending
  itself (the paddle home, the glass back, the heap gone, a new board, the sign off, playable again),
  breaking again (Sadie already out) and being left broken: fixed itself after a reload, put away and
  built again with the ball and Sadie in the hall, and the pause menu's start-over button (the
  music, the winces, Sadie's sounds in the hall and the poster are not checked in the browser).
- **`tools/brickbuster/shots.mjs`**: pictures of the room and the game from the built page:
  `dist/shots/brickbuster/` (including the machine mending itself).

What the tests expect in numbers is in `numbers.md`.
