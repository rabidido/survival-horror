// Keyboard input. Ashgrove Manor is a PC game: everything in play is on the
// keyboard, and every menu can be driven from the keyboard too -- the mouse
// is a convenience there, never a requirement.
//
// Two separate streams come out of here:
//   pressed  edge-triggered gameplay actions, cleared every frame
//   nav      edge-triggered menu movement, which DOES repeat when a key is
//            held, because holding a direction to run down a list is what a
//            menu is expected to do

const HOLD = {
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'aim',
};

// Gameplay actions. Fire sits under the right hand while the left holds
// WASD, Shift and Space.
const ACTIONS = {
  KeyE: 'action', Enter: 'action', NumpadEnter: 'action',
  KeyI: 'inventory', Tab: 'inventory',
  Escape: 'cancel', Backspace: 'cancel',
  KeyJ: 'fire', KeyX: 'fire', ControlLeft: 'fire', ControlRight: 'fire',
  KeyQ: 'swap',
  KeyM: 'map',
};

const NAV = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyE: 'confirm',
  Escape: 'cancel', Backspace: 'cancel',
};

// Keys the page has no business scrolling, zooming or tabbing away on while
// the game owns the window.
const SWALLOW = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
  'Backspace', 'Enter', 'NumpadEnter',
]);

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };     // character space: +y = forward, x = turn
    this.magnitude = 0;
    this.running = false;
    this.runHeld = false;
    this.aimHeld = false;
    this.keys = new Set();
    this.pressed = new Set();
    this.nav = [];
    this.typed = [];            // digits typed this frame, for the keypad
    this._bind();
  }

  press(name) { this.pressed.add(name); }
  consume(name) {
    if (this.pressed.has(name)) { this.pressed.delete(name); return true; }
    return false;
  }
  endFrame() { this.pressed.clear(); this.nav.length = 0; this.typed.length = 0; }

  _bind() {
    addEventListener('keydown', (e) => {
      // A modified key belongs to the browser: Ctrl+R, Alt+Tab, Cmd+W. Only
      // bare Ctrl -- which is a fire button -- gets through.
      if ((e.ctrlKey && !e.code.startsWith('Control')) || e.altKey || e.metaKey) return;
      if (NAV[e.code]) this.nav.push(NAV[e.code]);
      // A keypad on screen should accept the number row, not just clicks.
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
      if (digit) this.typed.push(digit[1]);
      if (SWALLOW.has(e.code)) e.preventDefault();
      if (e.repeat) return;           // held keys must not re-fire an action
      this.keys.add(e.code);
      const hold = HOLD[e.code];
      if (hold === 'run') this.runHeld = true;
      if (hold === 'aim') this.aimHeld = true;
      if (ACTIONS[e.code]) { this.press(ACTIONS[e.code]); e.preventDefault(); }
    });

    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const hold = HOLD[e.code];
      if (hold === 'run') this.runHeld = false;
      if (hold === 'aim') this.aimHeld = false;
    });

    // Alt-tabbing away with a key down would otherwise leave the character
    // walking into a wall until the player came back and pressed it again.
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  releaseAll() {
    this.keys.clear();
    this.runHeld = false;
    this.aimHeld = false;
    this.move.x = this.move.y = 0;
    this.nav.length = 0;
    this.typed.length = 0;
  }

  update() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    // Digital: every direction is fully on or fully off. Pressing forward and
    // a turn together walks a curve, exactly as holding two directions on a
    // d-pad always did.
    this.move.x = Math.sign(x);
    this.move.y = Math.sign(y);
    this.magnitude = Math.max(Math.abs(this.move.x), Math.abs(this.move.y));
    this.running = this.runHeld;
    return this.move;
  }
}
