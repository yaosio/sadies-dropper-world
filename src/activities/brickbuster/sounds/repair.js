// Brickbuster '96's machine mending itself: the new ball popping out of the paddle, and the glass
// coming back together as a run of little glass chimes. (The tune it all plays to is in music/repair.js.)
import { RATE, TAU, rng, ping } from '../../../shared/retro.js';
import { crunch as finish } from './crunch.js';

// The yarn ball popping out of the paddle: a bubbly little up-slide.
export function pop() {
  const n = Math.round(0.22 * RATE), a = new Float32Array(n + Math.round(0.15 * RATE));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, f = 280 + 900 * (1 - Math.exp(-t * 22)) + 60 * Math.sin(TAU * 30 * t);
    ph += f / RATE;
    a[i] = Math.sin(TAU * ph) * Math.exp(-t * 14) * 0.5 * Math.min(1, t / 0.004);
  }
  return finish(a, 0.15);
}

// The glass putting itself back together: little chimes climbing up a scale, one after another,
// each ringing a while, with a tinkle of glass between them (soft: nothing like the shatter).
export function mend(seed = 96) {
  const r = rng(seed), len = 2.8, a = new Float32Array(Math.round(len * RATE) + Math.round(0.5 * RATE));
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  scale.forEach((st, i) => {
    const at = 0.1 + i * 0.22 + r() * 0.03, f = 523 * Math.pow(2, st / 12);
    ping(a, Math.floor(at * RATE), f, 5.5, 0.2, a.length);
    ping(a, Math.floor(at * RATE), f * 2.01, 9, 0.07, a.length);
  });
  for (let p = 0; p < 18; p++) ping(a, Math.floor((0.2 + r() * (len - 0.5)) * RATE), 2200 + r() * 3000, 24 + r() * 20, 0.05 + r() * 0.05, a.length);
  return finish(a, 0.2);
}
