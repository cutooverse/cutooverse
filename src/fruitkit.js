// Small helpers shared by every fruit module (src/fruits.js and src/fruits/*.js).
import * as THREE from "three";

export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const gaussOf = rnd => () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

// soft random bumps on a unit-sphere direction v: n bumps of size ~sigma and width w0..w1
// (the same as the Blender code's `r += normal(0, sigma) * exp(-(1 - v.d) / uniform(w0, w1))`)
export function lumps(rnd, n, sigma, w0, w1) {
  const g = gaussOf(rnd), list = [];
  for (let i = 0; i < n; i++) list.push([new THREE.Vector3(g(), g(), g()).normalize(), g() * sigma, w0 + rnd() * (w1 - w0)]);
  return v => list.reduce((s, [d, a, w]) => s + a * Math.exp(-(1 - v.dot(d)) / w), 0);
}

// smoothstep that also runs downhill when e0 > e1 (as Blender's Map Range with From Min > From Max)
export const sm = (e0, e1, t) => { const x = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return x * x * (3 - 2 * x); };

// a JS colour [r, g, b] (sRGB 0..1) as a GLSL vec3 literal; wrap it in lin() inside shaders
export const v3 = c => `vec3(${c.map(x => x.toFixed(3)).join(", ")})`;

// A body of revolution about x whose radius along its length is prof(u) times the fruit's half-width,
// from u = -1 (the far end) to u = 1 (the stem): the squeeze for the mesh (post), and the same shape
// for counting its pieces and filling it with cubes (inside, shell, vol), which otherwise take the
// fruit for an ellipsoid. belly(e0, e1, d): full up to e0, slimmer by d from e1 on (a pear's neck).
export const belly = (e0, e1, d) => u => { const x = Math.min(1, Math.max(0, (u - e0) / (e1 - e0))); return 1 - d * x * x * (3 - 2 * x); };
export function spindle(axes, prof) {
  const [a, b, c] = axes, clamp = u => Math.max(-0.995, Math.min(0.995, u));
  const lim = x => prof(clamp(x / a)) ** 2;
  const w = u => prof(u) / Math.sqrt(1 - u * u);      // against the sphere the mesh starts from
  const sdf = (x, y, z) => Math.max(Math.hypot(y, z * b / c) - b * Math.sqrt(lim(x)), Math.abs(x) - a);
  let vol = 0;
  for (let i = 0; i < 200; i++) vol += Math.PI * b * c * prof(-1 + (i + 0.5) / 100) ** 2 * a / 100;
  return {
    post(p, A, v) { const k = w(clamp(v.x)); p.y *= k; p.z *= k; },
    inside: (x, y, z) => Math.abs(x) < a && (y / b) ** 2 + (z / c) ** 2 <= 0.94 * lim(x),
    shell: (x, y, z, e) => sdf(x, y, z) > -1.3 * e,
    vol,
  };
}
