// Potato, ported from chicken/blender/procedural.py (_potato_mesh, _potato_skin, _potato_flesh).
// The Blender one is 22 cm long; here it is shrunk to fit the board, and the shaders scale their
// pattern sizes with it (k), so it looks like the same potato, smaller.
import * as THREE from "three";
import { lumps, gaussOf } from "../fruitkit.js";

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.110 / AX.x;                                                   // patterns sized as on the 22 cm potato
    float n = fbm(p * 16.0 * k);
    col = seg(lin(vec3(0.46, 0.31, 0.17)), lin(vec3(0.74, 0.55, 0.33)), n, 0.28, 0.72);
    float net = fbm(p * 320.0 * k);                                           // russet netting
    col = mix(col, lin(vec3(0.35, 0.23, 0.13)), clamp((net - 0.45) / 0.25, 0.0, 1.0) * 0.55);
    float spk = smoothstep(0.11, 0.05, worley(p * 90.0 * k).x) * 0.75;        // lenticels
    col = mix(col, lin(vec3(0.30, 0.20, 0.12)), spk);
    float eye = smoothstep(0.12, 0.03, worley(p * 26.0 * k).x);               // sparse eye dimples
    col = mix(col, lin(vec3(0.38, 0.25, 0.15)), eye * 0.6);
    rough = mix(0.88, 0.70, n);
    h = (net - 1.2 * eye) * 0.8;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.110 / AX.x;
    float rr = length(p / AX) + fbm(p * 30.0 * k) * 0.10 - 0.05;
    col = lin(vec3(0.92, 0.83, 0.53));                                        // pale translucent core
    col = seg(col, lin(vec3(0.87, 0.74, 0.39)), rr, 0.0, 0.45);
    col = seg(col, lin(vec3(0.86, 0.72, 0.38)), rr, 0.45, 0.78);
    col = seg(col, lin(vec3(0.71, 0.60, 0.30)), rr, 0.78, 0.86);              // vascular ring under the skin
    col = seg(col, lin(vec3(0.86, 0.72, 0.38)), rr, 0.86, 0.93);
    col = seg(col, lin(vec3(0.80, 0.67, 0.35)), rr, 0.93, 1.05);
    float g = fbm(p * 420.0 * k);
    col *= 0.93 + 0.10 * g;                                                   // starch grain
    rough = 0.30;
    h = g * 0.35;
  }`;

export default {
  name: { en: "Potato", fa: "سیب‌زمینی" }, axes: [0.080, 0.0524, 0.0436], juice: 0xede8d6, tint: 0xdebd63,
  radius(rnd) {
    const L = lumps(rnd, 22, 0.065, 0.06, 0.30), g = gaussOf(rnd);
    const eyes = Array.from({ length: 10 }, () => [new THREE.Vector3(g(), g(), g()).normalize(), 0.03 + 0.02 * rnd()]);   // shallow eye dents
    return v => 1 + L(v) - eyes.reduce((s, [d, a]) => s + a * Math.exp(-(1 - v.dot(d)) / 0.006), 0);
  },
  post(p, A) {                                         // one end fatter, a gentle kidney bend, flatter underside
    const x = p.x / A[0];
    p.y *= 1 + 0.08 * x; p.z *= 1 + 0.06 * x;
    p.z += 0.012 * (A[0] / 0.110) * (x * x - 0.4);
    if (p.z < 0) p.z *= 0.88;
  },
  skin: SKIN, flesh: FLESH,
};
