// Tells you on Telegram when someone opens the game or finishes a video task.
//
// Vercel settings (Project > Settings > Environment Variables), never in the game's code:
//   TELEGRAM_TOKEN    the bot's token from @BotFather
//   TELEGRAM_CHAT_ID  where the messages go (your own chat id, or a group's)
// Optional, for a visitor number and a limit on messages per IP: an Upstash Redis database from
// Vercel's Marketplace, which adds KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl|wget|python|headless/i;
const PER_IP_HOUR = 30;                               // more than this from one IP in an hour: dropped

const esc = s => String(s ?? "").slice(0, 120).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const header = (req, k) => { try { return decodeURIComponent(req.headers[k] || ""); } catch (e) { return req.headers[k] || ""; } };

function device(ua) {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "?";
  const browser = /EdgA?\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "?";
  return `${os} · ${browser}`;
}

// Upstash's REST API: several commands in one call, the results in order (null without a database)
async function redis(cmds) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(cmds) });
    return (await r.json()).map(x => x.result);
  } catch (e) { return null; }
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); } }
  return new Promise(res => {
    let raw = ""; req.on("data", c => { raw += c; if (raw.length > 4000) req.destroy(); });
    req.on("end", () => { try { res(JSON.parse(raw || "{}")); } catch (e) { res({}); } });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const token = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  const ua = req.headers["user-agent"] || "";
  if (!token || !chat || BOTS.test(ua)) return res.status(200).json({ ok: false });

  const body = await readBody(req);
  const event = body.event === "video" ? "video" : body.event === "visit" ? "visit" : null;
  if (!event) return res.status(400).json({ ok: false });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "?";
  const place = [header(req, "x-vercel-ip-city"), header(req, "x-vercel-ip-country-region"), req.headers["x-vercel-ip-country"]].filter(Boolean).join(", ") || "?";
  const day = new Date().toISOString().slice(0, 10), hour = new Date().toISOString().slice(0, 13);

  const counts = await redis([
    ["INCR", `rl:${ip}:${hour}`], ["EXPIRE", `rl:${ip}:${hour}`, 3600],
    ...(event === "visit" ? [["INCR", "visits"], ["INCR", `visits:${day}`]] : [["INCR", "videos"]]),
  ]);
  if (counts && counts[0] > PER_IP_HOUR) return res.status(200).json({ ok: false });

  const lines = event === "visit"
    ? [`👀 <b>${body.returning ? "Returning visitor" : "New visitor"}</b>${counts ? ` #${counts[2]} · today ${counts[3]}` : ""}`]
    : [`▶️ <b>Video watched</b>${counts ? ` #${counts[2]}` : ""}`,
       `🎬 youtu.be/${esc(body.video)} · ${body.via === "youtube" ? "on YouTube" : "in the game"}`,
       `🔓 ${esc(body.unlock)}`];
  lines.push(`🌍 ${esc(place)}`, `📱 ${esc(device(ua))}${body.lang ? ` · ${esc(body.lang)}` : ""}`, `🔢 IP ${esc(ip)}`);
  if (body.ref) lines.push(`↩️ from ${esc(body.ref)}`);

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
