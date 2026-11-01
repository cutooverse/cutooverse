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

export const sfx = {
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
