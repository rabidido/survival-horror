// Unified keyboard + touch input.
export class Input {
  constructor(root) {
    this.move = { x: 0, y: 0 };     // screen space: +y = away from camera
    this.runHeld = false;
    this.aimHeld = false;
    this.pressed = new Set();       // edge-triggered actions this frame
    this.keys = new Set();
    this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.pointerLockMove = null;
    this.root = root;
    this.touch = false;
    this._bindKeys();
    this._bindTouch(root);
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
    const zone = root.querySelector('#stickZone');
    const knob = root.querySelector('#stickKnob');
    const base = root.querySelector('#stickBase');
    const R = 56;

    const start = (e) => {
      this.touch = true;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this.stick.active = true;
      this.stick.id = t.identifier === undefined ? 'mouse' : t.identifier;
      this.stick.ox = t.clientX; this.stick.oy = t.clientY;
      base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px';
      base.style.opacity = '0.85';
      knob.style.left = t.clientX + 'px'; knob.style.top = t.clientY + 'px';
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.stick.active) return;
      const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = list.find(x => (x.identifier === undefined ? 'mouse' : x.identifier) === this.stick.id);
      if (!t) return;
      let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this.stick.x = dx / R; this.stick.y = dy / R;
      knob.style.left = (this.stick.ox + dx) + 'px';
      knob.style.top = (this.stick.oy + dy) + 'px';
      e.preventDefault();
    };
    const end = (e) => {
      const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = list.find(x => (x.identifier === undefined ? 'mouse' : x.identifier) === this.stick.id);
      if (!t && e.changedTouches) return;
      this.stick.active = false; this.stick.x = this.stick.y = 0;
      base.style.opacity = '0';
      knob.style.left = base.style.left; knob.style.top = base.style.top;
    };

    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

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
    const kl = Math.hypot(x, y);
    if (kl > 1) { x /= kl; y /= kl; }
    if (this.stick.active) { x = this.stick.x; y = -this.stick.y; }
    this.move.x = x; this.move.y = y;
    this.magnitude = Math.min(1, Math.hypot(x, y));
    // Full stick deflection on touch counts as running.
    this.running = this.runHeld || (this.stick.active && this.magnitude > 0.82);
    return this.move;
  }
}
