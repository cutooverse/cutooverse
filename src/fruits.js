// The fruit, ported from chicken/blender/procedural.py: the same radius formulas for the shape, and
// the Blender node shaders rewritten as GLSL. Every shader reads 'opos' (where a point sat in the
// whole fruit, in the fruit's own frame: x along the stem, z up), so a cut face anywhere shows the
// right patch of the inside.
import * as THREE from "three";
import { icosphere, volumeAndCentre } from "./slice.js";
import { perf } from "./perf.js";

export const MAXP = 160;                     // cut lines drawn on a fruit (more still count): phones cap fragment uniforms

export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gaussOf = rnd => () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
function lumps(rnd, n, sigma, w0, w1) {
  const g = gaussOf(rnd), list = [];
  for (let i = 0; i < n; i++) list.push([new THREE.Vector3(g(), g(), g()).normalize(), g() * sigma, w0 + rnd() * (w1 - w0)]);
  return v => list.reduce((s, [d, a, w]) => s + a * Math.exp(-(1 - v.dot(d)) / w), 0);
}
const sm = (e0, e1, t) => { const x = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return x * x * (3 - 2 * x); };
const v3 = c => `vec3(${c.map(x => x.toFixed(3)).join(", ")})`;

// ------------------------------------------------------------------ GLSL
const LIB = /* glsl */`
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  vec3 seg(vec3 a, vec3 b, float t, float t0, float t1) { return mix(a, b, clamp((t - t0) / (t1 - t0), 0.0, 1.0)); }
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
  // x: distance to the nearest cell point, y: that cell's random id, z: distance to the cell edge
  vec3 worley(vec3 p) {
    vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(x, y, z), r = g + hash33(i + g) - f; float dd = dot(r, r);
      if (dd < d1) { d2 = d1; d1 = dd; id = hash13(i + g + 7.7); } else if (dd < d2) d2 = dd;
    }
    return vec3(sqrt(d1), id, (sqrt(d2) - sqrt(d1)) * 0.5);
  }
  vec3 bumpNormal(vec3 surfPos, vec3 n, vec2 dHdxy, float faceDir) {
    vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * faceDir;
    return normalize(abs(det) * n - sign(det) * (dHdxy.x * r1 + dHdxy.y * r2));
  }
`;

const citrusSkin = (lo, hi, pore) => /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float n = fbm(p * 16.0);
    col = mix(lin(${v3(lo)}), lin(${v3(hi)}), smoothstep(0.3, 0.7, n));
    vec3 w = worley(p * 520.0);                       // oil-gland pits
    float pit = smoothstep(0.30, 0.05, w.x);
    col = mix(col, lin(${v3(pore)}), pit * 0.45);
    col = mix(col, lin(vec3(0.40, 0.42, 0.14)), smoothstep(AX.x * 0.93, AX.x * 0.97, p.x));   // stem scar
    rough = 0.36 + pit * 0.12;
    h = w.x * 0.9;
  }`;

const citrusFlesh = (a, b, tint, zest, pith, seeds) => /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float wob = fbm(p * 30.0);
    float rr = length(p / AX) + wob * 0.04 - 0.02;
    float ax = length(p.yz);
    float angw = atan(p.z, p.y) + wob * 0.4;
    float mem = smoothstep(0.0012, 0.0005, abs(sin(angw * 5.0)) * ax);   // ten segment walls
    float core = smoothstep(0.0065, 0.0040, ax);
    float pith = max(max(mem, core), smoothstep(${pith[0].toFixed(3)}, ${pith[1].toFixed(3)}, rr));
    vec3 v = worley(vec3(ax * 140.0, angw * ax * 420.0, p.x * 420.0));   // juice sacs run outward
    vec3 pulp = mix(lin(${v3(a)}), lin(${v3(b)}), smoothstep(0.1, 0.65, v.x));
    pulp = mix(pulp, lin(${v3(tint)}), v.y * 0.3);
    ${seeds ? `float sd = smoothstep(0.16, 0.10, worley(p * 70.0).x) * smoothstep(0.55, 0.40, rr);
    pulp = mix(pulp, lin(vec3(0.92, 0.88, 0.70)), sd);` : ""}
    vec3 pc = mix(lin(vec3(0.98, 0.94, 0.82)), lin(${v3(zest)}), smoothstep(0.955, 0.975, rr));
    col = mix(pulp, pc, pith);
    rough = mix(0.14, 0.6, pith);
    h = (1.0 - pith) * -v.x;
  }`;

const KIWI_SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    col = mix(lin(vec3(0.33, 0.21, 0.10)), lin(vec3(0.56, 0.40, 0.21)), smoothstep(0.30, 0.72, fbm(p * 40.0)));
    float hair = vnoise(p * 900.0);
    col *= 0.8 + 0.35 * hair;
    col = mix(col, lin(vec3(0.15, 0.09, 0.05)), smoothstep(AX.x * 0.90, AX.x * 0.99, p.x));
    rough = 0.85;
    h = hair * 0.6;
  }`;

const KIWI_FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float xn = p.x / AX.x;
    float rn = length(p.yz / AX.yz) / sqrt(max(1.0 - xn * xn, 0.04));     // follows the egg's taper
    float wob = fbm(p * 60.0);
    float rr = rn + wob * 0.08 - 0.04;
    col = lin(vec3(0.94, 0.92, 0.74));                                        // cream core
    col = seg(col, lin(vec3(0.90, 0.90, 0.62)), rr, 0.0, 0.20);
    col = seg(col, lin(vec3(0.62, 0.80, 0.22)), rr, 0.20, 0.30);
    col = seg(col, lin(vec3(0.42, 0.72, 0.08)), rr, 0.30, 0.50);
    col = seg(col, lin(vec3(0.36, 0.64, 0.06)), rr, 0.50, 0.85);
    col = seg(col, lin(vec3(0.30, 0.52, 0.07)), rr, 0.85, 0.97);
    float ang = atan(p.z, p.y);
    float ray = smoothstep(0.75, 1.0, sin((wob * 1.5 + ang) * 34.0)) * smoothstep(0.75, 0.25, rr) * 0.45;
    col = mix(col, lin(vec3(0.84, 0.90, 0.60)), ray);
    vec3 w = worley(p * 420.0);                                               // black seeds in a ring
    float s = smoothstep(0.42, 0.30, w.x) * smoothstep(0.26, 0.31, rr) * smoothstep(0.50, 0.42, rr);
    col = mix(col, vec3(0.002), s);
    rough = 0.18;
    h = vnoise(p * 500.0) * 0.5 - s;
  }`;

const MELON_SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.125 / AX.x;                                                   // patterns sized as on the 25 cm melon
    float ang = atan(p.z, p.y);
    float rag = fbm(p * 30.0 * k);
    float a = rag * 0.9 + sin(p.x * 40.0 * k) * 0.12 + ang;
    float st = smoothstep(-0.15, 0.25, sin(a * 8.0));
    col = mix(lin(vec3(0.34, 0.54, 0.18)), lin(vec3(0.04, 0.16, 0.04)), st);
    float mott = fbm(p * 120.0 * k);
    col *= 0.85 + 0.27 * mott;
    float spot = smoothstep(-0.66 * AX.z, -0.87 * AX.z, p.z) * rag * 1.6;  // field spot on the belly
    col = mix(col, lin(vec3(0.66, 0.62, 0.28)), clamp(spot, 0.0, 1.0));
    rough = 0.5;
    h = mott * 0.5;
  }`;

const MELON_FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.125 / AX.x;
    float rr = length(p / AX);
    col = lin(vec3(0.86, 0.08, 0.10));
    col = seg(col, lin(vec3(0.90, 0.12, 0.12)), rr, 0.0, 0.70);
    col = seg(col, lin(vec3(0.92, 0.30, 0.26)), rr, 0.70, 0.82);
    col = seg(col, lin(vec3(0.92, 0.70, 0.62)), rr, 0.82, 0.87);
    col = seg(col, lin(vec3(0.92, 0.92, 0.78)), rr, 0.87, 0.90);
    col = seg(col, lin(vec3(0.62, 0.78, 0.42)), rr, 0.90, 0.955);
    col = seg(col, lin(vec3(0.06, 0.22, 0.06)), rr, 0.955, 0.985);
    vec3 g = worley(p * 260.0 * k);
    col *= 0.85 + 0.27 * g.x;                                                 // crystalline grain
    float s = smoothstep(0.17, 0.13, worley(p * 44.0 * k).x) * smoothstep(0.40, 0.50, rr) * smoothstep(0.76, 0.66, rr);
    col = mix(col, vec3(0.002), s);
    rough = mix(0.16, 0.5, smoothstep(0.86, 0.92, rr));
    h = g.x * 0.6 - s;
  }`;

const POM_SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    col = mix(lin(vec3(0.56, 0.05, 0.07)), lin(vec3(0.80, 0.12, 0.10)), smoothstep(0.30, 0.70, fbm(p * 18.0)));
    col = mix(col, lin(vec3(0.84, 0.42, 0.24)), smoothstep(0.55, 0.72, fbm(p * 7.0)) * 0.45);
    vec3 w = worley(p * 260.0);
    col = mix(col, lin(vec3(0.20, 0.05, 0.04)), smoothstep(0.10, 0.04, w.x) * 0.6);
    col = mix(col, lin(vec3(0.36, 0.14, 0.07)), smoothstep(AX.x * 0.95, AX.x * 1.10, p.x));   // dry crown
    rough = 0.42;
    h = fbm(p * 220.0) * 0.5;
  }`;

const POM_FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float wob = fbm(p * 30.0);
    float rr = length(p / AX) + wob * 0.08 - 0.04;
    float ax = length(p.yz);
    float angw = atan(p.z, p.y) + wob * 1.2;
    float mem = smoothstep(0.0015, 0.0006, abs(sin(angw * 3.0)) * ax);       // six membranes
    float core = smoothstep(0.0085, 0.0055, ax);
    float pith = max(max(mem, core), smoothstep(0.84, 0.88, rr));
    vec3 w = worley(p * 170.0);                                               // one cell per aril
    vec3 aril = mix(lin(vec3(0.88, 0.06, 0.16)), lin(vec3(0.58, 0.02, 0.09)), smoothstep(0.10, 0.60, w.x));
    aril = mix(aril, lin(vec3(0.42, 0.01, 0.06)), w.y * 0.35);
    aril = mix(aril, lin(vec3(0.94, 0.80, 0.74)), smoothstep(0.16, 0.08, w.x) * 0.7);   // pale seed
    aril = mix(aril, lin(vec3(0.20, 0.01, 0.03)), smoothstep(0.07, 0.0, w.z));        // dark gaps
    vec3 pc = seg(lin(vec3(0.92, 0.84, 0.64)), lin(vec3(0.82, 0.44, 0.30)), rr, 0.80, 0.99);
    col = mix(aril, pc, pith);
    rough = mix(0.12, 0.6, pith);
    h = (1.0 - pith) * -w.x;
  }`;

// ------------------------------------------------------------------ the fruit table
export const FRUITS = {
  orange: {
    name: { en: "Orange", fa: "پرتقال" }, axes: [0.054, 0.056, 0.056], juice: 0xff9a1a, tint: 0xff7a10,
    radius(rnd) { const L = lumps(rnd, 10, 0.010, 0.2, 0.5); return v => 1 + L(v) - 0.035 * Math.exp(-(1 - v.x) / 0.003) - 0.025 * Math.exp(-(1 + v.x) / 0.004); },
    skin: citrusSkin([0.80, 0.25, 0.0], [0.95, 0.40, 0.01], [0.62, 0.17, 0.0]),
    flesh: citrusFlesh([1.0, 0.50, 0.03], [0.82, 0.24, 0.0], [1.0, 0.62, 0.12], [1.0, 0.52, 0.04], [0.86, 0.89], false),
  },
  lemon: {
    name: { en: "Lemon", fa: "لیمو" }, axes: [0.064, 0.046, 0.046], juice: 0xffe45c, tint: 0xffe030,
    radius(rnd) {
      const L = lumps(rnd, 10, 0.012, 0.2, 0.5);
      return v => 1 + L(v) + 0.16 * Math.exp(-(1 + v.x) / 0.012) + 0.07 * Math.exp(-(1 - v.x) / 0.010) - 0.03 * Math.exp(-(1 - v.x) / 0.0015);
    },
    skin: citrusSkin([0.90, 0.68, 0.02], [1.0, 0.86, 0.12], [0.76, 0.55, 0.0]),
    flesh: citrusFlesh([1.0, 0.94, 0.46], [0.90, 0.78, 0.20], [1.0, 0.97, 0.62], [0.98, 0.82, 0.10], [0.90, 0.93], true),
  },
  kiwi: {
    name: { en: "Kiwi", fa: "کیوی" }, axes: [0.055, 0.042, 0.040], juice: 0x8fd13a, tint: 0x7bc030,
    radius(rnd) { const L = lumps(rnd, 12, 0.015, 0.15, 0.4); return v => 1 + L(v) - 0.06 * Math.exp(-(1 - v.x) / 0.004) + 0.035 * Math.exp(-(1 + v.x) / 0.002); },
    post(p, A) { const x = p.x / A[0]; p.y *= 1 + 0.07 * x; p.z *= 1 + 0.07 * x; if (p.z < 0) p.z *= 0.95; },
    skin: KIWI_SKIN, flesh: KIWI_FLESH,
  },
  watermelon: {
    name: { en: "Watermelon", fa: "هندوانه" }, axes: [0.088, 0.069, 0.066], juice: 0xe8303a, tint: 0xd8202e,
    radius(rnd) { const L = lumps(rnd, 10, 0.012, 0.2, 0.5); return v => 1 + L(v); },
    post(p) { if (p.z < 0) p.z *= 0.94; },
    skin: MELON_SKIN, flesh: MELON_FLESH,
  },
  pomegranate: {
    name: { en: "Pomegranate", fa: "انار" }, axes: [0.058, 0.060, 0.060], juice: 0xb0102a, tint: 0xc01030,
    radius(rnd) {
      const L = lumps(rnd, 10, 0.014, 0.2, 0.5);
      return v => {
        const th = Math.acos(Math.max(-1, Math.min(1, v.x))), ph = Math.atan2(v.z, v.y);
        let r = 1 + L(v) + 0.012 * Math.cos(6 * ph + 0.3) * Math.sin(th) ** 2;
        r += 0.16 * sm(0.42, 0.20, th);                                       // the neck
        r += 0.12 * (0.5 + 0.5 * Math.cos(6 * ph)) ** 2.5 * sm(0.08, 0.15, th) * sm(0.24, 0.16, th);   // sepals
        return r - 0.20 * sm(0.13, 0.03, th);                                 // sunken centre
      };
    },
    skin: POM_SKIN, flesh: POM_FLESH,
  },
};
for (const [id, f] of Object.entries(FRUITS)) f.id = id;
export const FRUIT_IDS = Object.keys(FRUITS);

// A whole fruit as a soup. Positions are scaled by `scale`; opos keeps the fruit's own size, so the
// shaders do not care how big it is drawn.
export function buildSoup(fruit, seed, scale = 1) {
  if (fruit.soup) {                                    // a body built elsewhere (your photo): copy it
    const s = fruit.soup, P = Float32Array.from(s.P, v => v * scale);
    return { P, N: s.N.slice(), O: s.O.slice(), M: s.M.slice(), V: volumeAndCentre(P).V };
  }
  const { verts, faces } = icosphere(perf.ico || 5);
  const radius = fruit.radius(mulberry32(seed * 7919 + 13));
  const A = fruit.axes;
  const pos = verts.map(v => {
    const p = new THREE.Vector3(v.x * A[0], v.y * A[1], v.z * A[2]).multiplyScalar(radius(v));
    fruit.post?.(p, A);
    return p;
  });
  const nrm = pos.map(() => new THREE.Vector3());
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (const [a, b, c] of faces) {
    e1.subVectors(pos[b], pos[a]); e2.subVectors(pos[c], pos[a]); fn.crossVectors(e1, e2);
    nrm[a].add(fn); nrm[b].add(fn); nrm[c].add(fn);
  }
  nrm.forEach(n => n.normalize());
  const T = faces.length, P = new Float32Array(T * 9), N = new Float32Array(T * 9), O = new Float32Array(T * 9), M = new Uint8Array(T);
  faces.forEach((f, t) => f.forEach((vi, k) => {
    const o = t * 9 + k * 3, p = pos[vi], n = nrm[vi];
    P[o] = p.x * scale; P[o + 1] = p.y * scale; P[o + 2] = p.z * scale;
    N[o] = n.x; N[o + 1] = n.y; N[o + 2] = n.z;
    O[o] = p.x; O[o + 1] = p.y; O[o + 2] = p.z;
  }));
  return { P, N, O, M, V: volumeAndCentre(P).V };
}

// ------------------------------------------------------------------ materials
// One pair (skin, flesh) per fruit, look and stage slot: each slot carries its own cut lines.
const cache = new Map();
export function fruitMaterials(fruitId, glass, slot) {
  const key = `${fruitId}|${glass}|${slot}`;
  if (!cache.has(key)) cache.set(key, { skin: make(FRUITS[fruitId], "skin", glass), flesh: make(FRUITS[fruitId], "flesh", glass) });
  return cache.get(key);
}

// a new photo replaces the old one: drop its materials so they are built with the new picture
export function forgetMaterials(fruitId) {
  for (const [k, v] of cache) if (k.startsWith(fruitId + "|")) { v.skin.dispose(); v.flesh.dispose(); cache.delete(k); }
}

function make(fruit, part, glass) {
  const U = {
    uPl: { value: Array.from({ length: MAXP }, () => new THREE.Vector4()) },
    uPn: { value: 0 },
    uInv: { value: 1 },
    uLineW: { value: 0.0003 },
  };
  const mat = glass
    ? new THREE.MeshPhysicalMaterial({ transmission: 0.9, thickness: 0.05, ior: 1.42, roughness: 0.05, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.04, attenuationColor: new THREE.Color(fruit.tint), attenuationDistance: 0.09 })
    : part === "flesh" && perf.clearcoat !== false ? new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.12 })
      : new THREE.MeshStandardMaterial({ roughness: 0.4 });
  mat.userData.U = U;
  const ax = fruit.axes.map(v => v.toFixed(4)).join(", ");
  const bumpScale = part === "flesh" ? 0.012 : 0.02;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, fruit.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        #ifdef USE_INSTANCING
        attribute vec3 iOff;
        #else
        attribute vec3 opos;
        #endif
        uniform float uInv;
        varying vec3 vOpos;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vOpos = iOff + position * uInv;
        #else
        vOpos = opos;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        const vec3 AX = vec3(${ax});
        uniform vec4 uPl[${MAXP}];
        uniform int uPn;
        uniform float uLineW;
        varying vec3 vOpos;
        ${LIB}
        ${fruit[part]}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 fCol; float fRough; float fH;
        shade(vOpos, fCol, fRough, fH);
        diffuseColor.rgb = ${glass ? "mix(fCol, vec3(1.0), 0.15)" : "fCol"};
        float fLine = 0.0;
        for (int i = 0; i < ${MAXP}; i++) {
          if (i >= uPn) break;
          float dd = dot(vOpos, uPl[i].xyz) - uPl[i].w;
          float fw = fwidth(dd);
          fLine = max(fLine, 1.0 - smoothstep(uLineW, uLineW + fw, abs(dd) - fw * 0.25));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), fLine * 0.85);`)
      .replace("#include <roughnessmap_fragment>", `float roughnessFactor = ${glass ? "0.05" : "fRough"};`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.96, 0.88) * fLine * 0.7;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        normal = bumpNormal(-vViewPosition, normal, vec2(dFdx(fH), dFdy(fH)) * ${(glass ? bumpScale * 0.4 : bumpScale).toFixed(4)}, faceDirection);`);
  };
  mat.customProgramCacheKey = () => `${fruit.id}-${fruit.variant || ""}-${part}-${glass}`;
  return mat;
}
