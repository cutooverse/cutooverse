// After many chops the fruit bursts into a pile of small cubes. countPieces() says how many pieces
// the cut planes really make (points inside the fruit grouped by which side of every plane they
// are on); the cubes are sized so that about that many fall out.
import * as THREE from "three";

// planes: [nx, ny, nz, d] in the fruit's own frame (opos). Returns the number of pieces.
export function countPieces(fruit, planes) {
  const [a, b, c] = fruit.axes, V = fruit.vol || 4 / 3 * Math.PI * a * b * c;
  const inside = fruit.inside || ((x, y, z) => (x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2 <= 0.94);
  const g = Math.cbrt(V / 70000);
  const k1 = planes.map((_, i) => (Math.imul(i + 1, 2654435761) ^ 0x5bd1e995) >>> 0);
  const k2 = planes.map((_, i) => (Math.imul(i + 7, 1597334677) ^ 0x27d4eb2d) >>> 0);
  const seen = new Set();
  for (let x = -a; x <= a; x += g) for (let y = -b; y <= b; y += g) for (let z = -c; z <= c; z += g) {
    if (!inside(x, y, z)) continue;
    let h1 = 0, h2 = 0;
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i];
      if (p[0] * x + p[1] * y + p[2] * z >= p[3]) { h1 ^= k1[i]; h2 ^= k2[i]; }
    }
    seen.add((h1 >>> 0) * 2097152 + (h2 & 0x1fffff));
  }
  return Math.max(1, seen.size);
}

const _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
import { perf } from "./perf.js";

export class Burst {
  // fruit: { axes, scale, matrixWorld (of the whole-fruit mesh), com (local centre shift), and for
  // shapes that are not ellipsoids: inside(x, y, z), shell(x, y, z, edge), vol }
  // force: how hard it bursts (dice ~0.15, a chop 1); up: how much it is thrown upward
  // edge: cube size in metres (dice: the spacing of its cuts); tilt: random lean at the start, so a
  // diced block topples into a pile instead of standing there
  constructor(stage, phys, mats, fruit, pieces, onLand, { force = 1, up = 1, edge = 0, tilt = 0 } = {}) {
    this.stage = stage; this.phys = phys; this.onLand = onLand; this.t = 0; this.done = false;
    const [a, b, c] = fruit.axes, S = fruit.scale;
    const Vo = fruit.vol || 4 / 3 * Math.PI * a * b * c;
    let e = edge ? edge / S : Math.cbrt(Vo / pieces);   // cube edge in fruit units
    e = Math.min(Math.max(e, 0.0045 / S), (edge ? 0.04 : 0.02) / S);
    while (Vo / e ** 3 > (perf.maxCubes || 1100)) e *= 1.05;   // real bodies: more pieces, bigger cubes
    const skin = [], flesh = [];
    const minAx = Math.min(a, b, c);
    for (let x = -a; x <= a; x += e) for (let y = -b; y <= b; y += e) for (let z = -c; z <= c; z += e) {
      if (fruit.inside) {
        if (fruit.inside(x, y, z)) (fruit.shell(x, y, z, e) ? skin : flesh).push([x, y, z]);
        continue;
      }
      const rr = Math.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2);
      if (rr > 0.97) continue;
      (rr > 1 - 1.3 * e / minAx ? skin : flesh).push([x, y, z]);
    }
    const ew = e * S, half = ew * 0.47;
    const geo = new THREE.BoxGeometry(ew * 0.94, ew * 0.94, ew * 0.94);
    this.meshes = []; this.cubes = [];
    const centre = new THREE.Vector3().setFromMatrixPosition(fruit.matrixWorld);
    const fq = new THREE.Quaternion().setFromRotationMatrix(fruit.matrixWorld);
    for (const [list, mat] of [[skin, mats.skin], [flesh, mats.flesh]]) {
      if (!list.length) continue;
      const g = geo.clone();
      g.setAttribute("iOff", new THREE.InstancedBufferAttribute(new Float32Array(list.flat()), 3));
      const im = new THREE.InstancedMesh(g, mat, list.length);
      im.castShadow = !perf.low; im.receiveShadow = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      stage.scene.add(im);
      this.meshes.push(im);
      list.forEach((o, i) => {
        const pos = new THREE.Vector3(o[0] * S - fruit.com.x, o[1] * S - fruit.com.y, o[2] * S - fruit.com.z).applyMatrix4(fruit.matrixWorld);
        const out = pos.clone().sub(centre);
        const r = out.length() / Math.max(...fruit.axes) / S;           // 0 at the centre, 1 at the skin
        const dir = out.lengthSq() > 1e-8 ? out.normalize() : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        const speed = (0.15 + r * 0.55 + Math.random() * 0.3) * force;
        const v = dir.multiplyScalar(speed).add(new THREE.Vector3(0, (0.2 + Math.random() * 0.7) * up, 0));
        const w = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14 * Math.max(0.25, force));
        const q0 = tilt ? fq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (Math.random() - 0.5) * tilt, (Math.random() - 0.5) * tilt, (Math.random() - 0.5) * tilt))) : fq;
        const body = phys.body(pos, q0, { box: [half, half, half] }, { v, w });   // no CCD: slow cubes do not tunnel, and it cost 60 ms a frame
        this.cubes.push({ im, i, body, vy: 0 });
        _m.compose(pos, q0, _s); im.setMatrixAt(i, _m);
      });
    }
    this.count = this.cubes.length;
  }

  // the physics world moves the cubes; this copies them into the instanced meshes
  update(dt) {
    if (this.done) return;
    this.t += dt;
    let awake = 0, landed = 0;
    for (const c of this.cubes) {
      if (c.body.isSleeping()) continue;
      awake++;
      const t = c.body.translation(), r = c.body.rotation(), vy = c.body.linvel().y;
      if (c.vy < -0.5 && vy > c.vy * 0.4) landed++;
      c.vy = vy;
      _m.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s); c.im.setMatrixAt(c.i, _m);
    }
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
    if (landed) this.onLand?.(landed);
    if (!awake || this.t > 10) this.done = true;
  }

  dispose() {
    for (const c of this.cubes) this.phys.remove(c.body);
    for (const im of this.meshes) { this.stage.scene.remove(im); im.geometry.dispose(); im.dispose?.(); }
    this.meshes = []; this.cubes = [];
  }
}
