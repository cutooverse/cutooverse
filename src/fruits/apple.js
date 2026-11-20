// Apple: red with yellow streaks, a deep stem cavity and a calyx basin; inside, cream flesh, the
// core line and five seed chambers in a star, a brown seed in each. Stem at +x.
import { lumps } from "../fruitkit.js";

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float ang = atan(p.z, p.y), u = p.x / AX.x;
    float tone = fbm(p * 22.0);
    float streak = fbm(vec3(ang * 7.0, length(p.yz) * 30.0, u * 1.5));     // streaks run from pole to pole
    col = mix(lin(vec3(0.52, 0.03, 0.05)), lin(vec3(0.86, 0.10, 0.08)), smoothstep(0.25, 0.75, tone));
    float pale = smoothstep(0.48, 0.70, streak) * 0.75 + smoothstep(0.55, 0.9, fbm(p * 7.0 + 3.1)) * 0.6;
    col = mix(col, lin(vec3(0.90, 0.72, 0.22)), clamp(pale, 0.0, 1.0) * 0.7);
    col = mix(col, lin(vec3(0.62, 0.66, 0.20)), smoothstep(0.55, 0.95, u) * 0.55);   // greener round the stem
    col = mix(col, lin(vec3(0.98, 0.92, 0.66)), smoothstep(0.10, 0.05, worley(p * 150.0).x) * 0.55);   // lenticels
    float cav = smoothstep(0.012, 0.004, length(p.yz));
    col = mix(col, lin(vec3(0.34, 0.22, 0.10)), cav * step(0.0, p.x));    // russet in the stem cavity
    col = mix(col, lin(vec3(0.20, 0.14, 0.08)), cav * step(p.x, 0.0));    // the dry calyx
    rough = 0.22 + 0.3 * cav;
    h = tone * 0.25;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float rr = length(p / AX), ax = length(p.yz), ang = atan(p.z, p.y);
    float g = fbm(p * 260.0);
    col = mix(lin(vec3(0.99, 0.96, 0.82)), lin(vec3(0.95, 0.93, 0.70)), smoothstep(0.55, 0.98, rr));
    col = mix(col, lin(vec3(0.80, 0.86, 0.50)), smoothstep(0.93, 0.99, rr) * 0.5);   // green under the skin
    col *= 0.95 + 0.07 * g;
    vec3 c = p / vec3(0.026, 0.021, 0.021);                                // the core
    float cl = abs(length(c) - 1.0);
    col = mix(col, lin(vec3(0.84, 0.82, 0.52)), smoothstep(0.07, 0.02, cl) * 0.6);   // core line
    float a5 = mod(ang, 1.2566) - 0.6283;                                  // five chambers
    vec2 q = ax * vec2(cos(a5), sin(a5));
    float cham = length(vec3(p.x / 0.016, (q.x - 0.0065) / 0.0058, q.y / 0.0030));
    col = mix(col, lin(vec3(0.90, 0.84, 0.56)), smoothstep(1.0, 0.85, cham));        // papery chamber
    col = mix(col, lin(vec3(0.70, 0.62, 0.34)), smoothstep(0.12, 0.0, abs(cham - 1.0)) * 0.7);
    float seed = length(vec3((p.x + 0.002) / 0.0085, (q.x - 0.0068) / 0.0036, q.y / 0.0019));
    float sd = smoothstep(1.0, 0.85, seed);
    col = mix(col, mix(lin(vec3(0.20, 0.09, 0.03)), lin(vec3(0.40, 0.20, 0.08)), g), sd);
    col = mix(col, lin(vec3(0.42, 0.34, 0.16)), smoothstep(0.0022, 0.0008, ax) * step(abs(p.x), AX.x * 0.8) * 0.8);   // the stalk's thread
    rough = mix(0.30, 0.18, sd);
    h = g * 0.35 - sd * 0.6;
  }`;

export default {
  name: { en: "Apple", fa: "سیب" }, axes: [0.056, 0.062, 0.062], juice: 0xf2ead0, tint: 0xd8202a,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.012, 0.2, 0.5);
    return v => {
      const ang = Math.atan2(v.z, v.y);
      return 1 + L(v) - 0.20 * Math.exp(-(1 - v.x) / 0.035) - 0.13 * Math.exp(-(1 + v.x) / 0.022)   // stem cavity, calyx basin
        + 0.022 * Math.cos(5 * ang) * Math.exp(-(1 + v.x) / 0.25);                                   // five soft crowns round the calyx
    };
  },
  post(p, A, v) { const k = 1 - 0.07 * v.x; p.y *= k; p.z *= k; },         // broader shoulders than base
  skin: SKIN, flesh: FLESH,
};
