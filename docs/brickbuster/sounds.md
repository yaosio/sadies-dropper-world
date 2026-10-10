# How Brickbuster's sounds and music are made

The code behind its sounds (`src/activities/brickbuster/sounds/`) and arcade music (`music/`).
Read before changing or adding a sound. How they sound to the player is in `playing.md`,
`the-break.md` and `the-hall.md`; the clubhouse's sound system is in
`docs/clubhouse/sound/system.md`, the sound kit and the band in
`docs/clubhouse/sound/making-sounds.md`.

## Sounds (`sounds/`)

Every sound is made in code as 8-bit 11 kHz samples (each held 4 times over at 44.1 kHz, so no
smoothing), a file per kind of sound:

- `glass.js`: the three cracks (a snap, a thump, crackle bursts, glass pings, a slapback echo, the
  third a long crash); the shatter (a snap and a boom, a crash in two waves, three seconds of glass
  tinkling down); and the tink of glass that can't crack any more.
- `machine.js`: the paddle's BOING, brick blips (higher rows higher), the case's tock (bricks landing
  on the heap too), and the little tunes of a miss (a sad slide down), a new level (a quick bright
  run up) and GAME OVER (four notes drooping down).
- `repair.js`: the machine mending itself: the new ball's bubbly pop, and a soft run of glass chimes
  climbing a scale as the glass comes back together (nothing like the shatter).
- `quiet.js`: the poster's squeak-click, `mute`.
- `sadie.js`: Sadie's sounds while she plays in the hall, and `makeChatter`, the rules for when she
  makes them.

They're made with the toolbox's kit (`src/shared/retro.js`: pings, resonances for voices) and the
room's own crunchy ending with the slapback (`crunch.js`), and the clubhouse's sound system
(`src/shared/sound.js`) plays them, through the room's handle (Sadie's on the VOICES volume,
fading with distance). `index.js` is the list of every sound by name and how loud:
`makeSounds(handle)`, made when you step up to the case (or when Sadie first makes a sound while
you're in the hall).

**A new sound** goes in the file it belongs with (or a new file for a new kind), and gets a line in
`index.js`.

## Arcade music (`music/`)

- `tune.js` writes it a bar at a time with no browser (the tests run it): four chords a round, the
  hook, the hook varied, the hook again, the answer, and a breath at the end of most rounds; new
  chords every other round, a new hook and now and then a key change up every fourth. `heat` (0 to
  1: the most cracks on one side, over two) sets the speed (132 to 150 beats a minute, `BPM`),
  brings in the arpeggio (from 0.3) and the hopping bass.
- `repair.js` writes the tune the machine mends itself to (no browser: the tests run it) and plays
  it: about 15 seconds of a whimsical little waltz in a bright major key (6/8): a music-box tune
  (a soft square wave, with sine sparkles on top) over two long bass notes a bar (so never an even
  row of notes: nothing ticks or drones), climbing to a busier middle while the bricks dance, and
  ending on a happy chord with a tinkle. Written fresh from a seed, so never the same twice. It plays
  while it mends (through its own band, so the theme makes way for it) and fades out after.
- `player.js` plays it live on the browser's own oscillators (`SHAPES`: soft edges, short notes),
  with a short slapback echo, through the toolbox's band (`src/shared/band.js`, a music line on
  the sound system), so the theme makes way for it and the MUSIC button sets its volume without
  the room doing anything.
