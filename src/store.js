// Looks, settings and puzzle stars, kept in this browser (and nowhere else).
const KEY = "cutcount.v1";
const DEFAULTS = {
  looks: { fruit: "orange", material: "real", knife: "chef", cuts: 50, size: "m", board: "walnut", backdrop: "teal", style: "free", camera: "top", speed: "normal" },
  settings: { sound: true, notes: "piano", haptics: true, strength: "normal", quality: "auto", lang: "auto" },
  stars: [],
  unlocked: [],                               // what videos opened ("knife.gold", "level.3")
  best: {},                                   // the most pieces, by "fruit|style|cuts"
  task: { video: null, watched: [] },         // the video the tasks show now, and the ones seen
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { looks: { ...DEFAULTS.looks, ...raw.looks }, settings: { ...DEFAULTS.settings, ...raw.settings }, stars: Array.isArray(raw.stars) ? raw.stars : [],
      unlocked: Array.isArray(raw.unlocked) ? raw.unlocked : [], best: raw.best && typeof raw.best === "object" ? raw.best : {}, task: { video: raw.task?.video || null, watched: raw.task?.watched || [] } };
  } catch (e) {
    return structuredClone(DEFAULTS);
  }
}

export const store = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private window: keep it in memory */ }
}
// one star for each Puzzle level cleared
export const totalStars = () => store.stars.filter(n => n > 0).length;
