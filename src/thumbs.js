// Little pictures for the Looks panel, drawn once with a small renderer of their own: each fruit
// cut in half (so its inside shows), each knife, and the current fruit in each material.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FRUITS, buildSoup, fruitMaterials } from "./fruits.js";
import { slice, volumeAndCentre, makeGeometry } from "./slice.js";
import { makeKnife } from "./knife.js";

let R = null, scene, cam;
const cache = new Map();

function setup() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setSize(192, 192, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.4, 1, 0.8); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6));
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
}

function shot(obj, dist, aim = new THREE.Vector3()) {
  scene.add(obj);
  cam.position.set(0.05, 0.6, 1).normalize().multiplyScalar(dist).add(aim);
  cam.lookAt(aim);
  R.render(scene, cam);
  scene.remove(obj);
  return R.domElement.toDataURL("image/png");
}

export function fruitThumb(id, glass = false) {
  const key = `f|${id}|${glass}`;
  if (cache.has(key)) return cache.get(key);
  if (!R) setup();
  const f = FRUITS[id];
  const halves = slice(buildSoup(f, 3, 1), new THREE.Vector3(1, 0, 0), 0);
  const soup = halves[1];                              // the half below x = 0: its cut face looks along +x
  const { c } = volumeAndCentre(soup.P);
  let r = 0;                                           // the half's bounding radius: long fruits fill the tile too
  for (let i = 0; i < soup.P.length; i += 3) { soup.P[i] -= c.x; soup.P[i + 1] -= c.y; soup.P[i + 2] -= c.z; r = Math.max(r, Math.hypot(soup.P[i], soup.P[i + 1], soup.P[i + 2])); }
  const mats = fruitMaterials(id, glass, "thumb");
  const mesh = new THREE.Mesh(makeGeometry(soup), [mats.skin, mats.flesh]);
  mesh.rotation.set(-Math.PI / 2, 0, 0);               // fruit frame is z up
  mesh.rotateZ(-1.1);                                  // turn the cut face toward the camera
  const url = shot(mesh, r * 3.9);
  mesh.geometry.dispose();
  cache.set(key, url);
  return url;
}

export function forgetThumbs(fruitId) { for (const k of [...cache.keys()]) if (k.startsWith(`f|${fruitId}|`)) cache.delete(k); }

export function knifeThumb(kind) {
  const key = `k|${kind}`;
  if (cache.has(key)) return cache.get(key);
  if (!R) setup();
  const k = makeKnife(kind);
  k.rotation.set(-0.35, 0.25, 0.35);
  k.position.set(-0.06, -0.03, 0);
  scene.environmentIntensity = 0.22;                   // steel mirrors the room: keep it from going white
  const url = shot(k, 0.62);
  scene.environmentIntensity = 0.7;
  cache.set(key, url);
  return url;
}
