// Room construction helpers. Rooms are axis-aligned boxes so collision can stay
// a cheap list of XZ rectangles.
import * as THREE from '../vendor/three.module.min.js';
import * as T from './textures.js';

// Global light multiplier -- authored intensities are relative; this sets the
// overall exposure of the world.
export const LIGHT_SCALE = 7.0;

export function mat(map, opts) {
  return new THREE.MeshPhongMaterial(Object.assign({
    map, shininess: 0, specular: 0x000000, color: 0xffffff,
  }, opts || {}));
}

let blobTex = null;
export function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

export function blobShadow(radius) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: blobShadowTexture(), transparent: true, depthWrite: false,
      blending: THREE.NormalBlending, opacity: 0.9,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

export class Builder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];   // {x0,z0,x1,z1}
    this.lights = [];
  }
  add(obj) { this.group.add(obj); return obj; }

  // `tall` colliders block line of sight and gunfire; low furniture only
  // blocks movement, so you can shoot across a table.
  collider(x, z, w, d, tall = true) {
    this.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, tall });
  }

  floor(w, d, texture, y = 0, cx = 0, cz = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 4, 4), mat(texture));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, y, cz);
    m.receiveShadow = false;
    return this.add(m);
  }

  ceiling(w, d, texture, y, cx = 0, cz = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(texture, { color: 0x585c60 }));
    m.rotation.x = Math.PI / 2;
    m.position.set(cx, y, cz);
    return this.add(m);
  }

  // Axis-aligned wall slab, centred on (x,z)
  wall(x, z, w, h, d, texture, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 2)), 2, Math.max(1, Math.round(d / 2)));
    const m = new THREE.Mesh(geo, mat(texture, opts.matOpts));
    m.position.set(x, h / 2 + (opts.y || 0), z);
    this.add(m);
    if (opts.collide !== false) this.collider(x, z, w, d);
    return m;
  }

  box(x, y, z, w, h, d, material, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y + h / 2, z);
    if (opts.rotY) m.rotation.y = opts.rotY;
    this.add(m);
    if (opts.collide) this.collider(x, z, Math.max(w, 0.3), Math.max(d, 0.3), !!opts.tall);
    return m;
  }

  cyl(x, y, z, rt, rb, h, material, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y + h / 2, z);
    return this.add(m);
  }

  plane(x, y, z, w, h, material, rotY = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    return this.add(m);
  }

  decal(x, z, size, seed) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshPhongMaterial({
        map: T.bloodDecal(seed), transparent: true, depthWrite: false,
        opacity: 0.8, shininess: 0, specular: 0x000000, color: 0x6a5a58,
      }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = seed;
    m.position.set(x, 0.012, z);
    m.renderOrder = 1;
    return this.add(m);
  }

  lamp(x, y, z, color, intensity, distance) {
    const l = new THREE.PointLight(color, intensity * LIGHT_SCALE, distance, 2);
    l.position.set(x, y, z);
    this.lights.push(l);
    return this.add(l);
  }

  // A glowing bulb/lamp shade you can actually see
  fixture(x, y, z, color, cordTo) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color }));
    g.position.set(x, y, z);
    this.add(g);
    if (cordTo && cordTo > y) {
      const len = cordTo - y;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4),
        new THREE.MeshPhongMaterial({ color: 0x14120f, shininess: 0 }));
      cord.position.set(x, y + len / 2, z);
      this.add(cord);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 8, 1, true),
        new THREE.MeshPhongMaterial({ color: 0x2a2724, shininess: 0, side: THREE.DoubleSide }));
      cap.position.set(x, y + 0.1, z);
      this.add(cap);
    }
    return g;
  }

  // --- common furniture ----------------------------------------------------
  table(x, z, w, d, rotY = 0, woodMat) {
    const wm = woodMat || mat(T.wood('#2b1c11', '#6a4526', 11, 2, 1));
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), wm);
    top.position.y = 0.78; g.add(top);
    const legG = new THREE.BoxGeometry(0.1, 0.78, 0.1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(legG, wm);
      l.position.set(sx * (w / 2 - 0.1), 0.39, sz * (d / 2 - 0.1));
      g.add(l);
    }
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.add(g);
    const cw = Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * d;
    const cd = Math.abs(Math.cos(rotY)) * d + Math.abs(Math.sin(rotY)) * w;
    this.collider(x, z, cw, cd, false);
    return g;
  }

  shelf(x, z, w, h, rotY = 0) {
    const wm = mat(T.wood('#20150d', '#513218', 21, 1, 2));
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wm);
    back.position.y = h / 2; g.add(back);
    const shelves = Math.max(2, Math.round(h / 0.5));
    for (let i = 1; i < shelves; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.34), wm);
      s.position.set(0, (h / shelves) * i, 0.17); g.add(s);
      // books
      let px = -w / 2 + 0.06;
      let k = i * 7 + 3;
      while (px < w / 2 - 0.1) {
        k = (k * 1103515245 + 12345) % 2147483648;
        const bw = 0.045 + ((k >> 8) % 40) / 1000;
        const bh = 0.22 + ((k >> 13) % 90) / 1000;
        // setHSL defaults to the linear working space; pass sRGB explicitly
        // so these read as the dark spines they are meant to be.
        const hue = ((k >> 17) % 50) / 360;
        const lit = 0.10 + Math.abs((k >> 5) % 14) / 140;
        const col = new THREE.Color().setHSL(hue, 0.28, lit, THREE.SRGBColorSpace);
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.24),
          new THREE.MeshPhongMaterial({ color: col, shininess: 0 }));
        b.position.set(px + bw / 2, (h / shelves) * i + bh / 2 + 0.03, 0.16);
        g.add(b);
        px += bw + 0.005;
      }
    }
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.38), wm);
      side.position.set(sx * (w / 2 - 0.03), h / 2, 0.19); g.add(side);
    }
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.add(g);
    const cw = Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * 0.42;
    const cd = Math.abs(Math.cos(rotY)) * 0.42 + Math.abs(Math.sin(rotY)) * w;
    this.collider(x + Math.sin(rotY) * 0.19, z + Math.cos(rotY) * 0.19, cw, cd);
    return g;
  }

  crate(x, z, s = 0.7, rotY = 0) {
    const m = mat(T.wood('#332012', '#6b4a29', 33, 1, 1));
    const b = this.box(x, 0, z, s, s, s, m, { rotY, collide: true, tall: false });
    return b;
  }

  barrel(x, z, h = 0.9) {
    const m = mat(T.metal('#3a3e33', 44, 2, 1));
    const b = this.cyl(x, 0, z, 0.32, 0.32, h, m, 12);
    this.collider(x, z, 0.64, 0.64, false);
    return b;
  }

  door(x, z, rotY, w = 1.1, h = 2.1) {
    const g = new THREE.Group();
    const frame = mat(T.wood('#1d130b', '#3d2a18', 55, 1, 1));
    const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), mat(T.doorTex(66, 1, 1)));
    d.position.y = h / 2; g.add(d);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.14, 0.16), frame);
      p.position.set(sx * (w / 2 + 0.06), (h + 0.14) / 2, 0); g.add(p);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.36, 0.14, 0.16), frame);
    top.position.y = h + 0.07; g.add(top);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.add(g);
    return g;
  }

  // portal/darkness behind a doorway gap
  voidPanel(x, z, w, h, rotY) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    m.position.set(x, h / 2, z); m.rotation.y = rotY;
    return this.add(m);
  }
}

// Rectangular room shell with wall openings.
// openings: [{side:'n'|'s'|'e'|'w', at: offset along wall, width}]
export function shell(b, w, d, h, floorTex, wallTex, ceilTex, openings = []) {
  b.floor(w, d, floorTex);
  if (ceilTex) b.ceiling(w, d, ceilTex, h);
  const t = 0.3;
  const sides = {
    n: { fixed: -d / 2 - t / 2, axis: 'x', len: w },
    s: { fixed: d / 2 + t / 2, axis: 'x', len: w },
    w: { fixed: -w / 2 - t / 2, axis: 'z', len: d },
    e: { fixed: w / 2 + t / 2, axis: 'z', len: d },
  };
  for (const key of Object.keys(sides)) {
    const s = sides[key];
    const gaps = openings.filter(o => o.side === key)
      .map(o => [o.at - o.width / 2, o.at + o.width / 2])
      .sort((a, c) => a[0] - c[0]);
    let cursor = -s.len / 2;
    const segs = [];
    for (const g of gaps) { if (g[0] > cursor) segs.push([cursor, g[0]]); cursor = Math.max(cursor, g[1]); }
    if (cursor < s.len / 2) segs.push([cursor, s.len / 2]);
    for (const seg of segs) {
      const len = seg[1] - seg[0];
      if (len <= 0.001) continue;
      const mid = (seg[0] + seg[1]) / 2;
      if (s.axis === 'x') b.wall(mid, s.fixed, len + t, h, t, wallTex);
      else b.wall(s.fixed, mid, t, h, len + t, wallTex);
    }
    // lintel above each opening
    for (const g of gaps) {
      const len = g[1] - g[0];
      const mid = (g[0] + g[1]) / 2;
      const lh = h - 2.25;
      if (lh <= 0.02) continue;
      if (s.axis === 'x') b.wall(mid, s.fixed, len + t, lh, t, wallTex, { y: 2.25, collide: false });
      else b.wall(s.fixed, mid, t, lh, len + t, wallTex, { y: 2.25, collide: false });
    }
  }
}
