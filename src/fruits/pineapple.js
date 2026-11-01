// Pineapple, ported from chicken/blender/procedural.py (_pine*, _pineapple*) at 0.7 of its size, so
// body and crown fit the board (~20 cm). Blender fuses body, crown core and leaves by voxel remesh;
// here body and core are one surface of revolution and each leaf is a thin closed blade of its own,
// its base buried a little in the core. The body sits on the origin, the crown points along +x.
import { gaussOf, sm, v3 } from "../fruitkit.js";

const K = 0.7;                                        // Blender size -> game size
const HL = 0.085 * K, R = 0.055 * K;                  // body half length, radius at the waist
const CX = HL - 0.006 * K;                            // where the crown grows out of the body
const CORE = [CX + 0.012 * K, 0.024 * K, 0.021 * K];  // crown core: centre x, half length, radius
const LEAF = 0.8 * K;                                 // leaves a little shorter than Blender's
const PA = 2 * Math.PI * R / 12, PH = PA * Math.sqrt(3) / 2, SHEAR = 0.18 * PA, CIRC = 2 * Math.PI * R;   // 12 fruitlets around
const f6 = v => v.toFixed(6);

const bodyR = x => { const t = Math.abs(x) / HL; return t > 1 ? -1 : R * Math.max(0, 1 - t ** 2.8) ** (1 / 2.8) * (1 - 0.1 * Math.min(Math.max(x / HL, 0), 1)); };
const coreR = x => { const u = (x - CORE[0]) / CORE[1]; return Math.abs(u) > 1 ? -1 : CORE[2] * Math.sqrt(1 - u * u); };
const radius = x => Math.max(bodyR(x), coreR(x));    // the solid: body and crown core (-1 past the ends)

// hexagonal fruitlet lattice, sheared rows give the spiral: distance to the cell centre, 1 at its edge
function cells(x, ang) {
  const s = ang * R, j0 = Math.round(x / PH);
  let best = 1e9;
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    const off = (((j % 2) + 2) % 2) * 0.5 * PA + j * SHEAR, i = Math.round((s - off) / PA);
    const ds = ((s - (i * PA + off) + CIRC / 2) % CIRC + CIRC) % CIRC - CIRC / 2;
    best = Math.min(best, Math.hypot(ds, x - j * PH));
  }
  return Math.min(best / (0.56 * PA), 1);
}

// m + 1 points evenly spaced along the polyline P of [x, r]
function along(P, m) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const out = [];
  for (let i = 0, k = 0; i <= m; i++) {
    const s = L[L.length - 1] * i / m;
    while (k < L.length - 2 && L[k + 1] < s) k++;
    const u = (s - L[k]) / (L[k + 1] - L[k] || 1);
    out.push([P[k][0] + (P[k + 1][0] - P[k][0]) * u, P[k][1] + (P[k + 1][1] - P[k][1]) * u]);
  }
  return out;
}

// outline from the bottom pole up the barrel (a superellipse), over the crown core to its tip,
// smoothed ~1 mm where the core rises out of the flat top (Blender: remesh + smooth)
function outline(n) {
  const P = [], inCore = (x, r) => ((x - CORE[0]) / CORE[1]) ** 2 + (r / CORE[2]) ** 2 < 1;
  for (let i = 0; i <= 2000; i++) {
    const f = Math.PI * i / 2000, c = Math.cos(f), t = -Math.sign(c) * Math.abs(c) ** (2 / 2.8);
    const x = t * HL, r = R * Math.abs(Math.sin(f)) ** (2 / 2.8) * (1 - 0.1 * Math.max(t, 0));
    if (inCore(x, r)) {
      for (let a = Math.atan2(r / CORE[2], (x - CORE[0]) / CORE[1]); a > 0; a -= 0.002) P.push([CORE[0] + CORE[1] * Math.cos(a), CORE[2] * Math.sin(a)]);
      break;
    }
    P.push([x, r]);
  }
  P.push([CORE[0] + CORE[1], 0]);
  let Q = along(P, 800);
  for (let it = 0; it < 60; it++) Q = Q.map((q, i) => i === 0 || i === Q.length - 1 ? q : [(Q[i - 1][0] + 2 * q[0] + Q[i + 1][0]) / 4, (Q[i - 1][1] + 2 * q[1] + Q[i + 1][1]) / 4]);
  return along(Q, n);
}

const pt = (b, d, n1, n2, u, v, w) => [0, 1, 2].map(i => b[i] + d[i] * u + n1[i] * v + n2[i] * w);

// one closed, tapered blade from b along d, its width along n1, curling outward along n2 = d x n1
function leaf(pos, faces, b, d, n1, n2, len, wid, thick, curl, segs, around) {
  let s0 = 0;                                          // start where it leaves the core, 2 mm inside it
  for (let s = 0; s < 0.6; s += 0.005) {
    const q = pt(b, d, n1, n2, s * len, 0, curl * len * s * s);
    if (Math.hypot(q[1], q[2]) > radius(q[0])) { s0 = Math.max(0, s - 0.003 * K / len); break; }
  }
  const first = pos.length;
  for (let k = 0; k <= segs; k++) {
    const s = s0 + (1 - s0) * k / segs, w = 0.5 * wid * Math.max(0, 1 - s) ** 0.8 +0.0018 * K, th = 0.5 * thick * (1 - 0.5 * s) + 0.0006 * K;
    for (let j = 0; j < around; j++) {
      const a = 2 * Math.PI * j / around, c = Math.cos(a);
      pos.push(pt(b, d, n1, n2, s * len, w * c, curl * len * s * s + th * Math.sin(a) - 0.2 * w * c * c));   // edges turn up: a channel
    }
  }
  const b0 = pos.length; pos.push(pt(b, d, n1, n2, s0 * len - 0.002 * K, 0, curl * len * s0 * s0));
  const tip = pos.length; pos.push(pt(b, d, n1, n2, len + 0.003 * K, 0, curl * len));
  const V = (k, j) => first + k * around + (j % around);
  for (let k = 0; k < segs; k++) for (let j = 0; j < around; j++) faces.push([V(k, j), V(k, j + 1), V(k + 1, j + 1)], [V(k, j), V(k + 1, j + 1), V(k + 1, j)]);
  for (let j = 0; j < around; j++) faces.push([b0, V(0, j + 1), V(0, j)], [tip, V(segs, j), V(segs, j + 1)]);
}

const GL = /* glsl */`
  const float PN_HL = ${f6(HL)}, PN_R = ${f6(R)}, PN_CX = ${f6(CX)};
  const float PN_A = ${f6(PA)}, PN_H = ${f6(PH)}, PN_SH = ${f6(SHEAR)}, PN_C = ${f6(CIRC)};
  float pineBody(float x) {
    float t = min(abs(x) / PN_HL, 1.0);
    return PN_R * pow(max(1.0 - pow(t, 2.8), 0.0), 0.357143) * (1.0 - 0.10 * clamp(x / PN_HL, 0.0, 1.0));
  }
  // x: distance to the fruitlet centre (1 at its edge), y: that fruitlet's random value
  vec2 pineCells(vec3 p) {
    float s = atan(p.z, p.y) * PN_R, j0 = floor(p.x / PN_H + 0.5), best = 1e9, cid = 0.0;
    for (int k = -1; k <= 1; k++) {
      float j = j0 + float(k);
      float off = mod(j, 2.0) * 0.5 * PN_A + j * PN_SH;
      float i = floor((s - off) / PN_A + 0.5);
      float ds = mod(s - (i * PN_A + off) + PN_C * 0.5, PN_C) - PN_C * 0.5;
      float d = length(vec2(ds, p.x - j * PN_H));
      if (d < best) { best = d; cid = hash13(vec3(mod(i, 12.0), j, 4.1)); }
    }
    return vec2(clamp(best / (0.56 * PN_A), 0.0, 1.0), cid);
  }`;

const SKIN = GL + /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec2 c = pineCells(p);
    float dn = c.x;
    float body = step(p.x, PN_CX - ${f6(0.002 * K)}) * step(0.55 * pineBody(p.x), length(p.yz));   // 0 on the crown
    vec3 b = lin(${v3([0.18, 0.10, 0.04])});                                 // the eye
    b = seg(b, lin(${v3([0.41, 0.24, 0.08])}), dn, 0.00, 0.16);
    b = seg(b, lin(${v3([0.78, 0.48, 0.11])}), dn, 0.16, 0.30);
    b = seg(b, lin(${v3([0.92, 0.65, 0.16])}), dn, 0.30, 0.62);
    b = seg(b, lin(${v3([0.58, 0.55, 0.15])}), dn, 0.62, 0.86);
    b = seg(b, lin(${v3([0.25, 0.21, 0.08])}), dn, 0.86, 1.00);
    b *= mix(0.78, 1.12, c.y);
    b = mix(b, lin(${v3([0.38, 0.45, 0.13])}), smoothstep(0.0, PN_CX, p.x) * 0.45 * c.y);   // greener toward the crown
    vec3 cr = seg(lin(${v3([0.09, 0.25, 0.10])}), lin(${v3([0.25, 0.43, 0.20])}), fbm(p * ${f6(90 / K)}), 0.35, 0.70);
    cr = mix(cr, lin(${v3([0.45, 0.33, 0.13])}), smoothstep(PN_CX + ${f6(0.075 * LEAF)}, PN_CX + ${f6(0.115 * LEAF)}, p.x) * 0.7);   // dry tips
    col = mix(cr, b, body);
    float relief = 0.5 * (1.0 - dn * dn) - 0.5 * clamp((dn - 0.82) / 0.18, 0.0, 1.0) - 0.4 * exp(-dn * dn / 0.0256);
    h = fbm(p * ${f6(300 / K)}) * 0.35 + relief * body * (1.0 - smoothstep(PN_CX - ${f6(0.012 * K)}, PN_CX - ${f6(0.002 * K)}, p.x));
    rough = mix(0.38, 0.62, body);
  }`;

const FLESH = GL + /* glsl */`
  float pineFib(float a, float rc, float x) { return fbm(vec3(a * 9.0, rc * 1.5, x * ${f6(30 / K)}) * 4.0); }
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float rc = length(p.yz) / (PN_R * (1.0 - 0.10 * clamp(p.x / PN_HL, 0.0, 1.0)));
    float se = pow(pow(min(abs(p.x) / PN_HL, 2.0), 2.8) + pow(rc, 2.8), 0.357143);   // 1 on the skin, flat ends too
    float rr = max(rc, 1.0 + (se - 1.0) * 3.0);
    col = lin(${v3([0.94, 0.84, 0.46])});                                     // pale woody core
    col = seg(col, lin(${v3([0.96, 0.80, 0.36])}), rr, 0.00, 0.20);
    col = seg(col, lin(${v3([1.00, 0.76, 0.12])}), rr, 0.20, 0.30);
    col = seg(col, lin(${v3([1.00, 0.78, 0.15])}), rr, 0.30, 0.80);
    col = seg(col, lin(${v3([0.98, 0.84, 0.38])}), rr, 0.80, 0.93);
    col = seg(col, lin(${v3([0.82, 0.66, 0.26])}), rr, 0.93, 1.05);
    float a = atan(p.z, p.y);
    float fib = mix(pineFib(a, rc, p.x), pineFib(a - 6.283185, rc, p.x), smoothstep(2.6, 3.141593, a));   // no seam at -y
    col *= mix(0.85, 1.10, clamp(fib, 0.0, 1.0));
    float eye = (1.0 - smoothstep(0.08, 0.20, worley(p * ${f6(55 / K)}).x)) * smoothstep(0.80, 0.92, rr);
    col = mix(col, lin(${v3([0.48, 0.31, 0.10])}), eye);
    col = mix(col, lin(${v3([0.62, 0.74, 0.38])}), smoothstep(PN_CX - ${f6(0.002 * K)}, PN_CX + ${f6(0.006 * K)}, p.x));   // crown tissue
    rough = 0.2;
    h = fib * 0.6;
  }`;

export default {
  name: { en: "Pineapple", fa: "آناناس" },
  axes: [CORE[0] + CORE[1], R + 0.0035 * K, R + 0.0035 * K],   // the solid part; the leaves reach x ~ +0.14
  juice: 0xffdb52, tint: 0xffc426,
  mesh(rnd, level) {
    const hi = level >= 5, na = hi ? 96 : 48, nr = hi ? 100 : 50;
    const prof = outline(nr), pos = [[prof[0][0], 0, 0]], faces = [];
    for (let k = 1; k < nr; k++) {
      const [x, r] = prof[k], tx = prof[k + 1][0] - prof[k - 1][0], tr = prof[k + 1][1] - prof[k - 1][1];
      // fruitlet domes, a groove at their edges and a dimple (the eye), faded out on the flat ends and under the crown
      const fade = sm(CX - 0.002 * K, CX - 0.012 * K, x) * (tx * tx) / (tx * tx + tr * tr);
      for (let j = 0; j < na; j++) {
        const a = 2 * Math.PI * j / na, dn = cells(x, a);
        const rr = r + K * fade * (0.0035 * (1 - dn * dn) - 0.0015 * Math.min(Math.max((dn - 0.82) / 0.18, 0), 1) - 0.0012 * Math.exp(-((dn / 0.16) ** 2)));
        pos.push([x, rr * Math.cos(a), rr * Math.sin(a)]);
      }
    }
    const V = (k, j) => 1 + (k - 1) * na + (j % na), top = pos.length;
    pos.push([prof[nr][0], 0, 0]);
    for (let k = 1; k < nr - 1; k++) for (let j = 0; j < na; j++) faces.push([V(k, j), V(k, j + 1), V(k + 1, j + 1)], [V(k, j), V(k + 1, j + 1), V(k + 1, j)]);
    for (let j = 0; j < na; j++) faces.push([0, V(1, j + 1), V(1, j)], [top, V(nr - 1, j), V(nr - 1, j + 1)]);
    // crown: three rings of leaves, steep in the middle, spreading outward
    const g = gaussOf(rnd), U = (a, b) => a + rnd() * (b - a), segs = hi ? 10 : 6, around = hi ? 8 : 6;
    for (const [count, tilt, len, rb, wk] of [[5, 7, 0.120, 0.008, 0.75], [8, 20, 0.105, 0.014, 0.9], [10, 31, 0.085, 0.019, 1]]) {
      const ph0 = U(0, 2 * Math.PI);
      for (let i = 0; i < count; i++) {
        const ph = ph0 + 2 * Math.PI * i / count + g() * 0.12, al = (tilt + g() * 3) * Math.PI / 180;
        const d = [Math.cos(al), Math.sin(al) * Math.cos(ph), Math.sin(al) * Math.sin(ph)];
        let n1 = [0, -Math.sin(ph), Math.cos(ph)];                         // the width runs around the axis
        let n2 = [d[1] * n1[2] - d[2] * n1[1], d[2] * n1[0] - d[0] * n1[2], d[0] * n1[1] - d[1] * n1[0]];
        if (n2[1] * Math.cos(ph) + n2[2] * Math.sin(ph) < 0) { n1 = n1.map(v => -v); n2 = n2.map(v => -v); }   // curl away from the axis
        leaf(pos, faces, [CX + 0.010 * K, rb * K * Math.cos(ph), rb * K * Math.sin(ph)], d, n1, n2,
          len * LEAF * U(0.85, 1.1), U(0.018, 0.024) * K * wk, 0.0045 * K, U(0.10, 0.22), segs, around);
      }
    }
    return { pos, faces };
  },
  skin: SKIN, flesh: FLESH,
  inside: (x, y, z) => Math.hypot(y, z) <= radius(x),
  shell: (x, y, z, e) => { const r = Math.hypot(y, z), d = 1.3 * e; return r + d > radius(x) || r > radius(x - d) || r > radius(x + d); },
  vol: (() => { const x0 = -HL, x1 = CORE[0] + CORE[1], n = 400; let v = 0; for (let i = 0; i < n; i++) v += Math.PI * Math.max(radius(x0 + (i + 0.5) * (x1 - x0) / n), 0) ** 2; return v * (x1 - x0) / n; })(),
};
