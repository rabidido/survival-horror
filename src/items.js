// Item definitions, inventory icons (drawn, not loaded) and world pickup meshes.
import * as THREE from '../vendor/three.module.min.js';
import * as T from './textures.js';
import { mat } from './world.js';

export const ITEMS = {
  knife: {
    name: 'Combat Knife', kind: 'weapon', dmg: 24, rate: 0.55, range: 1.5, arc: 0.6,
    desc: 'A worn survival knife. No ammunition required, but you must be close enough to smell them.',
  },
  handgun: {
    name: 'M92F Handgun', kind: 'weapon', dmg: 34, rate: 0.42, range: 14, arc: 0.32, ammo: 'ammo9',
    desc: 'A 9mm sidearm. Reliable, and the only thing between you and the halls.',
  },
  ammo9: {
    name: 'Handgun Rounds', kind: 'ammo', stack: 90,
    desc: '9mm parabellum. Count them. Then count them again.',
  },
  herb: {
    name: 'Green Herb', kind: 'heal', heal: 45, stack: 6,
    desc: 'A bitter medicinal plant. Chewing it dulls pain and closes small wounds.',
  },
  spray: {
    name: 'First Aid Spray', kind: 'heal', heal: 100, stack: 3,
    desc: 'Military grade antiseptic. Restores you completely.',
  },
  key_rust: {
    name: 'Rusted Key', kind: 'key', desc: 'A heavy iron key, red with rust. The bow is stamped with a small owl.',
  },
  fuse: {
    name: 'Fuse Cell', kind: 'key', desc: 'A ceramic power cell, still warm. Something in this house is missing it.',
  },
  note_welcome: {
    name: 'Torn Letter', kind: 'note',
    title: 'Torn Letter',
    body: 'Whoever finds this — the front doors are chained and I have thrown the key into the lake.\n\nDo not open them. What is in the cellar is worse than what is in the halls, but the halls are how it gets out.\n\nThere is a service gate below. It needs power. The generator lost its cell weeks ago; I hid it where the sisters could watch over it.\n\n— H. Vance, groundskeeper',
  },
  note_order: {
    name: 'Librarian’s Note', kind: 'note',
    title: 'Librarian’s Note',
    body: 'Mr. Vance has been in here again, moving my portraits.\n\nHe insists they hang in the order the night falls — dusk, then midnight, then dawn — and that the sisters each be given their candles.\n\nI counted the candles. Three numbers. He laughed and said the study safe would make sense of them.\n\nI find it all very tiresome.',
  },
  note_breaker: {
    name: 'Maintenance Card', kind: 'note',
    title: 'Maintenance Card',
    body: 'BREAKER ARRAY — WESTERN WING\n\nThe relays are cross-wired. Throwing one switch will also throw the switches on either side of it.\n\nAll six lamps must read green before the cell will carry load.\n\nDo not attempt to bypass. The last man who did is still down there.',
  },
  note_cellar: {
    name: 'Blood-Soaked Page', kind: 'note',
    title: 'Blood-Soaked Page',
    body: 'day 9 — the thin ones move on all fours now. they hear the lamps hum.\n\nday 11 — shot one four times. it got up twice. aim for where the head used to be.\n\nday 14 — the gate lever works. i can hear it from here. i just cannot make myself walk that far.',
  },
};

export function itemLabel(id, count) {
  const it = ITEMS[id];
  if (!it) return id;
  return count > 1 ? `${it.name} x${count}` : it.name;
}

// --- icons -----------------------------------------------------------------
const iconCache = new Map();
export function iconFor(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.lineCap = 'round'; x.lineJoin = 'round';
  const draw = {
    knife() {
      x.fillStyle = '#c9ccd2'; x.beginPath();
      x.moveTo(16, 46); x.lineTo(40, 14); x.lineTo(46, 20); x.lineTo(22, 50); x.closePath(); x.fill();
      x.fillStyle = '#2b2b2e'; x.fillRect(10, 44, 12, 8);
      x.strokeStyle = '#7d8087'; x.lineWidth = 1.5; x.stroke();
    },
    handgun() {
      x.fillStyle = '#33363b';
      x.fillRect(12, 26, 38, 9);
      x.fillRect(16, 35, 12, 18);
      x.fillStyle = '#4a4e55'; x.fillRect(14, 22, 28, 5);
      x.fillStyle = '#1d1f22'; x.fillRect(28, 35, 6, 6);
    },
    ammo9() {
      for (let i = 0; i < 3; i++) {
        const px = 16 + i * 12;
        x.fillStyle = '#b98a3a'; x.fillRect(px, 26, 8, 22);
        x.fillStyle = '#d8b268'; x.beginPath(); x.moveTo(px, 26); x.lineTo(px + 4, 16); x.lineTo(px + 8, 26); x.fill();
      }
    },
    herb() {
      x.fillStyle = '#3e7a3a';
      for (let i = 0; i < 5; i++) {
        x.save(); x.translate(32, 40); x.rotate((i - 2) * 0.5);
        x.beginPath(); x.ellipse(0, -14, 6, 15, 0, 0, 6.28); x.fill(); x.restore();
      }
      x.strokeStyle = '#2a5226'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(32, 52); x.lineTo(32, 36); x.stroke();
    },
    spray() {
      x.fillStyle = '#b4262b'; x.fillRect(22, 20, 20, 32);
      x.fillStyle = '#e8e8e8'; x.fillRect(26, 12, 12, 8);
      x.fillStyle = '#f0f0f0'; x.fillRect(25, 28, 14, 10);
      x.fillStyle = '#b4262b'; x.fillRect(30, 30, 4, 6); x.fillRect(27, 32, 10, 2);
    },
    key_rust() {
      x.strokeStyle = '#8a5a32'; x.lineWidth = 5;
      x.beginPath(); x.arc(22, 24, 9, 0, 6.28); x.stroke();
      x.beginPath(); x.moveTo(26, 30); x.lineTo(46, 50); x.stroke();
      x.lineWidth = 4;
      x.beginPath(); x.moveTo(40, 44); x.lineTo(34, 50); x.stroke();
      x.beginPath(); x.moveTo(45, 49); x.lineTo(39, 55); x.stroke();
    },
    fuse() {
      x.fillStyle = '#5c5148'; x.fillRect(20, 18, 24, 30);
      x.fillStyle = '#c8a23a'; x.fillRect(20, 14, 24, 6); x.fillRect(20, 46, 24, 6);
      x.fillStyle = '#63d2ff'; x.fillRect(26, 24, 12, 18);
      x.fillStyle = 'rgba(160,240,255,0.8)'; x.fillRect(29, 27, 6, 12);
    },
    note() {
      x.fillStyle = '#cdbf9c'; x.fillRect(16, 12, 32, 42);
      x.fillStyle = '#6a5a38';
      for (let i = 0; i < 6; i++) x.fillRect(21, 20 + i * 6, 20 - (i % 3) * 4, 2);
    },
  };
  const it = ITEMS[id];
  (draw[id] || (it && it.kind === 'note' ? draw.note : draw.note))();
  iconCache.set(id, c.toDataURL());
  return iconCache.get(id);
}

// --- world pickup meshes ---------------------------------------------------
export function pickupMesh(itemId) {
  const g = new THREE.Group();
  const steel = mat(T.metal('#6a6f72', 101, 1, 1));
  const brass = new THREE.MeshPhongMaterial({ color: 0xb98a3a, shininess: 40, specular: 0x554422 });
  switch (itemId) {
    case 'handgun': {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.09), steel));
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.07), mat(T.metal('#33363b', 102, 1, 1)));
      grip.position.set(-0.08, -0.08, 0); g.add(grip);
      break;
    }
    case 'ammo9': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.13),
        new THREE.MeshPhongMaterial({ color: 0x5a4a2a, shininess: 0 }));
      g.add(box);
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), brass);
        r.position.set(-0.05 + i * 0.05, 0.07, 0); g.add(r);
      }
      break;
    }
    case 'herb': {
      const lm = new THREE.MeshPhongMaterial({ color: 0x3e7a3a, shininess: 10 });
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), lm);
        leaf.scale.set(0.55, 0.3, 1.4);
        leaf.position.set(Math.cos(i * 1.3) * 0.07, 0.02 + i * 0.012, Math.sin(i * 1.3) * 0.07);
        leaf.rotation.y = i * 1.3; g.add(leaf);
      }
      break;
    }
    case 'spray': {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 10),
        new THREE.MeshPhongMaterial({ color: 0xb4262b, shininess: 30 }));
      can.position.y = 0.11; g.add(can);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 8),
        new THREE.MeshPhongMaterial({ color: 0xdddddd }));
      cap.position.y = 0.24; g.add(cap);
      break;
    }
    case 'key_rust': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12),
        new THREE.MeshPhongMaterial({ color: 0x8a5a32, shininess: 20 }));
      ring.rotation.x = Math.PI / 2; g.add(ring);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02),
        new THREE.MeshPhongMaterial({ color: 0x8a5a32 }));
      shaft.position.x = 0.11; g.add(shaft);
      break;
    }
    case 'fuse': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13),
        new THREE.MeshPhongMaterial({ color: 0x5c5148, shininess: 5 }));
      body.position.y = 0.1; g.add(body);
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x63d2ff }));
      core.position.y = 0.1; g.add(core);
      break;
    }
    default: {
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3),
        new THREE.MeshPhongMaterial({ map: T.paperTex(6, 88), shininess: 0, side: THREE.DoubleSide }));
      paper.rotation.x = -Math.PI / 2 + 0.1;
      paper.position.y = 0.02; g.add(paper);
    }
  }
  return g;
}
