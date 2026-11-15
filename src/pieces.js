// Pieces on the board: meshes built from soups, each with a rigid body in the physics world, and
// cutting every piece a plane passes through.
import * as THREE from "three";
import { slice, volumeAndCentre, hullSamples, makeGeometry } from "./slice.js";
import { perf } from "./perf.js";

const _pw = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _iq = new THREE.Quaternion();

export class Pieces {
  constructor(stage, phys) { this.stage = stage; this.phys = phys; this.list = []; }

  // The costly part of add(), which can be done ahead of time (Flurry does it while the knives
  // still fly, a few soups a frame, so the burst itself is light). Kept on the soup, which is not
  // touched and can still be cut: its middle, its geometry about that middle, its collision hull.
  static prepare(soup) {
    if (soup.prep) return soup.prep;
    const { V, c } = volumeAndCentre(soup.P);
    const P = new Float32Array(soup.P.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = soup.P[i] - c.x; P[i + 1] = soup.P[i + 1] - c.y; P[i + 2] = soup.P[i + 2] - c.z; }
    const samples = hullSamples(P);
    const R = Math.sqrt(samples.reduce((a, s) => a + s.lengthSq(), 0) / samples.length) || 0.01;
    // the collider is a little smaller than the piece: freshly cut neighbours share a face, and
    // touching hulls would be pushed apart as if they overlapped (dice cubes flew off the board)
    const pts = Object.assign(new Float32Array(samples.flatMap(s => [s.x * 0.9, s.y * 0.9, s.z * 0.9])),
      { radius: R * 0.5, flat: !(V > 1e-9 && V / R ** 3 > 0.02) });   // a speck (under 1 mm3) or paper-thin: no hull for it
    return (soup.prep = { V, c, P, geo: makeGeometry({ P, N: soup.N, O: soup.O, M: soup.M }), samples, R, pts });
  }

  // ccd: small pieces are kept from passing through things (costly: not for hundreds of them at once)
  add(soup, position, quaternion, v, w, mats, slot, ccd = true) {
    const { V, c, P, geo, samples, R, pts } = Pieces.prepare(soup);
    soup.P = P; soup.prep = null;                        // from here on the soup is about its own middle
    const mesh = new THREE.Mesh(geo, [mats.skin, mats.flesh]);
    mesh.receiveShadow = true;
    mesh.quaternion.copy(quaternion);
    mesh.position.copy(position).add(c.clone().applyQuaternion(quaternion));
    this.stage.scene.add(mesh);
    mesh.castShadow = !perf.low || R > 0.012;            // on phones crumbs cast no shadow (a draw call less each)
    const body = this.phys.body(mesh.position, mesh.quaternion, pts, { v, w, small: ccd && R < 0.008 });
    const piece = { mesh, soup, V, samples, R, com: c.clone(), body, mats, slot, pinned: false, vy: 0, landed: 0 };
    this.list.push(piece);
    return piece;
  }

  remove(pc) {
    this.stage.scene.remove(pc.mesh); pc.mesh.geometry.dispose();
    this.phys.remove(pc.body);
    const i = this.list.indexOf(pc); if (i >= 0) this.list.splice(i, 1);
  }

  clear(slot = null) { for (const pc of [...this.list]) if (slot === null || pc.slot === slot) this.remove(pc); }

  inSlot(slot) { return this.list.filter(p => p.slot === slot); }

  // move a piece by hand (placing the fruit on the board)
  place(pc, position, quaternion = pc.mesh.quaternion) {
    pc.mesh.position.copy(position); pc.mesh.quaternion.copy(quaternion);
    pc.body.setTranslation(position, true); pc.body.setRotation(quaternion, true);
    pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true); pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  velocity(pc, v, w) {
    pc.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    pc.body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
  }

  // Cut every piece of `slot` that the world plane (normal nW through origin) passes through.
  // `filter(pc)` can narrow it (a swipe only cuts what it crossed). Returns how many were cut.
  cutPlane(slot, nW, origin, { filter = null, push = 0.22, spin = 3, onCut = null } = {}) {
    let hit = 0;
    for (const pc of this.inSlot(slot)) {
      const { mesh } = pc;
      mesh.updateMatrixWorld();
      let pos = 0, neg = 0;
      for (const s of pc.samples) {
        _pw.copy(s).applyMatrix4(mesh.matrixWorld);
        (_tmp.subVectors(_pw, origin).dot(nW) >= 0 ? pos++ : neg++);
      }
      if (!pos || !neg || (filter && !filter(pc))) continue;
      _iq.copy(mesh.quaternion).invert();
      const nL = nW.clone().applyQuaternion(_iq);
      const oL = origin.clone().applyMatrix4(_inv.copy(mesh.matrixWorld).invert());
      const halves = slice(pc.soup, nL, nL.dot(oL));
      if (!halves) continue;
      hit++;
      const lv = pc.body.linvel(), av = pc.body.angvel();
      const v0 = new THREE.Vector3(lv.x, lv.y, lv.z), w0 = new THREE.Vector3(av.x, av.y, av.z);
      this.remove(pc);
      halves.forEach((soup, i) => {
        const sgn = i === 0 ? 1 : -1;
        const v = v0.clone().addScaledVector(nW, sgn * push).add(new THREE.Vector3(0, push * 0.5, 0));
        const w = w0.clone().add(new THREE.Vector3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin));
        const np = this.add(soup, mesh.position, mesh.quaternion, v, w, pc.mats, slot);
        if (pc.pinned) { np.pinned = true; this.phys.pin(np.body, true); }
      });
      onCut?.(mesh.position.clone());
    }
    return hit;
  }

  // before the physics step: pinned pieces (held in the air by the game) lead their bodies
  beforeStep() {
    for (const pc of this.list) {
      this.phys.pin(pc.body, pc.pinned);
      if (pc.pinned) { pc.body.setNextKinematicTranslation(pc.mesh.position); pc.body.setNextKinematicRotation(pc.mesh.quaternion); }
    }
  }

  // after it: the meshes follow their bodies
  afterStep(onLand) {
    for (const pc of this.list) {
      if (pc.pinned) continue;
      const t = pc.body.translation(), r = pc.body.rotation();
      pc.mesh.position.set(t.x, t.y, t.z); pc.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      const vy = pc.body.linvel().y;
      if (pc.vy < -0.45 && vy > pc.vy * 0.4 && onLand && performance.now() - pc.landed > 200) { pc.landed = performance.now(); onLand(-pc.vy, pc); }
      pc.vy = vy;
    }
  }
}
