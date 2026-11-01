// Cucumber, ported from chicken/blender/procedural.py (_cucumber*): a UV sphere remapped to a capsule
// along x, soft lengthwise ridges, a few small warts and a gentle bend. The Blender one is 24 cm, too
// long for the board, so it is built at K = 0.9; the shaders go back to the Blender frame
// (q = p / K + OFF) and keep every Blender number as it was.
import { mulberry32 } from "../fruitkit.js";
import { tube, meshVolume, dAng } from "./tube.js";

const H = 0.120, R = 0.026;                  // Blender half-length and waist radius
const K = 0.9;                               // game size / Blender size
const OFF = [0, 0, 0.0037];                  // the bent body's bounding-box centre, Blender frame
const prof = t => R * Math.max(0, 1 - Math.abs(t) ** 7) ** 0.28 * (1 - 0.07 * Math.max(0, t) ** 2);
const bend = t => 0.010 * (1 - t * t) - 0.004;
const ridge = (t, a) => 1 + 0.025 * Math.cos(9 * a + 0.6 * Math.sin(3 * t));

function mesh(rnd, level) {
  const U = level >= 5 ? 72 : 36, V = level >= 5 ? 110 : 55;   // Blender: u_segments=72, v_segments=110
  const warts = Array.from({ length: 40 }, () => [-0.85 + 1.7 * rnd(), Math.PI * (2 * rnd() - 1)]);
  const at = (t, a) => {
    let r = prof(t) * ridge(t, a);
    for (const [tc, ac] of warts) r *= 1 + 0.035 * Math.exp(-(((t - tc) / 0.012) ** 2 + (dAng(a, ac) / 0.10) ** 2));
    return [(t * H - OFF[0]) * K, (r * Math.cos(a) - OFF[1]) * K, (r * Math.sin(a) + bend(t) - OFF[2]) * K];
  };
  // uniform latitude on the sphere = uniform rings along x
  return tube(V - 1, U, (i, j) => at(-1 + 2 * (i + 1) / V, Math.PI * (2 * j / U - 1)), at(-1, 0), at(1, 0));
}

// signed distance to the skin (game metres, < 0 inside), warts left out
function sdf(x, y, z) {
  const qx = x / K + OFF[0], qy = y / K + OFF[1], t = qx / H;
  if (Math.abs(t) >= 1) return (Math.abs(qx) - H) * K;
  const qz = z / K + OFF[2] - bend(t);
  return Math.max(Math.hypot(qy, qz) - prof(t) * ridge(t, Math.atan2(qz, qy)), Math.abs(qx) - H) * K;
}

// back to the Blender frame; the offset from the bent centre line and the profile radius there
const GL = /* glsl */`
  const float CU_H = ${H.toFixed(3)}, CU_R = ${R.toFixed(3)}, CU_K = ${K.toFixed(3)};
  const vec3 CU_OFF = vec3(${OFF.map(v => v.toFixed(4)).join(", ")});
  vec3 cuQ(vec3 p) { return p / CU_K + CU_OFF; }
  vec2 cuOff(vec3 q) { float t = clamp(q.x / CU_H, -1.0, 1.0); return vec2(q.y, q.z - 0.010 * (1.0 - t * t) + 0.004); }
  float cuProf(float t) { return CU_R * pow(max(1.0 - pow(abs(t), 7.0), 0.0), 0.28) * (1.0 - 0.07 * pow(clamp(t, 0.0, 1.0), 2.0)); }
`;

const SKIN = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = cuQ(p);
    vec2 d = cuOff(q);
    float wob = fbm(q * 22.0);
    float st = smoothstep(0.70, 0.98, sin((wob * 0.5 + atan(d.y, d.x)) * 5.0));   // lengthwise stripes
    col = mix(lin(vec3(0.06, 0.19, 0.06)), lin(vec3(0.15, 0.30, 0.10)), st);
    col = mix(col, lin(vec3(0.36, 0.48, 0.17)), smoothstep(-0.012, -0.024, q.z) * wob * 0.5);   // field spot underneath
    float wart = smoothstep(0.12, 0.04, worley(q * 140.0).x);
    col = mix(col, lin(vec3(0.50, 0.66, 0.31)), wart * 0.5);
    rough = 0.45;
    h = (fbm(q * 260.0) * 0.4 + wart) * 0.8;
  }`;

const FLESH = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = cuQ(p);
    vec2 d = cuOff(q);
    float rr = length(d) / CU_R;
    col = lin(vec3(0.74, 0.84, 0.50));                                       // seed core
    col = seg(col, lin(vec3(0.72, 0.82, 0.48)), rr, 0.0, 0.50);
    col = seg(col, lin(vec3(0.58, 0.72, 0.34)), rr, 0.50, 0.58);              // core boundary
    col = seg(col, lin(vec3(0.70, 0.84, 0.43)), rr, 0.58, 0.64);              // flesh
    col = seg(col, lin(vec3(0.62, 0.79, 0.36)), rr, 0.64, 0.88);
    col = seg(col, lin(vec3(0.26, 0.48, 0.14)), rr, 0.88, 0.96);              // dark band under the skin
    float s = smoothstep(0.28, 0.10, worley(q * 160.0).x) * smoothstep(0.52, 0.40, rr) * smoothstep(0.10, 0.22, rr);
    col = mix(col, lin(vec3(0.92, 0.94, 0.76)), s);                          // soft pale seeds
    float t = clamp(q.x / CU_H, -1.0, 1.0);                                  // Blender's rim: 1.2 mm of skin round the cut
    float rl = cuProf(t) * (1.0 + 0.025 * cos(9.0 * atan(d.y, d.x) + 0.6 * sin(3.0 * t)));
    col = mix(col, lin(vec3(0.10, 0.24, 0.07)), smoothstep(rl - 0.0014, rl - 0.0011, length(d)));
    rough = 0.22;
    h = vnoise(q * 380.0) * 0.35;
  }`;

const def = {
  name: { en: "Cucumber", fa: "خیار" },
  axes: [H * K, 0.0245, 0.0266],            // y, z: the bounding box plus room for the warts
  juice: 0xbfe09e, tint: 0xbdd680,
  mesh,
  skin: SKIN, flesh: FLESH,
  inside: (x, y, z) => sdf(x, y, z) <= 0,
  shell: (x, y, z, e) => sdf(x, y, z) > -1.3 * e,
};
def.vol = meshVolume(mesh(mulberry32(1), 5));
export default def;
