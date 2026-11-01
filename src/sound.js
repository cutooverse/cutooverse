// Every sound is made on the fly with Web Audio: no files to load. Plus phone vibration.
let ctx = null, master = null, NOISE = null;
export const sound = { on: true, haptics: true, strength: "normal" };

export function unlock() {
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
const ready = () => ctx && ctx.state === "running";

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
  const t = ctx.currentTime + at;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur * (curve >= 3 ? 0.7 : 1));   // the old fade-out curve, roughly
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * (1 - Math.min(dur, 0.9)), dur + 0.01);
}

function tone(freq, dur, { type = "sine", gain = 0.3, at = 0, to = freq } = {}) {
  if (!sound.on || !unlock() || !ready()) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  swish() { noise(0.18, { f0: 5200, f1: 900, q: 1.2, gain: 0.45 }); },
  slice() { noise(0.12, { f0: 900, f1: 300, q: 0.8, gain: 0.8 }); noise(0.07, { f0: 2600, f1: 1800, q: 3, gain: 0.22 }); },
  chop(i = 0, at = 0) {                               // knife through fruit into the board, `at` s from now
    const p = 1 + ((i * 37) % 11 - 5) * 0.02;
    noise(0.05, { f0: 3200 * p, f1: 1400, q: 0.9, gain: 0.35, at });
    noise(0.06, { type: "lowpass", f0: 900, f1: 300, gain: 0.7, at });
    tone(150 * p, 0.07, { gain: 0.35, to: 80, at });
  },
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
