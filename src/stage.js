// The stage: renderer, lights, the board and backdrop looks, one or two "slots" (a board with its
// own camera; two for the 1 VS N mode), and juice drops.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { perf, applyPerf } from "./perf.js";

export const BOARD = { w: 0.44, d: 0.25, h: 0.024 };

export const BACKDROPS = {
  teal:    { name: { en: "Teal studio", fa: "استودیو سبزآبی" }, bg: "#163f42", floor: "#1b4649", ground: 0x1d4a4d, key: 0xfff1dc, rim: 0xe6fbff, light: false, map: "floor_teal.jpg" },
  studio:  { name: { en: "Soft grey", fa: "طوسی روشن" }, bg: "#cfd5db", floor: "#c3cad1", ground: 0xb8c0c8, key: 0xffffff, rim: 0xffffff, light: true },
  kitchen: { name: { en: "Kitchen", fa: "آشپزخانه" }, bg: "#e6d6bf", floor: "#d6c2a6", ground: 0xcdb898, key: 0xfff0d8, rim: 0xfff5e6, light: true },
  night:   { name: { en: "Night", fa: "شب" }, bg: "#1b1026", floor: "#24152f", ground: 0x2a1838, key: 0xffb870, rim: 0xb889ff, light: false, map: "floor_night.jpg" },
  charcoal: { name: { en: "Charcoal", fa: "زغالی" }, bg: "#292a2d", floor: "#303235", ground: 0x2c2d30, key: 0xfff3e0, rim: 0xf2f4ff, light: false },
};
export const BOARDS = {
  walnut: { name: { en: "Walnut", fa: "گردو" } },
  marble: { name: { en: "Marble", fa: "مرمر" } },
  dark:   { name: { en: "Charred", fa: "سوخته" } },
  glass:  { name: { en: "Glass", fa: "شیشه" } },
  classic: { name: { en: "Maple", fa: "افرا" } },
};
// the Blender project's themes: a board, a backdrop and (Halloween) the fruit that goes with it
export const THEMES = {
  "walnut-teal": { name: { en: "Walnut & teal", fa: "گردو و سبزآبی" }, board: "walnut", backdrop: "teal" },
  halloween:     { name: { en: "Halloween", fa: "هالووین" }, board: "dark", backdrop: "night", fruit: "pumpkin" },
  classic:       { name: { en: "Classic", fa: "کلاسیک" }, board: "classic", backdrop: "charcoal" },
};

export class Stage {
  constructor(host) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    const s = this.scene = new THREE.Scene();
    s.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.55;
    s.fog = new THREE.Fog(0x163f42, 0.7, 2.2);
    s.background = new THREE.Color(0x163f42);
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x1d4a4d, 0.55); s.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.key.castShadow = true;
    Object.assign(this.key.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.1, far: 4 });
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.002;
    s.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight(0xe6fbff, 1.1); s.add(this.rim, this.rim.target);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: "#1b4649", roughness: 0.85 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; s.add(this.floor);

    const tl = new THREE.TextureLoader();
    const tex = (url) => { const t = tl.load(url); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(0.95, 0.95); t.offset.set(0.025, 0.025); t.anisotropy = 8; return t; };
    this.boardMats = {
      walnut: new THREE.MeshStandardMaterial({ map: tex("board.jpg"), roughness: 0.42 }),
      dark: new THREE.MeshStandardMaterial({ map: tex("board_dark.jpg"), roughness: 0.5 }),
      classic: new THREE.MeshStandardMaterial({ map: tex("board_classic.jpg"), roughness: 0.45 }),
      marble: new THREE.MeshPhysicalMaterial({ map: marbleTexture(), roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xe8f6f4, transmission: 0.92, thickness: 0.024, roughness: 0.04, ior: 1.5 }),
    };
    this.edgeMats = {
      walnut: new THREE.MeshStandardMaterial({ color: "#3a2214", roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: "#1e120c", roughness: 0.55 }),
      classic: new THREE.MeshStandardMaterial({ color: "#b8956a", roughness: 0.5 }),
      marble: new THREE.MeshPhysicalMaterial({ color: "#e9e6e1", roughness: 0.2, clearcoat: 0.6 }),
      glass: this.boardMats.glass,
    };
    this.floorMaps = {};
    this.floorTex = (url) => {                         // the theme wall's mottling, one tile every 0.9 m
      const t = tl.load(url); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12 / 0.9, 12 / 0.9); return t;
    };
    this.boardGeo = new THREE.BoxGeometry(BOARD.w, BOARD.h, BOARD.d);
    this.boardId = "walnut";
    this.slots = [];
    this.cameras = [];
    this.quality = "auto";
    this.lift = 0; this.liftTo = 0;                    // share of the height the picture is moved up (Looks open)
    this.dropsInit();
    this.setLayout(1);
  }

  setLook(boardId, backdropId) {
    const b = BACKDROPS[backdropId] || BACKDROPS.teal;
    this.scene.background.set(b.bg); this.scene.fog.color.set(b.bg);
    this.floor.material.color.set(b.floor);
    this.floor.material.map = b.map ? (this.floorMaps[b.map] ||= this.floorTex(b.map)) : null;
    this.floor.material.needsUpdate = true;
    this.hemi.groundColor.set(b.ground);
    this.key.color.set(b.key); this.rim.color.set(b.rim);
    this.boardId = BOARDS[boardId] ? boardId : "walnut";
    for (const sl of this.slots) this.dressBoard(sl.board);
    document.body.dataset.backdrop = b.light ? "light" : "dark";
  }

  dressBoard(mesh) {
    const top = this.boardMats[this.boardId], edge = this.edgeMats[this.boardId];
    mesh.material = [edge, edge, top, edge, edge, edge];
  }

  // n = 1 or 2 boards; two boards sit far apart so each camera only sees its own
  setLayout(n) {
    for (const sl of this.slots) this.scene.remove(sl.board);
    this.slots = [];
    this.cameras = [];
    for (let i = 0; i < n; i++) {
      const origin = new THREE.Vector3(n === 1 ? 0 : (i === 0 ? -1.4 : 1.4), 0, 0);
      const board = new THREE.Mesh(this.boardGeo, []);
      this.dressBoard(board);
      board.position.set(origin.x, BOARD.h / 2, origin.z);
      board.castShadow = board.receiveShadow = true;
      this.scene.add(board);
      this.slots.push({ origin, board, rotated: false, rect: null });
      this.cameras.push(new THREE.PerspectiveCamera(38, 1, 0.01, 10));
    }
    this.resize();
  }

  groundAt(x, z) {
    for (const sl of this.slots) {
      const hx = (sl.rotated ? BOARD.d : BOARD.w) / 2, hz = (sl.rotated ? BOARD.w : BOARD.d) / 2;
      if (Math.abs(x - sl.origin.x) < hx && Math.abs(z - sl.origin.z) < hz) return BOARD.h;
    }
    return 0;
  }

  setQuality(q) {
    this.quality = q;
    applyPerf(q);
    const dpr = window.devicePixelRatio || 1;
    const ratio = q === "battery" ? 1 : q === "best" ? Math.min(dpr, 2.5) : perf.low ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    this.renderer.setPixelRatio(ratio);
    const type = perf.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.renderer.shadowMap.type !== type) { this.renderer.shadowMap.type = type; this.renderer.shadowMap.needsUpdate = true; }
    const map = perf.shadowMap;
    if (this.key.shadow.mapSize.x !== map) {
      this.key.shadow.mapSize.set(map, map);
      this.key.shadow.map?.dispose(); this.key.shadow.map = null;
    }
    this.resize();
  }

  // Viewports: one full screen, or two side by side (wide screens) or stacked (tall screens).
  resize() {
    const W = innerWidth, H = innerHeight;
    this.renderer.setSize(W, H);
    const n = this.slots.length, wide = W >= H;
    this.slots.forEach((sl, i) => {
      const r = n === 1 ? { x: 0, y: 0, w: W, h: H } : wide ? { x: i * W / 2, y: 0, w: W / 2, h: H } : { x: 0, y: i * H / 2, w: W, h: H / 2 };
      sl.rect = r;
      const cam = this.cameras[i];
      cam.aspect = r.w / r.h;
      const view = this.camView || "top";
      // top: looking down at the board (turned lengthwise on tall screens); front: low and square on,
      // the board across the frame, as in the shorts; close: low and near, the fruit large
      sl.rotated = view === "top" && cam.aspect < 0.9;
      sl.board.rotation.y = sl.rotated ? Math.PI / 2 : 0;
      let off, aim, fov;
      if (view === "front") {
        off = new THREE.Vector3(0, 0.25, 0.62); aim = new THREE.Vector3(0, 0.10, 0);
        fov = fitFov(0.46, off.distanceTo(aim), cam.aspect, 30);
      } else if (view === "close") {
        off = new THREE.Vector3(0, 0.17, 0.40); aim = new THREE.Vector3(0, 0.07, 0);
        fov = fitFov(0.30, off.distanceTo(aim), cam.aspect, 34);
      } else if (sl.rotated) {
        off = new THREE.Vector3(0, 0.50, 0.50); aim = new THREE.Vector3(0, 0.02, -0.03); fov = 48;
      } else {
        off = new THREE.Vector3(0, 0.34, 0.54); aim = new THREE.Vector3(0, 0.045, 0); fov = n === 2 && !wide ? 30 : 38;
      }
      cam.fov = fov;
      if (this.lift) cam.setViewOffset(r.w, r.h, 0, this.lift * r.h, r.w, r.h);
      cam.position.copy(sl.origin).add(off);
      cam.lookAt(aim.add(sl.origin));
      cam.updateProjectionMatrix();
    });
    // keep the key light's shadow box over the boards
    const cx = n === 1 ? 0 : 0;
    this.key.position.set(cx - 0.6, 1.1, 0.7); this.key.target.position.set(cx, 0, 0);
    const span = n === 1 ? 0.5 : 1.9;
    Object.assign(this.key.shadow.camera, { left: -span, right: span, top: 0.5, bottom: -0.5 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.rim.position.set(0.5, 0.6, -0.8);
    this.onBoards?.();                                  // the physics world rebuilds its board boxes
  }

  // Which slot (and its camera) a screen point falls in
  slotAt(x, y) {
    const i = this.slots.findIndex(sl => x >= sl.rect.x && x < sl.rect.x + sl.rect.w && y >= sl.rect.y && y < sl.rect.y + sl.rect.h);
    return Math.max(0, i);
  }

  toScreen(p, i = 0) {
    const r = this.slots[i].rect, v = p.clone().project(this.cameras[i]);
    return { x: r.x + (v.x + 1) / 2 * r.w, y: r.y + (1 - v.y) / 2 * r.h };
  }

  rayDir(pt, i = 0) {
    const r = this.slots[i].rect, cam = this.cameras[i];
    const v = new THREE.Vector3((pt.x - r.x) / r.w * 2 - 1, -((pt.y - r.y) / r.h) * 2 + 1, 0.5).unproject(cam);
    return v.sub(cam.position).normalize();
  }

  render(shake = 0) {
    const R = this.renderer, H = innerHeight;
    R.setScissorTest(this.slots.length > 1);
    const was = this.lift;
    this.lift += (this.liftTo - this.lift) * 0.16;
    if (Math.abs(this.liftTo - this.lift) < 0.001) this.lift = this.liftTo;
    this.slots.forEach((sl, i) => {
      const r = sl.rect, cam = this.cameras[i];
      if (this.lift !== was || (this.lift && !cam.view)) {   // the same view, moved up: the fruit stays in sight
        if (this.lift) cam.setViewOffset(r.w, r.h, 0, this.lift * r.h, r.w, r.h); else cam.clearViewOffset();
      }
      const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
      cam.position.x += sx; cam.position.y += sy;
      R.setViewport(r.x, H - r.y - r.h, r.w, r.h);
      R.setScissor(r.x, H - r.y - r.h, r.w, r.h);
      R.render(this.scene, cam);
      cam.position.x -= sx; cam.position.y -= sy;
    });
  }

  // ------------------------------------------------------------ juice drops
  dropsInit() {
    this.DROPS = 360;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0022, 8, 6),
      new THREE.MeshPhysicalMaterial({ color: 0xff9a1a, roughness: 0.08, clearcoat: 1 }), this.DROPS);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.scene.add(this.drops);
    this.dropState = Array.from({ length: this.DROPS }, () => ({ p: new THREE.Vector3(0, -1, 0), v: new THREE.Vector3(), life: 0, stuck: false }));
    this.dropNext = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
  }

  splash(at, n, count, color) {
    if (color !== undefined) this.drops.material.color.set(color);
    for (let i = 0; i < count; i++) {
      const d = this.dropState[this.dropNext]; this.dropNext = (this.dropNext + 1) % this.DROPS;
      const side = Math.random() < 0.5 ? 1 : -1;
      d.p.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.3) * 0.03, (Math.random() - 0.5) * 0.04));
      d.v.copy(n).multiplyScalar(side * (0.3 + Math.random() * 0.6)).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5));
      d.life = 4 + Math.random() * 3; d.stuck = false;
    }
  }

  clearDrops() { this.dropState.forEach(d => (d.life = 0)); }

  stepDrops(dt) {
    for (let i = 0; i < this.DROPS; i++) {
      const d = this.dropState[i];
      if (d.life > 0) {
        d.life -= dt;
        if (!d.stuck) {
          d.v.y += -9.8 * dt; d.p.addScaledVector(d.v, dt);
          const g = this.groundAt(d.p.x, d.p.z);
          if (d.p.y < g + 0.0006) { d.p.y = g + 0.0006; d.stuck = true; }
        }
      }
      const s = d.life > 0 ? Math.min(1, d.life) * (0.6 + (i % 5) * 0.15) : 0;
      this._s.set(d.stuck ? s * 1.8 : s, d.stuck ? s * 0.25 : s, d.stuck ? s * 1.8 : s);
      this._m.compose(d.p, this._q, this._s); this.drops.setMatrixAt(i, this._m);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
}

// vertical field of view that keeps `width` metres across the frame at `dist`, never under `minV`
function fitFov(width, dist, aspect, minV) {
  const v = 2 * Math.atan(Math.tan(Math.atan(width / 2 / dist)) / aspect) * 180 / Math.PI;
  return Math.min(70, Math.max(minV, v));
}

function marbleTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 584;
  const g = c.getContext("2d");
  g.fillStyle = "#f1eee9"; g.fillRect(0, 0, c.width, c.height);
  const rnd = (a => () => ((a = Math.imul(a ^ a >>> 15, 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296)(11);
  for (let k = 0; k < 26; k++) {                       // soft grey veins
    g.beginPath();
    let x = rnd() * c.width, y = rnd() * c.height, a = rnd() * Math.PI * 2;
    g.moveTo(x, y);
    for (let s = 0; s < 60; s++) { a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
    g.strokeStyle = `rgba(${110 + rnd() * 40 | 0},${112 + rnd() * 40 | 0},${120 + rnd() * 40 | 0},${0.08 + rnd() * 0.22})`;
    g.lineWidth = 0.6 + rnd() * 3.2; g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
