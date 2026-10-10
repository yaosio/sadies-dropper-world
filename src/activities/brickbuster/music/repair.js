// The tune the machine mends itself to: whimsical, a little lilting waltz (6/8) in a bright major
// key, a music-box tune over a round, bouncy bass, climbing up to a busy middle (the bricks
// dancing out the top) and ending on a happy chord with a tinkle on top. Written fresh from a seed
// every time, so it never comes round the same. No screen (the tests run the tune in Node); the
// player at the bottom plays it live on the browser's own oscillators, through a band (the
// clubhouse's theme makes way for it, the MUSIC button sets its volume, and it's only heard in
// its room).
//
// Kind to the ears (RULEBOOK.md section 4): no drums, nothing steady and ticking (the bass is two
// long notes a bar, the tune never runs in an even row of short notes), every note soft-edged.
import { makeBand } from '../../../shared/band.js';
import { hz } from '../../../shared/retro.js';
import { rng } from './tune.js';

export const SHAPES = {
  lead: { attack: 0.008, release: 0.08, gain: 0.26, cut: 2300 },     // a soft square: the music box
  bell: { attack: 0.004, release: 0.4, gain: 0.34, cut: 5000 },      // sine sparkles
  tri: { attack: 0.01, release: 0.06, gain: 0.8, cut: 1500 },        // the bass
};
export const RANGE = { lead: [64, 93], bass: [36, 52] };
export const BARS = 13, EIGHTH = 0.192;       // a bar is six eighths (1.15 s): the whole tune about 15 s
export const SECS = BARS * 6 * EIGHTH;

const PENTA = [0, 2, 4, 7, 9];                 // major pentatonic: it can't sound wrong
// what each bar's chord is rooted on (semitones above home)
const CHORDS = [0, 5, 7, 0, 0, 9, 5, 7, 5, 7, 9, 7, 0];
// ways to fill a bar: [start, length] in eighths
const CELLS = {
  calm: [[[0, 3], [3, 3]], [[0, 2], [2, 1], [3, 3]], [[0, 3], [3, 1], [4, 2]], [[0, 2], [2, 2], [4, 2]]],
  busy: [[[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], [[0, 2], [2, 1], [3, 1], [4, 1], [5, 1]], [[0, 1], [1, 2], [3, 1], [4, 1], [5, 1]]],
};
const pick = (r, list) => list[Math.floor(r() * list.length)];

// The whole tune: { secs, notes: [{ at, len, midi, voice, vel }] }, sorted by when they start.
export function makeRepairTune(seed = Date.now()) {
  const r = rng(seed), tonic = 60 + pick(r, [0, 2, 5, 7]);
  const notes = [];
  const add = (eighth, len, midi, voice, vel) => notes.push({ at: eighth * EIGHTH, len: Math.min(1.6, len * EIGHTH * 0.9), midi, voice, vel: vel * (0.92 + r() * 0.12) });
  const ladder = i => tonic + 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5];   // the pentatonic notes, up and down a ladder
  const fit = (m, [lo, hi]) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
  let at = 8 + Math.floor(r() * 3);           // where on the ladder the tune is
  for (let bar = 0; bar < BARS; bar++) {
    const b0 = bar * 6, root = tonic + CHORDS[bar];
    const section = bar < 4 ? 0 : bar < 8 ? 1 : bar < 12 ? 2 : 3;
    // the bass: a long low note, then a chord note up a bit, with a rest between (a waltz, not a tick)
    add(b0, 2.4, fit(root - 12, RANGE.bass), 'tri', 0.45);
    if (section !== 3 || bar === 12) add(b0 + 3, 2.2, fit(root - 12 + (bar % 2 ? 7 : 4), [RANGE.bass[0] + 4, RANGE.bass[1] + 7]), 'tri', 0.3);
    if (bar === 12) {                         // the end: a happy chord and a tinkle up the top
      for (const st of [0, 4, 7, 12]) add(b0, 5, fit(tonic + 12 + st, RANGE.lead), 'bell', 0.45);
      add(b0, 3, fit(tonic + 24, RANGE.lead), 'lead', 0.3);
      for (let i = 0; i < 5; i++) add(b0 + 2 + i * 0.5, 1, fit(ladder(at + 5 + i), RANGE.lead), 'bell', 0.26 - i * 0.03);
      continue;
    }
    // the tune: the first note of a bar is one of the chord's notes, the rest wander
    const cell = pick(r, section === 2 ? CELLS.busy : CELLS.calm);
    cell.forEach(([start, len], k) => {
      if (k === 0) {
        const want = [0, 4, 7, 12].map(s => root + s);
        let best = at, bd = 99;
        for (let i = at - 3; i <= at + 3; i++) { const d = Math.min(...want.map(w => Math.abs((ladder(i) - w) % 12))); if (d < bd) { bd = d; best = i; } }
        at = best;
      } else {
        at += pick(r, section === 2 ? [-1, 1, 1, 2, -2, 1] : [-1, -1, 1, 1, 2, -2, 0]);
      }
      // (it climbs towards the middle, and comes back down for the end)
      if (section === 2 && at < 11) at++;
      if (section === 0 && at > 13) at--;
      if (section >= 2 && at > 17) at -= 2;
      at = Math.max(5, Math.min(18, at));
      const m = fit(ladder(at), RANGE.lead);
      if (!(k === cell.length - 1 && len >= 3 && r() < 0.25)) add(b0 + start, len, m, 'lead', 0.5);   // (now and then a rest)
      if (len >= 2 && r() < (section === 2 ? 0.7 : 0.35)) add(b0 + start, len * 1.3, fit(m + 12, RANGE.lead), 'bell', 0.22);   // sparkle on top
    });
    // a little run up the glass chimes as the middle starts
    if (bar === 7) for (let i = 0; i < 5; i++) add(b0 + 3.4 + i * 0.5, 0.9, fit(ladder(at - 2 + i * 2), RANGE.lead), 'bell', 0.24);
  }
  return { secs: SECS, notes: notes.sort((a, b) => a.at - b.at) };
}

// Plays it in the browser: `h`, the room's handle (src/shared/sound.js). play() starts it from the top,
// tick() every frame hands over the notes coming up, stop() fades it (about `secs`). With no sound at
// all in the browser it quietly does nothing.
export function makeRepairMusic(h, seed = Date.now()) {
  const band = makeBand(h, { echo: { delay: 0.2, feedback: 0.25, cut: 2000, send: 0.3 } }), ctx = band.ctx;
  let part = null, tune = null, t0 = 0, i = 0, playing = false, notes = 0;
  function note(n, when) {
    const s = SHAPES[n.voice], end = when + n.len, amp = ctx.createGain(), peak = n.vel * s.gain;
    amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(peak, when + s.attack);
    amp.gain.setTargetAtTime(peak * (n.voice === 'bell' ? 0.3 : 0.6), when + s.attack, n.voice === 'bell' ? 0.18 : 0.25);
    amp.gain.setTargetAtTime(0, end, s.release);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = s.cut;
    const o = ctx.createOscillator(); o.type = n.voice === 'tri' ? 'triangle' : n.voice === 'bell' ? 'sine' : 'square'; o.frequency.value = hz(n.midi);
    o.connect(lp); lp.connect(amp); amp.connect(part.out);
    if (n.voice !== 'tri') { const w = ctx.createGain(); w.gain.value = 0.5; amp.connect(w); w.connect(part.wet); }
    o.start(when); o.stop(end + s.release * 8);
    o.onended = () => { try { amp.disconnect(); } catch {} };
  }
  return {
    get playing() { return playing; },
    played: () => notes,
    play() {
      if (playing) return;
      playing = true; tune = makeRepairTune(seed); i = 0; notes = 0;
      if (!ctx) return;
      h.wake();
      part = band.part(0.16);
      t0 = ctx.currentTime + 0.2;
    },
    stop(secs = 0.8) { if (!playing) return; playing = false; part?.fade(secs); part = null; },
    // every frame while playing
    tick() {
      if (!playing || !ctx || ctx.state !== 'running' || !tune) return;
      const now = ctx.currentTime;
      while (i < tune.notes.length && t0 + tune.notes[i].at < now + 0.5) {
        const n = tune.notes[i++];
        if (t0 + n.at < now - 0.05) continue;   // (too late to play: skipped)
        try { note(n, t0 + n.at); notes++; } catch {}
      }
      if (i >= tune.notes.length && now > t0 + tune.secs + 2) playing = false;
    },
  };
}
