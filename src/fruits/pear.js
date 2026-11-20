// Pear: a full belly and a long neck up to the stem (+x), green going yellow with russet freckles;
// inside, white gritty flesh, a small core with seeds low in the belly.
import { lumps, spindle, belly } from "../fruitkit.js";

const A = [0.078, 0.052, 0.052];
const neck = belly(-0.25, 0.55, 0.52), prof = u => (1 - u * u) ** 0.35 * neck(u);
const WID = /* glsl */`
  float prof(float u) { return pow(max(1.0 - u * u, 0.0), 0.35) * (1.0 - 0.52 * smoothstep(-0.25, 0.55, u)); }
  float rn(vec3 p) { return length(p.yz) / (AX.y * prof(clamp(p.x / AX.x, -0.98, 0.98))); }`;

const SKIN = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, tone = fbm(p * 14.0);
    col = mix(lin(vec3(0.50, 0.62, 0.14)), lin(vec3(0.84, 0.80, 0.26)), smoothstep(0.30, 0.72, tone + 0.15 * u));
    col = mix(col, lin(vec3(0.82, 0.36, 0.16)), smoothstep(0.62, 0.90, fbm(p * 6.0 + 9.0)) * smoothstep(0.2, -0.6, u) * 0.6);   // a blush on the belly
    float fr = smoothstep(0.13, 0.05, worley(p * 170.0).x);                // russet freckles
    col = mix(col, lin(vec3(0.46, 0.32, 0.14)), fr * 0.75);
    float net = smoothstep(0.55, 0.80, fbm(p * 60.0)) * smoothstep(0.55, 0.95, abs(u));
    col = mix(col, lin(vec3(0.55, 0.40, 0.18)), net * 0.6);                // russet at both ends
    rough = 0.42 + 0.3 * net;
    h = fr * 0.4 + tone * 0.2;
  }`;

const FLESH = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float r = rn(p), ax = length(p.yz), ang = atan(p.z, p.y);
    float g = fbm(p * 300.0);
    col = mix(lin(vec3(0.99, 0.97, 0.86)), lin(vec3(0.96, 0.94, 0.74)), smoothstep(0.5, 0.98, r));
    col = mix(col, lin(vec3(0.74, 0.80, 0.42)), smoothstep(0.93, 0.99, r) * 0.5);
    vec3 c = (p - vec3(-0.022, 0.0, 0.0)) / vec3(0.022, 0.015, 0.015);     // the core sits low in the belly
    float lc = length(c);
    float grit = smoothstep(0.20, 0.08, worley(p * 420.0).x) * smoothstep(1.9, 0.9, lc);   // stone cells round the core
    col = mix(col, lin(vec3(0.86, 0.80, 0.56)), grit * 0.55);
    col = mix(col, lin(vec3(0.82, 0.78, 0.50)), smoothstep(0.08, 0.02, abs(lc - 1.0)) * 0.6);
    float a5 = mod(ang, 1.2566) - 0.6283;
    vec2 q = ax * vec2(cos(a5), sin(a5));
    float seed = length(vec3((p.x + 0.024) / 0.0075, (q.x - 0.0050) / 0.0030, q.y / 0.0017));
    float sd = smoothstep(1.0, 0.85, seed);
    col = mix(col, lin(vec3(0.16, 0.08, 0.03)), sd);
    col *= 0.95 + 0.07 * g;
    rough = 0.30;
    h = g * 0.3 + grit * 0.4 - sd * 0.6;
  }`;

export default {
  name: { en: "Pear", fa: "گلابی" }, axes: A, juice: 0xf3efd2, tint: 0xb9c23a,
  radius(rnd) {
    const L = lumps(rnd, 9, 0.016, 0.2, 0.5);
    return v => 1 + L(v) - 0.10 * Math.exp(-(1 + v.x) / 0.015) + 0.10 * Math.exp(-(1 - v.x) / 0.004);   // calyx dimple, the stub of the stem
  },
  ...spindle(A, prof),
  skin: SKIN, flesh: FLESH,
};
