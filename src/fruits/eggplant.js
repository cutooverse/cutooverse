// Eggplant: long, glossy and near-black purple, fat at the far end and slim under the green calyx
// (+x); inside, spongy cream flesh with small tan seeds toward the middle.
import { lumps, spindle, belly } from "../fruitkit.js";

const A = [0.105, 0.046, 0.046];
const neck = belly(-0.5, 0.7, 0.45), prof = u => (1 - u * u) ** 0.30 * neck(u);
const WID = /* glsl */`
  float prof(float u) { return pow(max(1.0 - u * u, 0.0), 0.30) * (1.0 - 0.45 * smoothstep(-0.5, 0.7, u)); }
  float rn(vec3 p) { return length(p.yz) / (AX.y * prof(clamp(p.x / AX.x, -0.98, 0.98))); }`;
const cap = (u, ang) => Math.min(1, Math.max(0, (u - 0.70 + 0.11 * Math.max(0, Math.cos(5 * ang)) ** 2) / 0.03));   // the calyx and its five points

const SKIN = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, ang = atan(p.z, p.y), tone = fbm(p * 14.0);
    col = mix(lin(vec3(0.05, 0.01, 0.08)), lin(vec3(0.20, 0.04, 0.24)), smoothstep(0.3, 0.75, tone));
    float leaf = pow(max(cos(5.0 * ang), 0.0), 2.0);
    float green = clamp((u - 0.70 + 0.11 * leaf) / 0.03, 0.0, 1.0);
    col = mix(col, lin(vec3(0.80, 0.84, 0.66)), smoothstep(0.62, 0.72, u + 0.11 * leaf) * (1.0 - green) * 0.6);   // pale where the calyx shaded it
    vec3 gc = mix(lin(vec3(0.16, 0.30, 0.08)), lin(vec3(0.36, 0.50, 0.16)), fbm(vec3(ang * 9.0, u * 30.0, 2.0)));
    col = mix(col, gc, green);
    rough = mix(0.10, 0.7, green);
    h = tone * 0.15 + green * 0.8;
  }`;

const FLESH = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float r = rn(p), g = fbm(p * 180.0);
    col = mix(lin(vec3(0.97, 0.96, 0.84)), lin(vec3(0.90, 0.92, 0.70)), smoothstep(0.55, 0.97, r));
    col *= 0.90 + 0.14 * g;                                                // spongy
    vec3 w = worley(p * 330.0);
    float band = smoothstep(0.10, 0.25, r) * smoothstep(0.78, 0.60, r) * smoothstep(0.35, 0.60, fbm(p * 45.0));
    float seed = smoothstep(0.22, 0.13, w.x) * band;                       // seeds in soft swirls
    col = mix(col, lin(vec3(0.72, 0.58, 0.32)), seed);
    col = mix(col, lin(vec3(0.82, 0.76, 0.52)), band * 0.25);
    col = mix(col, lin(vec3(0.16, 0.03, 0.20)), smoothstep(0.972, 0.995, r));        // the skin, edge on
    rough = 0.55;
    h = g * 0.5 - seed * 0.4;
  }`;

const shape = spindle(A, prof);
export default {
  name: { en: "Eggplant", fa: "بادمجان" }, axes: A, juice: 0xe6e3c0, tint: 0x5a1a6e,
  radius(rnd) {
    const L = lumps(rnd, 10, 0.012, 0.2, 0.5);
    return v => 1 + L(v) + 0.06 * cap(v.x, Math.atan2(v.z, v.y)) + 0.20 * Math.exp(-(1 - v.x) / 0.003);   // the calyx sits proud; a stub of stem
  },
  ...shape,
  post(p, AX, v) { shape.post(p, AX, v); const x = p.x / AX[0]; p.z += 0.010 * (x * x - 0.35); },    // a slight curve
  skin: SKIN, flesh: FLESH,
};
