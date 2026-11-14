// The stage: renderer, lights, the board and backdrop looks, one or two "slots" (a board with its
// own camera; two for the 1 VS N mode), and juice drops.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { perf, applyPerf } from "./perf.js";
import { surfaceTexture, backdropTexture, lightRoom, contactShadowTexture, grainTexture } from "./textures.js";

export const BOARD = { w: 0.44, d: 0.25, h: 0.024 };
const FLOOR = 80;                                       // the counter runs on to the horizon

// A backdrop is a place: the counter the board stands on (surface: kind and colour) and the scene
// behind it, out of focus (scene). bg is the haze the counter fades into; key and rim tint the lights.
export const BACKDROPS = {
  teal:    { name: { en: "Teal studio", fa: "استودیو سبزآبی" }, scene: "studio", bg: "#163f42", floor: "#1b4649", ground: 0x1d4a4d, key: 0xfff1dc, rim: 0xe6fbff, light: false, map: "floor_teal.jpg" },
  studio:  { name: { en: "Soft grey", fa: "طوسی روشن" }, scene: "studio", surface: ["paper", "#c6ccd3"], bg: "#cfd5db", floor: "#c3cad1", ground: 0xb8c0c8, key: 0xffffff, rim: 0xffffff, light: true },
  kitchen: { name: { en: "Kitchen", fa: "آشپزخانه" }, scene: "kitchen", surface: ["stone", "#ece6dc"], bg: "#dccfba", floor: "#e3d9c8", ground: 0xcdb898, key: 0xfff0d8, rim: 0xfff5e6, light: true },
  night:   { name: { en: "Night", fa: "شب" }, scene: "night", surface: ["stone", "#2a2233"], bg: "#160d20", floor: "#24152f", ground: 0x2a1838, key: 0xffb870, rim: 0xb889ff, light: false },
  charcoal: { name: { en: "Charcoal", fa: "زغالی" }, scene: "studio", surface: ["concrete", "#35373a"], bg: "#292a2d", floor: "#303235", ground: 0x2c2d30, key: 0xfff3e0, rim: 0xf2f4ff, light: false },
  sunset:   { name: { en: "Sunset", fa: "غروب" }, scene: "sunset", surface: ["wood", "#7b4f37"], bg: "#7a4a6a", floor: "#6a4433", ground: 0x4a2c5e, key: 0xffc896, rim: 0xff8fd0, light: false },
  ocean:    { name: { en: "Ocean", fa: "اقیانوس" }, scene: "ocean", surface: ["wood", "#b8a288"], bg: "#2b8fbd", floor: "#a8957c", ground: 0x0f4a6c, key: 0xfffaf0, rim: 0xa6ecff, light: false },
  forest:   { name: { en: "Forest", fa: "جنگل" }, scene: "forest", surface: ["wood", "#6f5638"], bg: "#1f4a2c", floor: "#5f4a30", ground: 0x183524, key: 0xfff1cf, rim: 0xcfffd9, light: false },
  candy:    { name: { en: "Candy", fa: "آب‌نبات" }, scene: "studio", surface: ["paper", "#f5a7cf"], sky: ["#ffe0ef", "#ff9fcf"], bg: "#ff9fcf", floor: "#f5a7cf", ground: 0xe993c0, key: 0xfff2f8, rim: 0xffffff, light: true },
  mint:     { name: { en: "Mint", fa: "نعنایی" }, scene: "studio", surface: ["paper", "#9bd9c6"], sky: ["#e6fbf3", "#a3e2cf"], bg: "#a3e2cf", floor: "#9bd9c6", ground: 0x8ccbb8, key: 0xffffff, rim: 0xf0fffa, light: true },
  lavender: { name: { en: "Lavender", fa: "اسطوخودوس" }, scene: "studio", surface: ["paper", "#b29ae6"], sky: ["#f1e8ff", "#b9a2ee"], bg: "#b9a2ee", floor: "#b29ae6", ground: 0xa18ad6, key: 0xfff8ff, rim: 0xffffff, light: true },
  desert:   { name: { en: "Desert", fa: "کویر" }, scene: "studio", surface: ["paper", "#d9a167"], sky: ["#ffe6b8", "#e2a86c"], bg: "#e2a86c", floor: "#d9a167", ground: 0xc98f58, key: 0xfff0d6, rim: 0xffe9c8, light: true },
  sky:      { name: { en: "Blue sky", fa: "آسمان آبی" }, scene: "studio", surface: ["paper", "#cfe2ee"], sky: ["#8fd0ff", "#e8f5ff"], bg: "#e8f5ff", floor: "#cfe2ee", ground: 0xb9cfdd, key: 0xffffff, rim: 0xffffff, light: true },
  space:    { name: { en: "Space", fa: "فضا" }, scene: "space", surface: ["stone", "#0d0d20"], bg: "#020208", floor: "#0b0b1e", ground: 0x0a0a1a, key: 0xdfe6ff, rim: 0x9b86ff, light: false },
  neon:     { name: { en: "Neon", fa: "نئون" }, scene: "neon", surface: ["stone", "#13061f"], bg: "#07001a", floor: "#12002a", ground: 0x14002e, key: 0xff6fe0, rim: 0x23e6ff, light: false },
  ember:    { name: { en: "Ember", fa: "اخگر" }, scene: "ember", surface: ["concrete", "#2c1611"], bg: "#1c0703", floor: "#260904", ground: 0x2a0a04, key: 0xffa060, rim: 0xff5a30, light: false },
};
export const BOARDS = {
  walnut: { name: { en: "Walnut", fa: "گردو" } },
  marble: { name: { en: "Marble", fa: "مرمر" } },
  dark:   { name: { en: "Charred", fa: "سوخته" } },
  glass:  { name: { en: "Glass", fa: "شیشه" } },
  classic: { name: { en: "Maple", fa: "افرا" } },
};
// the CutooVerse mark engraved in the middle of each board's front edge: its ink and how strong
const TAG_INK = { walnut: ["#f3dcbc", 0.5], classic: ["#3a2410", 0.5], dark: ["#e8c9a0", 0.42], marble: ["#5c5751", 0.45], glass: ["#ffffff", 0.6] };

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
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environmentIntensity = 0.7;
    s.fog = new THREE.Fog(0x163f42, 0.95, 3.0);
    s.background = new THREE.Color(0x163f42);
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x1d4a4d, 0.4); s.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.key.castShadow = true;
    Object.assign(this.key.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.1, far: 4 });
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.002;
    s.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight(0xe6fbff, 1.1); s.add(this.rim, this.rim.target);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR, FLOOR), new THREE.MeshStandardMaterial({ color: "#1b4649", roughness: 0.85 }));
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
    this.edgeMats = {                                  // the sides show the wood's grain, end on
      walnut: new THREE.MeshStandardMaterial({ map: grainTexture("#4a2b19", { contrast: 0.35, seed: 11 }), roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ map: grainTexture("#24150d", { contrast: 0.3, seed: 12 }), roughness: 0.55 }),
      classic: new THREE.MeshStandardMaterial({ map: grainTexture("#c39c6d", { contrast: 0.22, seed: 13 }), roughness: 0.5 }),
      marble: new THREE.MeshPhysicalMaterial({ color: "#e9e6e1", roughness: 0.2, clearcoat: 0.6 }),
      glass: this.boardMats.glass,
    };
    // The scene behind: a flat picture held in front of the camera, behind everything. Not tone
    // mapped, as fog is not: the far counter and the picture's haze are then the very same colour.
    // Three times the view's height, its extra uv clamped, so nothing is bare when the picture is slid.
    const sheet = new THREE.PlaneGeometry(1, 3);
    sheet.attributes.uv.array.set([0, 2, 1, 2, 0, -1, 1, -1]);
    this.backdrop = new THREE.Mesh(sheet, new THREE.MeshBasicMaterial({ fog: false, depthTest: false, depthWrite: false, toneMapped: false }));
    this.backdrop.renderOrder = -10; this.backdrop.frustumCulled = false; s.add(this.backdrop);
    this.floorMaps = {}; this.skies = {}; this.surfaces = {};
    this.contactTex = contactShadowTexture();
    this.floorTex = (url) => {                         // the theme wall's mottling, one tile every 0.9 m
      const t = tl.load(url); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(FLOOR / 0.9, FLOOR / 0.9); return t;
    };
    this.boardGeo = new RoundedBoxGeometry(BOARD.w, BOARD.h, BOARD.d, 4, 0.004);   // eased edges, as a real board has
    this.boardId = "walnut";
    this.slots = [];
    this.cameras = [];
    this.quality = "auto";
    this.lift = 0; this.liftTo = 0;                    // share of the height the picture is moved up (Looks open)
    this.dropsInit();
    this.setLayout(1);
  }

  setLook(boardId, backdropId) {
    const id = BACKDROPS[backdropId] ? backdropId : "teal", b = BACKDROPS[id];
    if (id !== this.backdropId) {
      this.backdropId = id;
      this.backdrop.material.map = this.skies[id] ||= backdropTexture(b);
      this.backdrop.material.needsUpdate = true;
      this.scene.background.set(b.bg);
      this.scene.fog.color.set(b.bg);
      const m = this.floor.material;                    // the counter: its own picture, or the teal wall's mottling
      const surf = b.surface ? (this.surfaces[id] ||= surfaceTexture(b.surface[0], b.surface[1], FLOOR, id.length + id.charCodeAt(0))) : null;
      m.map = surf ? surf.map : b.map ? (this.floorMaps[b.map] ||= this.floorTex(b.map)) : null;
      m.color.set(surf ? "#ffffff" : b.floor); m.roughness = surf ? surf.roughness : 0.85;
      m.needsUpdate = true;
      const env = this.pmrem.fromScene(lightRoom(b), 0.03);          // what steel and wet fruit mirror
      this.envTarget?.dispose(); this.envTarget = env; this.scene.environment = env.texture;
      this.scene.environmentIntensity = b.light ? 0.5 : 0.8;
      this.hemi.groundColor.set(b.ground);
      this.key.color.set(b.key); this.rim.color.set(b.rim);
      document.body.dataset.backdrop = b.light ? "light" : "dark";
    }
    this.boardId = BOARDS[boardId] ? boardId : "walnut";
    for (const sl of this.slots) this.dressBoard(sl.board);
  }

  // a backdrop as a small picture, for its tile in Customize
  backdropPreview(id) {
    const b = BACKDROPS[id], src = (this.skies[id] ||= backdropTexture(b)).image;
    const c = document.createElement("canvas"); c.width = 160; c.height = 160;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0, src.width, src.height * 0.5, 0, 0, 160, 104);          // the scene, down to its haze
    g.fillStyle = b.surface ? b.surface[1] : b.floor; g.fillRect(0, 104, 160, 56);   // the counter
    const fade = g.createLinearGradient(0, 96, 0, 124); fade.addColorStop(0, b.bg); fade.addColorStop(1, b.bg + "00");
    g.fillStyle = fade; g.fillRect(0, 96, 160, 28);
    return c.toDataURL("image/jpeg", 0.8);
  }

  dressBoard(mesh) {
    const top = this.boardMats[this.boardId], edge = this.edgeMats[this.boardId];
    mesh.material = [edge, edge, top, edge, edge, edge];
    const [ink, a] = TAG_INK[this.boardId] || TAG_INK.walnut;
    mesh.userData.tag?.children[0].material.color.set(ink);
    if (mesh.userData.tag) mesh.userData.tag.children[0].material.opacity = a;
  }

  // a small mark on the edge that faces the camera, upright however the board is turned
  makeTag() {
    this.tagTex ||= brandTexture();
    const w = 0.062, mark = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshStandardMaterial({ map: this.tagTex, transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
    const tag = new THREE.Group(); tag.add(mark);
    return tag;
  }
  placeTag(sl) {
    const tag = sl.board.userData.tag;
    if (sl.rotated) { tag.position.set(-(BOARD.w / 2 + 0.0004), 0, 0); tag.rotation.y = -Math.PI / 2; }   // the short end faces us
    else { tag.position.set(0, 0, BOARD.d / 2 + 0.0004); tag.rotation.y = 0; }
  }

  // n = 1 or 2 boards; two boards sit far apart so each camera only sees its own
  setLayout(n) {
    for (const sl of this.slots) this.scene.remove(sl.board);
    this.slots = [];
    this.cameras = [];
    for (let i = 0; i < n; i++) {
      const origin = new THREE.Vector3(n === 1 ? 0 : (i === 0 ? -1.4 : 1.4), 0, 0);
      const board = new THREE.Mesh(this.boardGeo, []);
      board.userData.tag = this.makeTag(); board.add(board.userData.tag);
      const press = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w * 1.5, BOARD.d * 1.9),     // where it presses on the counter
        new THREE.MeshBasicMaterial({ map: this.contactTex, transparent: true, depthWrite: false, opacity: 0.45 }));
      press.rotation.x = -Math.PI / 2; press.position.y = -BOARD.h / 2 + 0.0006; press.renderOrder = -1;
      board.add(press);
      this.dressBoard(board);
      board.position.set(origin.x, BOARD.h / 2, origin.z);
      board.castShadow = board.receiveShadow = true;
      this.scene.add(board);
      this.slots.push({ origin, board, rotated: false, rect: null });
      this.cameras.push(new THREE.PerspectiveCamera(38, 1, 0.01, 120));
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
      this.placeTag(sl);
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

  // The scene behind fills this camera's view, its haze line on the camera's horizon: the counter
  // runs into it in every view and on every screen.
  fitBackdrop(cam, aspect) {
    const t = this.backdrop.material.map, d = 6, tan = Math.tan(cam.fov * Math.PI / 360);
    cam.updateMatrixWorld();
    this.backdrop.quaternion.copy(cam.quaternion);
    this.backdrop.position.copy(cam.position).add(new THREE.Vector3(0, 0, -d).applyQuaternion(cam.quaternion));
    this.backdrop.scale.set(2 * d * tan * aspect, 2 * d * tan, 1);
    if (!t) return;
    const v = new THREE.Vector3(cam.position.x, 0, cam.position.z - 400).applyMatrix4(cam.matrixWorld.clone().invert());
    const hy = v.z < 0 ? (1 - v.y / -v.z / tan) / 2 : -1;   // how far down the view the horizon is
    if (!(hy > 0.03)) { t.repeat.set(1, 0.01); t.offset.set(0, 0.2); return; }   // looking down: only haze
    const ry = 0.5 / Math.min(hy, 0.95), rx = Math.min(1.8, 0.5 * aspect / Math.min(hy, 0.95));
    t.repeat.set(rx, ry); t.offset.set((1 - rx) / 2, 1 - ry);
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
      this.fitBackdrop(cam, r.w / r.h);
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

// the mark: "CutooVerse" in white on clear, tinted by the material; drawn again once Poppins is in
function brandTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const draw = () => {
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 150px Poppins, sans-serif";
    if ("letterSpacing" in g) g.letterSpacing = "6px";
    g.fillText("CutooVerse", c.width / 2, c.height / 2 + 6);
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.load("800 150px Poppins").then(draw, () => {});
  return t;
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
