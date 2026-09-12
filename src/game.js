// Core game: scene management, player controller, combat, progression, saves.
import * as THREE from '../vendor/three.module.min.js';
import { ROOMS, START_ROOM, portal } from './rooms.js';
import { Builder, blobShadow, mat } from './world.js';
import * as T from './textures.js';
import { ITEMS, pickupMesh, itemLabel } from './items.js';
import { buildHumanoid, poseHumanWalk, poseHumanIdle, poseHumanAim, poseHumanHurt } from './actor.js';
import { Enemy, angDiff } from './enemies.js';
import { PostFX } from './postfx.js';
import { UI, fmtTime } from './ui.js';
import { Input } from './input.js';

const SAVE_KEY = 'ashgrove_save_v1';
const PLAYER_R = 0.31;
const WALK = 1.9, RUN = 3.45, BACKSTEP = 1.05;
const TURN_RATE = 2.7;        // radians/second on the spot
const AIM_TURN_RATE = 1.5;    // slower while the weapon is up
const QUICK_TURN_TIME = 0.32; // back + run spins you 180 degrees

class Inventory {
  constructor(size = 8) { this.size = size; this.slots = new Array(size).fill(null); }
  count(id) { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }
  has(id, n = 1) { return this.count(id) >= n; }
  add(id, n = 1) {
    const max = ITEMS[id] && ITEMS[id].stack ? ITEMS[id].stack : 1;
    let left = n;
    if (max > 1) {
      for (const s of this.slots) {
        if (!s || s.id !== id || s.count >= max) continue;
        const take = Math.min(max - s.count, left);
        s.count += take; left -= take;
        if (left <= 0) return true;
      }
    }
    while (left > 0) {
      const i = this.slots.indexOf(null);
      if (i < 0) return false;
      const take = Math.min(max, left);
      this.slots[i] = { id, count: take };
      left -= take;
    }
    return true;
  }
  canFit(id, n = 1) {
    const max = ITEMS[id] && ITEMS[id].stack ? ITEMS[id].stack : 1;
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += max;
      else if (s.id === id) room += Math.max(0, max - s.count);
    }
    return room >= n;
  }
  remove(id, n = 1) {
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.count, left);
      s.count -= take; left -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    return left === 0;
  }
  removeSlot(i) { this.slots[i] = null; }
  serialize() { return this.slots.map(s => (s ? [s.id, s.count] : null)); }
  load(d) { this.slots = d.map(s => (s ? { id: s[0], count: s[1] } : null)); while (this.slots.length < this.size) this.slots.push(null); }
}

if (typeof window !== 'undefined') window.__ROOMS = ROOMS;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'title';         // title | play | menu | dead | end
    // Whether to show the on-screen controls. A single media query is not
    // enough: `pointer: coarse` reports false in desktop-site mode and on
    // phones with a stylus or a paired mouse, and getting this wrong on a
    // phone leaves no way at all to control the game.
    this.touchMode = (navigator.maxTouchPoints || 0) > 0
      || 'ontouchstart' in window
      || matchMedia('(pointer: coarse)').matches
      || matchMedia('(any-pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tone mapping happens in the post pass (three skips it for render targets).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.08, 120);
    this.post = new PostFX(this.renderer);
    this.ui = new UI(this);
    this.input = new Input(document);
    // Last line of defence: an actual touch proves there is a touchscreen,
    // whatever the media queries claimed.
    this.input.onFirstTouch = () => this.enableTouchControls();
    // Fullscreen is only granted from inside a real gesture handler, so take a
    // second chance from the first on-screen control the player touches.
    this.input.onGesture = () => this.goFullscreen();

    this.clock = new THREE.Clock();
    this.fade = 1;
    this.fadeTarget = 1;
    this.damageFx = 0;

    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 260));

    this.buildPlayer();
    this.resetState();
  }

  // ------------------------------------------------------------------ setup
  enableTouchControls() {
    if (this.touchMode) return;
    this.touchMode = true;
    const hudVisible = !this.ui.el.hud.classList.contains('hidden');
    this.ui.el.touch.classList.toggle('hidden', !hudVisible);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.updateOrientationGate();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyFov();
    this.post.setSize(w, h);
  }

  // The camera angles are composed at REF_ASPECT. Rather than let a wider or
  // narrower window change what the shot contains, derive the vertical field
  // of view from a bounded horizontal one:
  //   narrower than REF -> widen vertically, so the composed width still fits
  //   up to MAX_ASPECT  -> show the extra width, the shot still reads
  //   beyond MAX_ASPECT -> stop widening, or a phone held sideways (2.2:1)
  //                        splays every room out into a fish-eye
  applyFov() {
    const base = this.baseFov || 52;
    const REF_ASPECT = 1.7, MAX_ASPECT = 1.95;
    const a = Math.max(0.2, this.camera.aspect);
    const halfV = THREE.MathUtils.degToRad(base) / 2;
    const halfH = Math.atan(Math.tan(halfV) * THREE.MathUtils.clamp(a, REF_ASPECT, MAX_ASPECT));
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfH) / a));
    this.camera.fov = THREE.MathUtils.clamp(fov, 22, 88);
    this.camera.updateProjectionMatrix();
  }

  // The game is built for landscape: every camera angle is composed wide, and
  // the touch controls need the width. In portrait we hold play rather than
  // present a broken frame.
  //
  // Deliberately re-derived every frame rather than on transitions, and it
  // fails open: if the rotate screen is missing from the page, nothing is
  // gated. A hold with no visible explanation is indistinguishable from the
  // game being broken, so it must not be reachable.
  updateOrientationGate() {
    if (this.rotateEl === undefined) this.rotateEl = document.getElementById('rotate');
    const portrait = !!this.rotateEl && innerWidth < innerHeight;
    if (this.rotateEl) this.rotateEl.classList.toggle('hidden', !portrait);
    this.gated = portrait;

    if (portrait) {
      if (this.mode === 'play') this.mode = 'gated';
    } else if (this.mode === 'gated') {
      this.mode = 'play';
      // drop anything that was held when the screen turned
      this.input.keys.clear();
      this.input.aimHeld = false;
      this.input.runHeld = false;
      this.input.pad.active = false;
      this.input.pad.up = this.input.pad.down = false;
      this.input.pad.left = this.input.pad.right = false;
      this.clock.getDelta();
    }
  }

  buildPlayer() {
    const m = buildHumanoid({ skin: 0xc09a78, top: 0x2c3a46, bottom: 0x23262b, hair: 0x2a1d14 });
    this.player = {
      group: m.group, parts: m.parts, x: 0, z: 0, angle: Math.PI,
      speed: 0, anim: 0, invuln: 0, hurt: 0, swing: -1,
    };
    this.playerLight = new THREE.PointLight(0xbfd0e0, 10, 6.0, 2);
    this.playerLight.position.set(0, 1.6, 0);
    // Aimed well below the horizontal: a beam pointed straight ahead skims the
    // floor and walls at a grazing angle and lights almost nothing.
    this.torch = new THREE.SpotLight(0xffeccf, 0, 16, 0.82, 0.55, 1.15);
    this.torch.position.set(0, 1.4, 0.25);
    this.torchTarget = new THREE.Object3D();
    this.torchTarget.position.set(0, -0.55, 4.6);
    this.player.group.add(this.torch, this.torchTarget);
    this.fillOffset = new THREE.Vector3();
    this.torch.target = this.torchTarget;
    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 6, 2);
    this.muzzle.position.set(0, 1.25, 0.35);
    this.player.group.add(this.muzzle);
    this.player.shadow = blobShadow(0.42);
    this.player.group.add(this.player.shadow);
  }

  resetState() {
    this.hp = 100; this.maxHp = 100;
    this.inv = new Inventory(8);
    this.box = new Array(12).fill(null);
    this.files = [];
    this.flags = {};
    this.taken = {};
    this.killed = {};
    this.equipped = 'knife';
    this.breakerState = null;
    this.stats = { kills: 0, shots: 0, time: 0, saves: 0 };
    this.inv.add('knife', 1);
  }

  // ------------------------------------------------------------- room load
  loadRoom(id, fromId) {
    if (this.roomGroup) {
      this.scene.remove(this.roomGroup);
      disposeTree(this.roomGroup);
    }
    for (const e of this.enemies || []) {
      if (e.group.parent) e.group.parent.remove(e.group);
      disposeTree(e.group);
    }

    const def = ROOMS[id];
    this.room = def;
    this.roomId = id;

    const b = new Builder();
    def.build(b, this);

    // doors: mesh + collider + trigger
    this.doorTriggers = [];
    for (const d of def.doors || []) {
      const trig = portal(b, d.side, d.at, def.w, def.d, d);
      const horiz = (d.side === 'n' || d.side === 's');
      const width = d.width || 1.4;
      const dx = d.side === 'w' ? -def.w / 2 - 0.15 : d.side === 'e' ? def.w / 2 + 0.15 : d.at;
      const dz = d.side === 'n' ? -def.d / 2 - 0.15 : d.side === 's' ? def.d / 2 + 0.15 : d.at;
      b.collider(dx, dz, horiz ? width + 0.3 : 0.4, horiz ? 0.4 : width + 0.3);
      this.doorTriggers.push(trig);
    }

    this.roomGroup = b.group;
    this.colliders = b.colliders;
    this.scene.add(this.roomGroup);
    this.scene.add(this.player.group);
    this.scene.add(this.playerLight);

    // lighting + atmosphere
    this.scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);
    this.scene.background = new THREE.Color(def.fog[0]);
    if (this.ambient) this.scene.remove(this.ambient);
    this.ambient = new THREE.AmbientLight(def.ambient, def.ambientI * 7.4);
    this.scene.add(this.ambient);
    this.torch.intensity = def.dark ? 500 : 0;
    this.playerLight.intensity = def.dark ? 4.0 : 6.5;
    // lights in an unpowered cellar only come on once the generator runs
    if (def.dark && this.flags.power) {
      for (const l of b.lights) l.intensity *= 1.0;
    } else if (def.dark) {
      for (const l of b.lights) l.intensity *= 0.3;
    }

    // pickups
    this.pickups = [];
    for (const p of def.pickups || []) {
      if (this.taken[p.id]) continue;
      const mesh = pickupMesh(p.item);
      mesh.position.set(p.x, (p.y || 0) + 0.09, p.z);
      const glow = new THREE.PointLight(0xffe7b8, 1.1, 1.5, 2);
      glow.position.y = 0.2; mesh.add(glow);
      this.roomGroup.add(mesh);
      this.pickups.push(Object.assign({}, p, { mesh, baseY: mesh.position.y }));
    }

    // enemies
    this.enemies = [];
    const deadList = this.killed[id] || [];
    (def.enemies || []).forEach((spec, i) => {
      if (deadList.includes(i)) return;
      const e = new Enemy(spec);
      e.index = i;
      this.scene.add(e.group);
      this.enemies.push(e);
    });

    // Place the player. A spawn point that has drifted inside a collider -- a
    // prop moved during a lighting pass, say -- would trap the player with no
    // way out at all, so the point is resolved against the geometry that was
    // actually built rather than trusted.
    const entry = (def.entries && (def.entries[fromId] || def.entries.start)) || [0, 0, 0];
    const spot = this.resolveSpawn(entry[0], entry[1], PLAYER_R);
    this.player.x = spot.x; this.player.z = spot.z; this.player.angle = entry[2];
    this.player.group.position.set(spot.x, 0, spot.z);
    this.player.group.rotation.y = entry[2];
    this.quickTurn = null;
    this.qtLatch = false;
    this.pickCamera(true);
    this.ui.setRoom(def.name);
    this.checkpoint = this.snapshot();
  }

  resolveSpawn(x, z, r) {
    if (!this.blocked(x, z, r)) return { x, z };
    for (let ring = 1; ring <= 26; ring++) {
      const rad = ring * 0.12;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const nx = x + Math.cos(a) * rad, nz = z + Math.sin(a) * rad;
        if (!this.blocked(nx, nz, r)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }

  // --------------------------------------------------------------- cameras
  pickCamera(force) {
    const p = this.player;
    const cams = this.room.cameras;
    let found = null;
    for (const c of cams) {
      if (p.x >= c.zone[0] && p.x <= c.zone[2] && p.z >= c.zone[1] && p.z <= c.zone[3]) { found = c; break; }
    }
    if (!found) found = this.activeCam || cams[0];
    if (found !== this.activeCam || force) {
      this.activeCam = found;
      this.camera.position.set(found.pos[0], found.pos[1], found.pos[2]);
      this.camera.lookAt(found.look[0], found.look[1], found.look[2]);
      this.baseFov = found.fov || 52;
      this.applyFov();
    }
  }

  // ------------------------------------------------------------- collision
  blocked(x, z, r) {
    for (const c of this.colliders) {
      if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
    }
    return false;
  }

  moveWithCollision(x, z, dx, dz, r, self) {
    // Already overlapping something: take any move that reduces the overlap
    // rather than refusing every direction, which would pin the actor forever.
    if (this.blocked(x, z, r)) {
      // Already overlapping something. Do not honour the input -- that would
      // be a licence to walk through walls. Push toward the nearest free
      // ground instead, so being wedged is temporary rather than permanent.
      const free = this.resolveSpawn(x, z, r);
      const ox = free.x - x, oz = free.z - z;
      const len = Math.hypot(ox, oz);
      if (len < 1e-6) return { x, z };
      const step = Math.min(len, Math.max(0.04, Math.hypot(dx, dz)));
      return { x: x + (ox / len) * step, z: z + (oz / len) * step };
    }
    let nx = x + dx, nz = z + dz;
    if (this.blocked(nx, z, r) || this.actorBlocked(nx, z, r, self)) nx = x;
    if (this.blocked(nx, nz, r) || this.actorBlocked(nx, nz, r, self)) nz = z;
    return { x: nx, z: nz };
  }

  actorBlocked(x, z, r, self) {
    for (const e of this.enemies) {
      if (e === self || e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < r + e.radius * 0.75) return true;
    }
    if (self && self !== this.player) {
      const d = Math.hypot(this.player.x - x, this.player.z - z);
      if (d < r + PLAYER_R * 0.6) return true;
    }
    return false;
  }

  lineOfSight(x1, z1, x2, z2) {
    const steps = 14;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      for (const c of this.colliders) {
        if (!c.tall) continue;
        if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return false;
      }
    }
    return true;
  }

  // ------------------------------------------------------------ interaction
  findFocus() {
    const p = this.player;
    let best = null, bestD = 1e9;
    const consider = (obj, d, kind) => { if (d < bestD) { bestD = d; best = { obj, kind }; } };
    for (const pk of this.pickups) {
      const d = Math.hypot(pk.x - p.x, pk.z - p.z);
      if (d < 1.25) consider(pk, d - 0.5, 'pickup');
    }
    for (const it of this.room.interactables || []) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < (it.r || 1.3)) consider(it, d, 'interact');
    }
    for (const dt of this.doorTriggers) {
      if (Math.abs(p.x - dt.x) < dt.w / 2 && Math.abs(p.z - dt.z) < dt.d / 2) {
        consider(dt, 0.95, 'door');
      }
    }
    return best;
  }

  doFocus(f) {
    if (!f) return;
    if (f.kind === 'pickup') return this.takePickup(f.obj);
    if (f.kind === 'interact') return f.obj.act(this);
    if (f.kind === 'door') return this.tryDoor(f.obj);
  }

  takePickup(pk) {
    const it = ITEMS[pk.item];
    if (it.kind === 'note') {
      if (!this.files.includes(pk.item)) this.files.push(pk.item);
      this.taken[pk.id] = 1;
      this.removePickup(pk);
      this.ui.openDoc(pk.item, () => this.closeMenus());
      this.mode = 'menu';
      return;
    }
    const n = pk.count || 1;
    if (!this.inv.canFit(pk.item, n)) return this.ui.say('You have no room to carry that.');
    this.inv.add(pk.item, n);
    this.taken[pk.id] = 1;
    this.removePickup(pk);
    this.ui.toast('Acquired  ' + itemLabel(pk.item, n));
    if (pk.item === 'handgun' && this.equipped === 'knife') this.equip('handgun');
  }

  removePickup(pk) {
    pk.mesh.parent && pk.mesh.parent.remove(pk.mesh);
    disposeTree(pk.mesh);
    this.pickups = this.pickups.filter(p => p !== pk);
  }

  tryDoor(d) {
    if (d.secure && !this.flags.power) {
      return this.ui.say('A steel security door, clamped shut. The panel beside it is dark.');
    }
    const unlocked = !d.lock || this.flags['unlocked_' + d.to];
    if (!unlocked && !this.inv.has(d.lock)) {
      return this.ui.say(d.lockMsg || 'It is locked.');
    }
    if (!unlocked) {
      this.flags['unlocked_' + d.to] = 1;
      this.ui.toast('Unlocked with ' + ITEMS[d.lock].name);
    }
    this.transition(d.to);
  }

  transition(to) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.fadeTarget = 1;
    setTimeout(() => {
      this.loadRoom(to, this.roomId);
      this.fadeTarget = 0;
      this.transitioning = false;
    }, 420);
  }

  // ----------------------------------------------------------------- facade
  say(text) { this.ui.say(text); }
  has(id, n) { return this.inv.has(id, n); }
  give(id, n = 1) {
    if (!this.inv.canFit(id, n)) { this.ui.say('You cannot carry any more.'); return false; }
    this.inv.add(id, n);
    this.ui.toast('Acquired  ' + itemLabel(id, n));
    return true;
  }
  take(id, n = 1) { return this.inv.remove(id, n); }
  setFlag(k, v = 1) { this.flags[k] = v; }

  openKeypad(cfg) { this.mode = 'menu'; this.ui.openKeypad(cfg); }

  openBreakers() {
    this.mode = 'menu';
    if (!this.breakerState) this.breakerState = makeBreakers();
    const st = this.breakerState;
    this.ui.openBreakers(st,
      (i) => { for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < st.length) st[k] = !st[k]; },
      (solved) => {
        this.closeMenus();
        if (solved || st.every(Boolean)) {
          this.flags.power = 1;
          this.ui.say('The array shudders. Somewhere above, lights snap on one row at a time,\nand the whole house begins to hum.\n\nThe cellar stair door will be released now.');
        }
      });
  }

  openItemBox() { this.mode = 'menu'; this.ui.openItemBox(this); }
  toBox(i) {
    const s = this.inv.slots[i];
    if (!s) return;
    if (s.id === 'knife') return;
    const free = this.box.indexOf(null);
    if (free < 0) return;
    this.box[free] = s; this.inv.slots[i] = null;
    if (this.equipped === s.id) this.equip('knife');
  }
  fromBox(i) {
    const s = this.box[i];
    if (!s) return;
    if (!this.inv.canFit(s.id, s.count)) return;
    this.inv.add(s.id, s.count); this.box[i] = null;
  }

  confirmSave() {
    this.mode = 'menu';
    this.ui.confirm('TYPEWRITER',
      'The ribbon still has ink. Record your progress here?', 'SAVE', () => {
        this.save();
        this.stats.saves++;
        this.ui.toast('Progress recorded.');
      });
  }

  useItem(i) {
    const s = this.inv.slots[i];
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.kind === 'heal') {
      if (this.hp >= this.maxHp) { this.ui.toast('You are not injured.'); return; }
      this.hp = Math.min(this.maxHp, this.hp + it.heal);
      this.inv.remove(s.id, 1);
      this.ui.toast('Used ' + it.name);
    }
  }

  equip(id) {
    if (!this.inv.has(id)) return;
    this.equipped = id;
    this.updateWeaponHud();
  }

  updateWeaponHud() {
    const w = ITEMS[this.equipped];
    if (w.ammo) {
      const n = this.inv.count(w.ammo);
      this.ui.setWeapon(w.name.toUpperCase(), String(n), n <= 6);
    } else {
      this.ui.setWeapon(w.name.toUpperCase(), '—', false);
    }
  }

  closeMenus() {
    this.ui.closeOverlay();
    if (this.mode === 'menu') this.mode = 'play';
  }

  endGame() {
    this.mode = 'end';
    this.fadeTarget = 1;
    setTimeout(() => this.showEnding(), 900);
  }

  // -------------------------------------------------------------- combat
  fire() {
    const w = ITEMS[this.equipped];
    if (this.fireCooldown > 0) return;
    const p = this.player;
    if (w.ammo) {
      if (!this.inv.has(w.ammo)) { this.ui.toast('Out of ammunition.'); return; }
      this.inv.remove(w.ammo, 1);
      this.stats.shots++;
      this.muzzleTime = 0.06;
      this.updateWeaponHud();
    } else {
      this.stats.shots++;
      p.swing = 0;
    }
    this.fireCooldown = w.rate;

    let best = null, bestD = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > w.range) continue;
      const a = Math.atan2(dx, dz);
      if (Math.abs(angDiff(p.angle, a)) > w.arc) continue;
      if (!this.lineOfSight(p.x, p.z, e.x, e.z)) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      const crit = Math.random() < 0.14 ? 2.0 : 1;
      best.hit(w.dmg * crit, Math.atan2(best.x - p.x, best.z - p.z), {
        onKill: (en) => {
          this.stats.kills++;
          (this.killed[this.roomId] = this.killed[this.roomId] || []).push(en.index);
        },
      });
      for (const e of this.enemies) if (!e.dead) e.alerted = true;
    }
  }

  damagePlayer(n) {
    if (this.player.invuln > 0 || this.mode !== 'play') return;
    this.hp -= n;
    this.player.invuln = 1.0;
    this.player.hurt = 0.55;
    this.damageFx = 1;
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }

  die() {
    this.mode = 'dead';
    this.fadeTarget = 0.55;
    setTimeout(() => this.showDeath(), 1400);
  }

  // ------------------------------------------------------------- save/load
  snapshot() {
    return JSON.stringify({
      room: this.roomId, x: this.player.x, z: this.player.z, a: this.player.angle,
      hp: this.hp, inv: this.inv.serialize(), box: this.box.map(s => (s ? [s.id, s.count] : null)),
      files: this.files, flags: this.flags, taken: this.taken, killed: this.killed,
      eq: this.equipped, stats: this.stats, brk: this.breakerState,
    });
  }
  restore(json, atEntry) {
    const d = JSON.parse(json);
    this.hp = d.hp; this.inv.load(d.inv);
    this.box = d.box.map(s => (s ? { id: s[0], count: s[1] } : null));
    this.files = d.files; this.flags = d.flags; this.taken = d.taken; this.killed = d.killed;
    this.equipped = d.eq; this.stats = d.stats; this.breakerState = d.brk;
    this.loadRoom(d.room, null);
    if (!atEntry) {
      this.player.x = d.x; this.player.z = d.z; this.player.angle = d.a;
      this.player.group.position.set(d.x, 0, d.z);
      this.player.group.rotation.y = d.a;
      this.pickCamera(true);
    }
    this.updateWeaponHud();
  }
  save() { try { localStorage.setItem(SAVE_KEY, this.snapshot()); } catch (e) { /* private mode */ } }
  static hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  loadSave() { const s = localStorage.getItem(SAVE_KEY); if (s) this.restore(s); }

  // --------------------------------------------------------------- screens
  start(fromSave) {
    this.goFullscreen();
    document.querySelector('#title').classList.add('hidden');
    this.ui.showHUD(true);
    this.mode = 'play';
    this.fade = 1; this.fadeTarget = 0;
    if (fromSave) this.loadSave();
    else { this.resetState(); this.loadRoom(START_ROOM, 'start'); }
    this.updateWeaponHud();
    this.clock.getDelta();
    if (!fromSave) {
      setTimeout(() => this.ui.say(
        'The chain on the front doors will not give.\n\nThere is a service gate in the cellar, the groundskeeper said. It needs power.'
      ), 900);
    }
  }

  // Called from a tap, which is the only time a browser will grant it. No
  // orientation lock: the rotate screen covers that, and locking orientation
  // is what makes viewport reporting unreliable on some Android builds.
  goFullscreen() {
    if (!this.touchMode || (this.fsTried || 0) >= 2) return;
    this.fsTried = (this.fsTried || 0) + 1;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      const el = document.documentElement;
      const fs = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fs) return;
      const p = fs.call(el);
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* refused */ }
  }

  showDeath() {
    this.ui.showHUD(false);
    const hasSave = Game.hasSave();
    this.ui.openOverlay('dead', `<div style="text-align:center">
      <h2 class="big-msg">YOU DIED</h2>
      <div class="sub-msg">ASHGROVE MANOR</div>
      <div class="title-menu">
        <button class="mbtn" id="dRetry">RETRY FROM ${this.room.name.toUpperCase()}</button>
        <button class="mbtn" id="dLoad" ${hasSave ? '' : 'disabled'}>LOAD LAST SAVE</button>
        <button class="mbtn ghost" id="dTitle">RETURN TO TITLE</button>
      </div></div>`, (root) => {
      root.querySelector('#dRetry').onclick = () => {
        this.ui.closeOverlay(); this.ui.showHUD(true);
        this.restore(this.checkpoint, true);
        this.hp = Math.max(this.hp, 60);
        this.mode = 'play'; this.fadeTarget = 0; this.damageFx = 0;
      };
      root.querySelector('#dLoad').onclick = () => {
        this.ui.closeOverlay(); this.ui.showHUD(true);
        this.loadSave(); this.mode = 'play'; this.fadeTarget = 0; this.damageFx = 0;
      };
      root.querySelector('#dTitle').onclick = () => location.reload();
    });
  }

  showEnding() {
    this.ui.showHUD(false);
    this.ui.openOverlay('end', `<div style="text-align:center;max-width:600px">
      <h2 class="big-msg" style="color:#c8a15a">ESCAPED</h2>
      <div class="sub-msg">ASHGROVE MANOR</div>
      <p class="ending-body">The gate motor drags the bars aside and cold air comes down the tunnel
      like water. Behind you the house keeps humming, every light burning, every room lit
      for no one at all.<br><br>You do not look back until the treeline.</p>
      <div class="statrow"><span>TIME</span><b>${fmtTime(this.stats.time)}</b></div>
      <div class="statrow"><span>CREATURES DOWNED</span><b>${this.stats.kills}</b></div>
      <div class="statrow"><span>SHOTS FIRED</span><b>${this.stats.shots}</b></div>
      <div class="statrow"><span>SAVES USED</span><b>${this.stats.saves}</b></div>
      <div class="title-menu" style="margin-top:28px">
        <button class="mbtn" id="eAgain">PLAY AGAIN</button>
      </div></div>`, (root) => {
      root.querySelector('#eAgain').onclick = () => location.reload();
    });
  }

  // ------------------------------------------------------------------ loop
  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * 9);
    this.post.uniforms.uFade.value = this.fade;
    this.damageFx = Math.max(0, this.damageFx - dt * 1.8);
    this.post.uniforms.uDamage.value = this.damageFx * 0.9;

    this.updateOrientationGate();
    this.input.update();
    if (this.mode === 'play') {
      this.stats.time += dt;
      this.updatePlay(dt);
    } else if (this.mode === 'menu') {
      if (this.input.consume('inventory') || this.input.consume('cancel')) this.closeMenus();
      this.input.endFrame();
    } else {
      this.input.endFrame();
    }

    this.ui.setCondition(this.hp / this.maxHp);
    this.ui.update(dt);
    this.post.render(this.scene, this.camera, dt);
  }

  updatePlay(dt) {
    const p = this.player, inp = this.input;

    // message box first: action advances dialogue
    if (this.ui.talking) {
      // Pushing a direction reads through the text as well as tapping: being
      // held still by a message box you cannot dismiss is the worst thing
      // that can happen to a player, so give it more than one exit.
      const pushing = inp.move.x !== 0 || inp.move.y !== 0;
      if (inp.consume('action') || inp.consume('fire') || (pushing && this.ui.sayTime > 0.4)) {
        this.ui.advance();
      }
      inp.endFrame();
      this.animateWorld(dt, 0);
      return;
    }

    if (inp.consume('inventory')) { this.mode = 'menu'; this.ui.openInventory(); inp.endFrame(); return; }
    if (inp.consume('cancel')) { this.mode = 'menu'; this.ui.openInventory('status'); inp.endFrame(); return; }
    if (inp.consume('swap')) {
      const order = ['handgun', 'knife'].filter(id => this.inv.has(id));
      const i = order.indexOf(this.equipped);
      this.equip(order[(i + 1) % order.length]);
    }

    this.fireCooldown = Math.max(0, (this.fireCooldown || 0) - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    if (p.swing >= 0) { p.swing += dt; if (p.swing > 0.45) p.swing = -1; }

    const aiming = inp.aimHeld && !this.transitioning;
    this.aiming = aiming;

    // --------------------------------------------------- tank movement / aim
    // Left and right rotate on the spot; forward and back move along whatever
    // direction the character faces. Deliberately camera-independent, so a
    // camera cut mid-stride never reverses your input.
    const turnIn = inp.move.x;
    const fwdIn = inp.move.y;

    if (this.quickTurn !== null && this.quickTurn !== undefined) {
      // mid spin: nothing else may happen
      this.quickTurn += dt / QUICK_TURN_TIME;
      const k = Math.min(1, this.quickTurn);
      const e = k * k * (3 - 2 * k);
      p.angle = this.qtFrom + Math.PI * e;
      p.speed = 0;
      if (k >= 1) { this.quickTurn = null; p.angle = this.qtFrom + Math.PI; }
    } else if (aiming) {
      // rooted: left/right swings the body, auto-aim finishes the job
      p.speed = 0;
      p.angle += turnIn * AIM_TURN_RATE * dt;
      const tgt = this.autoTarget();
      if (tgt) {
        const a = Math.atan2(tgt.x - p.x, tgt.z - p.z);
        p.angle += angDiff(p.angle, a) * Math.min(1, dt * 7);
      }
      if (inp.consume('fire')) this.fire();
    } else {
      // back + run performs a 180, the standard escape from something at your heels
      if (fwdIn < 0 && inp.runHeld && !this.qtLatch) {
        this.qtLatch = true;
        this.quickTurn = 0;
        this.qtFrom = p.angle;
      } else {
        if (fwdIn >= 0 || !inp.runHeld) this.qtLatch = false;

        if (turnIn) p.angle += turnIn * TURN_RATE * dt;

        let sp = 0;
        if (fwdIn > 0) sp = inp.running ? RUN : WALK;
        // qtLatch is still set right after a quick turn, which suppresses the
        // backstep until Back is released -- otherwise finishing the spin with
        // the key still down shuffles you backwards into what you turned from.
        else if (fwdIn < 0 && !this.qtLatch) sp = -BACKSTEP;
        p.speed = sp;
        if (sp !== 0) {
          const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
          const res = this.moveWithCollision(p.x, p.z, fx * sp * dt, fz * sp * dt, PLAYER_R, this.player);
          p.x = res.x; p.z = res.z;
        }
      }
      if (inp.consume('fire')) this.fire();
    }

    // Keep the heading in [-pi, pi] so it cannot drift over a long session.
    // Not while spinning: the quick turn interpolates from a stored angle.
    if (this.quickTurn === null || this.quickTurn === undefined) {
      if (p.angle > Math.PI) p.angle -= Math.PI * 2;
      else if (p.angle < -Math.PI) p.angle += Math.PI * 2;
    }

    // ------------------------------------------------------------ interact
    const focus = this.findFocus();
    if (focus && !aiming) {
      const label = focus.kind === 'pickup' ? ITEMS[focus.obj.item].name
        : focus.kind === 'door' ? focus.obj.label
          : focus.obj.label;
      const verb = focus.kind === 'pickup' ? 'Take' : focus.kind === 'door' ? 'Enter' : 'Examine';
      this.ui.setPrompt(`${verb}  ${label}`);
    } else this.ui.setPrompt(null);

    if (inp.consume('action') && focus && !aiming) this.doFocus(focus);

    // ------------------------------------------------------------- camera
    this.pickCamera(false);

    this.animateWorld(dt, p.speed);
    this.updateReticle(aiming);
    if (this.ui.el.btnFire) this.ui.el.btnFire.disabled = false;
    inp.endFrame();
  }

  updateReticle(aiming) {
    if (!aiming) { this.ui.setReticle(false); return; }
    const t = this.autoTarget();
    if (!t) { this.ui.setReticle(true, false, null); return; }
    const v = new THREE.Vector3(t.x, t.type === 'crawler' ? 0.55 : 1.15, t.z);
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    v.project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * innerHeight;
    this.ui.setReticle(true, true, { x: sx, y: sy });
  }

  autoTarget() {
    const w = ITEMS[this.equipped], p = this.player;
    let best = null, bestA = w.arc;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > w.range) continue;
      const a = Math.abs(angDiff(p.angle, Math.atan2(e.x - p.x, e.z - p.z)));
      if (a < bestA) { bestA = a; best = e; }
    }
    return best;
  }

  animateWorld(dt, speed) {
    const p = this.player;
    p.anim += dt * (speed !== 0 ? speed * 2.1 : 1);
    if (p.hurt > 0) poseHumanHurt(p.parts, p.anim);
    else if (p.swing >= 0) {
      poseHumanAim(p.parts, p.anim, 'knife');
      const k = Math.sin((p.swing / 0.45) * Math.PI);
      p.parts.armR.rotation.x = -1.5 + k * 2.1;
      p.parts.chest.rotation.y = -k * 0.5;
    } else if (this.aiming) poseHumanAim(p.parts, p.anim, this.equipped === 'knife' ? 'knife' : 'gun');
    else if (Math.abs(speed) > 0.1) poseHumanWalk(p.parts, p.anim * 2.2, Math.min(1, Math.abs(speed) / RUN + 0.45));
    else poseHumanIdle(p.parts, p.anim);

    p.group.position.x = p.x;
    p.group.position.z = p.z;
    p.group.rotation.y = p.angle;
    // keep the fill light between the camera and the player
    this.fillOffset.set(this.camera.position.x - p.x, 0, this.camera.position.z - p.z);
    if (this.fillOffset.lengthSq() > 0.001) this.fillOffset.normalize().multiplyScalar(1.7);
    this.playerLight.position.set(p.x + this.fillOffset.x, 1.7, p.z + this.fillOffset.z);
    if (p.invuln > 0) {
      const f = Math.max(0, p.invuln - 0.55) * 1.4;
      p.parts.chest.rotation.z = Math.sin(p.invuln * 40) * 0.06 * f;
    }

    this.muzzleTime = Math.max(0, (this.muzzleTime || 0) - dt);
    this.muzzle.intensity = this.muzzleTime > 0 ? 26 : 0;

    // pickups bob
    for (const pk of this.pickups) {
      pk.mesh.rotation.y += dt * 1.1;
      pk.mesh.position.y = pk.baseY + Math.sin(performance.now() * 0.002 + pk.x) * 0.025;
    }

    const ctx = {
      player: this.player,
      moveWithCollision: (x, z, dx, dz, r, s) => this.moveWithCollision(x, z, dx, dz, r, s),
      lineOfSight: (a, b, c, d) => this.lineOfSight(a, b, c, d),
      damagePlayer: (n) => this.damagePlayer(n),
      onKill: (en) => {
        this.stats.kills++;
        (this.killed[this.roomId] = this.killed[this.roomId] || []).push(en.index);
      },
    };
    for (const e of this.enemies) e.update(dt, ctx);
  }
}

function makeBreakers() {
  // start from solved, then apply a few legal moves so it is always solvable
  const st = [true, true, true, true, true, true];
  const moves = [0, 2, 5];
  for (const i of moves) for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < 6) st[k] = !st[k];
  return st;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) m.dispose();
    }
  });
}
