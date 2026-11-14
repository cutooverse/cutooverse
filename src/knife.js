// Knife models and the chop animation. Local frame: the blade lies in the xy plane, edge along
// y = 0, tip toward -x, handle toward +x, thickness along z.
//
// A blade is its outline extruded thin, with a ground bevel all round: brushed faces (painted maps:
// streaks, a maker's mark, a santoku's dimples, a cleaver's forge-black) and a polished bevel that
// catches the light along the edge. Handles are built the way the real ones are: a western handle
// is wood scales on a full tang with rivets and a bolster; the santoku has a Japanese octagon one.
import * as THREE from "three";
import { perf } from "./perf.js";
import { bladeMaps, grainTexture } from "./textures.js";

export const KNIVES = {
  chef:    { name: { en: "Chef", fa: "سرآشپز" } },
  santoku: { name: { en: "Santoku", fa: "سانتوکو" } },
  cleaver: { name: { en: "Cleaver", fa: "ساطور" } },
  gold:    { name: { en: "Gold", fa: "طلایی" } },
};

// blade outlines: from the heel along the edge to the tip, back along the spine
function outline(kind) {
  const s = new THREE.Shape();
  if (kind === "cleaver") {
    s.moveTo(0.10, 0); s.lineTo(-0.083, 0); s.quadraticCurveTo(-0.095, 0.001, -0.095, 0.014);
    s.lineTo(-0.095, 0.078); s.lineTo(0.10, 0.078); s.lineTo(0.10, 0);
    const hole = new THREE.Path(); hole.absarc(-0.07, 0.062, 0.0065, 0, Math.PI * 2, true); s.holes.push(hole);
  } else if (kind === "santoku") {
    s.moveTo(0.10, 0); s.lineTo(-0.03, 0); s.bezierCurveTo(-0.068, 0, -0.09, 0.004, -0.098, 0.013);
    s.bezierCurveTo(-0.093, 0.032, -0.072, 0.047, -0.04, 0.048); s.lineTo(0.10, 0.048); s.lineTo(0.10, 0);
  } else {                                             // chef and gold: a long belly up to a fine tip
    s.moveTo(0.10, 0); s.lineTo(0.005, 0); s.bezierCurveTo(-0.045, 0, -0.088, 0.004, -0.108, 0.021);
    s.bezierCurveTo(-0.08, 0.034, -0.03, 0.0445, 0.02, 0.046); s.lineTo(0.10, 0.048); s.lineTo(0.10, 0);
  }
  return s;
}
const BLADE_BOX = { chef: [-0.108, 0.10, 0.048], gold: [-0.108, 0.10, 0.048], santoku: [-0.098, 0.10, 0.048], cleaver: [-0.095, 0.10, 0.078] };

// what each blade has of its own, painted into its colour and roughness pictures
const PAINT = {
  chef({ cg, rg, px, py, k }) { mark(cg, rg, px(0.07), py(0.03), 0.0035 * k); },
  gold({ cg, rg, px, py, k }) { mark(cg, rg, px(0.07), py(0.03), 0.0035 * k); },
  santoku({ cg, rg, px, py, k }) {                     // a row of hollows above the edge, so slices fall away
    for (let x = -0.06; x <= 0.075; x += 0.0135) {
      const cx = px(x), cy = py(0.0125), rx = 0.0031 * k, ry = 0.0075 * k;
      const G = cg.createLinearGradient(cx - rx, 0, cx + rx, 0);
      G.addColorStop(0, "rgba(0,0,0,0.13)"); G.addColorStop(0.5, "rgba(0,0,0,0.02)"); G.addColorStop(1, "rgba(255,255,255,0.16)");
      cg.fillStyle = G; cg.beginPath(); cg.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); cg.fill();
      rg.fillStyle = "rgba(70,70,70,0.45)"; rg.beginPath(); rg.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); rg.fill();   // a little smoother than the brushed face
    }
    mark(cg, rg, px(0.075), py(0.034), 0.003 * k);
  },
  cleaver({ cg, rg, px, py, W, rnd }) {                // forge-black above, ground bright below
    const line = x => py(0.031) + Math.sin(x * 0.011) * 2.2 + Math.sin(x * 0.047 + 1) * 0.9;
    for (const [g, fill] of [[cg, "#565a60"], [rg, "#b4b4b4"]]) {
      g.fillStyle = fill; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, line(x));
      g.lineTo(W, 0); g.closePath(); g.fill();
    }
    for (let i = 0; i < 90; i++) {                     // the scale left by the forge: large, faint patches
      const x = rnd() * W, y = rnd() * line(x) * 0.9;
      cg.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * 0.22})` : `rgba(95,100,108,${rnd() * 0.2})`;
      cg.beginPath(); cg.ellipse(x, y, 14 + rnd() * 40, 5 + rnd() * 12, (rnd() - 0.5) * 0.5, 0, Math.PI * 2); cg.fill();
    }
  },
};
// a maker's mark, etched: a small diamond (it reads the same from both sides of the blade)
function mark(cg, rg, x, y, r) {
  for (const [g, fill] of [[cg, "rgba(60,64,70,0.55)"], [rg, "rgba(200,200,200,0.8)"]]) {
    g.fillStyle = fill; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.7, y); g.closePath(); g.fill();
    g.strokeStyle = fill; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 1.5, 0, Math.PI * 2); g.stroke();
  }
}

// a western handle from the side: a belly underneath, a rounded butt that hooks down a little
function handleShape(dy = 0) {
  const s = new THREE.Shape();
  s.moveTo(0.108, 0.021 + dy); s.bezierCurveTo(0.14, 0.017 + dy, 0.19, 0.0165 + dy, 0.218, 0.0135 + dy);
  s.quadraticCurveTo(0.2325, 0.014 + dy, 0.2315, 0.028 + dy); s.quadraticCurveTo(0.2305, 0.0435 + dy, 0.215, 0.045 + dy);
  s.bezierCurveTo(0.18, 0.047 + dy, 0.14, 0.049 + dy, 0.108, 0.047 + dy); s.closePath();
  return s;
}
// the bolster: steel between blade and handle, tall at the heel
function bolsterShape(y0, y1, top) {
  const s = new THREE.Shape();
  s.moveTo(0.0965, y0); s.lineTo(0.1105, y1); s.lineTo(0.1105, top); s.lineTo(0.0965, top); s.closePath();
  return s;
}

const WOODS = {                                        // scales: [colour, grain contrast, roughness, lacquer]
  chef: ["#3a2216", 0.45, 0.42, 0.35], cleaver: ["#1b1b1c", 0.25, 0.4, 0.2], gold: ["#15110d", 0.2, 0.3, 0.6], santoku: ["#d3b285", 0.22, 0.6, 0],
};
const built = new Map();                               // kind -> the parts of that knife (geometry, material, placement)

function build(kind) {
  const gold = kind === "gold", [x0, x1, hgt] = BLADE_BOX[kind];
  const maps = bladeMaps(x0, x1, hgt, PAINT[kind], { chef: 1, gold: 2, santoku: 3, cleaver: 4 }[kind]);
  // brushed faces: where the streaks run, the highlight spreads across them (not on the light profile)
  const face = new THREE.MeshPhysicalMaterial({ color: gold ? 0xe8b545 : 0xffffff, metalness: 1, roughness: 1, ...maps, envMapIntensity: 1.25,
    ...(perf.low ? {} : { anisotropy: 0.5, anisotropyRotation: Math.PI / 2 }) });
  const polished = new THREE.MeshPhysicalMaterial({ color: gold ? 0xf0c35a : 0xf4f6f8, metalness: 1, roughness: 0.13, envMapIntensity: 1.35 });
  const parts = [];
  const add = (geo, mat, at) => parts.push({ geo, mat, at });

  // the blade: 2.4 mm thick at the faces, ground down to the rim over 1.7 mm (the bevel is polished)
  const blade = new THREE.ExtrudeGeometry(outline(kind), { depth: 0.0005, bevelEnabled: true, bevelThickness: 0.00095, bevelSize: 0.0017, bevelOffset: -0.0017, bevelSegments: 2, curveSegments: 28 });
  add(blade, [face, polished], m => { m.position.z = -0.00025; });

  const [woodCol, contrast, woodRough, lacquer] = WOODS[kind];
  if (kind === "santoku") {                            // an octagon of pale wood with a dark horn collar
    const y = 0.034, wood = grainTexture(woodCol, { contrast, seed: 5 });
    wood.center.set(0.5, 0.5); wood.rotation = Math.PI / 2; wood.repeat.set(1, 2);
    const octagon = (r0, r1, len) => new THREE.CylinderGeometry(r0, r1, len, 8).rotateY(Math.PI / 8).rotateZ(Math.PI / 2);   // flats up and down, its length along x
    add(octagon(0.0117, 0.0129, 0.104), new THREE.MeshStandardMaterial({ map: wood, roughness: woodRough }), m => { m.scale.z = 0.86; m.position.set(0.180, y, 0); });
    add(octagon(0.0115, 0.0117, 0.026), new THREE.MeshPhysicalMaterial({ color: 0x1a1817, roughness: 0.3, clearcoat: 0.5 }), m => { m.scale.z = 0.86; m.position.set(0.115, y, 0); });
    add(new THREE.BoxGeometry(0.008, 0.016, 0.0024), polished, m => m.position.set(0.1, 0.032, 0));   // the tang going in
    return parts;
  }
  const dy = kind === "cleaver" ? 0.028 : 0, shape = handleShape(dy);
  const grain = grainTexture(woodCol, { contrast, seed: 3 });
  grain.repeat.set(7, 28);                             // the scales' faces carry metres as their uv
  const scales = new THREE.MeshPhysicalMaterial({ map: grain, roughness: woodRough, clearcoat: lacquer, clearcoatRoughness: 0.25 });
  add(new THREE.ExtrudeGeometry(shape, { depth: 0.0105, bevelEnabled: true, bevelThickness: 0.0032, bevelSize: 0.0032, bevelOffset: -0.0032, bevelSegments: 4, curveSegments: 20 }),
    scales, m => { m.position.z = -0.00525; });
  // the tang shows as a line of steel all round the handle, between the scales
  add(new THREE.ExtrudeGeometry(shape, { depth: 0.0024, bevelEnabled: false, curveSegments: 20 }), polished,
    m => { const cx = 0.17, cy = 0.031 + dy; m.scale.set(1.006, 1.03, 1); m.position.set(cx * -0.006, cy * -0.03, -0.0012); });
  const rivet = new THREE.MeshPhysicalMaterial({ color: gold ? 0xf0c35a : 0xd9dcdf, metalness: 1, roughness: 0.22 });
  for (const x of [0.134, 0.168, 0.202]) add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0172, 20), rivet, m => { m.rotation.x = Math.PI / 2; m.position.set(x, 0.0315 + dy - (x - 0.134) * 0.03, 0); });
  const bol = kind === "cleaver" ? bolsterShape(0.034, 0.047, 0.078) : bolsterShape(0.004, 0.02, 0.048);
  add(new THREE.ExtrudeGeometry(bol, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.003, bevelOffset: -0.003, bevelSegments: 3 }), polished, m => { m.position.z = -0.0045; });
  return parts;
}

export function makeKnife(kind = "chef") {
  if (!KNIVES[kind]) kind = "chef";
  if (!built.has(kind)) built.set(kind, build(kind));
  const g = new THREE.Group();
  for (const { geo, mat, at } of built.get(kind)) {
    const m = new THREE.Mesh(geo, mat);
    at(m); m.castShadow = true;
    g.add(m);
  }
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

// Drives one knife: hovering above the fruit, or chopping down a plane and back up.
export class KnifeRig {
  constructor(scene, kind, home) {
    this.scene = scene; this.home = home.clone(); this.setKind(kind);
    this.anim = null; this.idleT = Math.random() * 10;
  }
  setKind(kind) {
    if (this.group) this.scene.remove(this.group);
    this.group = makeKnife(kind); this.scene.add(this.group);
  }
  dispose() { this.scene.remove(this.group); }

  pose(n) {                                           // blade plane normal n, edge pointing down the plane
    const along = new THREE.Vector3().crossVectors(n, UP);
    if (along.lengthSq() < 1e-6) along.set(1, 0, 0);
    along.normalize();
    const u = new THREE.Vector3().crossVectors(n, along);
    if (u.y < 0) { along.negate(); u.negate(); }
    return { along, u, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, u, n)) };
  }

  // n: plane normal, c: a point on the plane inside the fruit, top: fruit top height, floorY: board top.
  // how: "chop" (down onto the board), "slide" (a level cut, in from the front), "fly" (through the
  // fruit in the air, from one side to the other)
  chop(n, c, top, floorY, dur, onImpact, how = "chop") {
    dur = Math.max(0.05, dur);
    if (this.anim && !this.anim.hit) { this.anim.hit = true; this.anim.onImpact?.(); }   // slow frames: never lose a cut
    if (how === "slide" || (how === "chop" && Math.abs(n.y) > 0.8)) {
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)));
      this.group.quaternion.copy(q);                    // blade flat, edge pointing away from you
      const from = c.clone().add(new THREE.Vector3(-0.02, 0, 0.16)), to = c.clone().add(new THREE.Vector3(-0.02, 0, -0.10));
      this.anim = { line: [from, to], t: 0, dur, hit: false, onImpact, at: 0.55 };
      return dur * 0.55;
    }
    const { along, u, q } = this.pose(n);
    this.group.quaternion.copy(q);
    if (how === "fly") {                                // a streak through the fruit along the blade
      const side = Math.random() < 0.5 ? 1 : -1;
      const from = c.clone().addScaledVector(along, 0.32 * side).addScaledVector(u, 0.03), to = c.clone().addScaledVector(along, -0.30 * side).addScaledVector(u, -0.03);
      this.anim = { line: [from, to], t: 0, dur, hit: false, onImpact, at: 0.5 };
      return dur * 0.5;
    }
    const p0 = c.clone().addScaledVector(u, -(c.y - floorY) / Math.max(u.y, 0.2));
    const sTop = (top + 0.035 - floorY) / Math.max(u.y, 0.2);
    this.anim = { p0, u, sTop, t: 0, dur, hit: false, onImpact };
    return dur * 0.42;                                  // seconds until the blade hits (for the sound)
  }

  update(dt) {
    const g = this.group;
    if (this.anim) {
      const a = this.anim; a.t += dt;
      const k = a.t / a.dur;
      if (a.line) {                                     // slide or fly: straight through, fast in the middle
        const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
        g.position.lerpVectors(a.line[0], a.line[1], Math.min(1, e));
        if (!a.hit && k >= a.at) { a.hit = true; a.onImpact?.(); }
        if (k >= 1) this.anim = null;
        return;
      }
      const down = 0.42;
      let s;
      if (k < down) { const e = k / down; s = a.sTop * (1 - e * e); }
      else { if (!a.hit) { a.hit = true; a.onImpact?.(); } const e = Math.min(1, (k - down) / (1 - down)); s = a.sTop * (1 - (1 - e) * (1 - e)); }
      g.position.copy(a.p0).addScaledVector(a.u, s);
      if (k >= 1) this.anim = null;
      return;
    }
    this.idleT += dt;                                  // hover above the fruit, breathing a little
    const target = this.home.clone().add(new THREE.Vector3(0, Math.sin(this.idleT * 1.6) * 0.004, 0));
    g.position.lerp(target, Math.min(1, dt * 6));
    const qIdle = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0.25, -0.12));
    g.quaternion.slerp(qIdle, Math.min(1, dt * 6));
  }
}
