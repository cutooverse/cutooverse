// Bamboo, ported from chicken/blender/procedural.py (_bamboo*): a length of green cane, open at both
// ends, with two growth nodes. Same cross-section as Blender's, cut to 24 cm (Blender: 30) to fit
// the board. One closed surface: outer wall, inner wall (facing into the bore) and the two ring
// ends, which are drawn as cut faces (flesh): that is what a sawn end looks like.
import { v3 } from "../fruitkit.js";

const HL = 0.12;                                      // half length
const R = 0.028, RI = 0.0205;                         // outer and inner radius: a 7.5 mm wall
const NODES = [-0.072, 0.058];                        // growth nodes along x
const f6 = v => v.toFixed(6);

const taper = x => 1 + 0.04 * x / 0.15;               // Blender's taper, per metre the same
const inner = x => RI * taper(x);
function outer(x, a = 0, phase = 0) {
  let r = R * taper(x);
  for (const xn of NODES) r += 0.0017 * Math.exp(-(((x - xn) / 0.0024) ** 2)) + 0.0005 * Math.exp(-(((x - xn - 0.006) / 0.006) ** 2));   // ridge, swelling above it
  return r * (1 + 0.012 * Math.cos(2 * a + phase));   // not perfectly round
}

const SKIN = /* glsl */`
  void bambooNode(inout vec3 col, float d) {          // a dark line and a pale waxy band just below
    col = mix(col, lin(${v3([0.13, 0.15, 0.05])}), 1.0 - smoothstep(0.0, 0.0008, abs(d)));
    col = mix(col, lin(${v3([0.68, 0.74, 0.57])}), smoothstep(-0.014, -0.006, d) * (1.0 - smoothstep(-0.004, -0.001, d)) * 0.45);
  }
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 q = p * vec3(4.0, 70.0, 70.0);                                       // streaks along the cane
    col = seg(lin(${v3([0.10, 0.26, 0.07])}), lin(${v3([0.26, 0.46, 0.12])}), fbm(q), 0.30, 0.72);
    col = mix(col, lin(${v3([0.50, 0.55, 0.16])}), smoothstep(0.58, 0.72, fbm(p * 9.0)) * 0.45);   // yellowing patches
    bambooNode(col, p.x - (${f6(NODES[0])}));
    bambooNode(col, p.x - (${f6(NODES[1])}));
    float bore = 1.0 - smoothstep(${f6(RI * 1.05 + 0.0002)}, ${f6(RI * 1.05 + 0.0008)}, length(p.yz));
    col = mix(col, lin(${v3([0.88, 0.84, 0.60])}), bore);                    // inner wall: pale and papery
    rough = mix(0.40, 0.85, bore);
    h = fbm(q * 12.0) * 0.5;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float tp = 1.0 + 0.04 * p.x / 0.15;
    float t = clamp((length(p.yz) - ${f6(RI)} * tp) / (${f6(R - RI)} * tp), 0.0, 1.0);   // 0 at the bore, 1 at the skin
    col = lin(${v3([0.92, 0.87, 0.64])});
    col = seg(col, lin(${v3([0.87, 0.78, 0.51])}), t, 0.00, 0.50);
    col = seg(col, lin(${v3([0.67, 0.67, 0.32])}), t, 0.50, 0.86);
    col = seg(col, lin(${v3([0.18, 0.35, 0.08])}), t, 0.86, 0.93);
    col = seg(col, lin(${v3([0.14, 0.29, 0.06])}), t, 0.93, 1.00);
    float dots = 1.0 - smoothstep(0.12, 0.26, worley(p * vec3(42.0, 420.0, 420.0)).x);   // vascular bundles, long along x
    col = mix(col, lin(${v3([0.53, 0.48, 0.25])}), dots * (t * 0.7 + 0.2));
    rough = 0.5;
    h = fbm(p * vec3(6.0, 450.0, 450.0)) * 0.6;
  }`;

export default {
  name: { en: "Bamboo", fa: "بامبو" },
  axes: [HL, outer(NODES[1]) * 1.012, outer(NODES[1]) * 1.012],
  juice: 0xe6f5d6, tint: 0xe0d29a,
  mesh(rnd, level) {
    const q = level >= 5 ? 1 : 2, na = 64 / q, phase = rnd() * 2 * Math.PI;
    const e = 0.0004;                                  // a ring this close to each rim: the smooth normals stay on the rim
    const uniq = xs => [...new Set(xs.map(x => Math.round(x * 1e5) / 1e5))].sort((a, b) => a - b);
    const xs = [-HL + e, HL - e], xi = [-HL + e, HL - e];
    for (let i = 0, n = 60 / q; i <= n; i++) xs.push(-HL + 2 * HL * i / n);   // every 4 mm (8 on phones)
    for (const xn of NODES) for (let i = 0; i < 22 / q; i++) xs.push(xn - 0.008 + 0.001 * q * i);   // finer at the nodes
    for (let i = 0, n = 30 / q; i <= n; i++) xi.push(-HL + 2 * HL * i / n);   // the bore is a plain cone
    // rings around the wall's cross-section: along the skin, in over the +x end, back through the
    // bore, out over the -x end; each joined to the next, the last to the first
    const pos = [], faces = [], mat = [], rings = [];
    const ring = (x, r, end) => {
      rings.push({ at: pos.length, end });
      for (let j = 0; j < na; j++) { const a = 2 * Math.PI * j / na, rr = r(a); pos.push([x, rr * Math.cos(a), rr * Math.sin(a)]); }
    };
    uniq(xs).forEach((x, k, l) => ring(x, a => outer(x, a, phase), k === 0 || k === l.length - 1));
    ring(HL, a => outer(HL, a, phase) - e, true); ring(HL, () => inner(HL) + e, true);
    uniq(xi).reverse().forEach((x, k, l) => ring(x, () => inner(x), k === 0 || k === l.length - 1));
    ring(-HL, () => inner(-HL) + e, true); ring(-HL, a => outer(-HL, a, phase) - e, true);
    rings.forEach((A, k) => {
      const B = rings[(k + 1) % rings.length], m = A.end && B.end ? 1 : 0;   // the two ends are drawn as cut faces
      for (let j = 0; j < na; j++) {
        const j2 = (j + 1) % na;
        faces.push([A.at + j, A.at + j2, B.at + j2], [A.at + j, B.at + j2, B.at + j]); mat.push(m, m);
      }
    });
    return { pos, faces, mat };
  },
  skin: SKIN, flesh: FLESH,
  inside: (x, y, z) => { const r = Math.hypot(y, z); return Math.abs(x) <= HL && r >= inner(x) && r <= outer(x); },
  shell: (x, y, z, e) => Math.hypot(y, z) > outer(x) - 1.3 * e,
  vol: Math.PI * (R * R - RI * RI) * 2 * HL,
};
