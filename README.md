# CutooVerse

A slicing game that runs entirely in the browser: three.js for the picture, Rapier for the
physics, no server and no build step.

## Run it on your computer

```bash
python serve.py
```

Then open http://localhost:8765. Opening `index.html` straight from the disk does not work: the
browser blocks the board images and the code files there.

`python serve.py 8766 --lan` also prints an address a phone on the same Wi-Fi can open.

## Put it online

Any static host works. On Vercel: import this repository, choose no framework, no build command,
and leave the output directory empty (the files are served as they are). `vercel.json` makes
browsers check for new code after each update instead of keeping old copies.

## Files

- `index.html` – the page: menus, HUD, styles
- `src/` – the game: `app.js` (modes and screens), `fruits.js` (shapes and shaders), `slice.js`
  (cutting), `physics.js` and `pieces.js` (Rapier bodies), `burst.js` (cube bursts), `photo.js`
  (your photo as a 3D shape), `stage.js`, `knife.js`, `sound.js`, `perf.js`, `i18n.js`, `store.js`
- `icons/ICONS.md` – the optional PNG icons and how to make them

## Telegram messages: visits and videos

`api/notify.js` (a Vercel function, no server of your own) sends a Telegram message when someone
opens the game (once per visit) and when someone finishes a video task: the IP, the city and
country, the device, and what the video unlocked. Nothing is sent from `serve.py` or the same
Wi-Fi, only from the live site. Crawlers and link previews are skipped.

1. In Telegram, open **@BotFather**, send `/newbot` and follow the steps. It gives you the bot's
   token.
2. Open your new bot and send it any message (a bot can only write to people who wrote to it).
3. Find your chat id: open **@userinfobot** and it replies with your id. For a group, add the bot to
   the group; the group's id starts with `-100`.
4. In Vercel: the project, **Settings › Environment Variables**, add `TELEGRAM_TOKEN` (the token)
   and `TELEGRAM_CHAT_ID` (the id), then **Deployments › Redeploy**.
   A group with topics: also add `TELEGRAM_TOPIC` (the topic's number) for every message, or
   `TELEGRAM_TOPIC_VISITS` and `TELEGRAM_TOPIC_VIDEOS` to put visits and videos in two topics. The
   number is in the topic's link: `t.me/c/1234567890/7` is topic `7` of group `-1001234567890`.
5. Optional, for a visitor number (#128, today 12) and at most 30 messages an hour per IP:
   **Storage** (or **Marketplace**) › **Upstash** › Redis, connected to this project. It adds its
   own settings; redeploy once more.

Keep the token only in Vercel's settings: never in the code, the game's files or a commit.

Visitor counts without IPs are also in Vercel's own **Analytics** tab (turn it on there once).
