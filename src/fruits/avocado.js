// Avocado: pear-shaped with a pebbly near-black skin; inside, butter-yellow flesh going green
// toward the skin, and the big round stone low in the body. Stem at +x.
import { lumps, spindle, belly } from "../fruitkit.js";

const A = [0.066, 0.047, 0.047];
const neck = belly(-0.2, 0.8, 0.34), prof = u => (1 - u * u) ** 0.40 * neck(u);
const WID = /* glsl */`
  float prof(float u) { return pow(max(1.0 - u * u, 0.0), 0.40) * (1.0 - 0.34 * smoothstep(-0.2, 0.8, u)); }
  float rn(vec3 p) { return length(p.yz) / (AX.y * prof(clamp(p.x / AX.x, -0.98, 0.98))); }`;

const SKIN = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 w = worley(p * 230.0);                                            // pebbles
    float tone = fbm(p * 20.0);
    col = mix(lin(vec3(0.04, 0.08, 0.03)), lin(vec3(0.14, 0.22, 0.07)), smoothstep(0.3, 0.7, tone));
    col = mix(col, lin(vec3(0.16, 0.10, 0.12)), smoothstep(0.5, 0.8, fbm(p * 8.0 + 4.0)) * 0.6);   // ripening purple-brown
    col *= 0.75 + 0.5 * smoothstep(0.45, 0.05, w.x);
    col = mix(col, lin(vec3(0.36, 0.26, 0.12)), smoothstep(0.006, 0.002, length(p.yz)) * step(0.0, p.x));   // stem button
    rough = 0.55;
    h = (1.0 - w.x) * 1.2;
  }`;

const FLESH = /* glsl */`${WID}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float r = rn(p), g = fbm(p * 200.0);
    col = lin(vec3(0.96, 0.92, 0.50));
    col = seg(col, lin(vec3(0.90, 0.90, 0.42)), r, 0.0, 0.55);
    col = seg(col, lin(vec3(0.66, 0.78, 0.26)), r, 0.55, 0.88);
    col = seg(col, lin(vec3(0.34, 0.52, 0.12)), r, 0.88, 0.965);
    col = seg(col, lin(vec3(0.07, 0.12, 0.04)), r, 0.965, 0.995);          // the edge of the skin
    col *= 0.96 + 0.06 * g;
    float st = length(p - vec3(-0.016, 0.0, 0.0)) / 0.0235;                // the stone
    float stone = smoothstep(1.0, 0.96, st);
    vec3 sc = mix(lin(vec3(0.50, 0.30, 0.13)), lin(vec3(0.70, 0.48, 0.24)), fbm(p * 70.0));
    sc = mix(sc, lin(vec3(0.30, 0.17, 0.07)), smoothstep(0.55, 0.75, fbm(p * 240.0)) * 0.5);
    col = mix(col, lin(vec3(0.62, 0.52, 0.22)), smoothstep(1.10, 1.0, st) * 0.5);    // stained hollow round it
    col = mix(col, sc, stone);
    rough = mix(0.34, 0.55, stone);
    h = g * 0.25 + stone * fbm(p * 240.0) * 0.5;
  }`;

export default {
  name: { en: "Avocado", fa: "آووکادو" }, axes: A, juice: 0xcfd77a, tint: 0x8fae3a,
  radius(rnd) { const L = lumps(rnd, 9, 0.014, 0.2, 0.5); return v => 1 + L(v); },
  ...spindle(A, prof),
  skin: SKIN, flesh: FLESH,
};
