// "Your photo": cut the object out of a photo (flood fill from the edges, or the PNG's own
// transparency), then puff its outline up into a closed pillow-like body with the photo on the
// front and back. The result is a fruit like the others: it slices, chops and bursts.
import * as THREE from "three";

const MAXPX = 360;                           // working size: plenty for a shape 13 cm across
const SIZE_M = 0.13;                         // the longest side, in metres

export function loadImage(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("not an image")); };
    img.src = url;
  });
}

export function prepare(img) {
  const k = Math.min(1, MAXPX / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const W = Math.max(8, Math.round((img.naturalWidth || img.width) * k)), H = Math.max(8, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H);
  let clear = 0, border = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { border++; if (data.data[(y * W + x) * 4 + 3] < 20) clear++; }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { border++; if (data.data[(y * W + x) * 4 + 3] < 20) clear++; }
  return { W, H, data, hasAlpha: clear > border * 0.3 };
}

// 1 = object. tol: how different from the background a colour must be to count as object (0..120).
export function segment(prep, tol) {
  const { W, H, data, hasAlpha } = prep, d = data.data, N = W * H;
  let m = new Uint8Array(N);
  if (hasAlpha) {
    for (let i = 0; i < N; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0;
  } else {
    const bg = new Uint8Array(N), q = new Int32Array(N);
    const t2 = tol * tol, near2 = (tol * 0.35) ** 2;
    const dist2 = (i, r, g, b) => { const o = i * 4; return (d[o] - r) ** 2 + (d[o + 1] - g) ** 2 + (d[o + 2] - b) ** 2; };
    const fillFrom = s => {
      if (bg[s]) return;
      const r = d[s * 4], g = d[s * 4 + 1], b = d[s * 4 + 2];
      let head = 0, tail = 0; q[tail++] = s; bg[s] = 1;
      while (head < tail) {
        const i = q[head++], x = i % W, y = (i / W) | 0, o = i * 4;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j < 0 || bg[j]) continue;
          if (dist2(j, r, g, b) < t2 || dist2(j, d[o], d[o + 1], d[o + 2]) < near2) { bg[j] = 1; q[tail++] = j; }
        }
      }
    };
    for (let x = 0; x < W; x++) { fillFrom(x); fillFrom((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { fillFrom(y * W); fillFrom(y * W + W - 1); }
    for (let i = 0; i < N; i++) m[i] = bg[i] ? 0 : 1;
  }
  m = morph(m, W, H, 1, true); m = morph(m, W, H, 1, false);       // close small gaps
  m = morph(m, W, H, 1, false); m = morph(m, W, H, 1, true);       // drop thin specks
  m = largest(m, W, H);
  fillHoles(m, W, H);
  return m;
}

function morph(m, W, H, r, grow) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = grow ? 0 : 1;
    for (let dy = -r; dy <= r && v === (grow ? 0 : 1); dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : m[yy * W + xx];
      if (grow && s) { v = 1; break; }
      if (!grow && !s) { v = 0; break; }
    }
    out[y * W + x] = v;
  }
  return out;
}

function largest(m, W, H) {
  const lab = new Int32Array(m.length), q = new Int32Array(m.length);
  let best = 0, bestSize = 0, id = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    id++; let head = 0, tail = 0; q[tail++] = s; lab[s] = id;
    while (head < tail) {
      const i = q[head++], x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
        if (j >= 0 && m[j] && !lab[j]) { lab[j] = id; q[tail++] = j; }
    }
    if (tail > bestSize) { bestSize = tail; best = id; }
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = lab[i] === best ? 1 : 0;
  return out;
}

function fillHoles(m, W, H) {
  const out = new Uint8Array(m.length), q = new Int32Array(m.length);
  let head = 0, tail = 0;
  const seed = i => { if (!m[i] && !out[i]) { out[i] = 1; q[tail++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (head < tail) {
    const i = q[head++], x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0) seed(j);
  }
  for (let i = 0; i < m.length; i++) if (!out[i]) m[i] = 1;   // background the edges never reach is a hole
}

export function coverage(m) { let s = 0; for (const v of m) s += v; return s / m.length; }

// The object cropped out, transparent around it (for the preview and for keeping it).
export function cutout(prep, m) {
  const { W, H, data } = prep;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const pad = 2, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2;
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const g = c.getContext("2d"), out = g.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = x + x0 - pad, sy = y + y0 - pad, o = (y * cw + x) * 4;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H || !m[sy * W + sx]) continue;
    const s = (sy * W + sx) * 4;
    out.data[o] = data.data[s]; out.data[o + 1] = data.data[s + 1]; out.data[o + 2] = data.data[s + 2]; out.data[o + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}

// ------------------------------------------------------------------ the body
export const INSIDES = ["cake", "jelly", "photo"];

export function buildPhotoFruit(cut, inside = "cake") {
  const W = cut.width, H = cut.height;
  const px = cut.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  let rs = 0, gs = 0, bs = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 128) { m[i] = 1; rs += px[i * 4]; gs += px[i * 4 + 1]; bs += px[i * 4 + 2]; n++; }
  if (n < 50) throw new Error("empty");
  const avg = new THREE.Color(rs / n / 255, gs / n / 255, bs / n / 255);
  const dist = chamfer(m, W, H);
  let dmax = 1; for (const v of dist) dmax = Math.max(dmax, v);
  const k = SIZE_M / Math.max(W, H);                    // metres per pixel
  const Hmax = Math.min(0.032, 0.5 * dmax * k);         // half the thickness at the thickest point
  const hAt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { if (!m[i]) continue; const t = Math.min(1, dist[i] / dmax); hAt[i] = Hmax * Math.sqrt(1 - (1 - t) ** 2); }
  const cx = W / 2, cy = H / 2;
  const toX = x => (x - cx) * k, toY = y => (cy - y) * k;

  // grid of vertices over the outline; a cell counts when its four corners are inside
  const step = Math.max(1.5, Math.max(W, H) / 90);
  const GW = Math.floor((W - 1) / step) + 1, GH = Math.floor((H - 1) / step) + 1;
  const at = (gx, gy) => { const x = Math.min(W - 1, Math.round(gx * step)), y = Math.min(H - 1, Math.round(gy * step)); return y * W + x; };
  const ins = (gx, gy) => gx >= 0 && gy >= 0 && gx < GW && gy < GH && m[at(gx, gy)] === 1;
  const cell = (gx, gy) => ins(gx, gy) && ins(gx + 1, gy) && ins(gx, gy + 1) && ins(gx + 1, gy + 1);
  const used = new Int8Array(GW * GH), edge = new Int8Array(GW * GH);
  for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) if (cell(gx, gy)) for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) used[(gy + ay) * GW + gx + ax] = 1;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (!used[gy * GW + gx]) continue;
    if (!(cell(gx - 1, gy - 1) && cell(gx, gy - 1) && cell(gx - 1, gy) && cell(gx, gy))) edge[gy * GW + gx] = 1;
  }
  const pos = [], front = new Int32Array(GW * GH).fill(-1), back = new Int32Array(GW * GH).fill(-1);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const g = gy * GW + gx;
    if (!used[g]) continue;
    const i = at(gx, gy), x = toX(gx * step), y = toY(gy * step), h = edge[g] ? 0 : hAt[i];
    front[g] = pos.length; pos.push(new THREE.Vector3(x, y, h));
    if (edge[g]) back[g] = front[g];                    // the rim is shared: the body is closed
    else { back[g] = pos.length; pos.push(new THREE.Vector3(x, y, -h)); }
  }
  const tris = [];
  for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
    if (!cell(gx, gy)) continue;
    const a = gy * GW + gx, b = a + 1, c = a + GW + 1, d = a + GW;
    tris.push([front[a], front[d], front[c]], [front[a], front[c], front[b]]);   // facing +z (image y is flipped)
    tris.push([back[a], back[c], back[d]], [back[a], back[b], back[c]]);
  }
  // round off the stair-steps of the outline: slide rim vertices toward their rim neighbours
  const rimNb = new Map(), count = new Map();
  for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const kk = p < q ? `${p}_${q}` : `${q}_${p}`; count.set(kk, (count.get(kk) || 0) + 1); }
  const isRim = new Uint8Array(pos.length);
  for (let g = 0; g < GW * GH; g++) if (edge[g] && front[g] >= 0) isRim[front[g]] = 1;
  for (const [kk] of count) {
    const [p, q] = kk.split("_").map(Number);
    if (isRim[p] && isRim[q]) { (rimNb.get(p) || rimNb.set(p, []).get(p)).push(q); (rimNb.get(q) || rimNb.set(q, []).get(q)).push(p); }
  }
  for (let it = 0; it < 4; it++) {
    const next = new Map();
    for (const [p, nb] of rimNb) {
      const s = new THREE.Vector3(); nb.forEach(q => s.add(pos[q])); s.divideScalar(nb.length);
      next.set(p, pos[p].clone().lerp(s, 0.5));
    }
    for (const [p, v] of next) pos[p].set(v.x, v.y, 0);
  }
  const nrm = pos.map(() => new THREE.Vector3());
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (const [a, b, c] of tris) { e1.subVectors(pos[b], pos[a]); e2.subVectors(pos[c], pos[a]); fn.crossVectors(e1, e2); nrm[a].add(fn); nrm[b].add(fn); nrm[c].add(fn); }
  nrm.forEach(v => v.normalize());
  const T = tris.length, P = new Float32Array(T * 9), N = new Float32Array(T * 9), O = new Float32Array(T * 9), M = new Uint8Array(T);
  tris.forEach((tr, t) => tr.forEach((vi, kq) => {
    const o = t * 9 + kq * 3, p = pos[vi], q = nrm[vi];
    P[o] = O[o] = p.x; P[o + 1] = O[o + 1] = p.y; P[o + 2] = O[o + 2] = p.z;
    N[o] = q.x; N[o + 1] = q.y; N[o + 2] = q.z;
  }));

  // the photo as a texture, with the outline's colours spread outward so edges never pick up black
  const tex = bleed(cut);
  const map = new THREE.CanvasTexture(tex); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const uniforms = {
    uMap: { value: map },
    uUV: { value: new THREE.Vector4(1 / (k * W), cx / W, 1 / (k * H), 1 - cy / H) },
    uTint: { value: new THREE.Vector3(avg.r, avg.g, avg.b) },
  };
  const AX = [W * k / 2, H * k / 2, Hmax];
  const lookup = (x, y) => { const ix = Math.round(x / k + cx), iy = Math.round(cy - y / k); return ix < 0 || iy < 0 || ix >= W || iy >= H ? -1 : iy * W + ix; };
  const insideFn = (x, y, z) => { const i = lookup(x, y); return i >= 0 && m[i] === 1 && Math.abs(z) <= hAt[i] * 0.95; };
  return {
    id: "photo", variant: inside, name: { en: "Your photo", fa: "عکس شما" }, axes: AX, juice: avg.getHex(), tint: avg.getHex(),
    soup: { P, N, O, M }, uniforms,
    vol: undefined,
    inside: insideFn,
    shell: (x, y, z, e) => { const i = lookup(x, y); return i >= 0 && (Math.abs(z) > hAt[i] - 1.3 * e || dist[i] * k < 1.3 * e); },
    skin: PHOTO_SKIN, flesh: { cake: CAKE, jelly: JELLY, photo: PHOTO_THROUGH }[inside] || CAKE,
  };
}

function chamfer(m, W, H) {                               // distance to the outline, in pixels
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = m[i] ? INF : 0;
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], get(x - 1, y) + 1, get(x, y - 1) + 1, get(x - 1, y - 1) + 1.414, get(x + 1, y - 1) + 1.414);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], get(x + 1, y) + 1, get(x, y + 1) + 1, get(x + 1, y + 1) + 1.414, get(x - 1, y + 1) + 1.414);
  }
  return d;
}

function bleed(cut) {
  const W = cut.width, H = cut.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.drawImage(cut, 0, 0);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let pass = 0; pass < 10; pass++) {
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4; if (src[o + 3] > 128) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const s = (yy * W + xx) * 4; if (src[s + 3] > 128) { r += src[s]; gg += src[s + 1]; b += src[s + 2]; n++; }
      }
      if (n) { d[o] = r / n; d[o + 1] = gg / n; d[o + 2] = b / n; d[o + 3] = 255; }
    }
  }
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  g.putImageData(img, 0, 0);
  return c;
}

// keep the cut-out small enough to live in the browser's storage
export function toStored(cut) {
  const k = Math.min(1, 300 / Math.max(cut.width, cut.height));
  const c = document.createElement("canvas"); c.width = Math.round(cut.width * k); c.height = Math.round(cut.height * k);
  c.getContext("2d").drawImage(cut, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
export function fromStored(url) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); ok(c); };
    img.onerror = bad; img.src = url;
  });
}

// ------------------------------------------------------------------ shaders
const UV = `uniform sampler2D uMap; uniform vec4 uUV; uniform vec3 uTint;
  vec2 photoUV(vec3 p) { return vec2(p.x * uUV.x + uUV.y, p.y * uUV.z + uUV.w); }`;

const PHOTO_SKIN = /* glsl */`${UV}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    col = texture(uMap, photoUV(p)).rgb;
    rough = 0.42;
    h = 0.0;
  }`;

const CAKE = /* glsl */`${UV}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 w = worley(p * 380.0);
    col = lin(vec3(0.97, 0.84, 0.56)) * (0.86 + 0.22 * smoothstep(0.0, 0.5, w.x));      // sponge
    float z = p.z / AX.z;
    float cream = smoothstep(0.17, 0.12, abs(z));
    col = mix(col, lin(vec3(0.99, 0.96, 0.90)), cream);
    float jam = smoothstep(0.055, 0.03, abs(z + 0.03 * sin(p.x * 300.0)));
    col = mix(col, lin(vec3(0.78, 0.07, 0.15)), jam);
    rough = mix(0.8, 0.3, max(cream, jam));
    h = (1.0 - cream) * w.x * 0.6;
  }`;

const JELLY = /* glsl */`${UV}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 base = uTint * 1.15 + 0.03;
    col = base * (0.85 + 0.3 * vnoise(p * 200.0));
    float bub = smoothstep(0.12, 0.06, worley(p * 260.0).x);
    col = mix(col, min(base * 1.8 + 0.15, vec3(1.0)), bub * 0.6);
    rough = 0.06;
    h = -bub * 0.3;
  }`;

const PHOTO_THROUGH = /* glsl */`${UV}
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    col = texture(uMap, photoUV(p)).rgb * 0.94;
    rough = 0.35;
    h = 0.0;
  }`;
