// Room definitions: geometry, fixed camera zones, doors, interactables, spawns.
import * as THREE from '../vendor/three.module.min.js';
import * as T from './textures.js';
import { Builder, shell, mat } from './world.js';

const WALL_H = 3.6;

// Build a door in a shell wall. `side` is n/s/e/w of a room of size w x d.
// Returns the trigger rectangle used for "go through".
function portal(b, side, at, w, d, opts) {
  const t = 0.3, hw = w / 2, hd = d / 2;
  let x = 0, z = 0, rotY = 0, tx = 0, tz = 0;
  if (side === 'n') { x = at; z = -hd - t / 2; rotY = 0; tx = at; tz = -hd + 0.55; }
  if (side === 's') { x = at; z = hd + t / 2; rotY = Math.PI; tx = at; tz = hd - 0.55; }
  if (side === 'w') { x = -hw - t / 2; z = at; rotY = Math.PI / 2; tx = -hw + 0.55; tz = at; }
  if (side === 'e') { x = hw + t / 2; z = at; rotY = -Math.PI / 2; tx = hw - 0.55; tz = at; }
  const width = (opts && opts.width) || 1.4;
  if (!opts || opts.mesh !== false) b.door(x, z, rotY, width, 2.25);
  const horiz = (side === 'n' || side === 's');
  return Object.assign({
    x: tx, z: tz,
    w: horiz ? width + 0.3 : 1.7,
    d: horiz ? 1.7 : width + 0.3,
    facing: side,
  }, opts || {});
}

function op(side, at, width = 1.4) { return { side, at, width }; }

// ---------------------------------------------------------------------------
export const ROOMS = {};

// 1. ENTRANCE HALL ----------------------------------------------------------
ROOMS.foyer = {
  name: 'Entrance Hall',
  w: 14, d: 16,
  fog: [0x04060a, 6, 30],
  ambient: 0x232a33, ambientI: 0.95,
  build(b, g) {
    const floorT = T.marble('#4a4338', '#1c1a17', 3, 4, 5);
    const wallT = T.wallpaper('#2e2a22', '#6b5a35', 12, 4, 1);
    shell(b, 14, 16, 4.6, floorT, wallT, T.wood('#171009', '#2e2011', 13, 3, 3),
      [op('n', -4.6), op('w', -2), op('e', 2)]);

    // grand staircase (decorative, blocked at the top)
    const stepM = mat(T.wood('#241709', '#553619', 8, 2, 1));
    for (let i = 0; i < 7; i++) {
      b.box(0, i * 0.2, -6.6 + i * 0.42, 6 - i * 0.2, 0.2, 0.42, stepM, { collide: true });
    }
    b.box(0, 1.4, -7.6, 6, 1.2, 1.6, mat(wallT), { collide: true });
    const rail = mat(T.wood('#1a1008', '#4a301e', 9, 1, 1));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        b.box(sx * (2.9 - i * 0.1), i * 0.2 + 0.2, -6.6 + i * 0.42, 0.09, 0.8, 0.09, rail);
      }
    }

    // red carpet runner
    b.plane(0, 0.011, 1.5, 3.4, 11, new THREE.MeshPhongMaterial({
      map: T.rug(14, 1, 3), shininess: 0, transparent: false,
    })).rotation.x = -Math.PI / 2;

    // front doors (chained)
    b.wall(0, 7.85, 3.2, 2.6, 0.16, T.doorTex(77, 2, 1));
    const chain = mat(T.metal('#4a4a4a', 91, 4, 1));
    b.box(0, 1.2, 7.7, 3.4, 0.09, 0.09, chain);
    b.box(0, 1.45, 7.7, 3.4, 0.09, 0.09, chain);

    // side tables + pillars
    const pillarM = mat(T.marble('#3b382f', '#15140f', 22, 1, 2));
    for (const sx of [-1, 1]) for (const pz of [-5.0, 5.0]) {
      b.cyl(sx * 5.6, 0, pz, 0.34, 0.4, 4.6, pillarM, 10);
      b.collider(sx * 5.6, pz, 0.8, 0.8);
    }
    b.table(-4.6, 5.6, 1.4, 0.6, 0, mat(T.wood('#2a1b10', '#5c3c22', 15, 2, 1)));

    // chandelier
    b.fixture(0, 3.1, 0, 0xffd9a0, 4.6);
    b.cyl(0, 3.15, 0, 0.03, 0.03, 0.9, mat(T.metal('#22201c', 3, 1, 1)), 6);
    b.lamp(0, 3.0, 0, 0xffcf9a, 14, 18);
    b.lamp(0, 2.4, -6.2, 0xbfd0ff, 6, 11);
    b.lamp(-4.6, 1.6, 5.6, 0xffb066, 4, 7);
    // wall sconces down both sides keep the hall readable end to end
    for (const sx of [-1, 1]) for (const sz of [-3.4, 2.4, 6.4]) {
      b.fixture(sx * 6.55, 2.35, sz, 0xffb878).scale.setScalar(0.55);
      b.lamp(sx * 6.25, 2.35, sz, 0xffab68, 4.2, 8);
    }
    b.decal(2.4, -3.2, 1.6, 5);
  },
  cameras: [
    { zone: [-7, -8, 7, -1.5], pos: [5.4, 3.7, 3.0], look: [-0.6, 1.1, -5.6], fov: 50 },
    { zone: [-7, -1.5, 7, 8], pos: [6.0, 3.9, -5.8], look: [-1.0, 1.0, 4.6], fov: 54 },
  ],
  doors: [
    { side: 'n', at: -4.6, to: 'hall_e', label: 'Main Corridor' },
    { side: 'w', at: -2, to: 'safe_room', label: 'Keeper\u2019s Office' },
    { side: 'e', at: 2, to: 'dining', label: 'Dining Hall' },
  ],
  entries: {
    start: [0, 4.4, Math.PI],
    hall_e: [-4.6, -6.3, Math.PI],
    safe_room: [-5.2, -2, -Math.PI / 2],
    dining: [5.2, 2, Math.PI / 2],
  },
};

// 2. SAVE ROOM --------------------------------------------------------------
ROOMS.safe_room = {
  name: 'Keeper’s Office',
  w: 8, d: 9,
  fog: [0x0a0806, 6, 26],
  ambient: 0x2a2620, ambientI: 0.9,
  safe: true,
  build(b, g) {
    const floorT = T.wood('#241709', '#5a3a1e', 31, 3, 3);
    const wallT = T.wallpaper('#33301f', '#7a6a3a', 32, 3, 1);
    shell(b, 8, 9, 3.2, floorT, wallT, T.concrete('#2a2724', 33, 2, 2), [op('e', 0)]);

    b.shelf(-3.4, -2.2, 2.4, 2.2, Math.PI / 2);
    b.shelf(-3.4, 1.4, 2.4, 2.2, Math.PI / 2);
    const desk = b.table(1.2, -2.6, 2.4, 1.1, 0);
    // typewriter
    const tm = mat(T.metal('#23211e', 41, 1, 1));
    b.box(1.2, 0.82, -2.6, 0.62, 0.26, 0.46, tm);
    b.box(1.2, 1.08, -2.75, 0.5, 0.2, 0.1, tm);
    for (let i = 0; i < 3; i++) b.box(1.0 + i * 0.2, 0.82, -2.42, 0.14, 0.03, 0.14, mat(T.metal('#6a6255', 42, 1, 1)));
    // item box
    b.box(1.6, 0, 3.0, 1.1, 0.7, 0.8, mat(T.metal('#3a4038', 43, 2, 1)), { collide: true });
    b.box(1.6, 0.7, 3.0, 1.16, 0.08, 0.86, mat(T.metal('#4a5048', 44, 2, 1)));
    // pin board
    b.plane(0, 1.8, -4.34, 2.2, 1.4, new THREE.MeshPhongMaterial({ map: T.paperTex(7, 51), shininess: 0 }));
    b.crate(-2.8, 3.2, 0.8);
    b.barrel(3.2, -3.4, 0.85);

    b.fixture(0, 2.7, 0, 0xffe0b0, 3.2);
    b.lamp(0, 2.6, 0, 0xffd8a8, 11, 12);
    b.lamp(1.2, 1.5, -2.6, 0xffc070, 3.5, 5);
  },
  cameras: [
    { zone: [-5, -5, 5, 5], pos: [3.4, 2.85, 3.9], look: [-1.0, 0.9, -2.2], fov: 64 },
  ],
  doors: [{ side: 'e', at: 0, to: 'foyer', label: 'Entrance Hall' }],
  entries: { foyer: [2.4, 0, Math.PI / 2] },
};

// 3. DINING HALL ------------------------------------------------------------
ROOMS.dining = {
  name: 'Dining Hall',
  w: 11, d: 15,
  fog: [0x05070a, 6, 28],
  ambient: 0x1c222a, ambientI: 0.6,
  build(b, g) {
    const floorT = T.wood('#1e1409', '#4e3318', 61, 3, 4);
    const wallT = T.wallpaper('#2a2118', '#6a4a2a', 62, 3, 1);
    shell(b, 11, 15, WALL_H, floorT, wallT, T.wood('#171009', '#2e2011', 69, 3, 4), [op('w', 0), op('n', -2.5)]);

    // long table
    const tm = mat(T.wood('#2b1c11', '#6a4526', 63, 3, 1));
    b.table(0, 0.5, 2.4, 7, 0, tm);
    for (let i = 0; i < 4; i++) {
      for (const sx of [-1, 1]) {
        const cz = -2.2 + i * 1.6;
        b.box(sx * 1.75, 0, cz, 0.5, 0.46, 0.5, tm, { collide: true });
        b.box(sx * 1.97, 0.46, cz, 0.08, 0.6, 0.5, tm);
      }
    }
    // candelabra + plates
    const silver = mat(T.metal('#6a6455', 64, 1, 1));
    for (const cz of [-1.6, 1.6]) {
      b.cyl(0, 0.87, cz, 0.035, 0.09, 0.2, silver, 8);
      b.cyl(0, 1.07, cz, 0.022, 0.024, 0.2, mat(T.concrete('#8d856e', 65, 1, 1)), 6);
      b.fixture(0, 1.3, cz, 0xffc06a).scale.setScalar(0.32);
      b.lamp(0, 1.3, cz, 0xffb060, 3.2, 6.0);
    }
    for (let i = 0; i < 6; i++) {
      const cz = -2.6 + i * 1.1;
      b.cyl((i % 2 ? 1 : -1) * 0.7, 0.86, cz, 0.17, 0.15, 0.03, mat(T.concrete('#bfb6a0', 66, 1, 1)), 10);
    }

    // fireplace on the east wall
    const stone = mat(T.marble('#3a352c', '#141210', 67, 2, 2));
    b.box(5.0, 0, -3.5, 1.0, 2.6, 3.0, stone, { collide: true, tall: true });
    b.box(4.35, 0.1, -3.5, 0.3, 1.5, 1.9, new THREE.MeshBasicMaterial({ color: 0x080604 }));
    b.lamp(4.2, 0.7, -3.5, 0xff5a1e, 5, 5.5);

    // three portraits (the safe-code clue)
    const frames = [
      { z: -5.0, hint: 4, id: 'portrait_dusk', label: 'Portrait: Dusk' },
      { z: -1.2, hint: 7, id: 'portrait_midnight', label: 'Portrait: Midnight' },
      { z: 2.6, hint: 2, id: 'portrait_dawn', label: 'Portrait: Dawn' },
    ];
    for (const f of frames) {
      const fm = mat(T.wood('#1a1108', '#7a5a22', 68, 1, 1));
      b.box(-5.28, 1.35, f.z, 0.1, 1.5, 1.2, fm);
      const p = b.plane(-5.2, 2.1, f.z, 0.95, 1.2,
        new THREE.MeshPhongMaterial({ map: T.painting(f.hint * 13 + 70, f.hint), shininess: 0 }), Math.PI / 2);
      p.position.y = 2.1;
      b.lamp(-4.6, 2.9, f.z, 0xffd9a0, 2.2, 3.4);
    }

    b.decal(-2.0, 5.2, 1.8, 12);
    b.decal(1.6, -4.4, 1.4, 13);
    b.lamp(0, 3.0, -5.5, 0x8fa8c8, 4, 9);
    b.lamp(0, 3.0, 5.5, 0x8fa8c8, 4, 9);
  },
  cameras: [
    { zone: [-6, -8, 6, -1], pos: [-3.4, 3.2, 4.4], look: [0.9, 1.2, -5.2], fov: 48 },
    { zone: [-6, -1, 6, 8], pos: [3.7, 3.3, -5.4], look: [-0.9, 1.0, 4.2], fov: 50 },
  ],
  doors: [
    { side: 'w', at: 0, to: 'foyer', label: 'Entrance Hall' },
    { side: 'n', at: -2.5, to: 'kitchen', label: 'Scullery' },
  ],
  entries: { foyer: [-3.6, 0.9, -Math.PI / 2], kitchen: [-2.5, -5.9, Math.PI] },
};

// 4. KITCHEN ----------------------------------------------------------------
ROOMS.kitchen = {
  name: 'Scullery',
  w: 10, d: 9,
  fog: [0x060806, 5, 24],
  ambient: 0x1e2420, ambientI: 0.65,
  build(b, g) {
    const floorT = T.tileWall('#4a4b46', '#22211e', 71, 4, 4);
    const wallT = T.tileWall('#5a5b52', '#2a2823', 72, 4, 2);
    shell(b, 10, 9, 3.2, floorT, wallT, T.concrete('#26241f', 73, 3, 3), [op('s', -2.5), op('e', 1.5)]);

    const steel = mat(T.metal('#5a5f5c', 74, 2, 1));
    // counters along the north wall
    b.box(-1.4, 0, -3.9, 6.6, 0.9, 0.8, steel, { collide: true });
    b.box(-1.4, 0.9, -3.9, 6.7, 0.06, 0.86, mat(T.metal('#6e736f', 75, 3, 1)));
    // sink basin
    b.box(-3.0, 0.62, -3.9, 1.0, 0.3, 0.6, mat(T.metal('#3a3f3c', 76, 1, 1)));
    // hanging pots
    for (let i = 0; i < 5; i++) {
      b.cyl(-3.4 + i * 0.7, 2.1, -3.4, 0.16, 0.13, 0.22, steel, 8);
      b.box(-3.4 + i * 0.7, 2.32, -3.4, 0.02, 0.3, 0.02, steel);
    }
    // stove
    b.box(2.7, 0, -3.9, 1.5, 1.0, 0.8, mat(T.metal('#3f4340', 77, 1, 1)), { collide: true });
    // butcher block
    b.table(1.2, 0.8, 2.4, 1.2, 0);
    b.box(1.2, 0.83, 0.8, 0.5, 0.06, 0.3, mat(T.wood('#3a2a18', '#7a5a30', 78, 1, 1)));
    // shelving + crates
    b.shelf(-4.4, 1.6, 2.4, 2.0, Math.PI / 2);
    b.crate(4.2, -2.6, 0.8); b.crate(3.5, -2.9, 0.7);
    b.crate(4.2, -2.6, 0.6).position.y = 0.8 + 0.3;
    b.barrel(-4.1, -1.2, 0.9);

    b.decal(0.2, -1.2, 2.0, 22);
    b.decal(3.0, 0.4, 1.5, 23);

    b.fixture(-1.0, 2.6, 0.5, 0xd8e4d0, 3.2);
    b.lamp(-1.0, 2.55, 0.5, 0xcfe0d0, 9, 11);
    b.lamp(3.0, 1.6, -3.6, 0xff8a3a, 2.5, 4);
  },
  cameras: [
    { zone: [-6, 0, 6, 6], pos: [-4.2, 2.85, -3.4], look: [1.0, 0.9, 3.0], fov: 62 },
    { zone: [-6, -6, 6, 0], pos: [3.9, 2.85, 3.8], look: [-1.2, 1.0, -3.2], fov: 58 },
  ],
  doors: [
    { side: 's', at: -2.5, to: 'dining', label: 'Dining Hall' },
    { side: 'e', at: 1.5, to: 'generator', label: 'Utility Room' },
  ],
  entries: { dining: [-2.5, 2.9, 0], generator: [3.4, 1.5, Math.PI / 2] },
};

// 5. UTILITY ROOM -----------------------------------------------------------
ROOMS.generator = {
  name: 'Utility Room',
  w: 9, d: 8,
  fog: [0x050604, 4, 20],
  ambient: 0x181c18, ambientI: 0.5,
  build(b, g) {
    const floorT = T.concrete('#3a3833', 81, 3, 3);
    const wallT = T.concrete('#46433c', 82, 3, 2);
    shell(b, 9, 8, 3.0, floorT, wallT, T.concrete('#201e1b', 83, 3, 3), [op('w', 1.5)]);

    const steel = mat(T.metal('#4a4f4c', 84, 2, 1));
    const dark = mat(T.metal('#2e332f', 85, 2, 1));
    // the generator itself
    b.box(1.4, 0, -2.4, 3.4, 1.7, 1.6, steel, { collide: true });
    b.box(1.4, 1.7, -2.4, 2.0, 0.35, 1.0, dark);
    b.cyl(3.4, 1.7, -2.4, 0.18, 0.18, 1.1, dark, 8);
    b.box(-0.6, 0.5, -1.55, 0.5, 0.7, 0.2, dark);   // fuse socket housing
    // pipes
    for (let i = 0; i < 3; i++) {
      const p = b.cyl(-3.9, 1.2 + i * 0.5, 0, 0.09, 0.09, 7.4, dark, 8);
      p.rotation.x = Math.PI / 2; p.position.y = 1.2 + i * 0.5;
    }
    // breaker panel on the south wall
    b.box(-2.2, 1.1, 3.7, 1.5, 1.1, 0.18, dark);
    b.box(-2.2, 1.15, 3.58, 1.3, 0.95, 0.04, mat(T.metal('#5e6360', 86, 1, 1)));
    b.table(3.0, 2.6, 1.4, 0.8, 0);
    b.crate(-3.4, -2.6, 0.8);
    b.barrel(-3.6, 2.8, 0.9);
    b.decal(-1.0, 1.0, 1.8, 33);

    b.fixture(0, 2.6, 1.0, 0x9fd4a0, 3.0);
    b.lamp(0, 2.55, 1.0, 0x9fd4a0, 6, 9);
    b.lamp(2.0, 1.9, -2.2, 0xff6a2a, 2.4, 4);
  },
  cameras: [
    { zone: [-6, -6, 6, 6], pos: [3.9, 2.75, 3.6], look: [-1.5, 0.9, -2.0], fov: 66 },
  ],
  doors: [{ side: 'w', at: 1.5, to: 'kitchen', label: 'Scullery' }],
  entries: { kitchen: [-2.9, 1.5, -Math.PI / 2] },
};

// 6. MAIN CORRIDOR ----------------------------------------------------------
ROOMS.hall_e = {
  name: 'Main Corridor',
  w: 5, d: 20,
  fog: [0x04050a, 4, 24],
  ambient: 0x171c26, ambientI: 0.55,
  build(b, g) {
    const floorT = T.marble('#3e3a32', '#171512', 91, 2, 8);
    const wallT = T.wallpaper('#262218', '#5c4a28', 92, 2, 1);
    shell(b, 5, 20, 3.4, floorT, wallT, T.wood('#181008', '#33210f', 93, 2, 8),
      [op('s', 0), op('w', -4), op('e', 3), op('n', 0, 1.6)]);

    // wainscot panels
    const wain = mat(T.wood('#20150c', '#43301a', 94, 4, 1));
    for (const sx of [-1, 1]) {
      b.box(sx * 2.42, 0, 0, 0.06, 1.0, 19.6, wain);
    }
    // ceiling beams
    const beam = mat(T.wood('#1a1208', '#3a2712', 95, 1, 1));
    for (let i = -4; i <= 4; i++) b.box(0, 3.2, i * 2.2, 5.2, 0.2, 0.24, beam);

    // sconces, alternating walls so neither side of the shot goes black
    for (let i = -4; i <= 4; i++) {
      const sx = i % 2 ? 1 : -1;
      b.fixture(sx * 2.3, 2.2, i * 2.2, 0xffb066).scale.setScalar(0.6);
      b.lamp(sx * 2.05, 2.2, i * 2.2, 0xffa860, 3.6, 7);
    }
    // security door (north) frame
    const steel = mat(T.metal('#454b48', 96, 2, 1));
    b.box(0, 0, -9.7, 2.2, 2.6, 0.3, steel, { collide: false });
    b.box(0, 2.6, -9.7, 2.6, 0.3, 0.34, steel);
    b.decal(0.6, 4.2, 1.8, 44);
    b.decal(-0.8, -2.0, 1.6, 45);
    // toppled chair
    const tm = mat(T.wood('#2b1c11', '#6a4526', 97, 1, 1));
    const ch = b.box(1.4, 0.2, 6.2, 0.5, 0.46, 0.5, tm, { rotY: 0.7 });
    ch.rotation.z = 1.4;
  },
  cameras: [
    { zone: [-4, -11, 4, -3], pos: [0.2, 3.0, 3.4], look: [0.0, 1.0, -9.2], fov: 42 },
    { zone: [-4, -3, 4, 4], pos: [0.0, 3.0, -6.6], look: [0.0, 1.0, 3.4], fov: 48 },
    { zone: [-4, 4, 4, 11], pos: [-0.2, 3.0, 0.4], look: [0.0, 1.0, 9.8], fov: 44 },
  ],
  doors: [
    { side: 's', at: 0, to: 'foyer', label: 'Entrance Hall' },
    { side: 'w', at: -4, to: 'library', label: 'Library' },
    { side: 'e', at: 3, to: 'study', label: 'Study', lock: 'key_rust', lockMsg: 'The study door is locked. A small owl is engraved above the keyhole.' },
    { side: 'n', at: 0, width: 1.6, to: 'basement', label: 'Cellar Stair', mesh: false, secure: true },
  ],
  entries: {
    foyer: [0, 8.3, Math.PI],
    library: [-0.9, -4, -Math.PI / 2],
    study: [0.9, 3, Math.PI / 2],
    basement: [0, -8.2, 0],
  },
};

// 7. LIBRARY ----------------------------------------------------------------
ROOMS.library = {
  name: 'Library',
  w: 11, d: 10,
  fog: [0x06060a, 5, 26],
  ambient: 0x202028, ambientI: 0.6,
  build(b, g) {
    const floorT = T.wood('#1d1409', '#4a3218', 101, 3, 3);
    const wallT = T.wallpaper('#262a22', '#5c5a32', 102, 3, 1);
    shell(b, 11, 10, WALL_H, floorT, wallT, T.wood('#171009', '#2e2011', 104, 3, 3), [op('e', 0)]);

    for (let i = 0; i < 3; i++) {
      b.shelf(-5.2, -3.0 + i * 3.0, 2.6, 2.6, Math.PI / 2);
    }
    b.shelf(-2.0, -4.6, 3.2, 2.6, Math.PI);
    b.shelf(2.0, -4.6, 3.2, 2.6, Math.PI);
    b.shelf(1.0, 4.6, 3.2, 2.4, 0);
    b.shelf(4.0, -3.4, 2.6, 2.2, -Math.PI / 2);

    // reading table + lamp
    b.table(-1.2, 1.4, 2.2, 1.2, 0);
    b.cyl(-1.9, 0.87, 1.4, 0.09, 0.14, 0.3, mat(T.metal('#3a3024', 103, 1, 1)), 8);
    const shade = b.cyl(-1.9, 1.17, 1.4, 0.02, 0.17, 0.18, new THREE.MeshPhongMaterial({ color: 0x3b6a4a, shininess: 5 }), 10);
    b.fixture(-1.9, 1.2, 1.4, 0xffd89a);
    b.lamp(-1.9, 1.25, 1.4, 0xffcf90, 5.5, 6);
    // scattered books on the floor
    const bm = new THREE.MeshPhongMaterial({ color: 0x3a2a1e, shininess: 0 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3;
      b.box(Math.cos(a) * 2.4 + 0.4, 0, Math.sin(a) * 2.2 + 2.0, 0.24, 0.05, 0.18, bm, { rotY: a });
    }
    b.decal(-3.2, 2.8, 1.6, 55);
    b.lamp(0, 3.1, -2.0, 0x9aa8c0, 4.5, 9);
    b.lamp(3.0, 2.8, 3.4, 0x9aa8c0, 3.5, 8);
  },
  cameras: [
    { zone: [-7, -7, 0, 7], pos: [4.2, 3.15, 3.9], look: [-1.6, 1.0, -1.2], fov: 58 },
    { zone: [0, -7, 7, 7], pos: [-4.4, 3.15, -3.6], look: [2.2, 1.0, 1.6], fov: 58 },
  ],
  doors: [{ side: 'e', at: 0, to: 'hall_e', label: 'Main Corridor' }],
  entries: { hall_e: [3.9, 0, Math.PI / 2] },
};

// 8. STUDY ------------------------------------------------------------------
ROOMS.study = {
  name: 'Study',
  w: 9, d: 8,
  fog: [0x07060a, 5, 24],
  ambient: 0x262028, ambientI: 0.6,
  build(b, g) {
    const floorT = T.wood('#22160b', '#54381c', 111, 3, 3);
    const wallT = T.wallpaper('#33241c', '#7a5230', 112, 3, 1);
    shell(b, 9, 8, 3.3, floorT, wallT, T.wood('#181008', '#31200f', 113, 3, 3), [op('w', -1)]);

    b.table(0.4, -1.8, 2.6, 1.3, 0);
    b.box(0.4, 0.83, -1.8, 0.5, 0.06, 0.36, mat(T.paperTex(9, 114)));
    b.cyl(1.5, 0.87, -1.8, 0.07, 0.12, 0.26, mat(T.metal('#3a3024', 115, 1, 1)), 8);
    b.fixture(1.5, 1.18, -1.8, 0xffd89a);
    b.lamp(1.5, 1.2, -1.8, 0xffcf90, 5, 6);
    b.box(0.4, 0, -3.0, 0.6, 0.5, 0.6, mat(T.wood('#241708', '#553619', 116, 1, 1)), { collide: true });

    b.shelf(-3.9, 1.0, 2.6, 2.4, Math.PI / 2);
    b.shelf(3.9, -0.5, 2.4, 2.4, -Math.PI / 2);

    // wall safe behind a swung-open painting
    const steel = mat(T.metal('#3f4442', 117, 1, 1));
    b.box(-1.6, 1.5, 3.7, 0.9, 0.9, 0.2, steel);
    b.box(-1.6, 1.55, 3.58, 0.74, 0.74, 0.04, mat(T.metal('#5a605d', 118, 1, 1)));
    b.cyl(-1.6, 1.9, 3.5, 0.07, 0.07, 0.06, mat(T.metal('#8a8478', 119, 1, 1)), 10).rotation.x = Math.PI / 2;
    const fm = mat(T.wood('#1a1108', '#7a5a22', 120, 1, 1));
    const pf = b.box(-0.6, 1.3, 3.42, 0.14, 1.2, 1.0, fm, { rotY: 0 });
    pf.rotation.y = -0.9; pf.position.set(-0.75, 1.9, 3.2);

    b.crate(3.4, 2.6, 0.7);
    b.decal(2.0, 1.6, 1.5, 66);
    b.lamp(0, 2.9, 1.5, 0xb0a898, 5, 9);
  },
  cameras: [
    { zone: [-6, -6, 6, 6], pos: [3.7, 3.0, 3.7], look: [-1.3, 1.0, -2.2], fov: 66 },
  ],
  doors: [{ side: 'w', at: -1, to: 'hall_e', label: 'Main Corridor' }],
  entries: { hall_e: [-2.9, -1, -Math.PI / 2] },
};

// 9. CELLAR -----------------------------------------------------------------
ROOMS.basement = {
  name: 'Cellar',
  w: 8, d: 26,
  fog: [0x020304, 3, 18],
  ambient: 0x11161b, ambientI: 0.72,
  dark: true,
  build(b, g) {
    const floorT = T.concrete('#2e2c28', 131, 3, 10);
    const wallT = T.concrete('#3a3630', 132, 3, 2);
    shell(b, 8, 26, 3.2, floorT, wallT, T.concrete('#1a1916', 133, 3, 10),
      [op('s', 0, 1.6)]);

    const steel = mat(T.metal('#43483f', 134, 2, 1));
    const dark = mat(T.metal('#282c26', 135, 2, 1));
    // support pillars
    for (let i = -4; i <= 4; i += 2) {
      for (const sx of [-1, 1]) {
        b.box(sx * 2.7, 0, i * 2.6, 0.5, 3.2, 0.5, mat(T.concrete('#332f2a', 136, 1, 2)), { collide: true, tall: true });
      }
    }
    // pipes overhead
    for (let i = 0; i < 2; i++) {
      const p = b.cyl(-1.2 + i * 2.4, 2.8, 0, 0.1, 0.1, 25, dark, 8);
      p.rotation.x = Math.PI / 2; p.position.y = 2.8;
    }
    // clutter
    b.crate(-2.0, 7.0, 0.8); b.crate(-2.2, 6.0, 0.7);
    b.barrel(2.1, 4.2, 0.9); b.barrel(2.4, 3.2, 0.85);
    b.crate(2.0, -3.0, 0.75);
    b.box(-2.3, 0, -1.0, 1.0, 1.4, 2.4, steel, { collide: true }); // shelving unit
    b.table(2.0, -6.0, 1.6, 0.8, 0);

    // the service gate at the far (north) end
    const gate = mat(T.metal('#4d5248', 137, 3, 2));
    for (let i = 0; i < 9; i++) {
      b.box(-2.0 + i * 0.5, 0, -12.7, 0.16, 2.8, 0.16, gate);
    }
    b.box(0, 2.8, -12.7, 5.0, 0.3, 0.3, gate);
    b.box(0, 0, -12.9, 5.4, 0.2, 0.2, gate);
    // lever housing
    b.box(2.6, 0.9, -11.6, 0.4, 0.9, 0.5, dark);
    const lev = b.cyl(2.6, 1.5, -11.6, 0.05, 0.05, 0.55, mat(T.metal('#7a2a22', 138, 1, 1)), 8);
    lev.rotation.x = 0.7;

    b.decal(0.4, 8.0, 2.0, 77);
    b.decal(-1.2, 1.0, 2.2, 78);
    b.decal(1.4, -7.4, 1.8, 79);

    for (const z of [9.5, 3.0, -4.0, -10.5]) {
      b.fixture(0, 2.6, z, 0x74868f, 3.2).scale.setScalar(0.7);
      b.lamp(0, 2.55, z, 0x7f97a3, 7.5, 13);
    }
  },
  cameras: [
    { zone: [-5, 6, 5, 14], pos: [0.9, 2.95, 12.4], look: [-0.2, 1.0, 4.0], fov: 58 },
    { zone: [-5, -1, 5, 6], pos: [-1.0, 2.95, 8.4], look: [0.3, 1.0, -2.4], fov: 58 },
    { zone: [-5, -8, 5, -1], pos: [1.0, 2.95, 1.6], look: [-0.3, 1.0, -7.8], fov: 56 },
    { zone: [-5, -14, 5, -8], pos: [-1.0, 2.9, -5.4], look: [0.4, 1.1, -12.6], fov: 58 },
  ],
  doors: [{ side: 's', at: 0, width: 1.6, to: 'hall_e', label: 'Main Corridor', mesh: false }],
  entries: { hall_e: [0, 9.8, Math.PI] },
};

export { portal };

// ---------------------------------------------------------------------------
// Contents: pickups, interactables and enemy placements.
// Interactable.act(g) drives everything through the game facade.
// ---------------------------------------------------------------------------

ROOMS.foyer.pickups = [
  { id: 'foyer_note', x: -4.6, z: 5.3, y: 0.84, item: 'note_welcome' },
];
ROOMS.foyer.interactables = [
  {
    id: 'front_doors', x: 0, z: 6.9, r: 1.4, label: 'Front Doors',
    act: (g) => g.say('The doors are wound shut with chain and a padlock the size of a fist.\nWhoever did this did not want anyone leaving through the front.'),
  },
  {
    id: 'foyer_drawer', x: -4.6, z: 4.9, r: 1.4, label: 'Side Table',
    act: (g) => {
      if (g.flags.foyer_drawer) return g.say('The drawer is empty now.');
      if (g.give('ammo9', 8)) { g.flags.foyer_drawer = 1; g.say('A handful of loose rounds had rolled to the back of the drawer.'); }
    },
  },
  {
    id: 'stairs', x: 0, z: -5.0, r: 1.6, label: 'Staircase',
    act: (g) => g.say('The upper landing has collapsed into a heap of plaster and joists.\nThere is no way up.'),
  },
];
ROOMS.foyer.enemies = [];

ROOMS.safe_room.pickups = [
  { id: 'sr_gun', x: 0.2, z: -2.35, y: 0.85, item: 'handgun' },
  { id: 'sr_ammo', x: 2.2, z: -2.5, y: 0.85, item: 'ammo9', count: 12 },
  { id: 'sr_herb', x: -2.4, z: 0.2, item: 'herb' },
];
ROOMS.safe_room.interactables = [
  {
    id: 'typewriter', x: 1.2, z: -1.85, r: 1.5, label: 'Typewriter',
    act: (g) => g.confirmSave(),
  },
  {
    id: 'itembox', x: 1.6, z: 2.3, r: 1.4, label: 'Storage Trunk',
    act: (g) => g.openItemBox(),
  },
  {
    id: 'board', x: 0, z: -3.8, r: 1.6, label: 'Pin Board',
    act: (g) => g.say('Duty rosters, a seed catalogue, a photograph of six staff squinting into the sun.\nSomeone has drawn a careful circle around the groundskeeper’s face.'),
  },
];
ROOMS.safe_room.enemies = [];

ROOMS.dining.pickups = [
  { id: 'dn_herb', x: 3.4, z: 5.4, item: 'herb' },
];
ROOMS.dining.interactables = [
  {
    id: 'portrait_dusk', x: -4.4, z: -5.0, r: 1.6, label: 'Portrait — "Dusk"',
    act: (g) => { g.flags.saw_dusk = 1; g.say('A pale woman in grey, a brass plate beneath her reading DUSK.\nFour candles are painted along the bottom edge of the canvas.'); },
  },
  {
    id: 'portrait_midnight', x: -4.4, z: -1.2, r: 1.6, label: 'Portrait — "Midnight"',
    act: (g) => { g.flags.saw_midnight = 1; g.say('The middle sister, hooded, the plate reading MIDNIGHT.\nSeven candles burn along the bottom edge.'); },
  },
  {
    id: 'portrait_dawn', x: -4.4, z: 2.6, r: 1.6, label: 'Portrait — "Dawn"',
    act: (g) => { g.flags.saw_dawn = 1; g.say('The youngest, turned half away, the plate reading DAWN.\nOnly two candles are painted here.'); },
  },
  {
    id: 'fireplace', x: 4.0, z: -3.5, r: 1.8, label: 'Fireplace',
    act: (g) => {
      if (g.flags.fireplace) return g.say('Only cold ash and the twisted frame of an umbrella.');
      if (g.give('ammo9', 6)) { g.flags.fireplace = 1; g.say('Someone hid a small box of rounds in the flue. The ash is cold.'); }
    },
  },
];
ROOMS.dining.enemies = [
  { type: 'shambler', x: 3.4, z: 3.2, facing: Math.PI },
  { type: 'shambler', x: -3.4, z: -4.6, facing: 0, sleep: true },
];

ROOMS.kitchen.pickups = [
  { id: 'kt_key', x: -3.0, z: -3.55, y: 0.96, item: 'key_rust' },
  { id: 'kt_ammo', x: 1.2, z: 0.8, y: 0.86, item: 'ammo9', count: 8 },
  { id: 'kt_herb', x: -4.0, z: 2.6, item: 'herb' },
];
ROOMS.kitchen.interactables = [
  {
    id: 'stove', x: 2.7, z: -3.0, r: 1.5, label: 'Stove',
    act: (g) => g.say('A pot has boiled dry and burned black. The gas was left running for a long time.\nWhoever was cooking did not come back.'),
  },
  {
    id: 'sink', x: -3.0, z: -3.1, r: 1.4, label: 'Sink',
    act: (g) => g.say('The basin is full of brown water. Something moves in it when you lean closer.\nYou decide not to lean closer.'),
  },
];
ROOMS.kitchen.enemies = [
  { type: 'crawler', x: 0.2, z: 2.6, facing: -1.6 },
];

ROOMS.generator.pickups = [
  { id: 'gn_note', x: 3.0, z: 2.6, y: 0.84, item: 'note_breaker' },
  { id: 'gn_ammo', x: -3.4, z: -1.8, item: 'ammo9', count: 8 },
];
ROOMS.generator.interactables = [
  {
    id: 'socket', x: -0.6, z: -0.9, r: 1.5, label: 'Fuse Socket',
    act: (g) => {
      if (g.flags.fuse_in) return g.say('The cell sits seated in its cradle, humming faintly. The array still needs to be set.');
      if (!g.has('fuse')) return g.say('An empty ceramic cradle, scorched at the contacts.\nA cell of some kind is missing.');
      g.take('fuse', 1); g.flags.fuse_in = 1;
      g.say('The cell drops into the cradle and locks with a heavy clack.\nSomewhere behind the wall, a relay begins to tick.');
    },
  },
  {
    id: 'breakers', x: -2.2, z: 2.9, r: 1.5, label: 'Breaker Array',
    act: (g) => {
      if (g.flags.power) return g.say('All six lamps read green. The array is carrying load.');
      if (!g.flags.fuse_in) return g.say('The array is dead. Without a power cell there is nothing to switch.');
      g.openBreakers();
    },
  },
];
ROOMS.generator.enemies = [
  { type: 'crawler', x: -2.6, z: -2.2, facing: 0.8 },
];

ROOMS.hall_e.pickups = [
  { id: 'he_ammo', x: 1.6, z: -6.4, item: 'ammo9', count: 10 },
];
ROOMS.hall_e.interactables = [
  {
    id: 'sec_panel', x: 1.3, z: -9.2, r: 1.1, label: 'Door Panel',
    act: (g) => g.say(g.flags.power
      ? 'The panel reads GREEN. The stair door is released.'
      : 'The panel is dead. A strip of tape below it reads: WESTERN WING FEEDS THIS DOOR.'),
  },
];
ROOMS.hall_e.enemies = [
  { type: 'shambler', x: 0.4, z: 1.0, facing: Math.PI },
  { type: 'shambler', x: -0.6, z: -5.6, facing: 0 },
];

ROOMS.library.pickups = [
  { id: 'lb_note', x: -1.2, z: 1.4, y: 0.85, item: 'note_order' },
  { id: 'lb_ammo', x: -3.6, z: -1.2, item: 'ammo9', count: 10 },
];
ROOMS.library.interactables = [
  {
    id: 'shelves', x: -4.2, z: 0, r: 2.2, label: 'Bookshelves',
    act: (g) => g.say('Estate ledgers, botany, a shelf of identical black-bound diaries.\nEvery diary after the ninth of the month has been torn out.'),
  },
  {
    id: 'lb_globe', x: 2.2, z: 3.4, r: 1.6, label: 'Reading Nook',
    act: (g) => g.say('A blanket, a cold cup, and a chair dragged to face the door rather than the window.\nSomeone slept here, waiting.'),
  },
];
ROOMS.library.enemies = [
  { type: 'shambler', x: 0.8, z: -2.0, facing: 1.6 },
];

ROOMS.study.pickups = [
  { id: 'st_ammo', x: 0.4, z: -1.3, y: 0.86, item: 'ammo9', count: 10 },
  { id: 'st_herb', x: 3.4, z: 2.6, y: 0.72, item: 'herb' },
];
ROOMS.study.interactables = [
  {
    id: 'safe', x: -1.6, z: 2.9, r: 1.5, label: 'Wall Safe',
    act: (g) => {
      if (g.flags.safe_open) return g.say('The safe is empty.');
      g.openKeypad({
        title: 'WALL SAFE', digits: 3, code: '472',
        hint: 'Three dials. A brass plate above them reads: AS THE NIGHT FALLS.',
        onSuccess: () => {
          g.flags.safe_open = 1;
          g.give('fuse', 1);
          g.say('The bolt withdraws. Inside, wrapped in oilcloth, is a ceramic power cell.');
        },
      });
    },
  },
  {
    id: 'st_desk', x: 0.4, z: -0.9, r: 1.5, label: 'Writing Desk',
    act: (g) => g.say('Correspondence, all of it unsent. The last letter breaks off mid-sentence:\n"...and if the generator will not hold, then we should never have opened the lower"'),
  },
];
ROOMS.study.enemies = [];

ROOMS.basement.pickups = [
  { id: 'bs_ammo', x: -2.0, z: 7.8, item: 'ammo9', count: 12 },
  { id: 'bs_note', x: -2.2, z: -2.6, item: 'note_cellar' },
  { id: 'bs_spray', x: 2.0, z: -6.0, y: 0.84, item: 'spray' },
];
ROOMS.basement.interactables = [
  {
    id: 'gate_lever', x: 2.4, z: -11.0, r: 1.8, label: 'Gate Lever',
    act: (g) => {
      if (!g.flags.power) return g.say('The lever will not budge. Without power the gate motor is locked solid.');
      g.endGame();
    },
  },
];
ROOMS.basement.enemies = [
  { type: 'crawler', x: 0.6, z: 5.6, facing: Math.PI },
  { type: 'shambler', x: -1.0, z: -0.6, facing: Math.PI },
  { type: 'crawler', x: 1.2, z: -8.2, facing: Math.PI },
];

export const START_ROOM = 'foyer';
