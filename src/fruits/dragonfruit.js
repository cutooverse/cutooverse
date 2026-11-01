// Dragon fruit (pitaya), ported from chicken/blender/procedural.py (_dragon_mesh, _dragon_skin,
// _dragon_flesh). The leafy bracts are pure displacement of the body, so the radial path keeps it
// closed; length(opos / axes) is ~1 on the body and up to ~1.17 at a bract tip.
import * as THREE from "three";
import { lumps, gaussOf } from "../fruitkit.js";

const BRACTS = 34;

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float sk = length(p / AX);
    float n = fbm(p * 20.0);
    col = seg(lin(vec3(0.72, 0.03, 0.30)), lin(vec3(0.90, 0.06, 0.40)), n, 0.30, 0.70);   // hot pink
    float tf = clamp(smoothstep(1.06, 1.15, sk) + n * 0.3 - 0.15, 0.0, 1.0);   // bract tips, ragged edge
    col = mix(col, mix(lin(vec3(0.60, 0.36, 0.12)), lin(vec3(0.38, 0.58, 0.08)), tf), tf);
    rough = 0.35;
    h = fbm(p * 300.0) * 0.3;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float rr = length(p / AX) + fbm(p * 40.0) * 0.04 - 0.02;
    col = lin(vec3(0.96, 0.95, 0.91));                                        // white flesh
    col = seg(col, lin(vec3(0.94, 0.93, 0.89)), rr, 0.0, 0.88);
    col = seg(col, lin(vec3(0.92, 0.70, 0.78)), rr, 0.88, 0.91);              // pink blush at the rind's edge
    col = seg(col, lin(vec3(0.82, 0.10, 0.40)), rr, 0.91, 0.93);              // magenta rind (the bracts are rind too)
    col = seg(col, lin(vec3(0.74, 0.06, 0.34)), rr, 0.93, 1.0);
    float s = smoothstep(0.27, 0.19, worley(p * 380.0).x) * smoothstep(0.88, 0.84, rr);   // tiny black seeds
    col = mix(col, vec3(0.002), s);
    rough = 0.2;
    h = fbm(p * 350.0) * 0.24 + s * 0.6;                                      // seeds sit a little proud
  }`;

export default {
  name: { en: "Dragon fruit", fa: "دراگون‌فروت" }, axes: [0.066, 0.050, 0.052], juice: 0xf2e0e6, tint: 0xf5f2e8,
  radius(rnd) {
    const L = lumps(rnd, 10, 0.012, 0.2, 0.5), g = gaussOf(rnd), X = new THREE.Vector3(1, 0, 0), bracts = [];
    for (let i = 0; i < BRACTS; i++) {                 // centres on a jittered Fibonacci spiral, off the very ends
      const k = i + 0.5;
      const cx = Math.min(0.82, Math.max(-0.82, 1 - 2 * k / BRACTS + g() * 0.03));
      const ca = k * Math.PI * (3 - Math.sqrt(5)) + g() * 0.15, sr = Math.sqrt(1 - cx * cx);
      const c = new THREE.Vector3(cx, sr * Math.cos(ca), sr * Math.sin(ca));
      const ta = X.clone().addScaledVector(c, -cx).normalize();             // tangent toward the stem
      bracts.push({ c, ta, tb: new THREE.Vector3().crossVectors(c, ta),
        L: 0.20 + 0.06 * rnd(), T: 0.16 + 0.06 * rnd(), w: 0.22 + 0.06 * rnd(), a: 0.13 + 0.05 * rnd() });   // base behind, tip ahead
    }
    const d = new THREE.Vector3();
    return v => {
      let lift = 0;
      for (const b of bracts) {
        if (v.dot(b.c) <= 0.5) continue;
        d.subVectors(v, b.c);
        const s = d.dot(b.ta);                         // along the bract
        if (s <= -b.L || s >= b.T) continue;
        const f = (s + b.L) / (b.L + b.T);             // 0 at the base, 1 at the tip
        const width = b.w * (1 - f) ** 0.8 * Math.min(1, 3 * f) ** 0.5;
        const inside = Math.max(0, 1 - Math.abs(d.dot(b.tb)) / Math.max(width, 1e-4)) ** 0.3;   // broad leaf
        lift = Math.max(lift, b.a * f ** 1.2 * inside);
      }
      return 1 + L(v) + lift;
    };
  },
  skin: SKIN, flesh: FLESH,
};
