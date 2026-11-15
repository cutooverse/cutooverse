// Every sound is made on the fly with Web Audio: no files to load. Plus phone vibration.
let ctx = null, master = null, NOISE = null, OFFLINE = false, T0 = 0;
export const sound = { on: true, haptics: true, strength: "normal", notes: "piano" };

// Recording a video: sounds are rendered afterwards into an OfflineAudioContext, each at the
// moment (T0, seconds) it was asked for.
export function useOffline(c) {
  ctx = c; OFFLINE = true;
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  NOISE = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function startAt(t) { T0 = t; }

export function unlock() {
  if (OFFLINE) return ctx;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // one second of noise made once: every hit plays a slice of it (making a buffer per hit
    // delayed the sound behind the knife on phones)
    NOISE = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// iPhones only let sound start on a lift of the finger (touchend / click), not on touch-down:
// unlock on every such gesture. While it is still locked, sounds are dropped, not queued (queued
// ones all came out a second or two late).
for (const ev of ["touchend", "click", "keydown"]) addEventListener(ev, () => unlock(), { capture: true, passive: true });
const ready = () => ctx && (OFFLINE || ctx.state === "running");

// How long this device takes to get a sound out of the speaker: measured from the audio clock
// against the clock of what is being heard right now, else what the browser reports.
const IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
export function soundLag() {
  if (!ready()) return null;
  const ts = ctx.getOutputTimestamp?.();
  if (ts && ts.performanceTime > 0) {
    const heard = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    const lag = ctx.currentTime - heard + (ctx.baseLatency || 0);
    if (lag > 0 && lag < 3) return lag;
  }
  const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  return lat > 0.005 ? lat : IOS ? 0.07 : 0.02;
}
export function audioLead() {
  const lag = soundLag();
  return lag === null ? 0 : Math.max(0, lag - 0.016);   // minus a frame for the picture's own lag
}

function noise(dur, { type = "bandpass", f0 = 2000, f1 = f0, q = 1, gain = 0.5, at = 0, curve = 2 } = {}) {
  if (!sound.on || !unlock() || !ready()) return;
  const src = ctx.createBufferSource(); src.buffer = NOISE;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  const t = (OFFLINE ? T0 : ctx.currentTime) + at;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur * (curve >= 3 ? 0.7 : 1));   // the old fade-out curve, roughly
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * (1 - Math.min(dur, 0.9)), dur + 0.01);
}

function tone(freq, dur, { type = "sine", gain = 0.3, at = 0, to = freq } = {}) {
  if (!sound.on || !unlock() || !ready()) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = (OFFLINE ? T0 : ctx.currentTime) + at;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

// A note of an instrument: a few sine partials [ratio, level, decay s], each fading on its own,
// as a struck string or bar does. Made on the fly like everything else here.
function voice(freq, partials, { at = 0, attack = 0.004, gain = 0.16 } = {}) {
  if (!sound.on || !unlock() || !ready()) return;
  const t = (OFFLINE ? T0 : ctx.currentTime) + at;
  const out = ctx.createGain(); out.gain.value = gain; out.connect(master);
  for (const [ratio, level, decay, type = "sine"] of partials) {
    const o = ctx.createOscillator(), e = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq * ratio, t);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(level, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0003, t + attack + decay);
    o.connect(e).connect(out); o.start(t); o.stop(t + attack + decay + 0.05);
  }
}
export const INSTRUMENTS = {
  piano:    { oct: 1, attack: 0.003, p: [[1, 1, 0.9], [2, 0.42, 0.5], [3, 0.16, 0.3], [4.01, 0.07, 0.2]] },
  organ:    { oct: 1, attack: 0.025, p: [[0.5, 0.45, 0.32], [1, 1, 0.34], [2, 0.6, 0.32], [3, 0.3, 0.28], [4, 0.22, 0.26]] },
  musicbox: { oct: 2, attack: 0.002, p: [[1, 1, 1.2], [4, 0.32, 0.4], [6.3, 0.1, 0.22]] },
  marimba:  { oct: 1, attack: 0.002, p: [[1, 1, 0.45], [3.93, 0.38, 0.08], [9.2, 0.08, 0.03]] },
  glass:    { oct: 2, attack: 0.004, p: [[1, 1, 1.4], [2.32, 0.28, 0.6], [4.25, 0.1, 0.3]] },   // a struck wine glass
};
// a tiny glass ping: a few inharmonic partials ringing out, as a shard does
function ping(freq, at, gain) { voice(freq, [[1, 1, 0.18], [2.76, 0.45, 0.1], [5.4, 0.2, 0.05]], { at, attack: 0.001, gain }); }
// cut after cut climbs a major pentatonic scale two octaves up from C4, then back down: long runs
// keep singing and never land on a sour note
const SCALE = [0, 2, 4, 7, 9];
const stepFreq = step => 261.63 * 2 ** (Math.floor(step / 5) + SCALE[step % 5] / 12);
const runStep = i => { const k = i % 20; return k <= 10 ? k : 20 - k; };
function note(step, at = 0, gain = 0.16) {
  const ins = INSTRUMENTS[sound.notes];
  if (ins) voice(stepFreq(step) * ins.oct, ins.p, { at, attack: ins.attack, gain });
}

// ---------------------------------------------------------------------------------------------
// The Blender shorts' sound set (chicken/post/sfx.py), made live for the Flurry style: a knife's
// pass-by, the wet slice, the burst, pieces knocking on the board, drips. They go through a small
// room and a limiter of their own, panned to where the thing is on screen (pan: -1 left, 1 right).
let ST = null;
function studio() {
  if (ST?.ctx === ctx) return ST;
  const sr = ctx.sampleRate, rnd = () => Math.random() * 2 - 1;
  const limit = ctx.createDynamicsCompressor();        // a flurry of a hundred knives must not clip
  limit.threshold.value = -16; limit.knee.value = 10; limit.ratio.value = 4; limit.attack.value = 0.003; limit.release.value = 0.12;
  limit.connect(master);
  const bus = ctx.createGain(); bus.gain.value = 1.3; bus.connect(limit);
  const len = Math.floor(sr * 0.6), ir = ctx.createBuffer(2, len, sr);   // the room: 0.38 s, a few early reflections
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0, e = 0;
    for (let i = 1; i < len; i++) { lp += (rnd() * Math.exp(-6.9 * i / sr / 0.38) - lp) * 0.45; d[i] = lp * 0.35; }
    for (const [t, g] of [[0.007, 0.5], [0.013, 0.35], [0.019, 0.3], [0.027, 0.22], [0.034, 0.18]]) d[Math.floor((t + rnd() * 0.002) * sr)] += g * Math.sign(rnd());
    for (let i = 0; i < len; i++) e += d[i] * d[i];
    for (let i = 0; i < len; i++) d[i] /= Math.sqrt(e);
  }
  const room = ctx.createConvolver(); room.normalize = false; room.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.16;
  bus.connect(room).connect(wet).connect(limit);
  const crack = ctx.createBuffer(1, sr, sr), c = crack.getChannelData(0);   // sparse clicks: skin crackling
  for (let k = 0; k < 650; k++) c[Math.floor(Math.random() * sr)] = (0.3 + Math.random() * 0.7) * Math.sign(rnd());
  ST = { ctx, bus, crack };
  return ST;
}
const can = () => sound.on && unlock() && ready();
const when = at => (OFFLINE ? T0 : ctx.currentTime) + Math.max(0, at);
const between = (a, b) => a + Math.random() * (b - a);
// the end of a sound's chain: its place between the speakers (moving from p0 to p1), into the room
function out(node, t, dur, p0 = 0, p1 = p0) {
  const clip = p => Math.max(-1, Math.min(1, p || 0));
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(clip(p0), t); p.pan.linearRampToValueAtTime(clip(p1), t + dur);
    node = node.connect(p);
  }
  node.connect(studio().bus);
}
function source(buffer, t, dur) {
  const s = ctx.createBufferSource(); s.buffer = buffer;
  s.start(t, Math.random() * (1 - Math.min(dur, 0.9)), dur + 0.02);
  return s;
}
const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
// loudness over a sound: up in `attack`, then dying away at the rate `decay` (seconds to fall to 37 %)
function env(t, peak, attack, decay, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack, decay);
  g.gain.setValueAtTime(0.0001, t + dur);
  return g;
}
// wet flesh: noise through two mouth-like resonances, its loudness wobbling
function squelch(t, dur, { lp, f1, q1, f2, q2, level2, peak, attack, decay, wob, depth }) {
  const src = source(NOISE, t, dur), low = src.connect(filter("lowpass", lp));
  const e = env(t, peak, attack, decay, dur);
  low.connect(filter("bandpass", f1, q1)).connect(e);
  const second = ctx.createGain(); second.gain.value = level2;
  low.connect(filter("bandpass", f2, q2)).connect(second).connect(e);
  const shake = ctx.createGain(); shake.gain.value = 1;
  const lfo = ctx.createOscillator(), amount = ctx.createGain();
  lfo.frequency.value = wob; amount.gain.value = depth;
  lfo.connect(amount).connect(shake.gain); lfo.start(t); lfo.stop(t + dur + 0.02);
  return e.connect(shake);
}
const studioSfx = {
  // a blade passing by: a band of noise that rises as it nears and falls as it leaves; `at` is its start
  whoosh(at = 0, p0 = 0, p1 = 0, g = 1) {
    if (!can()) return;
    const t = when(at), dur = 0.30, mid = 0.135;
    const band = filter("bandpass", 380, 1.1);
    band.frequency.setValueAtTime(380, t); band.frequency.exponentialRampToValueAtTime(1800, t + mid); band.frequency.exponentialRampToValueAtTime(480, t + dur);
    const amp = ctx.createGain(), curve = new Float32Array(24);
    for (let i = 0; i < 24; i++) curve[i] = 0.14 * g * Math.exp(-((((i / 23) * dur - mid) / 0.075) ** 2));
    amp.gain.setValueCurveAtTime(curve, t, dur);
    out(source(NOISE, t, dur).connect(band).connect(filter("lowpass", 4500)).connect(amp), t, dur, p0, p1);
  },
  // the knife through the fruit: crisp skin crackle, a wet squelch, a faint tick of metal (and the note)
  cut(i = 0, at = 0, pan = 0, g = 1) {
    if (!can()) return;
    const t = when(at), dur = between(0.11, 0.17);
    out(source(studio().crack, t, 0.07).connect(filter("bandpass", 2900, 0.6)).connect(env(t, 0.45 * g, 0.0005, 0.03, 0.08)), t, dur, pan);
    out(squelch(t, dur, { lp: 1600, f1: between(380, 520), q1: 6, f2: between(1000, 1400), q2: 8, level2: 0.2,
      peak: 2.4 * g, attack: 0.006, decay: 0.05, wob: between(25, 55), depth: 0.5 }), t, dur, pan);
    for (const f of [4100, 6300]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.start(t); o.stop(t + 0.04);
      out(o.connect(env(t, 0.035 * g, 0.0005, 0.006, 0.04)), t, 0.04, pan);
    }
    note(runStep(Math.max(0, i - 1)), at);
  },
  // the burst: a low thump, a squelch and a spray of crackle; longer and wetter for more cuts (size 0..1)
  splat(size = 0.5, at = 0) {
    if (!can()) return;
    const t = when(at), dur = 0.30 + 0.5 * size, level = (0.6 + 0.4 * size) * (0.55 + 0.25 * size);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(137, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.2); o.frequency.exponentialRampToValueAtTime(42, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
    out(o.connect(env(t, 0.42 * level, 0.002, 0.10 + 0.05 * size, dur)), t, dur);
    out(squelch(t, dur, { lp: 1200 + 800 * size, f1: between(300, 420), q1: 5, f2: between(800, 1100), q2: 6, level2: 0.25,
      peak: 2.8 * level, attack: 0.004, decay: 0.07 + 0.12 * size, wob: 31, depth: 0.4 }), t, dur);
    out(source(studio().crack, t, dur).connect(filter("bandpass", 3700, 0.5)).connect(env(t, (0.25 + 0.5 * size) * level, 0.001, 0.12 + 0.2 * size, dur)), t, dur);
  },
  // a piece landing: a wet flop, and a wooden knock on the board, a dull thud on the floor, or nothing more on the pile
  impact(v = 1, surface = "board", pan = 0) {
    if (!can()) return;
    const t = when(0), level = Math.max(0.05, Math.min(0.8, v * 0.32));
    const flop = source(NOISE, t, 0.12).connect(filter("lowpass", surface === "pile" ? 700 : between(500, 900))).connect(filter("bandpass", between(220, 340), 4));
    out(flop.connect(env(t, 4.2 * level, 0.001, between(0.012, 0.025), 0.12)), t, 0.12, pan);
    if (surface === "board") {
      const sc = between(0.92, 1.08);                  // the board's own modes
      for (const [f, d, w] of [[170, 0.05, 1], [395, 0.035, 0.7], [720, 0.025, 0.3], [1180, 0.018, 0.15]]) {
        const o = ctx.createOscillator(); o.frequency.value = f * sc; o.start(t); o.stop(t + 0.22);
        out(o.connect(env(t, 0.17 * w * level, 0.001, d, 0.2)), t, 0.2, pan);
      }
    } else if (surface === "floor") {
      const o = ctx.createOscillator(); o.frequency.value = between(85, 115); o.start(t); o.stop(t + 0.16);
      out(o.connect(env(t, 0.28 * level, 0.001, 0.03, 0.15)), t, 0.15, pan);
    }
  },
  // a drop of juice landing: a tiny rising blip
  drip(pan = 0) {
    if (!can()) return;
    const t = when(0), o = ctx.createOscillator(), f = between(1400, 2200);
    o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 2.2, t + 0.05);
    o.start(t); o.stop(t + 0.07);
    out(o.connect(env(t, 0.05, 0.001, 0.012, 0.06)), t, 0.06, pan);
  },
  // the fruit rising off the board: a soft breath of air
  lift() {
    if (!can()) return;
    const t = when(0), dur = 0.42, band = filter("bandpass", 260, 0.8);
    band.frequency.setValueAtTime(260, t); band.frequency.exponentialRampToValueAtTime(950, t + dur);
    const amp = ctx.createGain(), curve = new Float32Array(24);
    for (let i = 0; i < 24; i++) curve[i] = 0.16 * Math.sin(Math.PI * i / 23) ** 1.5;
    amp.gain.setValueCurveAtTime(curve, t, dur);
    out(source(NOISE, t, dur).connect(band).connect(amp), t, dur);
  },
};

export const sfx = {
  ...studioSfx,
  swish() { noise(0.18, { f0: 5200, f1: 900, q: 1.2, gain: 0.45 }); },
  slice() { noise(0.12, { f0: 900, f1: 300, q: 0.8, gain: 0.8 }); noise(0.07, { f0: 2600, f1: 1800, q: 3, gain: 0.22 }); },
  chop(i = 0, at = 0, glass = false) {                // knife through fruit into the board, `at` s from now
    const p = 1 + ((i * 37) % 11 - 5) * 0.02;
    if (glass) {                                       // through glass: a sharp crack and a ring
      noise(0.04, { type: "highpass", f0: 5200 * p, f1: 3000, q: 0.7, gain: 0.34, at });
      noise(0.08, { f0: 2400 * p, f1: 1600, q: 6, gain: 0.18, at });
      tone(140 * p, 0.05, { gain: 0.22, to: 90, at });
      for (let k = 0; k < 3; k++) ping(2600 + Math.random() * 3400, at + k * 0.012, 0.07);
      note(runStep(Math.max(0, i - 1)), at);
      return;
    }
    noise(0.05, { f0: 3200 * p, f1: 1400, q: 0.9, gain: 0.35, at });
    noise(0.09, { f0: 1100 * p, f1: 500, q: 2.2, gain: 0.28, at: at + 0.004 });   // the wet squish of the flesh
    noise(0.06, { type: "lowpass", f0: 900, f1: 300, gain: 0.7, at });
    tone(150 * p, 0.07, { gain: 0.35, to: 80, at });
    note(runStep(Math.max(0, i - 1)), at);             // and the next note of the run
  },
  chord(at = 0) {                                      // the run resolves when the fruit falls apart
    [0, 2, 3, 5].forEach((step, k) => note(step + 5, at + k * 0.06, 0.13));
  },
  step(i) { note(runStep(i)); },
  glassCut() {                                         // a swiped cut through glass
    noise(0.07, { type: "highpass", f0: 6000, f1: 2500, q: 0.8, gain: 0.4 });
    for (let k = 0; k < 4; k++) ping(2400 + Math.random() * 3800, k * 0.015, 0.07);
  },
  shatter() {                                          // the glass fruit falls apart: a crash, then shards raining down
    noise(0.35, { type: "highpass", f0: 3000, f1: 7000, q: 0.6, gain: 0.38 });
    noise(0.25, { f0: 1800, f1: 600, q: 0.9, gain: 0.25 });
    tone(110, 0.2, { gain: 0.3, to: 55 });
    for (let k = 0; k < 40; k++) ping(1800 + Math.random() * 5200, 0.02 + Math.random() ** 1.6 * 1.1, 0.03 + Math.random() * 0.05);
  },
  preview() { [0, 1, 2, 3, 4].forEach(k => note(k + 5, k * 0.11, 0.15)); },
  burst() {
    noise(0.45, { f0: 600, f1: 4000, q: 0.7, gain: 0.5 });
    tone(90, 0.3, { gain: 0.45, to: 45 });
    for (let i = 0; i < 46; i++) noise(0.02, { type: "highpass", f0: 2500 + Math.random() * 3000, gain: 0.05 + Math.random() * 0.06, at: 0.15 + Math.random() * 0.9, curve: 3 });
  },
  land(v) { noise(0.05, { type: "lowpass", f0: 700, f1: 250, gain: Math.min(0.5, v * 0.4) }); },
  tick() { tone(1250, 0.03, { type: "triangle", gain: 0.12 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.16, at: i * 0.09 })); },
  lose() { [392, 311].forEach((f, i) => tone(f, 0.25, { type: "triangle", gain: 0.14, at: i * 0.14 })); },
};

export function buzz(kind = "chop") {
  if (!sound.haptics || !navigator.vibrate || navigator.userActivation?.hasBeenActive === false) return;
  const base = { light: 6, normal: 12, strong: 24 }[sound.strength] || 12;
  try { navigator.vibrate(kind === "burst" ? [base * 2, 40, base * 3] : base); } catch (e) { /* not allowed here */ }
}
