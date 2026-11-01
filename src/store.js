// Looks, settings and puzzle stars, kept in this browser (and nowhere else).
const KEY = "cutcount.v1";
const DEFAULTS = {
  looks: { fruit: "orange", material: "real", knife: "chef", cuts: 50, size: "m", board: "walnut", backdrop: "teal", style: "free", camera: "top", speed: "normal" },
  settings: { sound: true, haptics: true, strength: "normal", quality: "auto", lang: "auto" },
  stars: [],
  task: { stars: 0, video: null, watched: [] },   // what the video task gave, the video it shows, the ones seen
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { looks: { ...DEFAULTS.looks, ...raw.looks }, settings: { ...DEFAULTS.settings, ...raw.settings }, stars: Array.isArray(raw.stars) ? raw.stars : [],
      task: { ...DEFAULTS.task, stars: raw.tasks?.["video-1"] ? 3 : 0, ...raw.task } };   // tasks: the first version
  } catch (e) {
    return structuredClone(DEFAULTS);
  }
}

export const store = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private window: keep it in memory */ }
}
// Puzzle stars plus the ones tasks gave
export const totalStars = () => store.stars.reduce((a, b) => a + (b || 0), 0) + (store.task.stars || 0);
