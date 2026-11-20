// Tomato: squat and glossy with soft ribs and a green calyx star at the stem (+x); inside, a red
// wall, a pale core and walls between the chambers, each full of gel and seeds.
import { lumps } from "../fruitkit.js";

const CHAMBERS = 5;
const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, ang = atan(p.z, p.y), tone = fbm(p * 18.0);
    col = mix(lin(vec3(0.70, 0.04, 0.02)), lin(vec3(0.92, 0.14, 0.04)), smoothstep(0.25, 0.75, tone));
    col = mix(col, lin(vec3(0.95, 0.42, 0.06)), smoothstep(0.35, 0.95, u) * 0.35);   // orange shoulders
    float leaf = pow(max(cos(5.0 * ang + 0.6), 0.0), 2.0);                 // the calyx: five pointed sepals
    float green = smoothstep(0.022 + 0.020 * leaf, 0.018 + 0.016 * leaf, length(p.yz)) * step(0.0, p.x);
    col = mix(col, mix(lin(vec3(0.10, 0.30, 0.06)), lin(vec3(0.26, 0.50, 0.12)), tone), green);
    rough = mix(0.13, 0.6, green);
    h = tone * 0.15 + green * 0.5;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float xn = p.x / AX.x;
    float rn = length(p.yz / AX.yz) / sqrt(max(1.0 - xn * xn, 0.04));
    float wob = fbm(p * 40.0), ax = length(p.yz);
    float ang = atan(p.z, p.y) + wob * 0.25;
    float rr = rn + wob * 0.06 - 0.03;
    float wall = smoothstep(0.70, 0.78, rr);                               // the outer wall
    float sept = smoothstep(0.0040, 0.0022, abs(sin(ang * ${(CHAMBERS / 2).toFixed(1)})) * ax);   // walls between the chambers
    float core = smoothstep(0.26, 0.18, rr);
    float solid = max(max(wall, sept), core);
    vec3 meat = mix(lin(vec3(0.90, 0.20, 0.12)), lin(vec3(0.78, 0.06, 0.04)), smoothstep(0.75, 0.98, rr));
    meat = mix(meat, lin(vec3(0.96, 0.62, 0.46)), core * 0.7);             // pale core
    meat *= 0.92 + 0.12 * fbm(p * 240.0);
    vec3 w = worley(p * 150.0);                                            // a seed in its jelly
    vec3 gel = mix(lin(vec3(0.84, 0.36, 0.06)), lin(vec3(0.70, 0.46, 0.08)), w.y);
    gel = mix(gel, lin(vec3(0.94, 0.84, 0.50)), smoothstep(0.24, 0.14, w.x));        // the seed
    gel = mix(gel, lin(vec3(0.62, 0.20, 0.03)), smoothstep(0.05, 0.0, w.z) * 0.5);
    col = mix(gel, meat, solid);
    rough = mix(0.08, 0.26, solid);
    h = (1.0 - solid) * (0.5 - w.x);
  }`;

export default {
  name: { en: "Tomato", fa: "گوجه‌فرنگی" }, axes: [0.048, 0.058, 0.058], juice: 0xe8361a, tint: 0xe02a14,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.014, 0.2, 0.5);
    return v => {
      const ang = Math.atan2(v.z, v.y);
      return 1 + L(v) - 0.10 * Math.exp(-(1 - v.x) / 0.03) - 0.03 * Math.exp(-(1 + v.x) / 0.006)
        + 0.02 * Math.cos(CHAMBERS * ang) * Math.max(0, v.x) ** 0.5;       // soft ribs on the shoulders
    };
  },
  skin: SKIN, flesh: FLESH,
};
