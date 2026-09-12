// Low-poly articulated figures with procedural animation.
import * as THREE from '../vendor/three.module.min.js';

function pm(color, opts) {
  return new THREE.MeshPhongMaterial(Object.assign({ color, shininess: 0, specular: 0x000000 }, opts || {}));
}

function limb(parent, x, y, z, w, len, d, material) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), material);
  m.position.y = -len / 2;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

export function buildHumanoid(cfg) {
  const c = Object.assign({
    skin: 0xb98b6b, top: 0x2b3a42, bottom: 0x232527, hair: 0x1a1512,
    scale: 1, hunch: 0,
  }, cfg);
  const g = new THREE.Group();
  const root = new THREE.Group();      // vertical bob
  g.add(root);

  const skinM = pm(c.skin), topM = pm(c.top), botM = pm(c.bottom), hairM = pm(c.hair);

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.22), botM);
  pelvis.position.y = -0.05; hips.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = 0.06;
  hips.add(chest);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), topM);
  torso.position.y = 0.26; chest.add(torso);
  // shoulders
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.28), topM);
  shoulder.position.y = 0.48; chest.add(shoulder);

  const neck = new THREE.Group();
  neck.position.y = 0.56; chest.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), skinM);
  head.position.y = 0.14; neck.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.12, 0.245), hairM);
  hair.position.y = 0.235; neck.add(hair);
  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.2, 0.1), hairM);
  backHair.position.set(0, 0.12, -0.1); neck.add(backHair);

  const armL = limb(chest, 0.29, 0.46, 0, 0.12, 0.3, 0.14, topM);
  const armR = limb(chest, -0.29, 0.46, 0, 0.12, 0.3, 0.14, topM);
  const foreL = limb(armL, 0, -0.3, 0, 0.11, 0.3, 0.13, skinM);
  const foreR = limb(armR, 0, -0.3, 0, 0.11, 0.3, 0.13, skinM);

  const legL = limb(hips, 0.12, -0.12, 0, 0.16, 0.44, 0.18, botM);
  const legR = limb(hips, -0.12, -0.12, 0, 0.16, 0.44, 0.18, botM);
  const shinL = limb(legL, 0, -0.44, 0, 0.15, 0.42, 0.17, botM);
  const shinR = limb(legR, 0, -0.44, 0, 0.15, 0.42, 0.17, botM);
  const footM = pm(0x14110f);
  for (const s of [shinL, shinR]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), footM);
    f.position.set(0, -0.44, 0.05); s.add(f);
  }

  g.scale.setScalar(c.scale);
  const parts = { root, hips, chest, neck, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR };
  parts.baseHunch = c.hunch;
  chest.rotation.x = c.hunch;
  return { group: g, parts };
}

export function buildCrawler() {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);
  const skin = pm(0x7d6552), dark = pm(0x3d2f26);
  const body = new THREE.Group();
  body.position.y = 0.42; root.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.8), skin);
  body.add(torso);
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.4), dark);
  hump.position.set(0, 0.2, -0.1); body.add(hump);

  const neck = new THREE.Group();
  neck.position.set(0, 0.04, 0.42); body.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), skin);
  head.position.z = 0.12; neck.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.2), pm(0x5a1f1c));
  jaw.position.set(0, -0.11, 0.2); neck.add(jaw);

  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [0.3, -0.28]) {
      const up = limb(body, sx * 0.2, -0.05, sz, 0.1, 0.26, 0.1, skin);
      const lo = limb(up, 0, -0.26, 0, 0.09, 0.26, 0.09, dark);
      up.rotation.z = -sx * 0.5;
      legs.push({ up, lo, sx, sz });
    }
  }
  const tail = limb(body, 0, 0, -0.42, 0.1, 0.4, 0.1, dark);
  tail.rotation.x = 1.4;
  return { group: g, parts: { root, body, neck, head, jaw, legs, tail } };
}

// --- poses -----------------------------------------------------------------

export function poseHumanWalk(p, t, amt) {
  const s = Math.sin(t), c = Math.cos(t * 2);
  p.legL.rotation.x = s * 0.85 * amt;
  p.legR.rotation.x = -s * 0.85 * amt;
  p.shinL.rotation.x = Math.max(0, -s + 0.3) * 0.8 * amt;
  p.shinR.rotation.x = Math.max(0, s + 0.3) * 0.8 * amt;
  p.armL.rotation.x = -s * 0.6 * amt;
  p.armR.rotation.x = s * 0.6 * amt;
  p.armL.rotation.z = 0.06; p.armR.rotation.z = -0.06;
  p.foreL.rotation.x = -0.35 - Math.max(0, s) * 0.4 * amt;
  p.foreR.rotation.x = -0.35 - Math.max(0, -s) * 0.4 * amt;
  p.root.position.y = Math.abs(c) * 0.035 * amt;
  p.chest.rotation.y = -s * 0.09 * amt;
  p.hips.rotation.y = s * 0.09 * amt;
  p.chest.rotation.x = (p.baseHunch || 0) + 0.05 * amt;
}

export function poseHumanIdle(p, t) {
  const b = Math.sin(t * 1.6);
  p.legL.rotation.x = p.legR.rotation.x = 0;
  p.shinL.rotation.x = p.shinR.rotation.x = 0;
  p.armL.rotation.x = p.armR.rotation.x = 0.04 + b * 0.03;
  p.armL.rotation.z = 0.1; p.armR.rotation.z = -0.1;
  p.foreL.rotation.x = -0.25; p.foreR.rotation.x = -0.25;
  p.root.position.y = b * 0.012;
  p.chest.rotation.y = p.hips.rotation.y = 0;
  p.chest.rotation.x = (p.baseHunch || 0) + b * 0.02;
}

export function poseHumanAim(p, t, weapon) {
  const b = Math.sin(t * 2.2) * 0.01;
  p.legL.rotation.x = 0.12; p.legR.rotation.x = -0.12;
  p.shinL.rotation.x = p.shinR.rotation.x = 0;
  if (weapon === 'knife') {
    p.armR.rotation.x = -1.5 + b; p.armR.rotation.z = -0.3;
    p.foreR.rotation.x = -0.9;
    p.armL.rotation.x = -0.4; p.armL.rotation.z = 0.35; p.foreL.rotation.x = -0.8;
  } else {
    p.armR.rotation.x = -1.55 + b; p.armR.rotation.z = -0.18;
    p.armL.rotation.x = -1.5 + b; p.armL.rotation.z = 0.3;
    p.foreR.rotation.x = 0.06; p.foreL.rotation.x = 0.22;
  }
  p.root.position.y = 0;
  p.chest.rotation.y = 0; p.hips.rotation.y = 0;
  p.chest.rotation.x = (p.baseHunch || 0) + 0.08;
}

export function poseHumanHurt(p, t) {
  p.chest.rotation.x = (p.baseHunch || 0) - 0.4;
  p.armL.rotation.x = -0.8; p.armR.rotation.x = -0.8;
  p.foreL.rotation.x = -1.1; p.foreR.rotation.x = -1.1;
  p.root.position.y = -0.05;
}

export function poseShamble(p, t, amt) {
  const s = Math.sin(t), c = Math.cos(t);
  p.legL.rotation.x = s * 0.5 * amt;
  p.legR.rotation.x = -s * 0.5 * amt;
  p.shinL.rotation.x = Math.max(0, -s) * 0.5 * amt;
  p.shinR.rotation.x = Math.max(0, s) * 0.5 * amt;
  p.armL.rotation.x = -1.0 - s * 0.12;
  p.armR.rotation.x = -1.0 + s * 0.12;
  p.armL.rotation.z = 0.22; p.armR.rotation.z = -0.22;
  p.foreL.rotation.x = -0.5; p.foreR.rotation.x = -0.5;
  p.chest.rotation.x = (p.baseHunch || 0);
  p.chest.rotation.z = c * 0.12 * amt;
  p.neck.rotation.z = -c * 0.12;
  p.root.position.y = Math.abs(Math.cos(t)) * 0.02 * amt;
}

export function poseShambleAttack(p, k) {
  // k 0..1 lunge progress
  const e = Math.sin(Math.min(1, k) * Math.PI);
  p.armL.rotation.x = -1.4 - e * 0.7;
  p.armR.rotation.x = -1.4 - e * 0.7;
  p.foreL.rotation.x = -0.2; p.foreR.rotation.x = -0.2;
  p.chest.rotation.x = (p.baseHunch || 0) - e * 0.35;
  p.chest.rotation.z = 0; p.neck.rotation.z = 0;
}

export function poseCrawl(p, t, amt) {
  for (let i = 0; i < p.legs.length; i++) {
    const L = p.legs[i];
    const ph = t * 1.0 + (i % 2) * Math.PI + (L.sz > 0 ? 0 : Math.PI / 2);
    L.up.rotation.x = Math.sin(ph) * 0.7 * amt;
    L.lo.rotation.x = (0.6 + Math.cos(ph) * 0.4) * amt;
  }
  p.body.position.y = 0.42 + Math.abs(Math.sin(t)) * 0.05 * amt;
  p.body.rotation.z = Math.sin(t * 0.5) * 0.08 * amt;
  p.neck.rotation.x = -0.1 + Math.sin(t) * 0.12 * amt;
  p.tail.rotation.z = Math.sin(t * 0.7) * 0.3;
}

export function poseCrawlLunge(p, k) {
  const e = Math.sin(Math.min(1, k) * Math.PI);
  for (const L of p.legs) { L.up.rotation.x = -0.8 * e; L.lo.rotation.x = 1.2 * e; }
  p.body.position.y = 0.42 + e * 0.45;
  p.neck.rotation.x = -0.5 * e;
  p.jaw.rotation.x = 0.5 * e;
}
