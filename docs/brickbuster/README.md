# Brickbuster '96

The clubhouse's third activity (`src/activities/brickbuster/`), and the first that lives in the
clubhouse itself instead of on a computer: a Breakout machine built into the far wall of a tall
arcade room, two storeys of glass. Its ball is a ball of yarn, its paddle is a chunky plastic
character with a face, and Sadie sits on a box beside it watching the ball. You get three lives and
endless levels, each a new board. Play too well and crack the glass three times and it shatters,
and the yarn ball escapes into the hall for good (Sadie chases it out and never comes back); then
the machine mends itself, and you can play again.

## Design pillars (the owner's rules; these win over any feature idea)

- It's in the room, not on a separate screen. The room is tall (and the glass wide) because the game is.
- Three lives once the machine has mended itself (before that, a miss cracks the glass instead); missing the paddle costs one. Out of lives is only GAME OVER: it never breaks the
  machine. The game goes on through endless levels, each faster than the last up to a limit, each a
  new board made from the game's seed (never the same boards every game).
- Leave any time and come back to the same moment: the level, score, lives, board and the ball
  exactly where it was, so leaving just before a miss never saves you.
- Your score and the high score are always on the marquee.
- Playing too well cracks the glass at the top. Three cracks and it breaks (the first time only: once mended it's regular Breakout). The cracks are loud, crunchy and wonderfully 90s. Once the yarn ball is out, it's
  silent (the poster explains why; and nothing out there makes a constant noise:
  `docs/clubhouse/RULEBOOK.md` section 4).
- It only ever breaks to be mended: once Sadie's out and the door's shut, the machine fixes itself
  to whimsical music (the paddle rises and puts itself back, a new ball pops out of it, the glass
  unbreaks, the knocked-out bricks dance up and out of the top), and can be played again.
- Sadie's sounds are rare and soft: never close together, never the same twice running, never
  louder than a crack, fading with distance. Anything new that repeats gets the same treatment.
- The ball is Sadie's ball of yarn; the paddle is a character (a real 3D paddle, not a flat
  picture), happy, focused, nervous, wincing, and sad while it's broken.
- The escaped ball never gets in your way.
- No loose strand of yarn trailing from the ball (the owner said no need).

## Its pages

- `playing.md`: stepping up, the controls, lives, levels, scores, leaving mid-game, the cracks, the
  heap of bricks and the arcade music; read before changing how the game plays or feels.
- `boards.md`: how each level's board is made; read before changing the boards.
- `the-break.md`: the glass shattering, the yarn ball's escape and the room left OUT OF ORDER; read
  before changing the break.
- `mending.md`: the machine fixing itself afterwards; read before changing that.
- `the-hall.md`: the yarn ball loose in the hall, Sadie chasing it and her sounds; read before
  changing the ball or Sadie out there.
- `numbers.md`: sizes, speeds, the heap, the loose ball, Sadie's sounds and what the tests expect;
  read before changing any of them.
- `how-built.md`: which code file does what, and being put away; read before changing the code.
- `sounds.md`: how its sounds and arcade music are made and played; read before changing or adding
  a sound.
- `checks.md`: its tests and picture tool; read before changing what's checked.
- `history.md`: the steps it was built in. Only read before undoing a choice.
- `parked.md`: parked ideas.
