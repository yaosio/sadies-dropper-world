# Playing Brickbuster '96

The machine as the player sees it: stepping up, the controls, lives and levels, the cracks, the heap
and the music. Read before changing how the game plays or feels. The numbers are in `numbers.md`;
the boards are in `boards.md`; the break is in `the-break.md`.

## Stepping up

Look at the case and press E (PLAY on a phone): your view eases back (and a little below) until the
whole glass, the marquee and the floor in front (where the knocked-out bricks land) fit the
screen, square on, up in the air if need be (you're back on the floor when you step back). The
marquee's letters are big (3 and 2 pixels a dot on a 256 x 64 picture) so they read from there.
You have to be within 8.5 m of the machine to play it.

## Controls

A/D or the arrows (or just moving the mouse) move the paddle; on a phone, sliding a finger anywhere
moves it exactly as far as the finger goes. Esc, W or S (or Up/Down) (on a phone, hold the HOLD TO LEAVE button for a moment: a quick tap does nothing, because a sliding thumb hit it by accident) eases you back to
where you stood, and the game waits, the ball hanging where it was. Every new ball (the first, after a miss, after a level)
waits on the paddle, bobbing a little, until you touch the screen, click or press a key (Yaosio,
2026-10-10: a ball that went off by itself caught players unready). The 1UP heart is small and shows
where the ball hit.

## The game

It's Breakout with three lives. The marquee shows your SCORE and the HIGH score, and (while you play)
the LEVEL and the lives left as little hearts. Idle, it says FULL VERSION 99 LEVELS, as it always did.

- **Missing**: the ball drops out of the bottom of the glass (the paddle winces, a sad little slide
  down) and a new ball waits on the paddle. On a machine that hasn't broken yet, a miss cracks the
  glass at the bottom instead of costing a life (`the-break.md`); once mended, a miss costs one life.
- **Extra life** (Yaosio, 2026-10-10): every 3000 points one life comes back, if one is missing (never
  more than three). A big pink heart with 1UP under it in fat letters pops up where the ball hit,
  floats up and shrinks away, with a happy little run of notes and the paddle smiling. The heart
  says it first, because the main player has trouble reading. (`EXTRA_LIFE` in `game.js`.)
- **GAME OVER**: after the third miss the marquee says GAME OVER with your final score and the HIGH
  score (or NEW HIGH SCORE), the paddle looks sad, and a few seconds later the next game starts: level
  1, three lives, a new seed (so new boards). The high score stays, and so do any cracks on the
  glass and the heap on the floor. The machine isn't hurt.
- **Clearing a board**: every brick gone is the next level: a new board pops in, a bright little jingle,
  and the ball is a bit faster (up to level 15, then no faster).
- **The top**: once you've knocked a way through the bricks the ball hits the top of the glass. The
  first hit only tinks; the second cracks it (up at the top the ball rattles about, so a crack waits
  until the ball's been back to the paddle). Three cracks and the glass breaks (`the-break.md`).
- Every knocked-out brick falls down inside the glass, into the BRICK RETURN slot and out of the
  hatch at the foot of the machine onto a heap on the floor (along the front of the machine and down
  its right side, where nobody walks): 100 spots, and after that the oldest spot is swapped for the
  newest, so it never overflows.

## Leaving and coming back

Everything is kept as you play and when you step back or leave the page: the level, score, high score,
lives, the board (which bricks are left), the cracks, the heap, the seed (so the next boards are the
ones it would have made), and the ball itself: where it is and which way it's going. Come back and
the ball hangs where it was for a breath, then carries on, so leaving the moment before a miss
doesn't help (and doesn't hurt). A save from the first Brickbuster loads too: its score becomes the
high score.

## Arcade music

While you play the machine, bouncy 1996 arcade music plays (a square-wave tune over a triangle
bass), written as it plays so it never comes round the same, and the clubhouse's main theme fades
out for it. It gets more exciting as the glass cracks: quicker, a soft arpeggio joins in, the bass
hops octaves. It stops (a quick fade) when you step back, pause, or the glass breaks, and carries
on when you step up again. No drums (`docs/clubhouse/RULEBOOK.md` section 4). It follows the pause menu's MUSIC
button (ON, SOFT, OFF).
