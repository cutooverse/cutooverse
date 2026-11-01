// Coconut, ported from chicken/blender/procedural.py (_coco_*): a brown husked shell around an empty
// cavity, one closed surface. Two UV spheres (poles on x): the outer husk and the inner cavity wall,
// each with its +x pole cut away, bridged by a narrow tunnel at the soft eye, so cuts leave rings of
// white meat. The cavity wall is drawn with the inside material.
import * as THREE from "three";
import { lumps } from "../fruitkit.js";

const AXES = [0.064, 0.056, 0.056];                       // a 13 cm husked coconut, eyes at +x
const WALL = 0.014;                                       // shell (~3 mm) + white meat (~11 mm)
const AXI = AXES.map(a => a - WALL);                      // the cavity
const MOUTH = 1.5 * Math.PI / 64;                         // rings this close to the +x pole are cut away
const SHELL_IN = 1 - 0.003 / AXES[1] - 0.02;              // inside edge of the shell (+ the ridges), in length(p / AX)

// the husk's radius along a unit direction, without the random lumps: three ridges toward the eyes
// and a slightly pointed eye end
const husk = (x, y, z) => 1 + 0.022 * Math.sqrt(Math.max(0, 1 - x * x)) * Math.cos(3 * Math.atan2(z, y)) * (0.5 + 0.5 * x)
  + 0.05 * Math.max(0, x) ** 6;

// UV sphere, poles on x, V rings from pole to pole and 2V around; the +x pole and the rings inside
// MOUTH are left out. Outward-wound (flip: wound toward the centre). Returns the mouth ring's indices.
function sphere(pos, faces, V, axes, rad, flip) {
  const U = 2 * V, i0 = Math.floor(MOUTH * V / Math.PI) + 1, base = pos.length;
  for (let i = i0; i < V; i++) for (let j = 0; j < U; j++) {
    const th = i * Math.PI / V, ph = 2 * Math.PI * j / U;
    const v = new THREE.Vector3(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
    const r = rad(v);
    pos.push([v.x * r * axes[0], v.y * r * axes[1], v.z * r * axes[2]]);
  }
  const pole = pos.length;
  pos.push([-rad(new THREE.Vector3(-1, 0, 0)) * axes[0], 0, 0]);
  const id = (i, j) => base + (i - i0) * U + (j % U);
  const tri = (a, b, c) => faces.push(flip ? [a, c, b] : [a, b, c]);
  for (let j = 0; j < U; j++) {
    for (let i = i0; i < V - 1; i++) { tri(id(i, j), id(i + 1, j), id(i + 1, j + 1)); tri(id(i, j), id(i + 1, j + 1), id(i, j + 1)); }
    tri(id(V - 1, j), pole, id(V - 1, j + 1));
  }
  return Array.from({ length: U }, (_, j) => id(i0, j));
}

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float fib = fbm(p * vec3(0.12, 1.0, 1.0) * 420.0);                        // hairy fibres run end to end
    col = seg(lin(vec3(0.17, 0.09, 0.04)), lin(vec3(0.38, 0.23, 0.10)), fbm(p * 20.0), 0.25, 0.75);
    col = mix(col, lin(vec3(0.70, 0.52, 0.32)), smoothstep(0.50, 0.66, fib) * 0.85);   // light strands
    float ex = AX.x * 1.05;                                                   // three eyes in a triangle around the +x pole
    float eye = smoothstep(0.80, 0.97, cos(atan(p.z, p.y) * 3.0 + 0.6))
      * smoothstep(ex * 0.86, ex * 0.92, p.x) * smoothstep(ex * 0.99, ex * 0.95, p.x);
    float eyes = max(eye, smoothstep(ex * 0.985, ex * 0.995, p.x));          // and the soft eye at the pole
    col = mix(col, lin(vec3(0.09, 0.05, 0.025)), eyes);
    rough = 0.9;
    h = fib - eyes;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    const float SI = ${SHELL_IN.toFixed(4)};
    float rr = length(p / AX);
    col = lin(vec3(0.97, 0.96, 0.93));                                        // white meat
    col = seg(col, lin(vec3(0.66, 0.48, 0.29)), rr, SI - 0.035, SI - 0.02);   // thin brown skin
    col = seg(col, lin(vec3(0.37, 0.22, 0.11)), rr, SI - 0.02, SI);           // shell
    col = seg(col, lin(vec3(0.30, 0.17, 0.09)), rr, SI, 1.0);
    float g = fbm(p * 300.0);
    col *= mix(0.94, 1.03, clamp(g, 0.0, 1.0));
    rough = mix(0.32, 0.8, smoothstep(SI - 0.03, SI, rr));                    // moist meat, matte shell
    h = g * 0.5;
  }`;

export default {
  name: { en: "Coconut", fa: "نارگیل" }, axes: AXES, juice: 0xf0f2ed, tint: 0xf7f5ed,
  // level 5: Blender's 128 x 64 spheres; each level down halves both
  mesh(rnd, level) {
    const V = 2 ** (Math.max(2, level) + 1), pos = [], faces = [];
    const L = lumps(rnd, 10, 0.015, 0.15, 0.4);
    const outer = sphere(pos, faces, V, AXES, v => husk(v.x, v.y, v.z) + L(v), false);
    const nOuter = faces.length;
    const inner = sphere(pos, faces, V, AXI, () => 1, true);
    const nInner = faces.length - nOuter;
    for (let j = 0; j < outer.length; j++) {                // the tunnel through the eye
      const k = (j + 1) % outer.length;
      faces.push([outer[j], outer[k], inner[k]], [outer[j], inner[k], inner[j]]);
    }
    const mat = new Uint8Array(faces.length);
    mat.fill(1, nOuter, nOuter + nInner);
    return { pos, faces, mat };
  },
  // in the white meat or the shell, not in the cavity or the tunnel
  inside(x, y, z) {
    if ((x / AXI[0]) ** 2 + (y / AXI[1]) ** 2 + (z / AXI[2]) ** 2 < 1.03 ** 2) return false;
    if (x > 0 && y * y + z * z < 0.006 ** 2) return false;
    const qx = x / AXES[0], qy = y / AXES[1], qz = z / AXES[2], s = Math.hypot(qx, qy, qz);
    return s <= 0.97 * husk(qx / s, qy / s, qz / s);
  },
  shell(x, y, z, e) {
    const qx = x / AXES[0], qy = y / AXES[1], qz = z / AXES[2], s = Math.hypot(qx, qy, qz);
    return s > husk(qx / s, qy / s, qz / s) - 1.3 * e / AXES[1];
  },
  vol: 4 / 3 * Math.PI * (AXES[0] * AXES[1] * AXES[2] * 1.011 - AXI[0] * AXI[1] * AXI[2]),   // 1.011: the pointed eye end
  skin: SKIN, flesh: FLESH,
};
