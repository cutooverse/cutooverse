// Shared by the long fruits (cucumber, carrot, banana): the Blender code builds them as a UV sphere
// remapped along x, or as rings swept along a curve. Both are the same grid: a pole, rings of
// vertices, a pole, with shared vertices so the normals average across the seams.

// at(i, j): vertex j (0..segs-1) of ring i (0..rings-1), as [x, y, z]. The rings must run from poleA
// toward poleB, and j turn the way +y turns toward +z when the rings run along +x: the faces then
// wind counter-clockwise seen from outside.
export function tube(rings, segs, at, poleA, poleB) {
  const pos = [poleA];
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) pos.push(at(i, j));
  pos.push(poleB);
  const id = (i, j) => 1 + i * segs + j % segs, last = pos.length - 1, faces = [];
  for (let j = 0; j < segs; j++) {
    faces.push([0, id(0, j + 1), id(0, j)]);
    for (let i = 0; i + 1 < rings; i++) faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i + 1, j)]);
    faces.push([id(rings - 1, j), id(rings - 1, j + 1), last]);
  }
  return { pos, faces };
}

// volume of a closed { pos, faces } mesh (m³)
export function meshVolume({ pos, faces }) {
  let V = 0;
  for (const [a, b, c] of faces) {
    const [ax, ay, az] = pos[a], [bx, by, bz] = pos[b], [cx, cy, cz] = pos[c];
    V += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(V);
}

// the shortest way round from angle b to angle a (numpy's angle(exp(1j * (a - b))))
export const dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
