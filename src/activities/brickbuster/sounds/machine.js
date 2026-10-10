// Brickbuster '96's machine: the paddle's BOING, the bricks' blips (higher rows, higher notes), and
// the low wooden tock of the sides of the case (and of bricks landing on the heap).
import { RATE, TAU } from '../../../shared/retro.js';
import { crunch as finish } from './crunch.js';

// The paddle: a springy square-wave BOING, the pitch wobbling up.
export function boing(off = 0) {
  const n = Math.round(0.34 * RATE), a = new Float32Array(n + Math.round(0.2 * RATE));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, f = (150 + off * 25) + 230 * (1 - Math.exp(-t * 11)) + 40 * Math.sin(TAU * 16 * t) * Math.exp(-t * 5);
    ph += f / RATE;
    a[i] = (ph % 1 < 0.5 ? 0.42 : -0.42) * Math.exp(-t * 7);
  }
  return finish(a, 0.25);
}

// A brick: a short blip, higher for the rows further up.
export function blip(row = 0) {
  const n = Math.round(0.09 * RATE), a = new Float32Array(n + Math.round(0.2 * RATE)), f = 523 * Math.pow(2, (5 - row) / 5);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / RATE; ph += (t < 0.03 ? f : f * 1.5) / RATE; a[i] = (ph % 1 < 0.5 ? 0.3 : -0.3) * (1 - t / 0.09); }
  return finish(a, 0.2);
}

// The sides of the case: a low wooden tock.
export function tock() {
  const n = Math.round(0.05 * RATE), a = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE; a[i] = Math.sin(TAU * 190 * t) * Math.exp(-t * 70) * 0.45; }
  return finish(a, 0);
}

// A note of the machine's little tunes (a square wave with a soft start), added into `a` from `at`.
function beep(a, at, len, f, amp = 0.3, slide = 1) {
  const n = Math.round(len * RATE), s0 = Math.round(at * RATE);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < a.length; i++) {
    const t = i / RATE, k = i / n;
    ph += f * Math.pow(slide, k) / RATE;
    a[s0 + i] += (ph % 1 < 0.5 ? amp : -amp) * Math.min(1, t / 0.006) * Math.exp(-t * 6) * Math.min(1, (n - i) / (0.02 * RATE));
  }
}

// Missing the paddle: a sad little slide down (a life gone).
export function miss() {
  const a = new Float32Array(Math.round(0.8 * RATE));
  beep(a, 0, 0.42, 392, 0.3, 0.5);
  beep(a, 0.34, 0.3, 262, 0.26, 0.8);
  return finish(a, 0.2);
}

// A new level: a quick bright run up.
export function level() {
  const a = new Float32Array(Math.round(0.9 * RATE));
  [523, 659, 784, 1047, 1319].forEach((f, i) => beep(a, i * 0.085, 0.16, f, 0.26));
  return finish(a, 0.25);
}

// An extra life: a happy little run up and a sparkle on top.
export function oneup() {
  const a = new Float32Array(Math.round(1.1 * RATE));
  [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => beep(a, i * 0.075, i === 5 ? 0.4 : 0.14, f, 0.24, i === 5 ? 0.8 : 1));
  return finish(a, 0.25);
}

// GAME OVER: four notes drooping down, slow and soft.
export function over() {
  const a = new Float32Array(Math.round(1.6 * RATE));
  [523, 440, 392, 262].forEach((f, i) => beep(a, i * 0.3, 0.45, f, 0.24, i === 3 ? 0.8 : 1));
  return finish(a, 0.25);
}
