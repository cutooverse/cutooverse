// Carrot, ported from chicken/blender/procedural.py (_carrot*): a UV sphere remapped along x like the
// cucumber, a long taper from the pointed tip (-x) to a blunt shoulder at the crown (+x), shallow ring
// grooves, root-hair pits and a slight bend. 22 cm as in Blender; the shaders add OFF back to get the
// Blender frame.
import { mulberry32 } from "../fruitkit.js";
import { tube, meshVolume, dAng } from "./tube.js";

const H = 0.110, R = 0.023;                  // half-length, radius at the shoulder
const OFF = [0, 0, -0.0010];                 // the bent body's bounding-box centre, Blender frame
const prof = t => R * ((t + 1) / 2) ** 0.75 * Math.max(0, 1 - t ** 14) ** 0.3;
const bend = t => 0.006 * (1 - t * t) - 0.003;

function mesh(rnd, level) {
  const U = level >= 5 ? 64 : 32, V = level >= 5 ? 120 : 60;   // Blender: u_segments=64, v_segments=120
  const grooves = Array.from({ length: 26 }, () => [-0.9 + 1.8 * rnd(), Math.PI * (2 * rnd() - 1), 0.8 + 1.7 * rnd()]);
  const pits = Array.from({ length: 30 }, () => [-0.8 + 1.6 * rnd(), Math.PI * (2 * rnd() - 1)]);
  const at = (t, a) => {
    let r = prof(t);
    for (const [tc, ac, w] of grooves) r *= 1 - 0.035 * Math.exp(-(((t - tc) / 0.006) ** 2) - (dAng(a, ac) / w) ** 2);
    for (const [tc, ac] of pits) r *= 1 - 0.04 * Math.exp(-(((t - tc) / 0.008) ** 2 + (dAng(a, ac) / 0.08) ** 2));
    return [t * H - OFF[0], r * Math.cos(a) - OFF[1], r * Math.sin(a) + bend(t) - OFF[2]];
  };
  return tube(V - 1, U, (i, j) => at(-1 + 2 * (i + 1) / V, Math.PI * (2 * j / U - 1)), at(-1, 0), at(1, 0));
}

// signed distance to the skin (metres, < 0 inside), grooves and pits left out
function sdf(x, y, z) {
  const qx = x + OFF[0], t = qx / H;
  if (Math.abs(t) >= 1) return Math.abs(qx) - H;
  return Math.max(Math.hypot(y + OFF[1], z + OFF[2] - bend(t)) - prof(t), Math.abs(qx) - H);
}

// the offset from the bent axis; _carrot_local_r's profile radius (no crown rounding); the full one
const GL = /* glsl */`
  const float CA_H = ${H.toFixed(3)}, CA_R = ${R.toFixed(3)};
  const vec3 CA_OFF = vec3(${OFF.map(v => v.toFixed(4)).join(", ")});
  vec2 caOff(vec3 q) { float t = clamp(q.x / CA_H, -1.0, 1.0); return vec2(q.y, q.z - 0.006 * (1.0 - t * t) + 0.003); }
  float caLocalR(float x) { return CA_R * pow(max(x * 0.5 / CA_H + 0.5, 0.03), 0.75); }
  float caProf(float x) { float t = clamp(x / CA_H, -1.0, 1.0); return CA_R * pow(t * 0.5 + 0.5, 0.75) * pow(max(1.0 - pow(abs(t), 14.0), 0.0), 0.3); }
`;

const SKIN = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = p + CA_OFF;
    float n = fbm(q * 25.0);
    col = seg(lin(vec3(0.82, 0.28, 0.02)), lin(vec3(0.96, 0.42, 0.05)), n, 0.30, 0.70);
    float line = smoothstep(0.93, 1.0, sin((vnoise(q * 40.0) * 0.004 + q.x) * 900.0))   // ring lines ~7 mm apart
               * clamp((vnoise(q * 60.0) - 0.45) / 0.20, 0.0, 1.0);                       // that come and go around
    col = mix(col, lin(vec3(0.50, 0.14, 0.0)), line * 0.6);
    col = mix(col, lin(vec3(0.55, 0.21, 0.03)), smoothstep(0.08, 0.03, worley(q * 180.0).x) * 0.5);   // root-hair dots
    col = mix(col, lin(vec3(0.27, 0.32, 0.08)), smoothstep(CA_H * 0.975, CA_H * 0.995, q.x));         // cut-off greens
    rough = 0.55;
    h = -(n * 0.3 + line) * 0.7;                                             // the lines are grooves
  }`;

const FLESH = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = p + CA_OFF;
    vec2 d = caOff(q);
    float wob = vnoise(q * 70.0);
    float rr = length(d) / caLocalR(q.x) + wob * 0.10 - 0.05;
    col = lin(vec3(0.98, 0.60, 0.06));                                       // pale core
    col = seg(col, lin(vec3(0.96, 0.52, 0.03)), rr, 0.0, 0.44);
    col = seg(col, lin(vec3(0.74, 0.22, 0.0)), rr, 0.44, 0.50);               // thin darker ring
    col = seg(col, lin(vec3(0.92, 0.36, 0.02)), rr, 0.50, 0.56);              // cortex
    col = seg(col, lin(vec3(0.94, 0.39, 0.02)), rr, 0.56, 0.92);
    col = seg(col, lin(vec3(0.80, 0.28, 0.01)), rr, 0.92, 0.99);              // a touch darker under the skin
    float ray = smoothstep(0.85, 1.0, sin((wob + atan(d.y, d.x)) * 14.0)) * smoothstep(0.48, 0.30, rr) * 0.35;
    col = mix(col, lin(vec3(1.0, 0.70, 0.16)), ray);                         // faint rays in the core
    float rl = caProf(q.x);                                                  // Blender's rim: 0.8 mm of skin round the cut
    col = mix(col, lin(vec3(0.76, 0.27, 0.0)), smoothstep(rl - 0.0010, rl - 0.0007, length(d)));
    rough = 0.3;
    h = fbm(q * 400.0) * 0.4;
  }`;

const def = {
  name: { en: "Carrot", fa: "هویج" },
  axes: [H, 0.0212, 0.0215],
  juice: 0xff8c1a, tint: 0xf06305,
  mesh,
  skin: SKIN, flesh: FLESH,
  inside: (x, y, z) => sdf(x, y, z) <= 0,
  shell: (x, y, z, e) => sdf(x, y, z) > -1.3 * e,
};
def.vol = meshVolume(mesh(mulberry32(1), 5));
export default def;
