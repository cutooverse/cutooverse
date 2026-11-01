# cutooverse

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
