// Strawberry, ported from chicken/blender/procedural.py (_berry_mesh, _berry_skin, _berry_flesh).
// Tip at -x, sepals and stem at +x; the shoulders (x > 0) are flattened, so u = x / half-length
// divides by the shorter half there.
import { lumps } from "../fruitkit.js";

const SEPALS = 8;
const taper = u => 0.35 + 0.65 * ((u + 1) / 2) ** 0.8;                       // narrow rounded tip, full shoulders
const sepal = (u, ang) => Math.min(1, Math.max(0, (u - 0.90 + 0.30 * Math.max(0, Math.cos(SEPALS * ang)) ** 1.5) / 0.03));

const UANG = /* glsl */`
    float u = p.x / (p.x > 0.0 ? 0.85 * AX.x : AX.x);
    float ang = atan(p.z, p.y);`;

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {${UANG}
    float tone = fbm(p * 30.0);
    col = seg(lin(vec3(0.70, 0.03, 0.05)), lin(vec3(0.95, 0.08, 0.08)), tone, 0.30, 0.75);
    col = mix(col, lin(vec3(0.96, 0.50, 0.34)), smoothstep(0.55, 0.85, u) * 0.45);   // paler under the sepals
    float d = worley(p * 200.0).x;                                            // a seed in each dimple
    col = mix(col, lin(vec3(0.96, 0.80, 0.28)), smoothstep(0.16, 0.10, d));
    float pit = smoothstep(0.40, 0.12, d);
    float leaf = pow(max(cos(${SEPALS}.0 * ang), 0.0), 1.5);                  // the mesh's sepal mask
    float green = clamp((u - 0.90 + 0.30 * leaf + 0.01) / 0.03, 0.0, 1.0);
    col = mix(col, mix(lin(vec3(0.12, 0.36, 0.07)), lin(vec3(0.30, 0.58, 0.14)), tone), green);
    rough = mix(0.22, 0.65, green);
    h = -pit * (1.0 - green);
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {${UANG}
    float uc = min(u, 0.98);
    float wr = sqrt(max(1.0 - uc * uc, 0.04)) * (0.35 + 0.65 * pow(max(uc * 0.5 + 0.5, 0.0), 0.8));   // local radius: follows the cone
    float wob = fbm(p * 70.0);
    float rr = length(p.yz) / (wr * AX.y) + wob * 0.10 - 0.05;
    col = lin(vec3(0.98, 0.86, 0.84));                                        // pale pith
    col = seg(col, lin(vec3(0.97, 0.68, 0.67)), rr, 0.0, 0.30);
    col = seg(col, lin(vec3(0.95, 0.26, 0.25)), rr, 0.30, 0.55);
    col = seg(col, lin(vec3(0.90, 0.08, 0.10)), rr, 0.55, 0.80);
    col = seg(col, lin(vec3(0.80, 0.04, 0.06)), rr, 0.80, 0.97);              // deep red under the skin
    float ray = smoothstep(0.80, 1.0, sin((wob * 1.2 + ang) * 22.0)) * smoothstep(0.92, 0.35, rr) * 0.55;   // white rays out to the seeds
    col = mix(col, lin(vec3(0.98, 0.88, 0.86)), ray);
    col = mix(col, lin(vec3(0.98, 0.90, 0.86)), smoothstep(0.62, 0.86, u) * 0.7);   // whitish shoulder
    rough = 0.18;
    h = fbm(p * 500.0) * 0.5;
  }`;

export default {
  name: { en: "Strawberry", fa: "توت‌فرنگی" }, axes: [0.060, 0.050, 0.050], juice: 0xd10d1a, tint: 0xe6141a,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.02, 0.15, 0.4);
    return v => 1 + L(v) + 0.025 * sepal(v.x, Math.atan2(v.z, v.y)) + 0.22 * Math.exp(-(1 - v.x) / 0.0015);   // sepals on the skin, short stem
  },
  post(p, A, v) { const t = taper(Math.max(-1, Math.min(1, v.x))); p.y *= t; p.z *= t; if (p.x > 0) p.x *= 0.85; },
  skin: SKIN, flesh: FLESH,
};
