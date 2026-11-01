// Pumpkin (kadoo halvaei), ported from chicken/blender/procedural.py (_pumpkin_*): squat, z up, ten
// rounded lobes with narrow grooves, sunken top and bottom, a ridged stem out of the top dimple and a
// jack-o'-lantern face carved on the front (-y) that glows like a candle inside. Shrunk from 17 cm
// to 16 cm; the shaders scale their pattern sizes with it (k).
import * as THREE from "three";
import { lumps, sm } from "../fruitkit.js";

const BLENDER_X = 0.085;                                  // the Blender pumpkin's half-width
const stem = th => sm(0.16, 0.10, th);                    // 1 on the stem, which grows out of the top pole

// The face as a soft mask over the front (u = x, v = z), the same shapes as _pumpkin_face_image: two
// triangle eyes, a nose and a toothy grin, blurred (a 9 px box, twice each way).
function faceMask(size = 512) {
  const tri = (u, v, a, b, c) => {
    const side = (p, q) => (q[0] - p[0]) * (v - p[1]) - (q[1] - p[1]) * (u - p[0]);
    const s1 = side(a, b), s2 = side(b, c), s3 = side(c, a);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  let f = new Float32Array(size * size);                  // row 0 is v = 0 (the bottom)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const u = (c + 0.5) / size, v = (r + 0.5) / size;
    const on = tri(u, v, [0.27, 0.58], [0.43, 0.58], [0.36, 0.73]) || tri(u, v, [0.57, 0.58], [0.73, 0.58], [0.64, 0.73])
      || tri(u, v, [0.46, 0.48], [0.54, 0.48], [0.50, 0.55]);
    const s = (u - 0.5) / 0.27, top = 0.43 - 0.08 * (1 - s * s), bot = top - 0.11 * Math.sqrt(Math.max(0, 1 - s * s));
    let mouth = Math.abs(s) < 1 && v < top && v > bot;
    if (u > 0.40 && u < 0.46 && v > top - 0.045) mouth = false;                // teeth
    if (u > 0.55 && u < 0.61 && v < bot + 0.045) mouth = false;
    f[r * size + c] = on || mouth ? 1 : 0;
  }
  const blur = (src, rows) => {                           // np.convolve "same": zeros past the edge
    const out = new Float32Array(src.length);
    for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
      let s = 0;
      for (let t = b - 4; t <= b + 4; t++) if (t >= 0 && t < size) s += rows ? src[a * size + t] : src[t * size + a];
      out[rows ? a * size + b : b * size + a] = s / 9;
    }
    return out;
  };
  for (const rows of [false, false, true, true]) f = blur(f, rows);
  return f;
}

function faceTexture(size = 512) {
  const f = faceMask(size);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let r = 0; r < size; r++) for (let x = 0; x < size; x++) {
    const o = ((size - 1 - r) * size + x) * 4, val = Math.round(Math.min(1, f[r * size + x]) * 255);   // canvas rows run down
    img.data[o] = img.data[o + 1] = img.data[o + 2] = val; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);                   // flipY: the canvas top is v = 1
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
let face = null;                                          // built on first use: it needs a document

const SKIN = /* glsl */`
  uniform sampler2D uFace;
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = ${BLENDER_X.toFixed(3)} / AX.x;                                  // patterns sized as on the 17 cm pumpkin
    float sn = fbm(p * vec3(1.0, 1.0, 0.15) * 60.0 * k);                      // streaks run top to bottom
    col = seg(lin(vec3(0.80, 0.25, 0.0)), lin(vec3(0.95, 0.40, 0.01)), sn, 0.35, 0.70);
    float gr = smoothstep(-0.85, -1.0, cos(atan(p.y, p.x) * 10.0)) * 0.7;      // grooves, as in the mesh
    col = mix(col, lin(vec3(0.50, 0.15, 0.0)), gr);
    col = mix(col, lin(vec3(0.52, 0.38, 0.05)), smoothstep(AX.z * 0.62, AX.z * 0.80, p.z) * 0.45);   // greenish top
    vec3 stalk = mix(lin(vec3(0.25, 0.21, 0.10)), lin(vec3(0.52, 0.45, 0.25)), clamp(sn, 0.0, 1.0));
    col = mix(col, stalk, smoothstep(AX.z * 0.86, AX.z * 0.92, p.z));        // dry stem
    vec2 fuv = vec2(p.x * 0.5 / AX.x + 0.5, p.z * 0.5 / AX.z + 0.5);           // the face, projected from -y
    float inUV = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
    float fm = texture(uFace, clamp(fuv, 0.0, 1.0)).r * inUV * smoothstep(-AX.y * 0.35, -AX.y * 0.60, p.y);
    col = mix(col, lin(vec3(0.98, 0.68, 0.16)), smoothstep(0.05, 0.30, fm));  // cut flesh at the rim
    float hole = smoothstep(0.45, 0.75, fm);
    col = mix(col, lin(vec3(1.0, 0.62, 0.15)) * 3.0, hole);                   // candle glow: no emission slot, so just bright
    rough = mix(0.45, 1.0, hole);
    h = sn * (1.0 - hole);
  }`;

const FLESH = /* glsl */`
  vec3 pkWarp(vec3 q, float d) { return q + d * (vec3(vnoise(q + 3.1), vnoise(q + 17.3), vnoise(q + 41.7)) * 2.0 - 1.0); }   // Blender's noise Distortion
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = ${BLENDER_X.toFixed(3)} / AX.x;
    float rr = length(p / AX) + fbm(p * 25.0 * k) * 0.10 - 0.05;
    vec3 wall = seg(lin(vec3(1.0, 0.60, 0.05)), lin(vec3(0.92, 0.40, 0.01)), rr, 0.66, 0.97);
    float str = fbm(pkWarp(p * 30.0 * k, 4.0));                               // stringy pulp
    vec3 pulp = seg(lin(vec3(0.70, 0.30, 0.03)), lin(vec3(1.0, 0.64, 0.10)), str, 0.30, 0.75);
    float sd = smoothstep(0.24, 0.17, worley(p * vec3(1.0, 1.0, 2.2) * 55.0 * k).x) * smoothstep(0.20, 0.32, rr);   // flat oval seeds
    pulp = mix(pulp, lin(vec3(0.96, 0.92, 0.74)), sd);
    float cav = smoothstep(0.62, 0.68, rr);                                   // the cavity's edge
    col = mix(pulp, wall, cav);
    rough = mix(0.25, 0.4, cav);                                              // wet pulp, firm wall
    h = fbm(p * 350.0 * k) * 0.3 + str;
  }`;

export default {
  name: { en: "Pumpkin", fa: "کدو حلوایی" }, axes: [0.080, 0.0772, 0.0584], juice: 0xff941a, tint: 0xff990d,
  get uniforms() { return { uFace: { value: face ||= faceTexture() } }; },
  radius(rnd) {
    const L = lumps(rnd, 10, 0.015, 0.2, 0.5);
    return v => {
      const th = Math.acos(Math.max(-1, Math.min(1, v.z))), ph = Math.atan2(v.y, v.x);
      const g = ((1 - Math.cos(10 * ph)) / 2) ** 8;                           // narrow, 1 in the grooves
      let r = 1 + L(v) + (0.03 - 0.11 * g) * Math.sin(th) ** 0.6;            // lobes and grooves
      r -= 0.22 * Math.exp(-((th / 0.45) ** 2));                              // top dimple
      r -= 0.12 * Math.exp(-(((Math.PI - th) / 0.35) ** 2));                  // bottom dimple
      return r + stem(th) * (0.50 + 0.03 * Math.cos(5 * ph));
    };
  },
  post(p, A, v) {                                          // the stem leans a little
    p.x += 0.004 * (A[0] / BLENDER_X) * stem(Math.acos(Math.max(-1, Math.min(1, v.z)))) * Math.max(0, p.z / A[2] - 0.8);
  },
  skin: SKIN, flesh: FLESH,
};
