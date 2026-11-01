// Tells the site's /api/notify (and so your Telegram) about a visit or a finished video task.
// Only on the real site: nothing is sent from serve.py or the same Wi-Fi.
const LIVE = !/^(localhost|127\.0\.0\.1|192\.168\.)/.test(location.hostname);

export function notify(event, data = {}) {
  if (!LIVE) return;
  const body = JSON.stringify({ event, lang: navigator.language, ...data });
  try { if (navigator.sendBeacon?.("/api/notify", new Blob([body], { type: "application/json" }))) return; } catch (e) { /* fall back to fetch */ }
  fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

// once per visit (a reload in the same tab is the same visit); "returning" if this browser came before
export function notifyVisit() {
  let returning = false;
  try {
    if (sessionStorage.getItem("cutcount.visit")) return;
    sessionStorage.setItem("cutcount.visit", "1");
    returning = !!localStorage.getItem("cutcount.visited");
    localStorage.setItem("cutcount.visited", "1");
  } catch (e) { /* private window: still count it */ }
  let ref = "";
  try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { /* no referrer */ }
  notify("visit", { returning, ref: ref === location.hostname ? "" : ref });
}
