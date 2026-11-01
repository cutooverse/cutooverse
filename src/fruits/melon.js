// Melon (kharbozeh), ported from chicken/blender/procedural.py (_melon2_*): an oval muskmelon with ten
// shallow ribs, a stem dimple at +x and a blossom scar at -x, under a patchy raised net. Shrunk from
// 22 cm to 17 cm; the shaders scale their pattern sizes with it (k).
import { lumps } from "../fruitkit.js";

const SKIN = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.112 / AX.x;                                                   // patterns sized as on the 22 cm melon
    float groove = smoothstep(0.2, 1.0, cos(atan(p.z, p.y) * 10.0 + 0.4));     // 1 in the grooves, as in the mesh
    col = seg(lin(vec3(0.76, 0.59, 0.22)), lin(vec3(0.94, 0.80, 0.37)), fbm(p * 18.0 * k), 0.30, 0.70);
    col = mix(col, lin(vec3(0.47, 0.52, 0.20)), groove * 0.45);              // green-ochre grooves
    float net = smoothstep(0.06, 0.02, worley(p * 190.0 * k).z);              // the net: along the cell edges
    net *= clamp((fbm(p * 9.0 * k) - 0.35) / 0.25, 0.0, 1.0);                 // patchy, not everywhere
    col = mix(col, lin(vec3(0.90, 0.82, 0.60)), net);
    col = mix(col, lin(vec3(0.37, 0.30, 0.12)), smoothstep(AX.x * 0.93, AX.x * 0.99, p.x));   // stem scar
    rough = 0.72;
    h = net * 1.2;
  }`;

const FLESH = /* glsl */`
  void shade(vec3 p, out vec3 col, out float rough, out float h) {
    float k = 0.112 / AX.x;
    float rr = length(p / AX) + fbm(p * 25.0 * k) * 0.08 - 0.04;
    col = lin(vec3(0.90, 0.48, 0.15));                                        // cavity pulp
    col = seg(col, lin(vec3(0.94, 0.54, 0.19)), rr, 0.0, 0.40);
    col = seg(col, lin(vec3(1.0, 0.68, 0.34)), rr, 0.40, 0.46);               // flesh
    col = seg(col, lin(vec3(1.0, 0.74, 0.42)), rr, 0.46, 0.72);
    col = seg(col, lin(vec3(0.96, 0.88, 0.58)), rr, 0.72, 0.84);              // into the green rind
    col = seg(col, lin(vec3(0.78, 0.88, 0.52)), rr, 0.84, 0.90);
    col = seg(col, lin(vec3(0.70, 0.80, 0.42)), rr, 0.90, 0.965);
    col = seg(col, lin(vec3(0.54, 0.48, 0.19)), rr, 0.965, 0.985);            // skin line
    vec3 q = p * 30.0 * k;                                                    // Blender's ring wave: stringy pulp
    float fib = 0.5 + 0.5 * sin(length(q) * 20.0 + 6.0 * (fbm(q) * 2.0 - 1.0) - 1.5708);
    float cav = smoothstep(0.45, 0.36, rr);
    col = mix(col, lin(vec3(0.80, 0.42, 0.14)), fib * cav * 0.5);
    float sd = smoothstep(0.40, 0.28, worley(p * vec3(0.35, 1.0, 1.0) * 150.0 * k).x) * cav;   // flat seeds along x
    col = mix(col, lin(vec3(0.97, 0.92, 0.74)), sd);
    rough = 0.2;
    h = fbm(p * 380.0 * k) * 0.5;
  }`;

export default {
  name: { en: "Melon", fa: "خربزه" }, axes: [0.084, 0.0585, 0.0563], juice: 0xfabd70, tint: 0xffbd6b,
  radius(rnd) {
    const L = lumps(rnd, 10, 0.012, 0.2, 0.5);
    return v => {
      const side = Math.sqrt(Math.max(0, 1 - v.x * v.x));                    // ribs fade out toward both ends
      return 1 + L(v) - 0.014 * side * (0.5 + 0.5 * Math.cos(10 * Math.atan2(v.z, v.y) + 0.4))
        - 0.05 * Math.exp(-(1 - v.x) / 0.006)                                  // stem dimple
        - 0.02 * Math.exp(-(1 + v.x) / 0.004);                                 // blossom scar
    };
  },
  post(p) { if (p.z < 0) p.z *= 0.95; },
  skin: SKIN, flesh: FLESH,
};
