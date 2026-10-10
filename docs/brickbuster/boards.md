# The boards

How each level's board is made. Read before changing the boards. The game's rules are in
`playing.md`; the code is `boards.js`.

## Made from the game's seed and the level

A game has a seed (picked at random when a game starts, and kept in the save). Level 1, level 2 and so
on each make their board from that seed and the level number, so the same game and level always make
the same board: a saved game rebuilds the board it was on, and no two games get the same run of
boards. There is no last level: the numbers just keep going (a test makes thousands).

## The grid and the shapes

A board is a grid of 14 columns and 8 rows (some cells have a brick; each brick has a colour from
the rainbow of eight and is worth more nearer the top). The shape is one of twelve: stripes,
checker, diamond (sometimes hollow), pyramid (up or down), waves, pillars, frame, cross, scatter,
Sadie's cat face, a heart and a space invader. The shapes come round in a shuffled order (a new
shuffle every twelve levels), so a shape never comes twice running. Each shape is turned a little
different every time: its numbers, mirrored left to right or not, upside down or not (not the
pictures), a few holes punched in it (not the pictures), and one of four ways of colouring it (in
bands, up and down stripes, slanted, or out from the middle).

## Always a fair board

A board has at least 20 bricks (if a shape with its holes comes out thinner, the holes are left
out; if it's still thin it's three full rows), never more than the grid, and no brick is ever shut
away: the ball can always get at the bricks round the edge, and the rest as those go. The tests check
this for every one of four thousand levels in four games.
