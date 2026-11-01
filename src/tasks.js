// Video tasks: some looks and Puzzle levels open only after watching a video, a random one from
// videos.txt (one YouTube link a line). A video counts after `seconds` of it have played: in the
// game's own player (YouTube's IFrame API), or, where that does not load, on YouTube with the time
// spent away.
import { t } from "./i18n.js";

export const VIDEO_TASK = { seconds: 10 };
// what a video unlocks: "category.id" as in the Looks, or "level.N" for Puzzle level N + 1
export const VIDEO_UNLOCK = ["knife.gold", "fruit.pineapple", "fruit.coconut", "fruit.dragonfruit", "fruit.bamboo", "level.3", "level.6"];

// the 11-character video id from any YouTube link (watch?v=, youtu.be/, shorts/, embed/, live/) or a bare id
export function videoId(line) {
  const m = line.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || line.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
let list = null;
export function videoList() {                          // loaded once; a missing file is an empty list
  list ||= fetch("videos.txt", { cache: "no-store" }).then(r => (r.ok ? r.text() : ""))
    .then(text => [...new Set(text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#")).map(videoId).filter(Boolean))])
    .catch(() => []);
  return list;
}
// a random one, preferring those not watched yet (all of them again once every one was)
export function pickVideo(ids, watched, not) {
  const fresh = ids.filter(id => !watched.includes(id) && id !== not);
  const pool = fresh.length ? fresh : ids.filter(id => id !== not).length ? ids.filter(id => id !== not) : ids;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

const $ = id => document.getElementById(id);
let yt = null, player = null, timer = 0, awayFrom = 0, current = null;

function loadYT() {                                    // the IFrame API, once; a failure can be tried again later
  yt ||= new Promise((res, rej) => {
    if (window.YT?.Player) return res(window.YT);
    window.onYouTubeIframeAPIReady = () => res(window.YT);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api"; s.onerror = rej;
    document.head.appendChild(s);
    setTimeout(() => rej(new Error("timeout")), 8000);
  }).catch(e => { yt = null; throw e; });
  return yt;
}

// onDone(task) is called once, when enough of the video has played
export function watch(task, onDone) {
  current = { task, onDone, watched: 0, done: false, via: "player" };
  $("video").hidden = false;
  $("videoTitle").textContent = task.title;
  $("videoFail").hidden = true;
  $("videoBox").innerHTML = '<div id="videoPlayer"></div>';
  progress();
  loadYT().then(YT => {
    if (current?.task !== task) return;
    player = new YT.Player("videoPlayer", {
      videoId: task.video, playerVars: { playsinline: 1, rel: 0, autoplay: 1 },
      events: { onStateChange: e => playing(e.data === YT.PlayerState.PLAYING, e.data === YT.PlayerState.ENDED), onError: fail },
    });
  }, fail);
}

function playing(on, ended) {
  clearInterval(timer);
  if (ended) return finish();
  if (on) timer = setInterval(() => { current.watched += 0.25; progress(); if (current.watched >= current.task.seconds) finish(); }, 250);
}

function fail() {                                      // no player here (blocked, or the video may not be embedded)
  clearInterval(timer);
  $("videoBox").innerHTML = "";
  $("videoFail").hidden = false;
}

// on YouTube itself: the time away from the game counts
$("videoOpen").onclick = () => {
  if (!current) return;
  window.open(`https://www.youtube.com/watch?v=${current.task.video}`, "_blank", "noopener");
  current.via = "youtube";
  awayFrom = Date.now();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !awayFrom || !current) return;
  current.watched = Math.max(current.watched, (Date.now() - awayFrom) / 1000);
  awayFrom = 0;
  progress();
  if (current.watched >= current.task.seconds) finish();
});

function finish() {
  clearInterval(timer);
  if (current.done) return;
  current.done = true; current.watched = current.task.seconds;
  progress();
  current.onDone({ ...current.task, via: current.via });
}

function progress() {
  const { task, watched, done } = current, left = Math.max(0, Math.ceil(task.seconds - watched));
  $("videoBar").style.transform = `scaleX(${Math.min(1, watched / task.seconds)})`;
  $("videoNote").textContent = done ? t("earned") : t("keepWatching", { s: left });
  $("videoNote").classList.toggle("win", done);
}

$("videoClose").onclick = () => {
  clearInterval(timer); awayFrom = 0;
  try { player?.destroy(); } catch (e) { /* already gone */ }
  player = null; current = null;
  $("videoBox").innerHTML = "";
  $("video").hidden = true;
};

export const taskLine = () => t("watchFor", { s: VIDEO_TASK.seconds });
