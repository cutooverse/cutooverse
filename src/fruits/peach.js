// Peach: velvety, yellow with a red blush, a seam down one side and a little point at the tip
// (-x); inside, golden flesh running red toward the furrowed stone. Stem at +x.
import { lumps } from "../fruitkit.js";

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float tone = fbm(p * 12.0), fuzz = vnoise(p * 900.0);
    col = mix(lin(vec3(0.98, 0.70, 0.24)), lin(vec3(0.99, 0.82, 0.40)), tone);
    float blush = smoothstep(0.38, 0.70, fbm(p * 7.0 + 2.0) + 0.25 * p.z / AX.z);
    col = mix(col, mix(lin(vec3(0.62, 0.05, 0.08)), lin(vec3(0.88, 0.20, 0.12)), tone), blush * 0.9);
    col = mix(col, lin(vec3(0.99, 0.88, 0.66)), fuzz * 0.18);              // the down
    col = mix(col, lin(vec3(0.36, 0.24, 0.10)), smoothstep(0.007, 0.002, length(p.yz)) * step(0.0, p.x));
    rough = 0.9;
    h = fuzz * 0.25;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float rr = length(p / AX), g = fbm(p * 220.0);
    float st = length(p / vec3(0.0185, 0.0105, 0.0145));                   // the stone: a flattened almond
    float ang = atan(p.z, p.y);
    col = mix(lin(vec3(0.99, 0.74, 0.20)), lin(vec3(0.98, 0.62, 0.14)), smoothstep(0.3, 0.95, rr));
    float fib = fbm(vec3(ang * 14.0, st * 2.0, p.x * 60.0));               // fibres run out from the stone
    col = mix(col, lin(vec3(0.99, 0.84, 0.36)), fib * 0.3);
    col = mix(col, lin(vec3(0.74, 0.08, 0.08)), smoothstep(2.3, 1.0, st + fib * 0.7) * 0.85);   // red round the stone
    col = mix(col, lin(vec3(0.86, 0.22, 0.14)), smoothstep(0.95, 0.995, rr) * 0.6);  // and just under the skin
    float stone = smoothstep(1.0, 0.94, st);
    vec3 w = worley(p * vec3(120.0, 260.0, 260.0));                        // its furrows
    vec3 sc = mix(lin(vec3(0.36, 0.20, 0.09)), lin(vec3(0.66, 0.44, 0.24)), smoothstep(0.0, 0.14, w.z));
    col = mix(col, sc, stone);
    rough = mix(0.22, 0.7, stone);
    h = mix(g * 0.3, w.z * 3.0, stone);
  }`;

export default {
  name: { en: "Peach", fa: "هلو" }, axes: [0.056, 0.058, 0.058], juice: 0xffb648, tint: 0xf58a2a,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.012, 0.2, 0.5);
    return v => {
      const ang = Math.atan2(v.z, v.y), d = Math.atan2(Math.sin(ang - 1.5708), Math.cos(ang - 1.5708));   // the seam runs along the top
      return 1 + L(v) - 0.055 * Math.exp(-((d / 0.16) ** 2)) * (1 - v.x * v.x) ** 0.3
        - 0.12 * Math.exp(-(1 - v.x) / 0.03) + 0.05 * Math.exp(-(1 + v.x) / 0.006);    // stem cavity, the little point
    };
  },
  skin: SKIN, flesh: FLESH,
};
