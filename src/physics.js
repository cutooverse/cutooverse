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
    let col = shape.box ? RAPIER.ColliderDesc.cuboid(...shape.box) : RAPIER.ColliderDesc.convexHull(shape);
    if (!col) col = RAPIER.ColliderDesc.ball(shape.radius || 0.005);       // a flat sliver: a small ball will do
    this.world.createCollider(col.setDensity(density).setFriction(0.7).setRestitution(0.12), body);
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
