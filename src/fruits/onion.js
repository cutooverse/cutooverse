// Onion, yellow or red: a papery skin streaked from root to neck, a dry pointed neck at +x and the
// root plate at -x; inside, the layers, one within another, with a green shoot at the heart.
import { lumps, v3 } from "../fruitkit.js";

const LAYERS = 8;

const skin = (lo, hi) => /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float u = p.x / AX.x, ang = atan(p.z, p.y);
    float str = fbm(vec3(ang * 34.0, u * 5.0, 1.7));                       // the skin's veins run lengthwise
    float tone = fbm(p * 16.0);
    col = mix(lin(${v3(lo)}), lin(${v3(hi)}), smoothstep(0.25, 0.75, 0.6 * str + 0.4 * tone));
    col *= 0.86 + 0.24 * smoothstep(0.35, 0.65, fbm(vec3(ang * 110.0, u * 9.0, 4.0)));
    col = mix(col, lin(vec3(0.74, 0.62, 0.40)), smoothstep(0.80, 1.05, u));          // the dry neck
    float root = smoothstep(0.014, 0.004, length(p.yz)) * step(p.x, 0.0);
    col = mix(col, lin(vec3(0.34, 0.25, 0.14)) * (0.6 + 0.8 * vnoise(p * 900.0)), root);   // the root plate
    rough = 0.40 + 0.4 * root;
    h = str * 0.5 + root * vnoise(p * 900.0);
  }`;

const flesh = (body, line, heart, peel) => /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float wob = fbm(p * 26.0);
    float s = length(p / AX) + wob * 0.025;
    float t = s * ${LAYERS}.0, f = fract(t);
    float edge = smoothstep(0.13, 0.03, min(f, 1.0 - f));                  // where two layers meet
    col = mix(lin(${v3(body)}), lin(vec3(0.99, 0.99, 0.93)), f * 0.7);     // each layer paler toward its outside
    col = mix(col, lin(${v3(line)}), edge * 0.9);
    col = mix(col, lin(${v3(heart)}), smoothstep(0.16, 0.05, s));          // the shoot
    col = mix(col, lin(${v3(peel)}), smoothstep(0.955, 0.985, s));
    float fib = vnoise(vec3(atan(p.z, p.y) * 60.0, s * 40.0, p.x * 40.0));
    col *= 0.95 + 0.07 * fib;
    rough = 0.16;
    h = -edge * 0.7 + fib * 0.2;
  }`;

const body = (name, juice, tint, skinCols, fleshCols) => ({
  name, axes: [0.052, 0.056, 0.056], juice, tint,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.012, 0.2, 0.5);
    return v => 1 + L(v) + 0.26 * Math.exp(-(1 - v.x) / 0.010) - 0.05 * Math.exp(-(1 + v.x) / 0.02);   // the neck, the root dimple
  },
  skin: skin(...skinCols), flesh: flesh(...fleshCols),
});

export const onion = body({ en: "Onion", fa: "پیاز" }, 0xf2f0dc, 0xe0b560,
  [[0.60, 0.33, 0.09], [0.86, 0.60, 0.24]],
  [[0.93, 0.94, 0.80], [0.80, 0.84, 0.50], [0.78, 0.86, 0.40], [0.80, 0.56, 0.22]]);
export const redonion = body({ en: "Red onion", fa: "پیاز قرمز" }, 0xe9d3e3, 0x9a2a66,
  [[0.36, 0.05, 0.20], [0.62, 0.14, 0.36]],
  [[0.95, 0.90, 0.93], [0.52, 0.07, 0.34], [0.84, 0.86, 0.50], [0.46, 0.08, 0.28]]);
