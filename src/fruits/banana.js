// Banana, ported from chicken/blender/procedural.py (_banana*): rings swept along an arc in xz (ends
// up), five soft ridges, a pointed blossom tip and a straight neck with a flat-cut stem. Blender kept
// u (along) and v (around) in a UV layer; here the shaders rebuild them from opos with banFrame().
// The mesh is centred on its bounding box (OFF, Blender frame); the shaders add OFF back.
import { tube, meshVolume } from "./tube.js";

const RC = 0.22, TH = 0.45;                  // radius of the arc, half its angle: ~20 cm of body
const R0 = 0.018, NL = 0.03, NR = 0.0055;    // body radius; neck length and radius
const UB = 2 * RC * TH / (2 * RC * TH + NL); // u where the body ends and the neck starts
const OFF = [0.0144, 0, 0.0113];             // the bounding-box centre, Blender frame

// centre-line point [x, z] and in-plane normal (toward the arc's centre) at u in [0, 1]
function frame(u) {
  const th = Math.min(TH, -TH + 2 * TH * u / UB), w = u > UB ? (u - UB) / (1 - UB) * NL : 0;
  return { p: [RC * Math.sin(th) + Math.cos(th) * w, RC * (1 - Math.cos(th)) + Math.sin(th) * w], n: [-Math.sin(th), Math.cos(th)] };
}

function radius(u) {
  if (u > UB) return NR * (1 + 0.15 * ((u - UB) / (1 - UB)) ** 4);    // slight flare at the cut stem
  const s = 2 * u / UB - 1;                                           // -1 blossom tip .. 1 stem end
  const r = R0 * Math.max(0, 1 - Math.abs(s) ** 3.5) ** 0.42;
  const k = Math.min(1, Math.max(0, (s - 0.55) / 0.45));              // narrow into the neck
  return s > 0 ? (1 - k * k) * r + k * k * NR : r;
}
const ridge = ph => 0.94 + 0.06 * Math.cos(5 * ph) ** 2;

// no random numbers: the Blender banana has none either
function mesh(rnd, level) {
  const nu = level >= 5 ? 170 : 85, nv = level >= 5 ? 40 : 20;
  const pt = (u, ph) => {
    const f = frame(u), r = radius(u) * ridge(ph), c = r * Math.cos(ph);
    return [f.p[0] + c * f.n[0] - OFF[0], -r * Math.sin(ph) - OFF[1], f.p[1] + c * f.n[1] - OFF[2]];   // binormal = -y
  };
  const end = frame(1);                                               // centre of the flat-cut stem
  return tube(nu - 1, nv, (i, j) => pt((i + 1) / (nu - 1), 2 * Math.PI * j / nv), pt(0, 0), [end.p[0] - OFF[0], -OFF[1], end.p[1] - OFF[2]]);
}

// [u, angle around, distance from the centre line, how far past the stem cut] of a Blender-frame
// point; the first three as banFrame()
function where(qx, qy, qz) {
  const th = Math.atan2(qx, RC - qz);
  if (th <= TH) {
    const off = RC - Math.hypot(qx, qz - RC);
    return [(th + TH) / (2 * TH) * UB, Math.atan2(-qy, off), Math.hypot(off, qy), -Infinity];
  }
  const dx = qx - RC * Math.sin(TH), dz = qz - RC * (1 - Math.cos(TH));
  const s = dx * Math.cos(TH) + dz * Math.sin(TH), a = -dx * Math.sin(TH) + dz * Math.cos(TH);
  return [UB + s / NL * (1 - UB), Math.atan2(-qy, a), Math.hypot(a, qy), s - NL];
}

// signed distance to the peel (metres, < 0 inside)
function sdf(x, y, z) {
  const qx = x + OFF[0], qy = y + OFF[1], qz = z + OFF[2];
  const [u, ph, d, beyond] = where(qx, qy, qz);
  if (u <= 0) return Math.hypot(qx + RC * Math.sin(TH), qy, qz - RC * (1 - Math.cos(TH)));   // past the blossom tip
  return Math.max(d - radius(u) * ridge(ph), beyond);
}

const GL = /* glsl */`
  const float BA_RC = ${RC.toFixed(3)}, BA_TH = ${TH.toFixed(3)}, BA_R0 = ${R0.toFixed(4)};
  const float BA_NL = ${NL.toFixed(3)}, BA_NR = ${NR.toFixed(4)}, BA_UB = ${UB.toFixed(5)};
  const vec3 BA_OFF = vec3(${OFF.map(v => v.toFixed(4)).join(", ")});
  // x: u along the banana (0 blossom tip, BA_UB end of the body, 1 cut stem), y: the angle around
  // the centre line (Blender's v * 2 pi), z: the distance from the centre line
  vec3 banFrame(vec3 q) {
    float th = atan(q.x, BA_RC - q.z);
    if (th <= BA_TH) {
      float off = BA_RC - length(vec2(q.x, q.z - BA_RC));
      return vec3((th + BA_TH) / (2.0 * BA_TH) * BA_UB, atan(-q.y, off), length(vec2(off, q.y)));
    }
    vec3 d = q - BA_RC * vec3(sin(BA_TH), 0.0, 1.0 - cos(BA_TH));          // the straight neck
    float s = dot(d, vec3(cos(BA_TH), 0.0, sin(BA_TH)));
    float a = dot(d, vec3(-sin(BA_TH), 0.0, cos(BA_TH)));
    return vec3(BA_UB + s / BA_NL * (1.0 - BA_UB), atan(-q.y, a), length(vec2(a, q.y)));
  }
  float banRadius(float u) {
    if (u > BA_UB) return BA_NR * (1.0 + 0.15 * pow((u - BA_UB) / (1.0 - BA_UB), 4.0));
    float s = 2.0 * u / BA_UB - 1.0;
    float r = BA_R0 * pow(max(1.0 - pow(abs(s), 3.5), 0.0), 0.42);
    float k = clamp((s - 0.55) / 0.45, 0.0, 1.0);
    return s > 0.0 ? mix(r, BA_NR, k * k) : r;
  }
`;

const YELLOW = "vec3(0.98, 0.85, 0.16)";

const SKIN = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = p + BA_OFF;
    vec3 f = banFrame(q);
    float u = f.x;
    col = lin(vec3(0.12, 0.08, 0.04));                                       // dark blossom tip
    col = seg(col, lin(vec3(0.52, 0.37, 0.07)), u, 0.0, 0.035);
    col = seg(col, lin(${YELLOW}), u, 0.035, 0.07);
    col = seg(col, lin(vec3(0.70, 0.65, 0.13)), u, BA_UB - 0.10, BA_UB - 0.02);
    col = seg(col, lin(vec3(0.47, 0.47, 0.12)), u, BA_UB - 0.02, BA_UB + 0.03);   // green neck
    col = seg(col, lin(vec3(0.42, 0.37, 0.12)), u, BA_UB + 0.03, 0.985);
    col = seg(col, lin(vec3(0.34, 0.24, 0.10)), u, 0.985, 1.0);               // cut stem
    col = mix(col, lin(vec3(0.64, 0.54, 0.12)), smoothstep(0.86, 0.99, cos(5.0 * f.y)) * 0.45);   // five ridge lines
    float streak = fbm(q * vec3(6.0, 90.0, 90.0));                           // long fine streaks
    col *= 0.88 + 0.18 * clamp(streak, 0.0, 1.0);
    float spot = smoothstep(0.13, 0.05, worley(q * 110.0).x) * 0.9           // sugar spots, in clusters, none near the stem
               * smoothstep(0.45, 0.62, vnoise(q * 14.0)) * clamp((BA_UB - 0.02 - u) / 0.04, 0.0, 1.0);
    col = mix(col, lin(vec3(0.34, 0.19, 0.06)), spot);
    rough = 0.58;
    h = streak * 0.5;
  }`;

const FLESH = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = p + BA_OFF;
    vec3 f = banFrame(q);
    float rr = f.z / BA_R0;
    col = lin(vec3(0.86, 0.78, 0.52));                                       // translucent core
    col = seg(col, lin(vec3(0.90, 0.82, 0.55)), rr, 0.0, 0.22);
    col = seg(col, lin(vec3(0.96, 0.88, 0.60)), rr, 0.22, 0.35);
    col = seg(col, lin(vec3(0.97, 0.90, 0.64)), rr, 0.35, 0.85);
    col = seg(col, lin(vec3(0.98, 0.93, 0.70)), rr, 0.85, 1.05);              // a little paler toward the peel
    float s = smoothstep(0.2, 0.08, worley(q * 520.0).x) * 0.8 * smoothstep(0.28, 0.16, rr);
    col = mix(col, lin(vec3(0.28, 0.20, 0.11)), s);                          // tiny dark seed dots
    float c5 = cos(5.0 * f.y);
    float rl = banRadius(f.x) * (0.94 + 0.06 * c5 * c5);                     // Blender's rim: 2.5 mm of peel round the cut
    col = mix(col, lin(vec3(0.90, 0.86, 0.62)), smoothstep(rl - 0.0029, rl - 0.0025, f.z));
    col = mix(col, lin(${YELLOW}), smoothstep(rl - 0.0008, rl - 0.0005, f.z));
    rough = 0.35;
    h = vnoise(q * 300.0) * 0.4;
  }`;

const def = {
  name: { en: "Banana", fa: "موز" },
  axes: [0.1111, 0.0174, 0.0294],           // the bounding box
  juice: 0xf2ebcc, tint: 0xf7e6a3,
  mesh,
  skin: SKIN, flesh: FLESH,
  inside: (x, y, z) => sdf(x, y, z) <= 0,
  shell: (x, y, z, e) => sdf(x, y, z) > -1.3 * e,
};
def.vol = meshVolume(mesh(null, 5));
export default def;
