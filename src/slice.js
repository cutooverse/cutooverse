// Geometry: an icosphere to model fruit on, triangle soups (pieces), slicing a soup by a plane.
// A soup is { P, N, O, M }: 9 floats per triangle for position, normal and opos (where the point sat
// in the whole fruit), and one material id per triangle (0 skin, 1 cut face).
import * as THREE from "three";

export function icosphere(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(v => new THREE.Vector3(...v).normalize());
  let faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for (let l = 0; l < level; l++) {
    const cache = new Map(), next = [];
    const mid = (a, b) => {
      const k = a < b ? a + "_" + b : b + "_" + a;
      if (!cache.has(k)) { cache.set(k, verts.length); verts.push(verts[a].clone().add(verts[b]).normalize()); }
      return cache.get(k);
    };
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = next;
  }
  return { verts, faces };
}

export function volumeAndCentre(P) {
  let V = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < P.length; i += 9) {
    const ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[i + 3], by = P[i + 4], bz = P[i + 5], qx = P[i + 6], qy = P[i + 7], qz = P[i + 8];
    const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
    V += v; cx += v * (ax + bx + qx) / 4; cy += v * (ay + by + qy) / 4; cz += v * (az + bz + qz) / 4;
  }
  return { V: Math.abs(V), c: Math.abs(V) > 1e-12 ? new THREE.Vector3(cx / V, cy / V, cz / V) : new THREE.Vector3() };
}

const DIRS = (() => {                                   // directions for the collision hull
  const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const out = [], n = phone ? 26 : 48, g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y); out.push(new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r)); }
  return out;
})();

export function hullSamples(P) {
  const best = DIRS.map(() => [-Infinity, 0]);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    for (let k = 0; k < DIRS.length; k++) {
      const d = DIRS[k], s = x * d.x + y * d.y + z * d.z;
      if (s > best[k][0]) best[k] = [s, i];
    }
  }
  const seen = new Set(), out = [];
  for (const [, i] of best) if (!seen.has(i)) { seen.add(i); out.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2])); }
  return out;
}

export function makeGeometry(soup) {
  const { P, N, O, M } = soup, T = M.length;
  const order = [];
  for (let m = 0; m < 2; m++) for (let t = 0; t < T; t++) if (M[t] === m) order.push(t);
  const p = new Float32Array(T * 9), n = new Float32Array(T * 9), o = new Float32Array(T * 9);
  order.forEach((t, j) => { p.set(P.subarray(t * 9, t * 9 + 9), j * 9); n.set(N.subarray(t * 9, t * 9 + 9), j * 9); o.set(O.subarray(t * 9, t * 9 + 9), j * 9); });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.setAttribute("opos", new THREE.BufferAttribute(o, 3));
  let skin = 0; for (let t = 0; t < T; t++) if (M[t] === 0) skin++;
  g.addGroup(0, skin * 3, 0); g.addGroup(skin * 3, (T - skin) * 3, 1);
  g.computeBoundingSphere();
  return g;
}

// Slice a soup by the local plane n.p = d. Returns [above, below] or null when the plane misses.
export function slice(soup, n, d) {
  const { P, N, O, M } = soup, T = M.length;
  const side = [{ P: [], N: [], O: [], M: [] }, { P: [], N: [], O: [], M: [] }];
  const segs = [];
  const vert = (t, k) => { const o = t * 9 + k * 3; return { p: [P[o], P[o + 1], P[o + 2]], n: [N[o], N[o + 1], N[o + 2]], o: [O[o], O[o + 1], O[o + 2]] }; };
  const key = v => Math.round(v.p[0] * 1e7) + "," + Math.round(v.p[1] * 1e7) + "," + Math.round(v.p[2] * 1e7);
  const dist = v => v.p[0] * n.x + v.p[1] * n.y + v.p[2] * n.z - d;
  const push = (s, a, b, c, m) => {
    for (const v of [a, b, c]) { s.P.push(...v.p); s.N.push(...v.n); s.O.push(...v.o); }
    s.M.push(m);
  };
  const cut = (a, b) => {                              // the same point from both triangles of an edge
    let ka = key(a), kb = key(b);
    if (ka > kb) { [a, b] = [b, a]; [ka, kb] = [kb, ka]; }
    const da = dist(a), db = dist(b), t = da / (da - db);
    const lerp = (x, y) => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
    const nn = lerp(a.n, b.n), l = Math.hypot(...nn) || 1;
    return { p: lerp(a.p, b.p), n: [nn[0] / l, nn[1] / l, nn[2] / l], o: lerp(a.o, b.o), k: ka + "|" + kb };
  };
  for (let t = 0; t < T; t++) {
    const o = t * 9;
    const s0 = P[o] * n.x + P[o + 1] * n.y + P[o + 2] * n.z - d >= 0;
    const s1 = P[o + 3] * n.x + P[o + 4] * n.y + P[o + 5] * n.z - d >= 0;
    const s2 = P[o + 6] * n.x + P[o + 7] * n.y + P[o + 8] * n.z - d >= 0;
    if (s0 === s1 && s1 === s2) {
      const s = side[s0 ? 0 : 1];
      for (let i = 0; i < 9; i++) { s.P.push(P[o + i]); s.N.push(N[o + i]); s.O.push(O[o + i]); }
      s.M.push(M[t]);
      continue;
    }
    let v = [vert(t, 0), vert(t, 1), vert(t, 2)];
    const sg = [s0, s1, s2];
    const lone = sg[0] !== sg[1] && sg[0] !== sg[2] ? 0 : sg[1] !== sg[0] && sg[1] !== sg[2] ? 1 : 2;
    v = [v[lone], v[(lone + 1) % 3], v[(lone + 2) % 3]];
    const loneSide = sg[lone] ? 0 : 1;
    const i1 = cut(v[0], v[1]), i2 = cut(v[0], v[2]);
    push(side[loneSide], v[0], i1, i2, M[t]);
    push(side[1 - loneSide], i1, v[1], v[2], M[t]);
    push(side[1 - loneSide], i1, v[2], i2, M[t]);
    segs.push([i1, i2]);
  }
  if (!side[0].M.length || !side[1].M.length) return null;
  capFaces(segs, n, side);
  return side.map(s => ({ P: Float32Array.from(s.P), N: Float32Array.from(s.N), O: Float32Array.from(s.O), M: Uint8Array.from(s.M) }));
}

function capFaces(segs, n, side) {
  const byKey = new Map();
  segs.forEach((s, i) => s.forEach(v => { if (!byKey.has(v.k)) byKey.set(v.k, []); byKey.get(v.k).push(i); }));
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const loop = [segs[i][0], segs[i][1]];
    let end = segs[i][1];
    for (let guard = 0; guard < segs.length; guard++) {
      const nextIdx = (byKey.get(end.k) || []).find(j => !used[j]);
      if (nextIdx === undefined) break;
      used[nextIdx] = 1;
      const s = segs[nextIdx], nxt = s[0].k === end.k ? s[1] : s[0];
      if (nxt.k === loop[0].k) break;
      loop.push(nxt); end = nxt;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  if (!loops.length) return;
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const w = new THREE.Vector3().crossVectors(n, u);
  const flat = loops.map(l => l.map(v => new THREE.Vector2(v.p[0] * u.x + v.p[1] * u.y + v.p[2] * u.z, v.p[0] * w.x + v.p[1] * w.y + v.p[2] * w.z)));
  const inside = (pt, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c;
    return c;
  };
  const depth = flat.map((f, i) => flat.reduce((acc, g, j) => acc + (j !== i && inside(f[0], g) ? 1 : 0), 0));
  const outward = [n.clone().negate(), n.clone()];            // side 0 lies above the plane: its cap faces -n
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cr = new THREE.Vector3();
  flat.forEach((outer, i) => {
    if (depth[i] % 2) return;
    const holes = flat.map((h, j) => j).filter(j => depth[j] === depth[i] + 1 && inside(flat[j][0], outer));
    const pts = [...loops[i], ...holes.flatMap(j => loops[j])];
    const tris = THREE.ShapeUtils.triangulateShape(outer, holes.map(j => flat[j]));
    for (const [a, b, c] of tris) {
      for (let s = 0; s < 2; s++) {
        const want = outward[s], A = pts[a], B = pts[b], C = pts[c];
        e1.set(B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]);
        e2.set(C.p[0] - A.p[0], C.p[1] - A.p[1], C.p[2] - A.p[2]);
        const flip = cr.crossVectors(e1, e2).dot(want) < 0;
        const nn = [want.x, want.y, want.z];
        for (const V of flip ? [A, C, B] : [A, B, C]) { side[s].P.push(...V.p); side[s].N.push(...nn); side[s].O.push(...V.o); }
        side[s].M.push(1);
      }
    }
  });
}
