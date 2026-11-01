// Mango, ported from chicken/blender/procedural.py (_mango_mesh, _mango_skin, _mango_flesh).
import * as THREE from "three";
import { lumps } from "../fruitkit.js";

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float wob = fbm(p * 14.0);
    float xg = p.x / AX.x + wob;                                              // along x, broken up by noise
    float t = clamp((xg + 0.5) / 2.5, 0.0, 1.0);
    col = lin(vec3(1.0, 0.52, 0.04));                                         // ripe orange
    col = seg(col, lin(vec3(0.90, 0.74, 0.08)), t, 0.0, 0.55);
    col = seg(col, lin(vec3(0.22, 0.46, 0.06)), t, 0.55, 1.0);                // green stem end
    col = mix(col, lin(vec3(0.74, 0.08, 0.06)), smoothstep(0.6, 1.6, p.z / AX.z + xg));   // red blush on the upper shoulder
    col = mix(col, lin(vec3(0.98, 0.92, 0.62)), smoothstep(0.10, 0.05, worley(p * 160.0).x) * 0.5);   // lenticels
    rough = 0.35;
    h = wob * 0.5;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    vec3 dp = p / vec3(0.050, 0.011, 0.030);                                  // in units of the flat stone
    float pr = length(dp) + fbm(p * 40.0) * 0.25 - 0.12;
    col = seg(lin(vec3(0.96, 0.50, 0.02)), lin(vec3(1.0, 0.62, 0.04)), length(p / AX), 0.4, 0.97);
    // Blender's Wave rings around the stone are far finer than a pixel here: fade them to grain
    float n = length(dp) * 1200.0 + 8.0 * (fbm(dp * 60.0) * 2.0 - 1.0);
    float fib = mix(0.5 - 0.5 * cos(n), fbm(p * 300.0), smoothstep(1.5, 3.5, fwidth(n)));
    col = mix(col, lin(vec3(1.0, 0.66, 0.06)), fib * smoothstep(1.45, 1.0, pr) * 0.2);
    col = mix(col, lin(vec3(0.98, 0.76, 0.32)), smoothstep(1.12, 1.0, pr) * 0.45);   // hairy band
    float stone = smoothstep(1.05, 0.95, pr);
    col = mix(col, mix(lin(vec3(0.92, 0.84, 0.62)), lin(vec3(0.98, 0.94, 0.78)), fib), stone);
    rough = mix(0.30, 0.6, stone);
    h = fib * 0.4;
  }`;

export default {
  name: { en: "Mango", fa: "انبه" }, axes: [0.068, 0.040, 0.050], juice: 0xffb326, tint: 0xff9408,
  radius(rnd) {
    const L = lumps(rnd, 8, 0.012, 0.2, 0.5);
    const stem = new THREE.Vector3(1, 0, 0.15).normalize(), beak = new THREE.Vector3(-0.85, 0, -0.53);
    return v => 1 + L(v) - 0.04 * Math.exp(-(1 - v.dot(stem)) / 0.004) + 0.06 * Math.exp(-(1 - v.dot(beak)) / 0.01);   // stem dimple, little beak
  },
  post(p, A) { const x = p.x / A[0]; p.y *= 1 + 0.10 * x; p.z *= 1 + 0.10 * x; p.z -= 0.010 * x * x; },   // fuller stem end, kidney bend
  skin: SKIN, flesh: FLESH,
};
