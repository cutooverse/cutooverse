// Real rigid-body physics (Rapier, WebAssembly): pieces and cubes fall, knock into each other,
// tumble and pile up the way they do in the Blender shorts.
import RAPIER from "rapier";
import { BOARD } from "./stage.js";
import { perf } from "./perf.js";

export class Physics {
  static async create() { await RAPIER.init(); return new Physics(); }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 90;
    this.acc = 0;
    this.statics = [];
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20).setFriction(0.8), floor);
  }

  // one fixed box per board; slots come from the stage (they move and turn with the layout)
  setBoards(slots) {
    for (const b of this.statics) this.world.removeRigidBody(b);
    this.statics = slots.map(sl => {
      const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(sl.origin.x, BOARD.h / 2, sl.origin.z));
      const [hx, hz] = sl.rotated ? [BOARD.d / 2, BOARD.w / 2] : [BOARD.w / 2, BOARD.d / 2];
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, BOARD.h / 2, hz).setFriction(0.75).setRestitution(0.1), b);
      return b;
    });
  }

  // points: Float32Array of local hull points (x,y,z...), or a box half-size {box:[hx,hy,hz]}
  body(pos, quat, shape, { v, w, small = false, density = 950 } = {}) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(0.08).setAngularDamping(0.35).setCcdEnabled(small);
    if (v) desc.setLinvel(v.x, v.y, v.z);
    if (w) desc.setAngvel({ x: w.x, y: w.y, z: w.z });
    const body = this.world.createRigidBody(desc);
    const dress = col => col.setDensity(density).setFriction(0.7).setRestitution(0.12);
    const ball = () => RAPIER.ColliderDesc.ball(shape.radius || 0.005);
    // A sliver (shape.flat: paper-thin or a speck) gets a small ball: the hull of a nearly flat piece
    // has no volume, so no mass and no centre, and one such body brings the whole world down (a
    // panic inside Rapier: every call after it fails).
    const col = shape.box ? RAPIER.ColliderDesc.cuboid(...shape.box) : shape.flat ? ball() : RAPIER.ColliderDesc.convexHull(shape);
    let made = null;
    try { made = this.world.createCollider(dress(col || ball()), body); } catch (e) { made = null; }   // no hull at all: Rapier throws here
    if (made && !shape.box && !shape.flat) {             // and a hull that did come out is checked
      body.recomputeMassPropertiesFromColliders();
      const c = body.localCom();
      if (!(body.mass() > 0) || !Number.isFinite(c.x + c.y + c.z)) { this.world.removeCollider(made, false); made = null; }
    }
    if (!made) this.world.createCollider(dress(ball()), body);
    return body;
  }

  remove(body) { if (body) this.world.removeRigidBody(body); }

  pin(body, on) {
    const want = on ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic;
    if (body.bodyType() !== want) body.setBodyType(want, true);
  }

  // fixed steps (90 Hz, 60 on phones): small pieces stay on the board
  step(dt) {
    const STEP = 1 / (perf.physHz || 90);
    this.world.timestep = STEP;
    this.acc = Math.min(this.acc + dt, STEP * (perf.maxSteps || 4));
    let n = 0;
    while (this.acc >= STEP) { this.world.step(); this.acc -= STEP; n++; }
    return n;
  }
}
