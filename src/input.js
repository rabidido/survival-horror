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
      if (e.code === 'Space') { if (this.setAim) this.setAim(true); else this.aimHeld = true; e.preventDefault(); }
      if (map[e.code]) { this.press(map[e.code]); e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.runHeld = false;
      if (e.code === 'Space') { if (this.setAim) this.setAim(false); else this.aimHeld = false; }
    });
    addEventListener('blur', () => {
      this.keys.clear(); this.runHeld = false;
      if (this.setAim) this.setAim(false); else this.aimHeld = false;
    });
  }

  _bindTouch(root) {
    const pad = root.querySelector('#dpad');
    const quads = {
      up: root.querySelector('#sU'), down: root.querySelector('#sD'),
      left: root.querySelector('#sL'), right: root.querySelector('#sR'),
    };
    const glyphs = {};
    for (const k of Object.keys(quads)) {
      glyphs[k] = root.querySelector('.gly[data-for="' + quads[k].id + '"]');
    }
    const thumb = root.querySelector('#dThumb');

    // Four directions, not eight. Each axis is tested on its own against a
    // threshold, so the corners engage two at once exactly as the rocker under
    // a real d-pad does -- rather than a diagonal being a ninth thing to hit.
    // At T = 0.30 a press within 27.5 degrees of a corner holds both.
    const T = 0.30;
    const DEAD = 0.26;           // matches the drawn hub

    const setDirs = (up, down, left, right) => {
      this.pad.up = up; this.pad.down = down;
      this.pad.left = left; this.pad.right = right;
      const on = { up, down, left, right };
      for (const k of Object.keys(quads)) {
        quads[k].classList.toggle('on', on[k]);
        glyphs[k].classList.toggle('on', on[k]);
      }
    };
    const clearDirs = () => { setDirs(false, false, false, false); thumb.classList.remove('on'); };

    const sample = (clientX, clientY) => {
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rad = Math.min(r.width, r.height) / 2;
      let dx = (clientX - cx) / rad, dy = (cy - clientY) / rad;   // dy up-positive
      const len = Math.hypot(dx, dy);
      if (len < DEAD) { setDirs(false, false, false, false); thumb.classList.remove('on'); return; }
      // Direction only: how far past the deadzone the thumb sits changes
      // nothing, because the input is digital.
      const ux = dx / len, uy = dy / len;
      setDirs(uy > T, uy < -T, ux < -T, ux > T);
      const show = Math.min(len, 1);
      thumb.setAttribute('cx', (100 + ux * show * 74).toFixed(1));
      thumb.setAttribute('cy', (100 - uy * show * 74).toFixed(1));
      thumb.classList.add('on');
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

    // AIM latches on touch instead of being held. One thumb is on the pad and
    // the other cannot hold AIM and tap FIRE at the same time, so holding it
    // made aiming and firing physically impossible on a phone.
    const aimEl = root.querySelector('#btnAim');
    this.setAim = (v) => {
      this.aimHeld = v;
      if (aimEl) aimEl.classList.toggle('latched', v);
    };
    if (aimEl) {
      const toggle = (e) => {
        this.touch = true;
        if (this.onGesture) this.onGesture();
        this.setAim(!this.aimHeld);
        e.preventDefault(); e.stopPropagation();
      };
      aimEl.addEventListener('touchstart', toggle, { passive: false });
      aimEl.addEventListener('click', (e) => { if (!this.touch) toggle(e); });
    }
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
