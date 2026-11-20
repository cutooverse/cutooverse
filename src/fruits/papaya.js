// Papaya: a long yellow-orange fruit still green in patches, fuller at the far end; inside, thick
// salmon flesh round a hollow packed with black seeds. Stem at +x.
import { lumps, spindle, belly } from "../fruitkit.js";

const A = [0.092, 0.050, 0.050];
const neck = belly(-0.3, 0.9, 0.26), prof = u => (1 - u * u) ** 0.32 * neck(u);
const WID = /* glsl */`
  float prof(float u) { return pow(max(1.0 - u * u, 0.0), 0.32) * (1.0 - 0.26 * smoothstep(-0.3, 0.9, u)); }
  float rn(vec3 p) { return length(p.yz) / (AX.y * prof(clamp(p.x / AX.x, -0.98, 0.98))); }`;

const SKIN = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, tone = fbm(p * 12.0);
    col = mix(lin(vec3(0.96, 0.58, 0.08)), lin(vec3(0.98, 0.76, 0.16)), tone);
    float green = smoothstep(0.45, 0.72, fbm(p * 7.0 + 5.0) + 0.25 * u);   // unripe patches, more toward the stem
    col = mix(col, mix(lin(vec3(0.20, 0.38, 0.08)), lin(vec3(0.46, 0.58, 0.14)), tone), green * 0.85);
    col = mix(col, lin(vec3(0.60, 0.38, 0.10)), smoothstep(0.10, 0.05, worley(p * 120.0).x) * 0.4);   // freckles
    col = mix(col, lin(vec3(0.30, 0.24, 0.10)), smoothstep(0.007, 0.002, length(p.yz)) * step(0.0, p.x));
    rough = 0.34;
    h = tone * 0.25;
  }`;

const FLESH = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, r = rn(p), g = fbm(p * 200.0);
    float ang = atan(p.z, p.y);
    float hole = 0.46 * (1.0 + 0.10 * cos(5.0 * ang)) * smoothstep(0.93, 0.50, abs(u + 0.08));   // a five-sided hollow, closed at both ends
    col = mix(lin(vec3(0.95, 0.30, 0.08)), lin(vec3(0.99, 0.48, 0.14)), smoothstep(hole, 0.9, r));
    col = mix(col, lin(vec3(0.94, 0.76, 0.26)), smoothstep(0.90, 0.96, r));           // paler under the skin
    col = mix(col, lin(vec3(0.38, 0.52, 0.12)), smoothstep(0.965, 0.995, r));
    col *= 0.94 + 0.08 * g;
    float hol = smoothstep(hole + 0.02, hole - 0.03, r);
    vec3 w = worley(p * 250.0);                                            // one cell a seed
    vec3 sd = mix(vec3(0.004), lin(vec3(0.20, 0.22, 0.17)), smoothstep(0.30, 0.05, w.x) * 0.6);   // black, with a wet sheen
    sd = mix(sd, lin(vec3(0.62, 0.22, 0.05)), smoothstep(0.06, 0.0, w.z));            // the pulp between them
    col = mix(col, sd, hol);
    rough = mix(0.24, 0.10, hol);
    h = mix(g * 0.3, 1.2 - w.x * 2.0, hol);
  }`;

export default {
  name: { en: "Papaya", fa: "پاپایا" }, axes: A, juice: 0xff8a2a, tint: 0xf5701a,
  radius(rnd) {
    const L = lumps(rnd, 9, 0.012, 0.2, 0.5);
    return v => 1 + L(v) + 0.012 * Math.cos(5 * Math.atan2(v.z, v.y)) - 0.05 * Math.exp(-(1 - v.x) / 0.01);   // five faint ribs, stem dimple
  },
  ...spindle(A, prof),
  skin: SKIN, flesh: FLESH,
};
