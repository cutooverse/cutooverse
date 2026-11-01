// Knife models (built from 2D outlines) and the chop animation. Local frame: the blade lies in the
// xy plane, edge along y = 0, tip toward -x, handle toward +x, thickness along z.
import * as THREE from "three";

export const KNIVES = {
  chef:    { name: { en: "Chef", fa: "سرآشپز" } },
  santoku: { name: { en: "Santoku", fa: "سانتوکو" } },
  cleaver: { name: { en: "Cleaver", fa: "ساطور" } },
  gold:    { name: { en: "Gold", fa: "طلایی" } },
};

const STEEL = new THREE.MeshPhysicalMaterial({ color: 0xe8ecf0, metalness: 0.88, roughness: 0.3, clearcoat: 0.4, envMapIntensity: 1.8 });
const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xe9b949, metalness: 1, roughness: 0.24, clearcoat: 0.5 });
const HANDLES = {
  chef: new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.5 }),
  santoku: new THREE.MeshStandardMaterial({ color: 0xc8a171, roughness: 0.55 }),
  cleaver: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.45 }),
  gold: new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.35 }),
};
const RIVET = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.3 });

function outline(kind) {
  const s = new THREE.Shape();
  if (kind === "cleaver") {
    s.moveTo(0.10, 0); s.lineTo(-0.085, 0); s.quadraticCurveTo(-0.095, 0, -0.095, 0.012);
    s.lineTo(-0.095, 0.078); s.lineTo(0.10, 0.078); s.lineTo(0.10, 0);
    const hole = new THREE.Path(); hole.absarc(-0.07, 0.062, 0.007, 0, Math.PI * 2, true); s.holes.push(hole);
  } else if (kind === "santoku") {
    s.moveTo(0.10, 0); s.lineTo(-0.07, 0); s.quadraticCurveTo(-0.098, 0.004, -0.10, 0.03);
    s.quadraticCurveTo(-0.07, 0.047, -0.03, 0.048); s.lineTo(0.10, 0.048); s.lineTo(0.10, 0);
  } else {                                             // chef and gold
    s.moveTo(0.10, 0); s.lineTo(-0.04, 0); s.quadraticCurveTo(-0.09, 0.002, -0.105, 0.016);
    s.quadraticCurveTo(-0.06, 0.036, 0.0, 0.043); s.lineTo(0.10, 0.047); s.lineTo(0.10, 0);
  }
  return s;
}

export function makeKnife(kind = "chef") {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(kind), { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, curveSegments: 16 }),
    kind === "gold" ? GOLD : STEEL);
  blade.position.z = -0.0011;
  const hy = kind === "cleaver" ? 0.06 : 0.03;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.024, 0.017), HANDLES[kind]);
  handle.position.set(0.16, hy, 0);
  const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.019), kind === "gold" ? GOLD : STEEL);
  bolster.position.set(0.104, hy, 0);
  g.add(blade, handle, bolster);
  for (const x of [0.135, 0.18]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0185, 12), RIVET);
    r.rotation.x = Math.PI / 2; r.position.set(x, hy, 0); g.add(r);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
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
