// Brickbuster '96's sounds: every sound it makes, by name, and how loud. The sounds themselves are
// made in their own files (the glass, the machine, the machine mending itself, the poster, Sadie), with the kit in retro.js;
// the clubhouse's sound system (src/shared/sound.js) plays them, through the room's handle. A new
// sound goes in the file it belongs with (or a new file), and gets a line here.
import { RATE } from '../../../shared/retro.js';
import { wrap } from '../../../shared/sound.js';
import { crack, shatter, tink } from './glass.js';
import { boing, blip, tock, miss, level, over, oneup } from './machine.js';
import { pop, mend } from './repair.js';
import { mute } from './quiet.js';
import * as sadie from './sadie.js';

// `h`: the room's handle (soundsFor). Every sample is 11 kHz, held 4 times over (no smoothing: it
// keeps its crunch); everything at half volume, as it always was.
export function makeSounds(h) {
  const play = (key, make, loud = 1, more) => h.play(key, make, { loud: loud * 0.5, rate: RATE, hold: 4, ...more });
  return wrap(h, {
    crack: level => play('crack' + level, () => crack(level)),
    boing: off => play('boing' + Math.round(off * 2), () => boing(Math.round(off * 2) / 2), 0.8),
    blip: row => play('blip' + row, () => blip(row), 0.7, { gap: 0.03 }),
    tock: () => play('tock', tock, 0.6),
    tink: () => play('tink', tink, 0.7),
    shatter: () => play('shatter', shatter),
    mute: () => play('mute', mute, 0.9),
    miss: () => play('miss', miss, 0.8),
    level: () => play('level', level, 0.8),
    over: () => play('over', over, 0.8),
    oneup: () => play('oneup', oneup, 0.85),
    pop: () => play('pop', pop, 0.8),
    mend: () => play('mend', mend, 0.7),
    // Sadie (a sound makeChatter picked), `at` where she is: a voice, fading with distance
    sadie({ name, variant }, at) { play(`sadie-${name}${variant}`, () => sadie[name](variant), sadie.LOUD[name], { bus: 'voices', at }); },
  });
}
