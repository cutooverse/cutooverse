// Pictures painted on canvases, once each: counter surfaces, the out-of-focus scene behind the
// counter, brushed steel, handle and edge woods, the soft shadow under a board. No image files:
// nothing to download, and every backdrop costs a few milliseconds the first time it is picked.
import * as THREE from "three";

const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const hex = c => "#" + new THREE.Color(c).getHexString();
// a colour made lighter (k > 0) or darker (k < 0)
const shade = (c, k) => { const o = new THREE.Color(c); return "#" + (k > 0 ? o.lerp(new THREE.Color("#ffffff"), k) : o.lerp(new THREE.Color("#000000"), -k)).getHexString(); };

// blotchy noise: a tiny canvas of random greys stretched over the big one, blended in
function blotches(g, w, h, cells, alpha, rnd, mode = "soft-light") {
  const n = canvas(cells, Math.max(2, Math.round(cells * h / w))), ng = n.getContext("2d"), d = ng.createImageData(n.width, n.height);
  for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  ng.putImageData(d, 0, 0);
  g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = mode; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(n, 0, 0, w, h); g.restore();
}
function speckle(g, w, h, count, rnd, dark = 0.25, light = 0.2) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * dark})` : `rgba(255,255,255,${rnd() * light})`;
    g.fillRect(rnd() * w, rnd() * h, 0.6 + rnd() * 1.6, 0.6 + rnd() * 1.6);
  }
}

// ------------------------------------------------------------------ counter surfaces
// kind: stone (veined, polished), wood (planks), concrete, paper (a studio sweep). One tile is
// `tile` metres across and repeats mirrored, so no seam shows.
const SURFACES = {
  stone(g, S, tint, rnd) {
    g.fillStyle = tint; g.fillRect(0, 0, S, S);
    blotches(g, S, S, 7, 0.35, rnd); blotches(g, S, S, 28, 0.18, rnd);
    const pale = new THREE.Color(tint).getHSL({}).l > 0.5, vein = shade(tint, pale ? -0.5 : 0.5);   // dark veins in pale stone, pale in dark
    for (let k = 0; k < 16; k++) {                    // veins: wandering lines, a few bold, most faint
      let x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 70; s++) { a += (rnd() - 0.5) * 0.55; x += Math.cos(a) * 16; y += Math.sin(a) * 16; g.lineTo(x, y); }
      g.strokeStyle = vein; g.globalAlpha = (0.07 + rnd() * rnd() * 0.4) * (pale ? 1 : 0.55); g.lineWidth = 0.6 + rnd() * rnd() * (pale ? 5 : 3); g.stroke();
    }
    g.globalAlpha = 1; speckle(g, S, S, 2600, rnd, 0.12, 0.12);
  },
  wood(g, S, tint, rnd) {
    const P = 8, ph = S / P;                          // eight planks to a tile, their length along x
    for (let i = 0; i < P; i++) {
      const y0 = i * ph, base = shade(tint, (rnd() - 0.5) * 0.22);
      g.fillStyle = base; g.fillRect(0, y0, S, ph);
      for (let k = 0; k < 46; k++) {                  // grain: long lines that drift a little
        let y = y0 + rnd() * ph; const amp = 1 + rnd() * 3, f = 0.004 + rnd() * 0.01, ph0 = rnd() * 9;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= S; x += 24) g.lineTo(x, y + Math.sin(x * f + ph0) * amp);
        g.strokeStyle = rnd() < 0.7 ? `rgba(0,0,0,${0.04 + rnd() * 0.14})` : `rgba(255,255,255,${0.03 + rnd() * 0.07})`;
        g.lineWidth = 0.5 + rnd() * 1.8; g.stroke();
      }
      if (rnd() < 0.45) {                             // a knot
        const kx = rnd() * S, ky = y0 + ph * (0.25 + rnd() * 0.5);
        for (let r = 14; r > 2; r -= 3) { g.beginPath(); g.ellipse(kx, ky, r * 1.9, r, 0, 0, Math.PI * 2); g.strokeStyle = `rgba(0,0,0,${0.10 + (14 - r) * 0.02})`; g.lineWidth = 1.4; g.stroke(); }
      }
      const jx = rnd() * S;                           // where two boards meet end to end
      g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(jx, y0, 1.5, ph);
      g.fillStyle = "rgba(0,0,0,0.42)"; g.fillRect(0, y0, S, 1.8);          // the gap to the next plank
      g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(0, y0 + 1.8, S, 1.2);
    }
    blotches(g, S, S, 10, 0.2, rnd);
  },
  concrete(g, S, tint, rnd) {
    g.fillStyle = tint; g.fillRect(0, 0, S, S);
    blotches(g, S, S, 5, 0.4, rnd); blotches(g, S, S, 18, 0.28, rnd); blotches(g, S, S, 70, 0.2, rnd);
    speckle(g, S, S, 5000, rnd, 0.3, 0.14);
    for (let k = 0; k < 10; k++) {                    // hairline scratches
      const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 40 + rnd() * 160;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`; g.lineWidth = 0.7; g.stroke();
    }
  },
  paper(g, S, tint, rnd) {
    g.fillStyle = tint; g.fillRect(0, 0, S, S);
    blotches(g, S, S, 6, 0.1, rnd); speckle(g, S, S, 1500, rnd, 0.05, 0.05);
  },
};
const SURFACE_LOOK = {                                // how each kind takes the light
  stone: { roughness: 0.22, tile: 1.4, size: 1024 }, wood: { roughness: 0.62, tile: 0.9, size: 1024 },
  concrete: { roughness: 0.82, tile: 1.6, size: 1024 }, paper: { roughness: 0.92, tile: 2.2, size: 256 },
};
export function surfaceTexture(kind, tint, span, seed = 1) {
  const look = SURFACE_LOOK[kind], c = canvas(look.size, look.size);
  SURFACES[kind](c.getContext("2d"), look.size, hex(tint), rng(seed * 977 + 5));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(span / look.tile, span / look.tile);
  return { map: t, roughness: look.roughness };
}

// ------------------------------------------------------------------ the scene behind the counter
// Painted small, blurred by shrinking and stretching (a camera's out-of-focus background), then
// lights are added as bokeh discs. It ends in the backdrop's fog colour where the counter fades out.
class Painter {
  constructor(n) { this.n = n; this.c = canvas(n, n); this.g = this.c.getContext("2d"); }
  fill(color) { this.g.fillStyle = color; this.g.fillRect(0, 0, this.n, this.n); }
  grad(stops) { const G = this.g.createLinearGradient(0, 0, 0, this.n); for (const [at, col] of stops) G.addColorStop(at, col); this.g.fillStyle = G; this.g.fillRect(0, 0, this.n, this.n); }
  rect(x, y, w, h, color, a = 1) { const n = this.n; this.g.globalAlpha = a; this.g.fillStyle = color; this.g.fillRect(x * n, y * n, w * n, h * n); this.g.globalAlpha = 1; }
  glow(x, y, r, color, a = 1) {
    const n = this.n, G = this.g.createRadialGradient(x * n, y * n, 0, x * n, y * n, r * n);
    G.addColorStop(0, color); G.addColorStop(1, color + "00");
    this.g.globalAlpha = a; this.g.fillStyle = G; this.g.fillRect(0, 0, n, n); this.g.globalAlpha = 1;
  }
}
const SCENES = {
  // a seamless studio sweep: a pool of light high on the wall, falling off to the corners
  studio(p, b) {
    const [top, low] = b.sky || [shade(b.bg, 0.16), b.bg];
    p.grad([[0, top], [0.36, low], [1, low]]);          // the wall meets the counter in the haze colour itself
    p.glow(0.5, 0.0, 0.36, shade(top, 0.35), 0.8);
    p.glow(0.0, 0.0, 0.4, shade(low, -0.4), 0.4); p.glow(1.0, 0.0, 0.4, shade(low, -0.4), 0.4);
  },
  kitchen(p, b) {
    p.grad([[0, "#efe2cc"], [0.3, "#e2cfb0"], [0.46, "#c9b594"], [1, b.bg]]);
    p.rect(0.03, 0.0, 0.36, 0.37, "#ffffff", 1); p.glow(0.2, 0.18, 0.42, "#ffffff", 0.6);   // a bright window
    p.rect(0.2, 0.0, 0.02, 0.37, "#8f8168", 1); p.rect(0.03, 0.17, 0.36, 0.02, "#8f8168", 1);
    p.rect(0.5, 0.0, 0.5, 0.2, "#7a5632", 1); p.rect(0.5, 0.2, 0.5, 0.025, "#3f2c1a", 1);   // wall cabinets
    p.rect(0.745, 0.0, 0.014, 0.2, "#4d3620", 1);
    p.rect(0.0, 0.42, 1, 0.05, "#a48f72", 0.9);                                                // the back counter
    p.rect(0.55, 0.29, 0.055, 0.13, "#f1ebdf", 1); p.rect(0.63, 0.32, 0.045, 0.1, "#7d5a36", 1);   // jars on it
    p.rect(0.7, 0.345, 0.035, 0.075, "#b9482f", 1);
    p.rect(0.85, 0.3, 0.06, 0.12, "#6a4a30", 1); p.glow(0.88, 0.25, 0.1, "#3f7a3a", 1);     // a plant
    p.lights = [[0.47, 0.25, 0.022, "#fff6dd", 0.5], [0.7, 0.27, 0.016, "#fff0c8", 0.45], [0.93, 0.22, 0.014, "#ffffff", 0.4], [0.61, 0.24, 0.012, "#ffffff", 0.35]];
  },
  night(p, b) {
    p.grad([[0, "#150c1f"], [0.4, "#22152f"], [1, b.bg]]);
    p.rect(0.0, 0.0, 1, 0.1, "#0c0714", 0.9);
    p.rect(0.62, 0.12, 0.3, 0.2, "#1a2238", 0.9); p.glow(0.77, 0.2, 0.22, "#35477a", 0.5);        // a window onto the night
    for (const x of [0.2, 0.42, 0.64]) p.glow(x, 0.17, 0.2, "#ff9a3c", 0.55);
    p.lights = [[0.2, 0.17, 0.05, "#ffb45e", 0.8], [0.42, 0.17, 0.05, "#ffb45e", 0.8], [0.64, 0.17, 0.05, "#ffb45e", 0.8],
      [0.08, 0.3, 0.018, "#ff7a2a", 0.6], [0.3, 0.33, 0.014, "#c58bff", 0.5], [0.53, 0.31, 0.016, "#ff7a2a", 0.55], [0.86, 0.34, 0.02, "#c58bff", 0.5], [0.95, 0.27, 0.012, "#ffd08a", 0.5]];
  },
  sunset(p, b) {
    p.grad([[0, "#3d2a6b"], [0.2, "#b8527a"], [0.36, "#ff9a5a"], [0.44, "#ffc56e"], [1, b.bg]]);
    p.glow(0.34, 0.41, 0.34, "#fff2b0", 0.95); p.glow(0.34, 0.41, 0.1, "#ffffff", 0.9);            // the sun, low
    p.rect(0.0, 0.4, 0.2, 0.08, "#3a2247", 0.8); p.rect(0.72, 0.38, 0.28, 0.1, "#3a2247", 0.85);   // far hills
    p.lights = [[0.08, 0.2, 0.02, "#ffd9a0", 0.5], [0.22, 0.16, 0.022, "#ffd9a0", 0.55], [0.4, 0.14, 0.022, "#ffd9a0", 0.55], [0.58, 0.15, 0.022, "#ffd9a0", 0.55],
      [0.76, 0.18, 0.022, "#ffd9a0", 0.55], [0.93, 0.23, 0.02, "#ffd9a0", 0.5]];                   // a string of lamps
  },
  ocean(p, b) {
    p.grad([[0, "#56b6ee"], [0.3, "#a9e0f7"], [0.4, "#e3f6fb"], [0.41, "#2f9ac6"], [1, b.bg]]);
    p.glow(0.72, 0.1, 0.4, "#ffffff", 0.75);
    p.rect(0.0, 0.41, 1, 0.012, "#ffffff", 0.55);                                                  // the horizon, hazy
    p.rect(0.0, 0.3, 0.16, 0.12, "#3e7a55", 0.75);                                                 // a headland
    p.lights = [[0.5, 0.445, 0.012, "#ffffff", 0.55], [0.58, 0.455, 0.016, "#ffffff", 0.5], [0.66, 0.44, 0.011, "#ffffff", 0.5], [0.74, 0.46, 0.018, "#ffffff", 0.45],
      [0.82, 0.447, 0.012, "#ffffff", 0.5], [0.44, 0.462, 0.014, "#ffffff", 0.4]];                 // sun on the water
  },
  forest(p, b) {
    p.grad([[0, "#9fd08a"], [0.2, "#5f9a56"], [0.42, "#2a5a35"], [1, b.bg]]);
    const r = rng(11);
    for (let i = 0; i < 26; i++) p.glow(r(), r() * 0.45, 0.07 + r() * 0.12, r() < 0.5 ? "#1f4a2b" : "#7fbf62", 0.5);
    p.glow(0.3, 0.05, 0.4, "#fbffc8", 0.6);
    p.lights = Array.from({ length: 16 }, () => [r(), 0.03 + r() * 0.36, 0.014 + r() * 0.03, r() < 0.6 ? "#f4ffbe" : "#bfe88f", 0.3 + r() * 0.3]);
  },
  space(p, b) {
    p.grad([[0, "#0a0a2c"], [0.45, "#05040f"], [1, b.bg]]);
    p.glow(0.25, 0.16, 0.36, "#3a2f9c", 0.55); p.glow(0.72, 0.26, 0.3, "#8a2f8c", 0.4); p.glow(0.55, 0.06, 0.2, "#2f7f9c", 0.35);
    const r = rng(5);
    p.stars = Array.from({ length: 150 }, () => [r(), r() ** 1.5 * 0.44, 0.0008 + r() * 0.0022, 0.3 + r() * 0.7]);
    p.lights = [[0.8, 0.12, 0.03, "#cfd8ff", 0.5]];                                                // a moon, out of focus
  },
  neon(p, b) {
    p.grad([[0, "#12002c"], [0.44, "#0a0018"], [1, b.bg]]);
    p.rect(0.06, 0.16, 0.38, 0.018, "#ff3fd0", 1); p.glow(0.25, 0.17, 0.3, "#ff3fd0", 0.55);       // tubes of light
    p.rect(0.56, 0.26, 0.36, 0.018, "#22e0ff", 1); p.glow(0.74, 0.27, 0.3, "#22e0ff", 0.5);
    p.rect(0.3, 0.34, 0.2, 0.014, "#9b5cff", 1); p.glow(0.4, 0.35, 0.2, "#9b5cff", 0.4);
    p.lights = [[0.1, 0.32, 0.018, "#ff3fd0", 0.55], [0.88, 0.14, 0.02, "#22e0ff", 0.5], [0.5, 0.1, 0.014, "#ffe45c", 0.5], [0.68, 0.38, 0.014, "#ff3fd0", 0.45]];
  },
  ember(p, b) {
    p.grad([[0, "#0d0302"], [0.3, "#2a0a05"], [0.44, "#5c1a08"], [1, b.bg]]);
    p.glow(0.5, 0.47, 0.42, "#ff6a1a", 0.7); p.glow(0.5, 0.47, 0.16, "#ffd07a", 0.7);              // the fire, behind
    const r = rng(9);
    p.lights = Array.from({ length: 22 }, () => [0.1 + r() * 0.8, 0.05 + r() * 0.36, 0.004 + r() * 0.012, r() < 0.5 ? "#ff8a3a" : "#ffd27a", 0.4 + r() * 0.5]);
  },
};
export function backdropTexture(b) {
  const p = new Painter(128);
  (SCENES[b.scene] || SCENES.studio)(p, b);
  // out of focus: down to 32 px in two halvings, then stretched back up
  const half = canvas(64, 64), tiny = canvas(32, 32), S = 512, out = canvas(S, S), g = out.getContext("2d");
  for (const [dst, src] of [[half, p.c], [tiny, half]]) { const d = dst.getContext("2d"); d.imageSmoothingQuality = "high"; d.drawImage(src, 0, 0, dst.width, dst.height); }
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(tiny, 0, 0, S, S);
  for (const [x, y, r, a] of p.stars || []) { g.globalAlpha = a; g.fillStyle = "#fff"; g.beginPath(); g.arc(x * S, y * S, Math.max(0.5, r * S), 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = "screen";               // bokeh: flat discs of light with a brighter rim
  for (const [x, y, r, color, a] of p.lights || []) {
    const G = g.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
    G.addColorStop(0, color + "b0"); G.addColorStop(0.8, color + "c8"); G.addColorStop(0.93, color + "ff"); G.addColorStop(1, color + "00");
    g.globalAlpha = a; g.fillStyle = G; g.beginPath(); g.arc(x * S, y * S, r * S, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  const fade = g.createLinearGradient(0, S * 0.455, 0, S * 0.5);       // into the haze the counter fades to: the
  fade.addColorStop(0, hex(b.bg) + "00"); fade.addColorStop(1, hex(b.bg));   // stage puts this line on the horizon
  g.fillStyle = fade; g.fillRect(0, S * 0.455, S, S * 0.545);
  speckle(g, S, S, 3000, rng(3), 0.035, 0.035);        // a little grain: no banding in the gradients
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.MirroredRepeatWrapping;               // wide screens see past its sides
  return t;
}

// ------------------------------------------------------------------ light to reflect
// What polished things mirror: a softbox overhead, a window to one side, a strip light, and the
// backdrop's own colours on the walls and floor. Rendered once per backdrop into the environment.
export function lightRoom(b) {
  const room = new THREE.Scene(), lit = b.light ? 0.5 : 0.22;       // dim walls, bright lights: steel needs the contrast
  const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: new THREE.Color(b.bg).multiplyScalar(lit) }));
  wall.position.y = 2; room.add(wall);
  const panel = (w, h, color, power, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); room.add(m);
  };
  const soft = new THREE.Color(b.key).lerp(new THREE.Color(0xffffff), 0.55);   // near white: steel stays steel under a warm lamp
  panel(3.2, 3.2, soft, 9, [-0.8, 4.6, 1.2], [0, 0, 0]);           // softbox, above and a little to the left
  panel(2.2, 3.0, 0xf2f7ff, 6, [-4.8, 2.0, 1.0], [0, 1, 0]);       // a window
  panel(0.7, 3.4, b.rim, 7, [4.6, 2.2, -2.2], [0, 1, 0]);          // a strip, behind to the right
  panel(4, 1.2, soft, 1.6, [0, 1.4, 4.9], [0, 1, 0]);              // fill from where the camera is
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.floor).multiplyScalar(b.light ? 0.75 : 0.45) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.9; room.add(floor);
  return room;
}

// ------------------------------------------------------------------ small things
// the dark, soft patch a board presses into the counter
export function contactShadowTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext("2d"), G = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
  G.addColorStop(0, "rgba(0,0,0,0.85)"); G.addColorStop(0.55, "rgba(0,0,0,0.35)"); G.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = G; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

// wood seen from the side or along a handle: fine grain running the long way
export function grainTexture(color, { lines = 70, contrast = 0.2, w = 512, h = 64, seed = 2 } = {}) {
  const c = canvas(w, h), g = c.getContext("2d"), rnd = rng(seed * 131 + 7);
  g.fillStyle = hex(color); g.fillRect(0, 0, w, h);
  for (let k = 0; k < lines; k++) {
    let y = rnd() * h; const amp = 0.5 + rnd() * 2, f = 0.006 + rnd() * 0.02, ph = rnd() * 9;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.strokeStyle = rnd() < 0.65 ? `rgba(0,0,0,${rnd() * contrast})` : `rgba(255,255,255,${rnd() * contrast * 0.6})`;
    g.lineWidth = 0.5 + rnd() * 1.5; g.stroke();
  }
  blotches(g, w, h, 12, 0.18, rnd);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A blade's two pictures in its own xy frame (x0..x1 across, 0..hgt up from the edge): its colour
// and how rough each spot is. Brushed along its length; `paint` adds what a knife has of its own.
export function bladeMaps(x0, x1, hgt, paint, seed = 1) {
  const W = 1024, H = 256, col = canvas(W, H), rough = canvas(W, H), cg = col.getContext("2d"), rg = rough.getContext("2d"), rnd = rng(seed * 53 + 3);
  cg.fillStyle = "#e6e9ec"; cg.fillRect(0, 0, W, H);
  rg.fillStyle = "#5c5c5c"; rg.fillRect(0, 0, W, H);                 // roughness 0.36
  for (let k = 0; k < 900; k++) {                                    // the brushing: long, faint streaks
    const y = rnd() * H, x = rnd() * W, l = 60 + rnd() * 500, v = rnd();
    rg.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd() * 0.22})` : `rgba(255,255,255,${rnd() * 0.2})`; rg.fillRect(x, y, l, 0.6 + rnd());
    if (k % 3 === 0) { cg.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd() * 0.05})` : `rgba(255,255,255,${rnd() * 0.08})`; cg.fillRect(x, y, l, 0.6 + rnd()); }
  }
  // x, y in metres to canvas pixels (the canvas's top row is the spine)
  const px = x => (x - x0) / (x1 - x0) * W, py = y => (1 - y / hgt) * H, k = W / (x1 - x0);
  paint?.({ cg, rg, px, py, k, W, H, rnd });
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.repeat.set(1 / (x1 - x0), 1 / hgt); t.offset.set(-x0 / (x1 - x0), 0);     // the blade's faces carry (x, y) as their uv
    return t;
  };
  return { map: tex(col, true), roughnessMap: tex(rough, false) };
}
