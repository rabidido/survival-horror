// Unified keyboard + touch input.
export class Input {
  constructor(root) {
    this.move = { x: 0, y: 0 };     // screen space: +y = away from camera
    this.runHeld = false;
    this.aimHeld = false;
    this.pressed = new Set();       // edge-triggered actions this frame
    this.keys = new Set();
    this.pad = { active: false, id: null, up: false, down: false, left: false, right: false };
    this.pointerLockMove = null;
    this.root = root;
    this.touch = false;
    this._bindKeys();
    this._bindTouch(root);
    // Bound on the window, so it still fires when the touch overlay is hidden
    // -- which is the case this is here to recover from.
    addEventListener('touchstart', () => {
      if (this.touch) return;
      this.touch = true;
      if (this.onFirstTouch) this.onFirstTouch();
    }, { passive: true, capture: true });
  }

  press(name) { this.pressed.add(name); }
  consume(name) {
    if (this.pressed.has(name)) { this.pressed.delete(name); return true; }
    return false;
  }
  endFrame() { this.pressed.clear(); }

  _bindKeys() {
    const map = {
      KeyE: 'action', KeyF: 'action', Enter: 'action',
      KeyI: 'inventory', Tab: 'inventory',
      Escape: 'cancel', Backspace: 'cancel',
      KeyJ: 'fire', KeyX: 'fire',
      KeyQ: 'swap',
      KeyM: 'map',
    };
    addEventListener('keydown', (e) => {
      if (e.repeat) { return; }
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.runHeld = true;
      if (e.code === 'Space') { this.aimHeld = true; e.preventDefault(); }
      if (map[e.code]) { this.press(map[e.code]); e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.runHeld = false;
      if (e.code === 'Space') this.aimHeld = false;
    });
    addEventListener('blur', () => { this.keys.clear(); this.aimHeld = false; this.runHeld = false; });
  }

  _bindTouch(root) {
    const pad = root.querySelector('#dpad');
    // One continuous disc split into eight wedges that meet along the
    // diagonals. The diagonals are the awkward ones to hit, so they get the
    // wider slice -- 54 degrees against 36 -- and the artwork is drawn to
    // match, rather than showing equal wedges and behaving otherwise.
    const SEGS = [
      { id: 'sR', c: 0, w: 36, x: 1, y: 0 },
      { id: 'sUR', c: 45, w: 54, x: 1, y: 1 },
      { id: 'sU', c: 90, w: 36, x: 0, y: 1 },
      { id: 'sUL', c: 135, w: 54, x: -1, y: 1 },
      { id: 'sL', c: 180, w: 36, x: -1, y: 0 },
      { id: 'sDL', c: 225, w: 54, x: -1, y: -1 },
      { id: 'sD', c: 270, w: 36, x: 0, y: -1 },
      { id: 'sDR', c: 315, w: 54, x: 1, y: -1 },
    ];
    for (const sg of SEGS) sg.el = root.querySelector('#' + sg.id);

    const DEAD = 0.27;           // matches the drawn hub
    const applySeg = (sg) => {
      this.pad.up = !!sg && sg.y > 0;
      this.pad.down = !!sg && sg.y < 0;
      this.pad.right = !!sg && sg.x > 0;
      this.pad.left = !!sg && sg.x < 0;
      for (const s2 of SEGS) s2.el.classList.toggle('on', s2 === sg);
    };
    const clearDirs = () => applySeg(null);

    const sample = (clientX, clientY) => {
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rad = Math.min(r.width, r.height) / 2;
      const dx = (clientX - cx) / rad, dy = (cy - clientY) / rad;   // dy up-positive
      if (Math.hypot(dx, dy) < DEAD) return clearDirs();
      const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      for (const sg of SEGS) {
        let d = deg - sg.c;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        if (Math.abs(d) <= sg.w / 2) return applySeg(sg);
      }
      clearDirs();
    };

    const start = (e) => {
      this.touch = true;
      if (this.onGesture) this.onGesture();
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this.pad.id = t.identifier === undefined ? 'mouse' : t.identifier;
      this.pad.active = true;
      sample(t.clientX, t.clientY);
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.pad.active) return;
      const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = list.find(x => (x.identifier === undefined ? 'mouse' : x.identifier) === this.pad.id);
      if (!t) return;
      sample(t.clientX, t.clientY);
      e.preventDefault();
    };
    const end = (e) => {
      const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = list.find(x => (x.identifier === undefined ? 'mouse' : x.identifier) === this.pad.id);
      if (!t && e.changedTouches) return;
      this.pad.active = false;
      this.pad.id = null;
      clearDirs();
    };

    pad.addEventListener('touchstart', start, { passive: false });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end);
    pad.addEventListener('touchcancel', end);
    pad.addEventListener('mousedown', start);
    addEventListener('mousemove', (e) => { if (this.pad.active) move(e); });
    addEventListener('mouseup', (e) => { if (this.pad.active) end(e); });

    // Hold-style buttons
    const holdBtn = (id, set) => {
      const el = root.querySelector(id);
      if (!el) return;
      const on = (e) => { this.touch = true; set(true); el.classList.add('held'); e.preventDefault(); };
      const off = (e) => { set(false); el.classList.remove('held'); if (e) e.preventDefault(); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      addEventListener('mouseup', off);
    };
    const tapBtn = (id, name) => {
      const el = root.querySelector(id);
      if (!el) return;
      const on = (e) => {
        this.touch = true; this.press(name);
        if (this.onGesture) this.onGesture();
        el.classList.add('held');
        setTimeout(() => el.classList.remove('held'), 90);
        e.preventDefault(); e.stopPropagation();
      };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('click', (e) => { if (!this.touch) on(e); });
    };

    holdBtn('#btnAim', v => { this.aimHeld = v; });
    holdBtn('#btnRun', v => { this.runHeld = v; });
    tapBtn('#btnFire', 'fire');
    tapBtn('#btnAction', 'action');
    tapBtn('#btnInv', 'inventory');
  }

  update() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.pad.active) {
      if (this.pad.up) y += 1;
      if (this.pad.down) y -= 1;
      if (this.pad.right) x += 1;
      if (this.pad.left) x -= 1;
    }
    // Digital: every direction is fully on or fully off, never in between,
    // so the keyboard and the pad produce exactly the same input.
    this.move.x = Math.sign(x);
    this.move.y = Math.sign(y);
    this.magnitude = Math.max(Math.abs(this.move.x), Math.abs(this.move.y));
    this.running = this.runHeld;
    return this.move;
  }
}
