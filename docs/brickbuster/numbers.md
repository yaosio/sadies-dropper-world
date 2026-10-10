# Brickbuster's numbers

Sizes, speeds, cracks, the heap, the loose ball, Sadie's sounds, the escape and what the tests
expect. Read before changing any of them.

- **The glass**: 6 m wide, 6.6 m tall, its bottom 1.4 m off the floor. The ball's radius 0.16 m;
  the paddle 1.3 x 0.46 m, its middle 0.7 m up. Bricks 0.4 x 0.24 m (with gaps), a grid of 14 columns
  by 8 rows, the top row's top edge 1.25 m under the top of the glass (the gap you break through
  into). The marquee is 256 x 64 dots.
- **Lives and levels**: 3 lives. Speed 4.2 m/s at level 1, 0.2 m/s faster each level, up to level 15
  (7.0 m/s) and no faster after that (Claude's choice; `SPEED` in `game.js`). The paddle sends the ball up
  to 60 degrees off straight up (at its very ends); the keys move the paddle 6 m/s. Points: 80 for
  the top row down to 10 for the bottom one.
- **Cracks**: one hit at the top cracks it (`CRACK_HITS` = 1, fast as it always was), 3 cracks break it. The ball rattles about above the bricks once it's through, so after a
  hit at the top the next one waits until the ball's been back to the paddle. Cracks stay across levels. Once the machine has mended itself the glass never cracks again (Yaosio, 2026-10-10: after that it's regular Breakout). On the old machine a miss cracks the glass at the bottom (3 break it, no life lost) and clearing the board breaks it; once mended neither happens.
- **The heap**: 100 spots, 81 in three layers along the front of the machine and 19 down its right
  side; bricks are 0.21 m apart up a layer. A knocked-out brick takes a moment to fall inside the
  glass, then 0.55 s from the hatch to its spot. Once all 100 are taken the oldest is swapped.
- **Boards**: 14 x 8 grid, at least 20 bricks, twelve shapes (`boards.md`).
- **Game over and levels**: GAME OVER shows 3.6 s, then the next game; a new board pops in over about
  a second and a half.
- **Loose in the hall**: bounces keep 72% of their speed (85% off walls), it rolls to a stop.
  Sadie trots after it (leaps at 4 m/s) keeping 1.6 m off while it's going, and goes for it once
  it's slower than 1.2 m/s on something: leaps up to 2.2 m (6.5 m/s), a swat after a 0.25 s crouch,
  sending it 5 to 8 m/s and 2.5 to 5 m/s up (on the landing 5 to 7.5); from below, 30% of the
  time a mighty one (10.5 to 11.5 m/s up, out towards the landing). The tests expect about 9
  whacks a minute, never more than a minute apart, a third or so of its time on the landing, it
  never outside the hall or through the landing, and Sadie never through the landing or its
  railing, nor standing about while the ball rolls off.
- **Sadie's sounds** (`CHATTER` and `LOUD` in `sounds/sadie.js`): a pat on 30% of whacks (at most
  one every 10 s), a meow on 15% of whacks (at most one every 30 s), a chirp on 20% of pounces (one
  every 30 s), a trill on 60% of mighty whacks (one every 25 s); not two of her sounds within
  5 s, not two chirps, trills or meows within 15 s, about 5 in a minute at most. All of these are
  Claude's numbers and soft guides (`docs/clubhouse/RULEBOOK.md` section 4). The tests
  expect about 3 a minute (pats 1.5, chirps 0.8, trills 0.6, meows about 0.5). Right next to her they
  play at 0.25 to 0.35 of full volume, fading to nothing 18 m off.
- **The escape**: 9 hops, each 0.25 s plus its length at 8.5 m/s, about 8 seconds in all; Sadie
  runs at 5.5 m/s. The shatter lasts 3 seconds; shards lie on the floor 1.5 to 2.5 s.
- **Mending**: about 13.4 s from the start to the end (`MEND` in `room.js`): the paddle starts to
  rise at 0.5 s and is home at 3.4 s, the ball pops at 4.2 s, the glass starts to come back at
  4.8 s and is whole at 8 s, the heap starts to dance out at 6.6 s (2.2 to 2.7 s each, spread over
  2.8 s), the new board pops in at 10.4 s. It starts 2.2 s after the door shuts.
- **What the tests expect**: a pretend player that never misses and aims for gaps gets three top
  cracks in about a minute (0.7 to 1 minute over five games; never under half a minute), a real
  person takes a good few minutes. On the old machine, leaving the paddle alone breaks it with three misses; once mended it loses all three lives within a minute
  (about 5 s). The speed never passes 7.0 m/s at any level up to
  a hundred thousand, and the ball is still caught by the paddle at top speed.
