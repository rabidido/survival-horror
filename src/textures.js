// Procedural texture generation. Everything the game looks like is made here,
// on a 2D canvas, at load time -- no external image assets.
import * as THREE from '../vendor/three.module.min.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size, h) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h || size;
  return c;
}

// --- value noise -----------------------------------------------------------
function lattice(w, h, rnd) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return g;
}
function sampleLattice(g, w, h, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const i = (a, b) => g[((b % h) + h) % h * w + (((a % w) + w) % w)];
  const a = i(xi, yi), b = i(xi + 1, yi), c = i(xi, yi + 1), d = i(xi + 1, yi + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
// Tiling fractal noise into a Float32Array of size*size in [0,1]
export function fbm(size, octaves, baseFreq, seed) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = baseFreq * Math.pow(2, o);
    const g = lattice(f, f, rnd);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        out[y * size + x] += amp * sampleLattice(g, f, f, (x / size) * f, (y / size) * f);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Multiply a noise field over an existing canvas -- the universal "grime" pass.
function grime(ctx, size, seed, strength, freq) {
  const n = fbm(size, 4, freq || 4, seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const k = 1 - strength * (1 - n[p]);
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
}

function speckle(ctx, size, seed, count, color, rMin, rMax) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = rMin + rnd() * (rMax - rMin);
    ctx.globalAlpha = 0.1 + rnd() * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const cache = new Map();
function tex(key, make, rx, ry) {
  const k = key + '|' + rx + '|' + ry;
  if (cache.has(k)) return cache.get(k);
  const t = new THREE.CanvasTexture(make());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

// --- surfaces --------------------------------------------------------------

export function wallpaper(base, accent, seed, rx, ry) {
  return tex('wp' + base + accent + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    // damask-ish repeating motif
    x.strokeStyle = accent; x.fillStyle = accent;
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const cx = gx * 32 + 16 + (gy % 2 ? 16 : 0), cy = gy * 32 + 16;
        x.globalAlpha = 0.20;
        x.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.28) {
          const r = 7 + 3.2 * Math.sin(a * 4) + 1.4 * Math.cos(a * 7);
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 1.25;
          a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.closePath(); x.lineWidth = 1.2; x.stroke();
        x.globalAlpha = 0.07; x.fill();
      }
    }
    x.globalAlpha = 1;
    // vertical seams
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, S); x.stroke(); }
    grime(x, S, seed, 0.62, 3);
    speckle(x, S, seed + 7, 120, '#140e09', 1, 11);
    return c;
  }, rx, ry);
}

export function wood(dark, light, seed, rx, ry) {
  return tex('wd' + dark + light + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    const rnd = mulberry32(seed);
    x.fillStyle = dark; x.fillRect(0, 0, S, S);
    const planks = 6, ph = S / planks;
    for (let i = 0; i < planks; i++) {
      const t = rnd();
      x.fillStyle = light;
      x.globalAlpha = 0.25 + t * 0.45;
      x.fillRect(0, i * ph, S, ph - 1);
      x.globalAlpha = 1;
      // grain
      x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1;
      for (let g = 0; g < 9; g++) {
        const y = i * ph + 2 + rnd() * (ph - 4);
        x.beginPath(); x.moveTo(0, y);
        for (let px = 0; px <= S; px += 16) x.lineTo(px, y + Math.sin(px * 0.05 + t * 9) * 1.6);
        x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.45)';
      x.fillRect(0, i * ph + ph - 2, S, 2);
    }
    grime(x, S, seed + 3, 0.45, 4);
    return c;
  }, rx, ry);
}

export function marble(a, b, seed, rx, ry) {
  return tex('mb' + a + b + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    const n = fbm(S, 5, 4, seed);
    const img = x.createImageData(S, S);
    const ca = new THREE.Color(a), cb = new THREE.Color(b);
    for (let i = 0, p = 0; p < S * S; p++, i += 4) {
      const v = Math.pow(Math.abs(Math.sin(n[p] * 9 + (p % S) * 0.02)), 0.5);
      const col = ca.clone().lerp(cb, v * 0.9);
      img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // checker tiles
    x.globalAlpha = 0.25;
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      if ((tx + ty) % 2) { x.fillStyle = '#000'; x.fillRect(tx * 128, ty * 128, 128, 128); }
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3;
    x.strokeRect(0, 0, 128, 128); x.strokeRect(128, 0, 128, 128);
    x.strokeRect(0, 128, 128, 128); x.strokeRect(128, 128, 128, 128);
    grime(x, S, seed + 11, 0.4, 3);
    speckle(x, S, seed + 5, 60, '#0b0908', 1, 7);
    return c;
  }, rx, ry);
}

export function concrete(base, seed, rx, ry) {
  return tex('cc' + base + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    grime(x, S, seed, 0.7, 6);
    grime(x, S, seed + 31, 0.35, 2);
    speckle(x, S, seed + 2, 220, '#000000', 0.5, 3);
    // cracks
    const rnd = mulberry32(seed + 99);
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let k = 0; k < 5; k++) {
      let px = rnd() * S, py = rnd() * S, ang = rnd() * 6.28;
      x.lineWidth = 1 + rnd(); x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 22; s++) { ang += (rnd() - 0.5) * 1.1; px += Math.cos(ang) * 7; py += Math.sin(ang) * 7; x.lineTo(px, py); }
      x.stroke();
    }
    return c;
  }, rx, ry);
}

export function tileWall(base, grout, seed, rx, ry) {
  return tex('tw' + base + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = grout; x.fillRect(0, 0, S, S);
    const rnd = mulberry32(seed);
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
      const v = 0.82 + rnd() * 0.25;
      const col = new THREE.Color(base).multiplyScalar(v);
      x.fillStyle = '#' + col.getHexString();
      x.fillRect(tx * 32 + 1.5, ty * 32 + 1.5, 29, 29);
    }
    grime(x, S, seed + 4, 0.6, 4);
    speckle(x, S, seed + 8, 70, '#20140f', 1, 8);
    return c;
  }, rx, ry);
}

export function rug(seed, rx, ry) {
  return tex('rg' + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = '#2c0c0e'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#5a4620'; x.lineWidth = 6;
    x.strokeRect(12, 12, S - 24, S - 24);
    x.strokeRect(28, 28, S - 56, S - 56);
    x.lineWidth = 2; x.strokeStyle = '#1c080a';
    for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(S / 2, S / 2, 12 + i * 9, 0, 6.28); x.stroke(); }
    grime(x, S, seed, 0.75, 5);
    return c;
  }, rx, ry);
}

export function metal(base, seed, rx, ry) {
  return tex('mt' + base + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const rnd = mulberry32(seed);
    x.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 260; i++) {
      const y = rnd() * S; x.beginPath(); x.moveTo(0, y); x.lineTo(S, y + (rnd() - 0.5) * 4); x.stroke();
    }
    // rivets
    x.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.beginPath(); x.arc(32 + i * 64, 32 + j * 64, 4, 0, 6.28); x.fill();
    }
    grime(x, S, seed + 17, 0.6, 5);
    speckle(x, S, seed + 21, 120, '#5a2a10', 1, 10); // rust
    return c;
  }, rx, ry);
}

export function doorTex(seed, rx, ry) {
  return tex('dr' + seed, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = '#3a2418'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#4a2f1e';
    x.fillRect(18, 18, S - 36, 100); x.fillRect(18, 138, S - 36, 100);
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3;
    x.strokeRect(18, 18, S - 36, 100); x.strokeRect(18, 138, S - 36, 100);
    // handle
    x.fillStyle = '#b8a15c';
    x.beginPath(); x.arc(226, 128, 8, 0, 6.28); x.fill();
    grime(x, S, seed, 0.5, 4);
    return c;
  }, rx, ry);
}

export function painting(seed, hint) {
  return tex('pt' + seed + hint, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    const rnd = mulberry32(seed);
    // moody abstract portrait
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#1a1712'); g.addColorStop(1, '#0a0806');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(120,96,60,0.5)';
    x.beginPath(); x.ellipse(128, 150, 60, 84, 0, 0, 6.28); x.fill(); // body
    x.fillStyle = 'rgba(196,170,132,0.6)';
    x.beginPath(); x.ellipse(128, 92, 30, 38, 0, 0, 6.28); x.fill(); // head
    x.fillStyle = 'rgba(0,0,0,0.7)';
    x.beginPath(); x.ellipse(117, 88, 4, 6, 0, 0, 6.28); x.fill();
    x.beginPath(); x.ellipse(139, 88, 4, 6, 0, 0, 6.28); x.fill();
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `rgba(${40 + rnd() * 80},${30 + rnd() * 50},${20 + rnd() * 30},0.08)`;
      x.fillRect(rnd() * S, rnd() * S, 6, 3);
    }
    // candle hint marks along the bottom
    if (hint) {
      for (let i = 0; i < hint; i++) {
        const px = 40 + i * 24;
        x.fillStyle = '#d8c8a0'; x.fillRect(px, 206, 6, 22);
        x.fillStyle = '#ffb347'; x.beginPath(); x.ellipse(px + 3, 202, 4, 7, 0, 0, 6.28); x.fill();
      }
    }
    grime(x, S, seed + 6, 0.45, 3);
    return c;
  }, 1, 1);
}

export function paperTex(lines, seed) {
  return tex('pp' + seed + lines, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    x.fillStyle = '#9c9075'; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(90,70,40,0.8)';
    for (let i = 0; i < lines; i++) x.fillRect(30, 40 + i * 18, 120 + ((i * 37) % 80), 3);
    grime(x, S, seed, 0.62, 4);
    speckle(x, S, seed + 1, 70, '#4b3a1c', 1, 8);
    return c;
  }, 1, 1);
}

export function bloodDecal(seed) {
  return tex('bl' + seed, () => {
    const S = 128, c = canvas(S), x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    const rnd = mulberry32(seed);
    x.fillStyle = 'rgba(60,8,8,0.85)';
    x.beginPath();
    for (let a = 0; a < 6.283; a += 0.25) {
      const r = 28 + rnd() * 22;
      const px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath(); x.fill();
    for (let i = 0; i < 18; i++) {
      x.globalAlpha = 0.3 + rnd() * 0.5;
      x.beginPath(); x.arc(rnd() * S, rnd() * S, 2 + rnd() * 7, 0, 6.28); x.fill();
    }
    return c;
  }, 1, 1);
}
