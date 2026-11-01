// Looks, settings and puzzle stars, kept in this browser (and nowhere else).
const KEY = "cutcount.v1";
const DEFAULTS = {
  looks: { fruit: "orange", material: "real", knife: "chef", cuts: 50, size: "m", board: "walnut", backdrop: "teal", style: "free", camera: "top", speed: "normal" },
  settings: { sound: true, haptics: true, strength: "normal", quality: "auto", lang: "auto" },
  stars: [],
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { looks: { ...DEFAULTS.looks, ...raw.looks }, settings: { ...DEFAULTS.settings, ...raw.settings }, stars: Array.isArray(raw.stars) ? raw.stars : [] };
  } catch (e) {
    return structuredClone(DEFAULTS);
  }
}

export const store = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private window: keep it in memory */ }
}
export const totalStars = () => store.stars.reduce((a, b) => a + (b || 0), 0);
