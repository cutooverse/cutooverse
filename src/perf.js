// How hard the game works the device. Phones (and "Battery saver") get the light profile: a coarser
// fruit mesh, fewer physics bodies and steps, fewer drawn cut lines, simpler shadows, no clearcoat.
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const phoneUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export const perf = { mobile: coarse || phoneUA, low: false };

export function applyPerf(quality) {
  const low = quality === "battery" || (quality === "auto" && perf.mobile);
  Object.assign(perf, {
    low,
    ico: low ? 4 : 5,                 // icosphere level of a fruit: 5k triangles instead of 20k
    physHz: low ? 60 : 90,
    maxSteps: low ? 2 : 4,
    maxCubes: low ? 450 : 1100,       // bodies in a burst; the counter still shows the real count
    realPieces: low ? 120 : 300,      // up to this many pieces the fruit is really cut
    lines: low ? 100 : 160,           // cut lines drawn on a fruit while it is chopped (40 left parts looking uncut)
    shadowMap: quality === "best" ? 4096 : low ? 1024 : 2048,
    softShadows: !low,
    clearcoat: !low,
    hullDirs: low ? 26 : 48,
  });
  return perf;
}
