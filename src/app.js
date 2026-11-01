import * as THREE from "three";
import { Stage, BACKDROPS, BOARDS, BOARD, THEMES } from "./stage.js";
import { Pieces } from "./pieces.js";
import { Physics } from "./physics.js";
import { perf } from "./perf.js";
import { FRUITS, FRUIT_IDS, buildSoup, fruitMaterials, forgetMaterials, MAXP } from "./fruits.js";
import { volumeAndCentre, slice } from "./slice.js";
import { loadImage, prepare, segment, coverage, cutout, buildPhotoFruit, toStored, fromStored, INSIDES } from "./photo.js";
import { KnifeRig, KNIVES } from "./knife.js";
import { Burst, countPieces } from "./burst.js";
import { sfx, buzz, sound, unlock, audioLead, soundLag } from "./sound.js";
import { t, num, setLang, getLang } from "./i18n.js";
import { store, save, totalStars } from "./store.js";
import { VIDEO_TASK, VIDEO_UNLOCK, watch, taskLine, videoList, pickVideo } from "./tasks.js";
import { fruitThumb, knifeThumb, forgetThumbs } from "./thumbs.js";

const $ = id => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);
const Y_UP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);   // fruit frames are z up
const SIZES = { s: 0.75, m: 1, l: 1.3 };
const MAX_CUTS = 100;                        // the cuts slider, and how long Free style can go on
const LEVELS = [[2, 1], [4, 2], [3, 2], [6, 3], [7, 3], [8, 3], [10, 4], [12, 4], [15, 5]];
const MIN_PIECE = 0.004;                     // crumbs under 0.4 % of the fruit are not counted
// stars needed (one per Puzzle level, nine in all); the things a video opens are in tasks.js
const UNLOCK = { "knife.cleaver": 2, "board.marble": 3, "backdrop.night": 4, "theme.halloween": 4, "material.glass": 6, "board.glass": 8,
  "backdrop.space": 5, "backdrop.neon": 7 };
const REAL_SLICE_MAX = 12;                   // up to this many chops the fruit is always really cut,
// and so is any that makes up to perf.realPieces pieces (300, 120 on phones); above, it bursts into cubes

let stage;
try { stage = new Stage($("stage")); }
catch (e) {
  document.body.insertAdjacentHTML("beforeend", '<p style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center">This game needs WebGL, which this browser has turned off.</p>');
  throw e;
}
const phys = await Physics.create();
const pieces = new Pieces(stage, phys);
stage.onBoards = () => phys.setBoards(stage.slots);
phys.setBoards(stage.slots);
const looks = store.looks;
let seed = 11 + Math.floor(Math.random() * 1000);

const game = { screen: "home", mode: "chop", slots: [], holding: false, shake: 0, slowUntil: 0,
  levelIdx: 0, tries: 0, cutsUsed: 0, done: false, verdictAt: 0, lastLand: 0, lastTick: 0 };

// ------------------------------------------------------------------ settings and language
// "auto" language: Persian for visitors from Iran, English for everyone else. The country comes
// from the site's own /api/country (Vercel's geo header) and is kept; the Tehran time zone also
// counts, for a VPN or where that call is not there (serve.py)
let country = null;
try { country = localStorage.getItem("cutcount.country"); } catch (e) { /* private window */ }
const inIran = () => country === "IR" || Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Tehran";
fetch("/api/country").then(r => (r.ok ? r.json() : null)).then(j => {
  if (!j?.country || j.country === country) return;
  country = j.country;
  try { localStorage.setItem("cutcount.country", country); } catch (e) { /* private window */ }
  if (store.settings.lang === "auto") { applySettings(); if (sheetOpen) renderSheet(); if (game.screen === "play") hud(true); }
}).catch(() => {});

function applySettings() {
  const s = store.settings;
  sound.on = s.sound; sound.haptics = s.haptics; sound.strength = s.strength; sound.notes = s.notes;
  const lang = s.lang === "auto" ? (inIran() ? "fa" : "en") : s.lang;
  setLang(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  document.body.classList.toggle("fa", lang === "fa");
  document.querySelectorAll("[data-t]").forEach(el => (el.textContent = t(el.dataset.t)));
  stage.setQuality(s.quality);
  $("starsHome").textContent = num(totalStars());
}

const needsVideo = (cat, id) => VIDEO_UNLOCK.includes(`${cat}.${id}`) && !store.unlocked.includes(`${cat}.${id}`);
const locked = (cat, id) => needsVideo(cat, id) || (UNLOCK[`${cat}.${id}`] || 0) > totalStars();

// ------------------------------------------------------------------ slots: one fruit, its knife, its chops
function newSlot(i, total) {
  return { i, total, made: 0, next: 0, planesW: [], planesO: [], phase: "ready", count: 1, shown: 1, countFrom: 1, countAt: 0,
    knife: null, burst: null, whole: null, fruitV: 1, scale: 1, fruitId: null, mats: null, top: 0.1, finishAt: 0, lastBurstTick: 0 };
}

function spawnFruit(st, withKnife) {
  pieces.clear(st.i);
  st.burst?.dispose(); st.burst = null;
  const f = FRUITS[looks.fruit] || FRUITS.orange, S = SIZES[looks.size] || 1;
  const soup = buildSoup(f, seed++, S);
  const mats = fruitMaterials(f.id, looks.material === "glass", st.i);
  for (const m of [mats.skin, mats.flesh]) { m.userData.U.uPn.value = 0; m.userData.U.uInv.value = 1 / S; }
  warmUp(mats);
  const q = new THREE.Quaternion().setFromAxisAngle(UP, (Math.random() - 0.5) * 1.2).multiply(Y_UP);
  const origin = stage.slots[st.i].origin;
  const pc = pieces.add(soup, new THREE.Vector3(origin.x, 0.3, origin.z), q, new THREE.Vector3(), new THREE.Vector3(), mats, st.i);
  const ys = pc.samples.map(s => s.clone().applyQuaternion(q).y);
  pieces.place(pc, new THREE.Vector3(pc.mesh.position.x, BOARD.h - Math.min(...ys) + 0.002, pc.mesh.position.z), q);
  Object.assign(st, { whole: pc, fruitId: f.id, scale: S, mats, fruitV: soup.V, top: pc.mesh.position.y + Math.max(...ys),
    made: 0, planesW: [], planesO: [], phase: "ready", count: 1, shown: 1, countFrom: 1, countAt: 0, finishAt: 0, next: 0, plan: null, hoverY: 0, best: null, cheered: false,
    soups: [pc.soup] });
  if (withKnife) {
    if (!st.knife) st.knife = new KnifeRig(stage.scene, looks.knife, new THREE.Vector3());
    st.knife.home.set(origin.x - 0.03, st.top + 0.08, origin.z + 0.02);
    if (!st.knife.anim) st.knife.group.position.copy(st.knife.home);
  }
}

// The inside of the fruit and the burst cubes are first drawn at the end of a chop, and building
// their shaders then froze the game for ~0.3 s just as it falls apart. Build them in the
// background as soon as a fruit's materials exist.
function warmUp(mats) {
  if (mats.warm) return;
  mats.warm = true;
  const box = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  box.addGroup(0, 18, 0); box.addGroup(18, 18, 1);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(box, [mats.skin, mats.flesh]));
  for (const m of [mats.skin, mats.flesh]) { const im = new THREE.InstancedMesh(box, m, 1); im.castShadow = true; g.add(im); }
  const cam = stage.cameras[0];
  (stage.renderer.compileAsync ? stage.renderer.compileAsync(g, cam, stage.scene) : Promise.resolve(stage.renderer.compile(g, cam, stage.scene)))
    .catch(() => { mats.warm = false; });
}

function clearSlots() {
  for (const st of game.slots) { st.knife?.dispose(); st.burst?.dispose(); }
  game.slots = [];
  pieces.clear();
  stage.clearDrops();
}

const SPEEDS = ["slow", "normal", "fast"];
const SLOWER = { slow: 2.8, normal: 1.7, fast: 1 };   // how much longer each chop takes than at full speed
const pace = () => SLOWER[looks.speed] || 1;
const chopInterval = n => Math.min(0.26, Math.max(0.03, (1.0 + n * 0.03) / n)) * pace();
// Free style chops for as long as you hold, at a steady beat; Dice and Burst make the chosen count
const chopTotal = () => (looks.style === "free" ? MAX_CUTS : looks.cuts);
const beat = st => chopInterval(looks.style === "free" ? REAL_SLICE_MAX : st.total);

// Dice: evenly spaced cuts across the fruit, then along it, then level ones, shared out by its size
function planDice(st) {
  const pc = st.whole; pc.mesh.updateMatrixWorld();
  const box = new THREE.Box3();
  pc.samples.forEach(s => box.expandByPoint(s.clone().applyMatrix4(pc.mesh.matrixWorld)));
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const N = st.total, sum = size.x + size.y + size.z;
  let nx = Math.max(1, Math.round(N * size.x / sum)), nz = Math.min(N - nx, Math.max(0, Math.round(N * size.z / sum)));
  const ny = Math.max(0, N - nx - nz);
  const plan = [];
  const lay = (count, axis, n, how) => {
    for (let i = 1; i <= count; i++) { const c = mid.clone(); c[axis] = box.min[axis] + size[axis] * i / (count + 1); plan.push({ n, c, how }); }
  };
  lay(nx, "x", new THREE.Vector3(1, 0, 0), "chop");
  lay(nz, "z", new THREE.Vector3(0, 0, 1), "chop");
  lay(ny, "y", new THREE.Vector3(0, 1, 0), "slide");
  return plan;
}

// the dice cube edge: the average spacing of its cuts across, along and up
function diceEdge(st) {
  const plan = st.plan || [];
  const box = new THREE.Box3();
  st.whole.samples.forEach(s => box.expandByPoint(s.clone().applyMatrix4(st.whole.mesh.matrixWorld)));
  const size = box.getSize(new THREE.Vector3());
  const per = ax => size[ax] / (plan.filter(p => (ax === "x" ? p.n.x : ax === "y" ? p.n.y : p.n.z) > 0.9).length + 1);
  return (per("x") + per("y") + per("z")) / 3;
}

function doChop(st) {
  const style = looks.style, f = FRUITS[st.fruitId], A = f.axes, S = st.scale, pc = st.whole;
  pc.mesh.updateMatrixWorld();
  let n, c, how = "chop";
  if (style === "dice") {
    if (!st.plan) st.plan = planDice(st);
    const p = st.plan[Math.min(st.made, st.plan.length - 1)];
    n = p.n; c = p.c; how = p.how;
  } else {
    // a long body (cucumber, carrot, banana, bamboo) is cut all along its length, not only in the middle
    const long = A[0] > 2.2 * Math.max(A[1], A[2]);
    let o;
    if (long) o = new THREE.Vector3((Math.random() * 2 - 1) * 0.8, (Math.random() * 2 - 1) * 0.3, (Math.random() * 2 - 1) * 0.3);
    else do { o = new THREE.Vector3((Math.random() * 2 - 1) * 0.72, (Math.random() * 2 - 1) * 0.72, (Math.random() * 2 - 1) * 0.72); } while (o.lengthSq() > 0.52);
    c = new THREE.Vector3(o.x * A[0] * S, o.y * A[1] * S, o.z * A[2] * S).sub(pc.com).applyMatrix4(pc.mesh.matrixWorld);
    if (style === "burst") {                           // any direction: knives come from every side
      n = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      how = "fly";
    } else {
      const a = Math.random() * Math.PI * 2;
      n = new THREE.Vector3(Math.cos(a), (Math.random() - 0.5) * 0.55, Math.sin(a)).normalize();
    }
  }
  st.made++;
  const dur = Math.min((style === "burst" ? 0.15 : 0.24) * Math.min(pace(), 1.8), beat(st) * 0.95);
  const hitIn = st.knife.chop(n, c, st.top, BOARD.h, dur, () => impact(st, n, c), how);
  sfx.chop(st.made, Math.max(0, hitIn - audioLead()));  // started early by the device's sound lag: it lands on the hit
}

function impact(st, n, c) {
  const pc = st.whole;
  if (!pc) return;
  buzz("chop");                                         // first: the slicing below takes a moment on phones
  game.shake = Math.max(game.shake, 0.0035);
  pc.mesh.updateMatrixWorld();
  const nL = n.clone().applyQuaternion(pc.mesh.quaternion.clone().invert());
  const cL = c.clone().applyMatrix4(new THREE.Matrix4().copy(pc.mesh.matrixWorld).invert());
  const d = (nL.dot(cL) + nL.dot(pc.com)) / st.scale;              // the plane in the fruit's own frame
  st.planesO.push([nL.x, nL.y, nL.z, d]);
  st.planesW.push({ n: n.clone(), c: c.clone() });
  // cut the fruit's data a little at every chop (its frame stays the same while it is chopped),
  // so the ending only has to build the pieces: doing all the cuts at the end froze the game
  if (st.soups && (looks.style === "free" ? st.planesO.length : st.total) <= REAL_SLICE_MAX && looks.style !== "dice") {
    const dl = nL.dot(cL);
    st.soups = st.soups.flatMap(s => slice(s, nL, dl) || [s]);
  }
  const k = st.planesO.length - 1;
  if (k < Math.min(MAXP, perf.lines)) for (const m of [st.mats.skin, st.mats.flesh]) { m.userData.U.uPl.value[k].set(nL.x, nL.y, nL.z, d); m.userData.U.uPn.value = k + 1; }
  stage.splash(c, n, 2, FRUITS[st.fruitId].juice);
  if (st.planesO.length >= st.total) st.finishAt = performance.now() + (looks.style === "free" ? 120 : 1);   // straight on: no pause before it falls
}

// the most pieces this fruit has made with this style and count (Chop only)
function keepBest(st) {
  if (game.mode !== "chop") return;
  const key = `${st.fruitId}|${looks.style}|${looks.style === "free" ? "" : st.total}`, before = store.best[key] || 0;
  st.best = { n: Math.max(before, st.count), isNew: st.count > before && before > 0 };
  if (st.count > before) { store.best[key] = st.count; save(); }
}

function finish(st, now) {
  const f = FRUITS[st.fruitId];
  for (const m of [st.mats.skin, st.mats.flesh]) m.userData.U.uPn.value = 0;
  st.countFrom = 1; st.countAt = now;
  const dice = looks.style === "dice";                 // dice always ends in cubes, the size of its cuts
  const edge = dice ? diceEdge(st) : 0;
  const made = st.planesO.length;                      // Free style stops wherever you let go
  const estimate = made <= REAL_SLICE_MAX && !dice ? 0 : countPieces(f, st.planesO);
  if (!dice && (made <= REAL_SLICE_MAX || estimate <= perf.realPieces)) {
    const one = made === 1, style = looks.style, whole = st.whole, centre = whole.mesh.position.clone();
    if (st.soups && made <= REAL_SLICE_MAX) {      // already cut chop by chop: just build the pieces
      const pos = whole.mesh.position.clone(), quat = whole.mesh.quaternion.clone();
      const soups = st.soups.length > 1 ? st.soups : [];
      if (soups.length) {
        pieces.remove(whole);
        for (const s of soups) pieces.add(s, pos, quat, new THREE.Vector3(), new THREE.Vector3(), st.mats, st.i);
      }
      for (const pl of st.planesW) stage.splash(pl.c, pl.n, one ? 22 : 5, f.juice);
    } else {
      for (const pl of st.planesW) pieces.cutPlane(st.i, pl.n, pl.c, { push: 0, spin: 0,
        onCut: p => stage.splash(p, pl.n, one ? 22 : 5, f.juice) });
    }
    st.whole = null; st.soups = null;
    // the pieces open out from the middle, the way a cut fruit falls apart: dice barely moves
    const out = style === "dice" ? 0.05 : one ? 0.24 : 0.15;
    for (const p of pieces.inSlot(st.i)) {
      const d = p.mesh.position.clone().sub(centre); d.y = Math.max(0, d.y) * 0.4;
      if (d.lengthSq() < 1e-8) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      d.normalize();
      p.pinned = false;
      pieces.velocity(p, d.multiplyScalar(out * (0.8 + Math.random() * 0.4)).add(new THREE.Vector3(0, style === "burst" ? 0 : 0.04, 0)),
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(style === "dice" ? 0.4 : 2.2));
    }
    st.count = pieces.inSlot(st.i).filter(p => p.V > MIN_PIECE * st.fruitV).length;
    st.phase = "done";
    keepBest(st);
    sfx.slice(); sfx.chord(); buzz("chop");
  } else {
    st.count = estimate;
    const pc = st.whole;
    pc.mesh.updateMatrixWorld();
    const info = { axes: f.axes, scale: st.scale, matrixWorld: pc.mesh.matrixWorld.clone(), com: pc.com.clone(), slotOrigin: stage.slots[st.i].origin,
      inside: f.inside, shell: f.shell, vol: f.vol };
    stage.splash(pc.mesh.position, UP, 50, f.juice);
    pieces.remove(pc); st.whole = null;
    const force = { dice: { force: 0.2, up: 0.06, tilt: 0.5, edge }, burst: { force: 0.32, up: 0.1 } }[looks.style] || { force: 0.5, up: 0.5 };   // a heap, not a spray
    st.burst = new Burst(stage, phys, st.mats, info, st.count, nl => {
      if (performance.now() - st.lastBurstTick > 40) { st.lastBurstTick = performance.now(); sfx.land(0.25 + Math.min(nl, 20) * 0.02); }
    }, force);
    st.phase = "burst";
    keepBest(st);
    sfx.burst(); sfx.chord(); buzz("burst");
    game.shake = 0.012;
  }
}

// ------------------------------------------------------------------ screens and modes
function showHome() {
  game.screen = "home"; game.holding = false;
  hideResult();
  $("levels").hidden = true;
  clearSlots();
  stage.setLayout(1);
  stage.setLook(looks.board, looks.backdrop);
  game.slots = [newSlot(0, chopTotal())];
  spawnFruit(game.slots[0], true);
  $("home").hidden = false; $("hud").hidden = true;
  $("starsHome").textContent = num(totalStars());
}

// keep: go on with the fruit already on the board (the home screen's), as when you touch it there
function startMode(mode, keep = false) {
  game.mode = mode; game.screen = "play"; game.holding = false; game.done = false; game.verdictAt = 0; game.cutsUsed = 0;
  hideResult();
  if (keep && game.slots[0]?.whole) {
    for (const st of game.slots) {
      st.total = mode === "chop" ? chopTotal() : 0;
      if (mode !== "chop") { st.knife?.dispose(); st.knife = null; }
    }
  } else {
    clearSlots();
    const n = mode === "vs" ? 2 : 1;
    stage.setLayout(n);
    stage.setLook(looks.board, looks.backdrop);
    const knives = mode === "chop" || mode === "vs";
    game.slots = Array.from({ length: n }, (_, i) => newSlot(i, mode === "vs" ? (i === 0 ? 1 : looks.cuts) : mode === "chop" ? chopTotal() : 0));
    game.slots.forEach(st => spawnFruit(st, knives));
  }
  $("home").hidden = true; $("hud").hidden = false;
  $("modeLabel").textContent = mode === "levels" ? t("levelOf", { n: game.levelIdx + 1, m: LEVELS.length }) : t(`mode.${mode}`);
  $("chopCounter").hidden = mode !== "chop";
  $("goal").hidden = mode !== "levels";
  $("piecesCount").hidden = !(mode === "levels" || mode === "free");
  $("vsLayer").hidden = mode !== "vs";
  $("styleBar").hidden = !(mode === "chop" || mode === "vs");
  renderStyleBar();
  if (mode === "vs") buildVsLayer();
  layoutVs();
  hud(true);
}

function resetRound() {
  game.done = false; game.verdictAt = 0; game.cutsUsed = 0;
  hideResult();
  stage.clearDrops();
  for (const st of game.slots) { st.total = game.mode === "vs" ? (st.i === 0 ? 1 : looks.cuts) : game.mode === "chop" ? chopTotal() : 0; spawnFruit(st, !!st.knife); }
  hud(true);
}

// ------------------------------------------------------------------ HUD
let lastHud = "";
function hud(force = false) {
  const m = game.mode, s0 = game.slots[0];
  let key = "";
  if (game.screen !== "play") return;
  if (m === "chop") {
    const done = s0.phase === "done" || s0.phase === "burst";
    const best = done && s0.best && s0.shown >= s0.count ? s0.best : null;   // once the count has run up
    key = `${s0.made}|${s0.total}|${s0.shown}|${done}|${looks.style}|${best?.n}|${getLang()}`;
    if (key === lastHud && !force) return;
    const free = looks.style === "free";
    $("chopCounter").classList.toggle("free", free); $("chopCounter").classList.toggle("done", done);
    $("chopBig").textContent = free ? `${num(s0.made)} ${t(s0.made === 1 ? "cut" : "cuts")}` : `${num(s0.made)} / ${num(s0.total)}`;
    $("chopBar").style.transform = `scaleX(${s0.made / s0.total})`;
    $("chopSub").textContent = `${num(s0.shown)} ${t(s0.shown === 1 ? "piece" : "pieces")}`;
    $("chopBest").textContent = best ? (best.isNew ? t("newBest") : t("bestN", { n: best.n })) : "";
    $("chopBest").classList.toggle("new", !!best?.isNew);
    if (best?.isNew && !s0.cheered) { s0.cheered = true; sfx.win(); buzz("burst"); }
    setHint(done ? t("tapNew") : t(free ? "holdFree" : "hold"), !done && s0.made === 0);
  } else if (m === "vs") {
    const done = game.slots.every(st => st.phase === "done");
    key = game.slots.map(st => `${st.made}|${st.shown}`).join("/") + `|${done}|${getLang()}`;
    if (key === lastHud && !force) return;
    game.slots.forEach((st, i) => {
      $(`vsN${i}`).textContent = num(st.shown);
      $(`vsS${i}`).textContent = t(st.shown === 1 ? "piece" : "pieces");
      $(`vsT${i}`).textContent = `${num(st.total)} ${st.total === 1 ? t("cut") : t("cuts")}`;
    });
    setHint(done ? t("tapNew") : t("hold"), !done && game.slots[1].made === 0);
  } else {
    const n = countSwipe();
    const [target, cuts] = LEVELS[game.levelIdx];
    key = `${m}|${n}|${game.cutsUsed}|${game.levelIdx}|${getLang()}`;
    if (key === lastHud && !force) return;
    if ($("piecesNum").textContent !== num(n)) { $("piecesNum").textContent = num(n); bump($("piecesCount")); }
    $("piecesWord").textContent = t(n === 1 ? "piece" : "pieces");
    if (m === "levels") {
      $("levelLabel").textContent = t("level", { n: game.levelIdx + 1 });
      $("goalLine").innerHTML = t("make", { n: `<em>${num(target)}</em>` });
      $("cutsLabel").textContent = t("cutsLeft", { a: cuts - game.cutsUsed, b: cuts });
      $("knives").innerHTML = Array.from({ length: cuts }, (_, i) => `<i class="knife-pip${i < game.cutsUsed ? " used" : ""}"></i>`).join("");
      $("modeLabel").textContent = t("levelOf", { n: game.levelIdx + 1, m: LEVELS.length });
    } else {
      $("modeLabel").textContent = `${t("mode.free")} · ${t(game.cutsUsed === 1 ? "cutMade" : "cutsMade", { n: game.cutsUsed })}`;
    }
    setHint(t("swipe"), false, game.cutsUsed > 0);
  }
  lastHud = key;
}

function setHint(text, pulse, gone = false) {
  const h = $("hint");
  if (h.textContent !== text) h.textContent = text;
  h.classList.toggle("pulse", pulse);
  h.style.opacity = gone ? "0" : "1";
}
function bump(el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

function buildVsLayer() {
  $("vsLayer").innerHTML = game.slots.map((st, i) => `
    <div class="vs-label" id="vsTop${i}"><div class="t${i ? " red" : ""}" id="vsT${i}"></div></div>
    <div class="vs-label" id="vsBot${i}"><div class="n" id="vsN${i}">1</div><div class="s" id="vsS${i}"></div></div>`).join("")
    + `<div class="vs-badge" id="vsBadge">${t("vs")}</div>`;
}

function layoutVs() {
  if (game.mode !== "vs" || game.screen !== "play") return;
  const wide = innerWidth >= innerHeight;
  stage.slots.forEach((sl, i) => {
    const r = sl.rect, top = $(`vsTop${i}`), bot = $(`vsBot${i}`);
    if (!top) return;
    const topPad = (i === 0 || wide) ? 70 : 14;
    top.style.left = `${r.x + r.w / 2}px`; top.style.top = `${r.y + topPad}px`;
    bot.style.left = `${r.x + r.w / 2}px`; bot.style.top = `${r.y + r.h - (i === game.slots.length - 1 || wide ? 210 : 86)}px`;
  });
  const b = $("vsBadge");
  if (b) { b.style.left = `${innerWidth / 2}px`; b.style.top = `${innerHeight / 2}px`; }
}

const countSwipe = () => pieces.inSlot(0).filter(p => p.V > MIN_PIECE * (game.slots[0]?.fruitV || 1)).length;

// ------------------------------------------------------------------ puzzle verdict and stars
function verdict() {
  if (game.mode !== "levels" || game.done) return;
  const [target, cuts] = LEVELS[game.levelIdx], n = countSwipe();
  const win = n === target, over = n > target || game.cutsUsed >= cuts;
  if (!win && !over) return;
  game.done = true;
  game.tries++;
  let stars = 0;
  if (win) {
    stars = 1;
    const before = totalStars();
    store.stars[game.levelIdx] = Math.max(store.stars[game.levelIdx] || 0, stars);
    save();
    announceUnlocks(before, totalStars());
    sfx.win(); buzz("burst");
  } else sfx.lose();
  $("result").classList.toggle("win", win);
  $("resultStars").innerHTML = win ? `<svg class="on"><use href="#i-star"/></svg>` : "";
  $("resultTitle").textContent = win ? (game.cutsUsed < cuts ? t("clearedSpare") : t("cleared")) : n > target ? t("tooMany") : t("tooFew");
  $("resultText").textContent = win ? t(game.cutsUsed === 1 && getLang() === "en" ? "resultWin1" : "resultWin", { n, c: game.cutsUsed }) : t("resultLose", { n, t: target });
  $("nextBtn").hidden = !win;
  $("nextBtn").textContent = game.levelIdx === LEVELS.length - 1 ? t("playAgain") : t("nextLevel");
  $("result").classList.add("show");
}

function announceUnlocks(before, after) {
  const names = Object.entries(UNLOCK).filter(([, need]) => need > before && need <= after).map(([k]) => {
    const [cat, id] = k.split(".");
    return itemName(cat, id);
  });
  if (names.length) toast(t("unlocked", { name: names.join(", ") }));
}

// the video task always shows one video from videos.txt; a new one is picked once it is watched
let videoIds = [];
videoList().then(ids => {
  videoIds = ids;
  if (!ids.includes(store.task.video)) { store.task.video = pickVideo(ids, store.task.watched); save(); }
  if (sheetOpen === "tasks") renderSheet();
});

// a video opens one thing (a look, or a Puzzle level); then the tasks move on to another video
const keyName = key => { const [cat, id] = key.split("."); return cat === "level" ? t("level", { n: Number(id) + 1 }) : itemName(cat, id); };
function unlockByVideo(key, then) {
  if (!store.task.video) { toast(t("noVideos")); sfx.lose(); return; }
  sfx.tick();
  watch({ ...VIDEO_TASK, video: store.task.video, title: t("unlockTitle", { name: keyName(key) }) }, task => {
    store.unlocked = [...new Set([...store.unlocked, key])];
    store.task.watched = [...new Set([...store.task.watched, task.video])];
    store.task.video = pickVideo(videoIds, store.task.watched, task.video);
    save();
    sfx.win(); buzz("burst"); toast(t("unlocked", { name: keyName(key) }));
    if (sheetOpen) renderSheet();
    if (!$("levels").hidden) openLevels();
    then?.();
  });
}

function hideResult() { $("result").classList.remove("show", "win"); }

function openLevels() {
  const grid = $("levelsGrid");
  grid.innerHTML = LEVELS.map((lv, i) => {
    const cleared = (store.stars[i] || 0) > 0, reached = i === 0 || (store.stars[i - 1] || 0) > 0 || cleared;
    if (!reached) return `<div class="lv lock"><svg class="lk"><use href="#i-lock"/></svg></div>`;
    if (!cleared && needsVideo("level", i))            // reached, but this one opens with a video
      return `<button class="lv video" type="button" data-lvvideo="${i}"><b>${num(i + 1)}</b><span class="pv"><svg><use href="#i-play"/></svg>${t("watchShort")}</span></button>`;
    return `<button class="lv" type="button" data-lv="${i}"><b>${num(i + 1)}</b><span class="st"><svg class="${cleared ? "on" : ""}"><use href="#i-star"/></svg></span></button>`;
  }).join("");
  $("levels").hidden = false;
}

// ------------------------------------------------------------------ input
const trail = $("trail"), tctx = trail.getContext("2d");
let stroke = null, fading = [];
const canvasEl = $("stage");

canvasEl.addEventListener("pointerdown", e => {
  unlock();
  if (sheetOpen || !$("levels").hidden || !$("photo").hidden) return;
  try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* already lifted: the touch still counts */ }
  if (game.screen === "home") { sfx.tick(); startMode("chop", true); game.holding = true; return; }   // touching it starts chopping
  if (game.screen !== "play") return;
  if (game.mode === "chop" || game.mode === "vs") {
    // a new fruit as soon as it has fallen apart: no waiting for every cube to settle
    if (game.slots.every(st => st.phase === "done" || st.phase === "burst")) { sfx.tick(); resetRound(); return; }
    game.holding = true;
  } else if (!game.done) {
    stroke = [{ x: e.clientX, y: e.clientY }];
  }
});
canvasEl.addEventListener("pointermove", e => { if (stroke) stroke.push({ x: e.clientX, y: e.clientY }); });
const release = () => {
  game.holding = false;
  if (!stroke) return;
  const a = stroke[0], b = stroke[stroke.length - 1];
  fading.push({ pts: stroke, t: performance.now() });
  stroke = null;
  const swiped = Math.hypot(b.x - a.x, b.y - a.y) >= 30;
  if (!swiped) return;
  swipeCut(a, b);
};

function swipeCut(a, b) {
  if (game.mode === "levels" && game.cutsUsed >= LEVELS[game.levelIdx][1]) return;
  const nW = new THREE.Vector3().crossVectors(stage.rayDir(a, 0), stage.rayDir(b, 0)).normalize();
  const origin = stage.cameras[0].position.clone();
  sfx.swish();
  const juice = FRUITS[game.slots[0].fruitId].juice;
  const hit = pieces.cutPlane(0, nW, origin, {
    filter: pc => {
      pc.mesh.updateMatrixWorld();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const s of pc.samples) { const p = stage.toScreen(s.clone().applyMatrix4(pc.mesh.matrixWorld), 0); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return segmentHitsBox(a, b, x0 - 6, y0 - 6, x1 + 6, y1 + 6);
    },
    onCut: p => stage.splash(p, nW, 26, juice),
  });
  if (hit) {
    sfx.slice(); buzz("chop");
    sfx.step(game.cutsUsed);                              // swiped cuts climb the scale too
    game.cutsUsed++;
    game.verdictAt = performance.now() + 1300;
    hud(true);
  }
}
canvasEl.addEventListener("pointerup", release);
canvasEl.addEventListener("pointercancel", release);

function segmentHitsBox(a, b, x0, y0, x1, y1) {
  const inBox = p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (inBox(a) || inBox(b)) return true;
  const cross = (p, q, r, s) => {
    const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
    if (!d) return false;
    const tt = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
    return tt >= 0 && tt <= 1 && u >= 0 && u <= 1;
  };
  const c = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return c.some((p, i) => cross(a, b, p, c[(i + 1) % 4]));
}

function drawTrail(now) {
  tctx.clearRect(0, 0, trail.width, trail.height);
  const all = [...fading.map(f => ({ pts: f.pts, a: 1 - (now - f.t) / 260 })), ...(stroke ? [{ pts: stroke, a: 1 }] : [])];
  fading = fading.filter(f => now - f.t < 260);
  const dpr = Math.min(devicePixelRatio, 2);
  for (const { pts, a } of all) {
    if (pts.length < 2 || a <= 0) continue;
    tctx.lineCap = "round"; tctx.lineJoin = "round";
    for (const [wd, col] of [[10, `rgba(255,255,255,${0.18 * a})`], [3.5, `rgba(255,255,255,${0.95 * a})`]]) {
      tctx.lineWidth = wd * dpr; tctx.strokeStyle = col; tctx.beginPath();
      pts.forEach((p, i) => (i ? tctx.lineTo(p.x * dpr, p.y * dpr) : tctx.moveTo(p.x * dpr, p.y * dpr)));
      tctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ sheet: looks and settings
let sheetOpen = null, sheetTab = null;
// three tabs, each a column of sections: what you cut, how it is cut, and where
const LOOK_TABS = ["fruit", "cut", "scene"];
const TAB_ICON = { fruit: "i-fruit", cut: "i-chop", scene: "i-scene" };
const STYLES = ["free", "dice", "burst"], CAMS = ["top", "front", "close"], NOTES = ["off", "piano", "organ", "musicbox", "marimba"];

function itemName(cat, id) {
  if (cat === "fruit") return FRUITS[id].name[getLang()];
  if (cat === "material") return t(`mat.${id}`);
  if (cat === "knife") return KNIVES[id].name[getLang()];
  if (cat === "board") return BOARDS[id].name[getLang()];
  if (cat === "backdrop") return BACKDROPS[id].name[getLang()];
  if (cat === "theme") return THEMES[id].name[getLang()];
  return id;
}

function openSheet(kind, tab) {
  sheetOpen = kind; game.holding = false;
  sheetTab = tab || (kind === "looks" ? (sheetTab && LOOK_TABS.includes(sheetTab) ? sheetTab : "fruit") : "settings");
  $("sheetTitle").textContent = t(kind === "looks" ? "looks" : kind === "tasks" ? "tasks" : "settings");
  const tabs = kind === "looks" ? LOOK_TABS : [];
  $("sheetTabs").hidden = !tabs.length;
  $("sheetTabs").innerHTML = tabs.map(k => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${k === sheetTab}"><svg><use href="#${TAB_ICON[k]}"/></svg>${t(`tab.${k}`)}</button>`).join("");
  $("sheetBody").innerHTML = ""; renderSheet();    // a fresh open: rows start at the chosen card
  $("sheet").classList.add("open"); $("scrim").classList.add("open");
  $("sheet").classList.toggle("looks", kind === "looks"); $("scrim").classList.toggle("clear", kind === "looks");
  stage.liftTo = kind === "looks" && game.slots.length === 1 ? 0.25 : 0;   // see each pick on the board above
  document.body.classList.toggle("looking", kind === "looks");
  sfx.tick();
}
function closeSheet() { sheetOpen = null; stage.liftTo = 0; document.body.classList.remove("looking"); $("sheet").classList.remove("open"); $("scrim").classList.remove("open"); }

function tile(cat, id, label, img, swatch) {
  const lock = locked(cat, id), on = cat === "theme" ? themeOn(id) : looks[cat] === id;
  const pic = img ? `<img alt="" src="${img}">` : `<i class="sw" style="${swatch}"></i>`;
  return `<button class="tile${lock ? " locked" : ""}" type="button" data-pick="${cat}" data-id="${id}" aria-pressed="${on}">
    ${pic}<span>${label}</span>${!lock ? "" : needsVideo(cat, id) ? `<em class="lock video"><svg><use href="#i-play"/></svg></em>`
      : `<em class="lock"><svg><use href="#i-lock"/></svg>${num(UNLOCK[`${cat}.${id}`])}</em>`}</button>`;
}
const seg = (key, opts, cur) => `<div class="seg" data-seg="${key}">${opts.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${label}</button>`).join("")}</div>`;

const themeOn = id => looks.board === THEMES[id].board && looks.backdrop === THEMES[id].backdrop;
const BOARD_SW = { walnut: "center/cover url(board.jpg)", dark: "center/cover url(board_dark.jpg)", classic: "center/cover url(board_classic.jpg)",
  marble: "linear-gradient(135deg,#f3f0eb,#dcd8d2 45%,#f6f4f0 55%,#cfcac3)", glass: "linear-gradient(135deg,#dff3f1,#b8e0dc 50%,#effaf9)" };

function renderSheet() {
  const B = $("sheetBody");
  if (sheetOpen === "settings") {
    const s = store.settings;
    B.innerHTML = `
      <div class="row-set"><b>${t("sound")}</b><button class="switch" type="button" role="switch" data-sw="sound" aria-checked="${s.sound}" aria-label="${t("sound")}"></button></div>
      <p class="note" id="lagNote" style="margin:-4px 0 0">${(() => { const l = soundLag(); return l === null ? t("soundLagOff") : t("soundLag", { ms: Math.round(l * 1000) }); })()}</p>
      <div class="sec"><h3>${t("notes")}</h3><p class="note">${t("notesNote")}</p>${seg("notes", NOTES.map(v => [v, t(`notes.${v}`)]), s.notes)}</div>
      <div class="row-set"><b>${t("haptics")}</b><button class="switch" type="button" role="switch" data-sw="haptics" aria-checked="${s.haptics}" aria-label="${t("haptics")}"></button></div>
      <div class="sec"><h3>${t("intensity")}</h3><p class="note">${t("hapticsNote")}</p>${seg("strength", [["light", t("light")], ["normal", t("normal")], ["strong", t("strong")]], s.strength)}</div>
      <div class="sec"><h3>${t("quality")}</h3>${seg("quality", [["auto", t("qAuto")], ["battery", t("qBattery")], ["best", t("qBest")]], s.quality)}</div>
      <div class="sec"><h3>${t("language")}</h3>${seg("lang", [["auto", t("langAuto")], ["en", "English"], ["fa", "فارسی"]], s.lang)}</div>
      <div class="sec"><h3>${t("help")}</h3><p class="help">${t("helpText")}</p></div>`;
    return;
  }
  if (sheetOpen === "tasks") {
    const waiting = VIDEO_UNLOCK.filter(k => { const [cat, id] = k.split("."); return needsVideo(cat, id); });
    const v = store.task.video;                        // its thumbnail, over the play icon if YouTube's pictures load
    const thumb = `<span class="tic"><svg><use href="#i-play"/></svg>${v ? `<img alt="" src="https://i.ytimg.com/vi/${v}/mqdefault.jpg" onerror="this.remove()">` : ""}</span>`;
    B.innerHTML = `
      <div class="sec"><h3>${t("yourStars")}<em>★ ${num(totalStars())} / ${num(LEVELS.length)}</em></h3><p class="help">${t("starsHelp")}</p></div>
      <div class="sec"><h3>${t("tasks")}<em>${num(waiting.length)}</em></h3><p class="note">${t("tasksNote", { s: VIDEO_TASK.seconds })}</p>
        <div class="tasklist">${waiting.length ? waiting.map(k => `
          <div class="task">${thumb}<div><b>${keyName(k)}</b><small>${k.startsWith("level.") ? t("mode.levels") : t(`tab.${k.split(".")[0]}`)} · ${v ? taskLine() : t("noVideos")}</small></div>
            ${v ? `<button class="go" type="button" data-task="${k}">${t("watch")}</button>` : ""}</div>`).join("")
          : `<p class="help">${t("allUnlocked")}</p>`}</div></div>`;
    return;
  }
  const L = getLang();
  // a section: its name, what is chosen in it now, then the choices
  const sec = (key, now, body, note = "") => `<section class="sec" data-sec="${key}"><h3>${t(`tab.${key}`)}<em${key === "cuts" ? ' id="cutsNow"' : ""}>${now || ""}</em></h3>${note ? `<p class="note">${note}</p>` : ""}${body}</section>`;
  const tiles = list => `<div class="strip">${list.join("")}</div>`;   // one row, swiped sideways
  const th = Object.keys(THEMES).find(themeOn);
  let html = "";
  if (sheetTab === "fruit") html = `
    ${sec("fruit", itemName("fruit", looks.fruit), tiles([...FRUIT_IDS.map(id => tile("fruit", id, FRUITS[id].name[L], fruitThumb(id))),
      FRUITS.photo ? tile("fruit", "photo", FRUITS.photo.name[L], photoSaved?.img) : "",
      `<button class="tile add" type="button" data-addphoto><i class="sw" data-icon="add-photo">+</i><span>${t("addPhoto")}</span></button>`]))}
    <div class="pair">
      ${sec("size", t(`size.${looks.size}`), seg("size", [["s", t("size.s")], ["m", t("size.m")], ["l", t("size.l")]], looks.size))}
      ${sec("material", t(`mat.${looks.material}`), seg("material", ["real", "glass"].map(id => [id, `${t(`mat.${id}`)}${locked("material", id) ? '<svg class="lk"><use href="#i-lock"/></svg>' : ""}`]), looks.material))}
    </div>`;
  if (sheetTab === "cut") html = `
    ${sec("style", t(`style.${looks.style}`), seg("style", STYLES.map(v => [v, `<span class="ico" data-icon="style-${v}"></span>${t(`style.${v}`)}`]), looks.style), t(`style.${looks.style}.d`))}
    ${sec("speed", t(`speed.${looks.speed}`), seg("speed", SPEEDS.map(v => [v, t(`speed.${v}`)]), looks.speed))}
    ${sec("cuts", looks.style === "free" ? t("cutsFree") : num(looks.cuts),
      `<div class="cuts-range"${looks.style === "free" ? " data-off" : ""}><input type="range" id="cutsRange" min="1" max="${MAX_CUTS}" step="1" value="${looks.cuts}" aria-label="${t("tab.cuts")}"><output id="cutsOut">${num(looks.cuts)}</output></div>`, t("cutsNote"))}
    ${sec("knife", itemName("knife", looks.knife), tiles(Object.keys(KNIVES).map(id => tile("knife", id, KNIVES[id].name[L], knifeThumb(id)))))}`;
  if (sheetTab === "scene") html = `
    ${sec("theme", th && itemName("theme", th), tiles(Object.entries(THEMES).map(([id, th]) => {   // the board on its backdrop
      const b = BACKDROPS[th.backdrop];
      return tile("theme", id, th.name[L], null, `background:${BOARD_SW[th.board].replace("center/cover", "center/70% 40% no-repeat")},linear-gradient(180deg,${b.bg} 50%,${b.floor} 50%)`);
    })))}
    ${sec("camera", t(`cam.${looks.camera}`), seg("camera", CAMS.map(v => [v, `<span class="ico" data-icon="cam-${v}"></span>${t(`cam.${v}`)}`]), looks.camera), t(`cam.${looks.camera}.d`))}
    ${sec("board", itemName("board", looks.board), tiles(Object.keys(BOARDS).map(id => tile("board", id, BOARDS[id].name[L], null, `background:${BOARD_SW[id]}`))))}
    ${sec("backdrop", itemName("backdrop", looks.backdrop), tiles(Object.entries(BACKDROPS).map(([id, b]) => tile("backdrop", id, b.name[L], null, `background:linear-gradient(180deg,${b.sky ? `${b.sky[0]},${b.sky[1]}` : `${b.bg},${b.bg}`} 55%,${b.floor} 55%)`))))}`;
  const keep = [...B.querySelectorAll(".strip")].map(st => st.scrollLeft);   // a pick re-draws: rows stay where they were
  B.innerHTML = html;
  applyIcons(B);
  B.querySelectorAll(".strip").forEach((st, i) => {
    if (keep.length) { st.scrollLeft = keep[i] || 0; return; }
    const on = st.querySelector('[aria-pressed="true"]');             // a new tab: the chosen card in view
    if (on) st.scrollLeft += on.getBoundingClientRect().left - st.getBoundingClientRect().left - (st.clientWidth - on.offsetWidth) / 2;
  });
}

function pick(cat, id) {
  if (needsVideo(cat, id)) return unlockByVideo(`${cat}.${id}`, () => pick(cat, id));
  if (locked(cat, id)) { toast(t("unlockWith", { n: UNLOCK[`${cat}.${id}`] })); sfx.lose(); return; }
  sfx.tick();
  if (cat === "cuts") looks.cuts = Number(id);
  else if (cat === "theme") {
    const th = THEMES[id];
    Object.assign(looks, { board: th.board, backdrop: th.backdrop }, th.fruit && FRUITS[th.fruit] ? { fruit: th.fruit } : {});
    stage.setLook(looks.board, looks.backdrop);
  } else looks[cat] = id;
  save();
  if (cat === "style" || cat === "speed") renderStyleBar();
  if (cat === "knife") { for (const st of game.slots) st.knife?.setKind(id); }
  else if (cat === "board" || cat === "backdrop") stage.setLook(looks.board, looks.backdrop);
  else if (cat === "camera") { stage.camView = id; stage.resize(); layoutVs(); }
  else if (cat === "speed") { /* takes effect from the next chop */ }
  else if (cat === "style" && game.screen === "play" && !(game.mode === "chop" || game.mode === "vs")) { /* used by Chop and 1 VS N */ }
  else if (game.screen === "home") showHome();
  else if (game.mode === "levels") { game.done = false; resetRound(); }
  else resetRound();
  renderSheet();
}

$("sheetTabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  sheetTab = b.dataset.tab;
  $("sheetTabs").querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", x === b));
  sfx.tick(); $("sheetBody").innerHTML = ""; renderSheet(); $("sheetBody").scrollTop = 0;
});
// a mouse wheel moves a row of cards sideways
$("sheetBody").addEventListener("wheel", e => {
  const st = e.target.closest(".strip");
  if (!st || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || st.scrollWidth <= st.clientWidth) return;
  st.scrollLeft += (document.documentElement.dir === "rtl" ? -1 : 1) * e.deltaY; e.preventDefault();
}, { passive: false });
$("sheetBody").addEventListener("click", e => {
  if (e.target.closest("[data-addphoto]")) { $("photoFile").value = ""; $("photoFile").click(); return; }
  const tk = e.target.closest("[data-task]");
  if (tk) return unlockByVideo(tk.dataset.task);
  const tl = e.target.closest("[data-pick]");
  if (tl) return pick(tl.dataset.pick, tl.dataset.id);
  const sw = e.target.closest("[data-sw]");
  if (sw) { store.settings[sw.dataset.sw] = !store.settings[sw.dataset.sw]; save(); applySettings(); renderSheet(); sfx.tick(); return; }
  const sb = e.target.closest(".seg button");
  if (!sb) return;
  const key = sb.closest("[data-seg]").dataset.seg, v = sb.dataset.v;
  if (sheetOpen === "looks") return pick(key, v);
  store.settings[key] = v; save(); applySettings();
  if (key === "notes") sfx.preview();                    // hear the instrument just picked
  if (key === "lang") { openSheet("settings"); if (game.screen === "play") { if (game.mode === "vs") buildVsLayer(); layoutVs(); hud(true); } }
  else renderSheet();
  sfx.tick();
});
$("sheetBody").addEventListener("input", e => {          // the cuts slider: show the number while it moves,
  if (e.target.id !== "cutsRange") return;
  $("cutsOut").textContent = num(Number(e.target.value));
  $("cutsNow").textContent = num(Number(e.target.value));
});
$("sheetBody").addEventListener("change", e => {         // and take it when it is let go
  if (e.target.id === "cutsRange") pick("cuts", e.target.value);
});
$("sheetDone").onclick = closeSheet;
$("scrim").onclick = closeSheet;

let toastTimer = 0;
function toast(text, ms = 2200) {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

// ------------------------------------------------------------------ buttons
document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
  unlock(); sfx.tick();
  if (b.dataset.mode === "levels") openLevels(); else startMode(b.dataset.mode);
}));
$("levelsGrid").addEventListener("click", e => {
  const v = e.target.closest("[data-lvvideo]");
  if (v) return unlockByVideo(`level.${v.dataset.lvvideo}`);
  const b = e.target.closest("[data-lv]"); if (!b) return;
  sfx.tick(); $("levels").hidden = true;
  game.levelIdx = Number(b.dataset.lv); game.tries = 0;
  startMode("levels");
});
$("levelsClose").onclick = () => { $("levels").hidden = true; if (game.screen !== "play") showHome(); };
$("homeLooks").onclick = () => openSheet("looks");
$("homeSettings").onclick = () => openSheet("settings");
$("homeStars").onclick = () => openSheet("tasks");
$("hudLooks").onclick = () => openSheet("looks");
$("hudCam").onclick = () => {                           // each tap: the next camera, nothing to open
  looks.camera = CAMS[(CAMS.indexOf(looks.camera) + 1) % CAMS.length]; save();
  stage.camView = looks.camera; stage.resize(); layoutVs();
  sfx.tick(); toast(t(`cam.${looks.camera}`), 900);
};
$("hudSettings").onclick = () => openSheet("settings");
$("backBtn").onclick = () => { sfx.tick(); showHome(); };
$("retryBtn").onclick = () => { sfx.tick(); resetRound(); };
$("allBtn").onclick = () => { sfx.tick(); hideResult(); openLevels(); };
$("nextBtn").onclick = () => {
  sfx.tick();
  const next = (game.levelIdx + 1) % LEVELS.length;
  if (needsVideo("level", next) && !(store.stars[next] > 0)) { hideResult(); openLevels(); return unlockByVideo(`level.${next}`); }
  game.levelIdx = next; game.tries = 0; resetRound();
};

// ------------------------------------------------------------------ frame loop
function resize() {
  stage.resize();
  const dpr = Math.min(devicePixelRatio, 2);
  trail.width = innerWidth * dpr; trail.height = innerHeight * dpr;
  trail.style.width = innerWidth + "px"; trail.style.height = innerHeight + "px";
  layoutVs();
}
addEventListener("resize", resize);

// ------------------------------------------------------------------ your photo
const PHOTO_KEY = "cutcount.photo";
let photoSaved = null, photoPrep = null, photoCut = null, photoInside = "cake", photoTimer = 0;
try { photoSaved = JSON.parse(localStorage.getItem(PHOTO_KEY) || "null"); } catch (e) { photoSaved = null; }

function registerPhoto(def) {
  forgetMaterials("photo"); forgetThumbs("photo");
  def.vol = volumeAndCentre(def.soup.P).V;
  FRUITS.photo = def;
}

async function restorePhoto() {
  if (!photoSaved?.img) return;
  try { registerPhoto(buildPhotoFruit(await fromStored(photoSaved.img), photoSaved.inside)); }
  catch (e) { photoSaved = null; }
}

function drawPhotoPreview() {
  const cv = $("photoCanvas"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  if (!photoPrep) return;
  const { W, H, data } = photoPrep, k = Math.min(cv.width / W, cv.height / H), w = W * k, h = H * k, x = (cv.width - w) / 2, y = (cv.height - h) / 2;
  const full = document.createElement("canvas"); full.width = W; full.height = H; full.getContext("2d").putImageData(data, 0, 0);
  g.globalAlpha = 0.22; g.drawImage(full, x, y, w, h); g.globalAlpha = 1;      // what is removed, faint
  if (photoCut) {
    const mask = photoPrep.mask, cut = document.createElement("canvas"); cut.width = W; cut.height = H;
    const cg = cut.getContext("2d"), img = cg.createImageData(W, H);
    for (let i = 0; i < W * H; i++) if (mask[i]) { img.data.set(data.data.subarray(i * 4, i * 4 + 3), i * 4); img.data[i * 4 + 3] = 255; }
    cg.putImageData(img, 0, 0);
    g.drawImage(cut, x, y, w, h);
  }
}

function runSegment() {
  if (!photoPrep) return;
  photoPrep.mask = segment(photoPrep, Number($("photoTol").value));
  const cov = coverage(photoPrep.mask);
  photoCut = cov > 0.01 && cov < 0.985 ? cutout(photoPrep, photoPrep.mask) : null;
  $("photoMsg").hidden = !!photoCut;
  $("photoUse").disabled = !photoCut;
  $("photoUse").style.opacity = photoCut ? "1" : "0.45";
  drawPhotoPreview();
}

function renderPhotoInside() {
  $("photoInside").innerHTML = INSIDES.map(v => `<button type="button" data-v="${v}" aria-pressed="${v === photoInside}">${t(`in.${v}`)}</button>`).join("");
}

$("photoFile").addEventListener("change", async () => {
  const file = $("photoFile").files?.[0];
  if (!file) return;
  try {
    photoPrep = prepare(await loadImage(file));
  } catch (e) { toast(t("photoFail")); return; }
  photoInside = photoSaved?.inside || "cake";
  $("photoTol").disabled = photoPrep.hasAlpha;
  renderPhotoInside();
  $("photo").hidden = false;
  closeSheet();
  runSegment();
});
$("photoTol").addEventListener("input", () => { clearTimeout(photoTimer); photoTimer = setTimeout(runSegment, 90); });
$("photoInside").addEventListener("click", e => {
  const b = e.target.closest("[data-v]"); if (!b) return;
  photoInside = b.dataset.v; renderPhotoInside(); sfx.tick();
});
$("photoAnother").onclick = () => { $("photoFile").value = ""; $("photoFile").click(); };
$("photoCancel").onclick = () => { $("photo").hidden = true; photoPrep = null; };
$("photoUse").onclick = async () => {
  if (!photoCut) return;
  $("photoBusy").hidden = false;
  await new Promise(r => setTimeout(r, 30));            // let the "making it 3D" note paint first
  try {
    const stored = toStored(photoCut);
    registerPhoto(buildPhotoFruit(await fromStored(stored), photoInside));
    photoSaved = { img: stored, inside: photoInside };
    try { localStorage.setItem(PHOTO_KEY, JSON.stringify(photoSaved)); } catch (e) { /* too big or blocked: keep it for this visit */ }
    looks.fruit = "photo"; save();
    $("photo").hidden = true; photoPrep = null;
    sfx.win();
    if (game.screen === "play") resetRound(); else showHome();
  } catch (e) {
    $("photoMsg").hidden = false;
  } finally {
    $("photoBusy").hidden = true;
  }
};

// the cut-style switch under Chop and 1 VS N
function renderStyleBar() {
  $("styleBar").innerHTML = STYLES.map(v => `<button type="button" data-style="${v}" aria-pressed="${looks.style === v}"><span class="ico" data-icon="style-${v}"></span>${t(`style.${v}`)}</button>`).join("")
    + `<button type="button" class="speed" data-speed aria-label="${t("speed")}"><span class="ico" data-icon="speed-${looks.speed}"></span>${t(`speed.${looks.speed}`)}</button>`;
  applyIcons($("styleBar"));
}
$("styleBar").addEventListener("click", e => {
  if (e.target.closest("[data-speed]")) {                // cycle slow, normal, fast
    sfx.tick(); looks.speed = SPEEDS[(SPEEDS.indexOf(looks.speed) + 1) % SPEEDS.length]; save(); renderStyleBar(); return;
  }
  const b = e.target.closest("[data-style]"); if (!b || b.dataset.style === looks.style) return;
  sfx.tick(); looks.style = b.dataset.style; save(); renderStyleBar(); resetRound();
});

// icons: a PNG in icons/ (see icons/ICONS.md) replaces the drawn one when it is there
const iconOk = new Map();                               // name -> true, false, or the pending check
function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]:not(.png)").forEach(el => {
    const name = el.dataset.icon;
    const put = () => { const img = new Image(); img.alt = ""; img.src = `icons/${name}.png`; el.classList.add("png"); el.replaceChildren(img); };
    const known = iconOk.get(name);
    if (known === true) return put();
    if (known === false) return;
    if (known) { known.then(ok => ok && put()); return; }
    const check = new Promise(res => { const img = new Image(); img.onload = () => res(true); img.onerror = () => res(false); img.src = `icons/${name}.png`; });
    iconOk.set(name, check);
    check.then(ok => { iconOk.set(name, ok); if (ok) put(); });
  });
}
applyIcons();

stage.camView = looks.camera;
applySettings();
resize();
await restorePhoto();
if (looks.fruit === "photo" && !FRUITS.photo) { looks.fruit = "orange"; save(); }
looks.cuts = Math.min(MAX_CUTS, Math.max(1, Math.round(looks.cuts) || 50));   // older saves could hold 250
for (const [cat, def] of [["fruit", "orange"], ["knife", "chef"], ["material", "real"], ["board", "walnut"], ["backdrop", "teal"]])
  if (locked(cat, looks[cat])) looks[cat] = def;     // a look chosen before it needed stars or a video
showHome();

let last = performance.now(), frames = 0, slowFrames = 0;
stage.renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  const gdt = now < game.slowUntil ? dt * 0.35 : dt;

  for (const st of game.slots) {
    const pc = st.whole;
    if (game.screen === "play" && game.holding && st.knife && pc && st.made < st.total && now >= st.next) {
      if (looks.style === "burst" && !pc.pinned) {        // Burst: the fruit first rises into the air
        pc.pinned = true;
        st.hoverY = pc.mesh.position.y + 0.13;
        st.knife.home.y += 0.13;
        st.next = now + 420;
      } else {
        st.phase = "chop";
        doChop(st);
        st.next = now + beat(st) * 1000;
      }
    }
    if (pc?.pinned) {                                    // hover there, turning slowly
      pc.mesh.position.y += (st.hoverY + Math.sin(now / 420) * 0.004 - pc.mesh.position.y) * Math.min(1, dt * 7);
      pc.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, dt * 0.7));
    }
    if (looks.style === "free" && game.mode === "chop" && !game.holding && st.phase === "chop" && !st.finishAt
      && st.made > 0 && st.planesO.length === st.made) st.finishAt = now + 120;   // let go: it falls apart
    if (st.finishAt && now >= st.finishAt) { st.finishAt = 0; finish(st, now); }
    if (st.burst) { st.burst.update(gdt); if (st.burst.done && st.phase === "burst") st.phase = "done"; }
    st.knife?.update(dt);
    if (st.shown !== st.count) {                       // count up to the result
      const k = Math.min(1, (now - st.countAt) / 900), e = 1 - (1 - k) ** 3;
      st.shown = Math.round(st.countFrom + (st.count - st.countFrom) * e);
      if (now - game.lastTick > 45 && k < 1) { game.lastTick = now; sfx.tick(); }
    }
  }
  pieces.beforeStep();
  phys.step(gdt);
  pieces.afterStep(v => { if (now - game.lastLand > 70) { game.lastLand = now; sfx.land(v); } });
  stage.stepDrops(gdt);
  if (game.verdictAt && now > game.verdictAt) { game.verdictAt = 0; verdict(); }
  hud();
  drawTrail(now);
  stage.render(game.shake);
  game.shake *= 0.86;

  if (store.settings.quality === "auto" && frames < 240) {   // slow phone: drop to the battery look once
    frames++;
    if (dt > 0.026) slowFrames++;
    if (frames === 240 && slowFrames > 120) stage.setQuality("battery");
  }
});
