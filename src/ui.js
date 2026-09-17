// HUD + all overlay screens. Pure DOM; the 3D layer never touches these.
import { ITEMS, iconFor, itemLabel } from './items.js';

const CONDITIONS = [
  { min: 0.62, label: 'FINE', cls: '' },
  { min: 0.30, label: 'CAUTION', cls: 'caution' },
  { min: 0.0001, label: 'DANGER', cls: 'danger' },
  { min: -1, label: 'DEAD', cls: 'dead' },
];

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: q('#hud'), overlay: q('#overlay'),
      title: q('#title'), loading: q('#loading'),
      roomName: q('#roomName'), condition: q('#condition'),
      ekg: q('#ekgCanvas'), weaponName: q('#weaponName'), ammoCount: q('#ammoCount'),
      prompt: q('#prompt'), promptKey: q('#promptKey'), promptText: q('#promptText'),
      subtitle: q('#subtitle'), subtitleText: q('#subtitleText'),
      toast: q('#toast'), reticle: q('#reticle'),
    };
    this.ekgCtx = this.el.ekg.getContext('2d');
    this.ekgT = 0;
    this.queue = [];
    this.overlayOpen = null;
    this._roomTimer = 0;
    this.focusEl = null;        // the element the keyboard cursor sits on
    this.onCancel = null;       // how Escape leaves the open overlay
    this._navHook = null;       // called when the keyboard cursor moves
    this._typeHook = null;      // called when a digit is typed
    this.el.subtitle.addEventListener('click', () => this.advance());
    // The mouse is welcome in the menus, and moving it should take the
    // keyboard cursor with it rather than leave two highlights fighting.
    this.el.overlay.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest(FOCUSABLE);
      if (el && el !== this.focusEl && this.el.overlay.contains(el)) this._setFocus(el);
    });
  }

  // ---------------------------------------------------------------- HUD
  showHUD(on) {
    this.el.hud.classList.toggle('hidden', !on);
  }

  setRoom(name) {
    this.el.roomName.textContent = name;
    this.el.roomName.classList.add('show');
    this._roomTimer = 3.2;
  }

  setCondition(frac) {
    const c = CONDITIONS.find(x => frac > x.min) || CONDITIONS[CONDITIONS.length - 1];
    this.el.condition.textContent = c.label;
    this.el.condition.className = c.cls;
    this.cond = c;
  }

  setWeapon(name, ammo, low) {
    this.el.weaponName.textContent = name;
    this.el.ammoCount.textContent = ammo;
    this.el.ammoCount.classList.toggle('low', !!low);
  }

  setPrompt(text, key) {
    if (!text) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.classList.remove('hidden');
    this.el.promptKey.textContent = key || 'E';
    this.el.promptText.textContent = text;
  }

  setReticle(on, locked, at) {
    this.el.reticle.classList.toggle('hidden', !on);
    if (on) {
      if (at) {
        this.el.reticle.style.left = at.x + 'px';
        this.el.reticle.style.top = at.y + 'px';
      } else {
        this.el.reticle.style.left = '50%';
        this.el.reticle.style.top = '46%';
      }
      if (locked === this._retLocked) return;
      this._retLocked = locked;
      this.el.reticle.innerHTML = locked
        ? '<svg width="46" height="46" viewBox="0 0 46 46"><g stroke="#d24a3a" stroke-width="1.6" fill="none"><path d="M23 6v7M23 33v7M6 23h7M33 23h7"/><circle cx="23" cy="23" r="11" stroke-opacity=".55"/></g><circle cx="23" cy="23" r="1.9" fill="#d24a3a"/></svg>'
        : '<svg width="46" height="46" viewBox="0 0 46 46"><g stroke="#c8a15a" stroke-width="1.3" fill="none" stroke-opacity=".8"><path d="M23 9v6M23 31v6M9 23h6M31 23h6"/></g><circle cx="23" cy="23" r="1.4" fill="#c8a15a" fill-opacity=".9"/></svg>';
    }
  }

  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    this.el.toast.appendChild(d);
    setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; }, 2200);
    setTimeout(() => d.remove(), 2800);
  }

  // -------------------------------------------------------- message box
  say(text) {
    const parts = Array.isArray(text) ? text : String(text).split('\n\n');
    for (const p of parts) this.queue.push(p);
    this._showNext();
  }
  _showNext() {
    if (!this.queue.length) {
      this.el.subtitle.classList.add('hidden');
      this.talking = false;
      if (this._sayDone) { const f = this._sayDone; this._sayDone = null; f(); }
      return;
    }
    this.talking = true;
    this.el.subtitle.classList.remove('hidden');
    this.el.subtitleText.textContent = this.queue.shift();
    this.sayTime = 0;
  }
  advance() {
    if (!this.talking) return false;
    if (this.sayTime < 0.25) return true;
    this._showNext();
    return true;
  }

  // ------------------------------------------------------------ overlay
  // `onCancel` is the way out for Escape. Screens that have to leave by
  // their own door -- the breaker array checks whether it was solved, a
  // document opened from the FILES tab goes back to that tab -- name it here.
  openOverlay(name, html, wire, onCancel) {
    const same = this.overlayOpen === name;
    const key = same ? this._focusKey : null;
    this.overlayOpen = name;
    this.onCancel = onCancel || null;
    this._navHook = null;
    this._typeHook = null;
    this.focusEl = null;
    this.el.overlay.innerHTML = html;
    this.el.overlay.classList.remove('hidden');
    if (wire) wire(this.el.overlay);
    // A re-render is the same screen redrawn, so the keyboard cursor stays
    // where the player left it instead of snapping back to the first button.
    this._restoreFocus(this.el.overlay, key);
  }
  closeOverlay() {
    this.overlayOpen = null;
    this.onCancel = null;
    this._navHook = null;
    this._typeHook = null;
    this.focusEl = null;
    this._focusKey = null;
    this.el.overlay.classList.add('hidden');
    this.el.overlay.innerHTML = '';
  }

  // -------------------------------------------------- keyboard navigation
  // Every screen in the game is a handful of DOM elements, so rather than
  // hand-writing a cursor per screen the nav works geometrically: from where
  // the cursor is, find the nearest thing that actually lies in the direction
  // pressed. Grids, rows and columns all fall out of that for free.
  handleNav(inp) {
    const root = this._navRoot();
    if (!root) { this.focusEl = null; return; }
    if (root !== this._navRootEl) {
      this._navRootEl = root;
      this._restoreFocus(root);          // back where this screen left off
    }
    for (const n of inp.nav) {
      if (n === 'cancel') continue;                 // the game decides what Escape means
      if (n === 'confirm') {
        const el = this.focusEl;
        if (el && root.contains(el) && !el.disabled) el.click();
      } else {
        this._moveFocus(n);
      }
    }
    if (this._typeHook && inp.typed.length) {
      for (const ch of inp.typed) this._typeHook(ch);
    }
  }

  // The topmost visible screen owns the keyboard.
  _navRoot() {
    if (!this.el.overlay.classList.contains('hidden')) return this.el.overlay;
    const title = this.el.title;
    if (title && !title.classList.contains('hidden')) return title;
    return null;
  }

  // Everything that can hold the cursor, in DOM order.
  focusList(root) {
    return this._geomList(root).filter(el => !el.disabled);
  }

  // The same list with the greyed-out entries left in. They cannot be
  // selected, but they still say where the next row of controls is.
  _geomList(root) {
    return Array.from(root.querySelectorAll(FOCUS_ANY)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  // `key` names where the cursor should land: a string to put it back on
  // that element, null to start fresh, and undefined to use wherever this
  // screen last had it -- which is how leaving the CONTROLS screen returns
  // the cursor to the CONTROLS button rather than the top of the menu.
  _restoreFocus(root, key) {
    const list = this.focusList(root);
    if (!list.length) { this.focusEl = null; return; }
    const want = key === null ? null : (key === undefined ? root._navKey : key);
    const el = (want && list.find(x => navKey(x) === want))
      || list.find(x => x.dataset.navDefault != null) || list[0];
    this._setFocus(el);
  }

  _setFocus(el) {
    if (this.focusEl === el) return;
    if (this.focusEl) this.focusEl.classList.remove('kfocus');
    this.focusEl = el;
    if (!el) return;
    el.classList.add('kfocus');
    this._focusKey = navKey(el);
    const root = this._navRoot();
    if (root) root._navKey = this._focusKey;
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (this._navHook) this._navHook(el);
  }

  _moveFocus(dir) {
    const root = this._navRoot();
    if (!root) return;
    const all = this._geomList(root);
    const live = all.filter(el => !el.disabled);
    if (!live.length) return;
    const cur = this.focusEl && live.includes(this.focusEl) ? this.focusEl : null;
    if (!cur) { this._setFocus(live[0]); return; }

    const horiz = dir === 'left' || dir === 'right';
    const sign = (dir === 'right' || dir === 'down') ? 1 : -1;
    const r = cur.getBoundingClientRect();
    const c = centre(cur);
    const measure = (el) => {
      const q = el.getBoundingClientRect(), p = centre(el);
      return {
        along: (horiz ? p.x - c.x : p.y - c.y) * sign,
        off: horiz ? Math.abs(p.y - c.y) : Math.abs(p.x - c.x),
        // do the two boxes share ground on the other axis?
        overlap: horiz ? Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top)
          : Math.min(r.right, q.right) - Math.max(r.left, q.left),
      };
    };

    // 1. The nearest control ahead that shares this row or column. Greyed-out
    //    entries are skipped over, not stopped at, so a disabled CONTINUE
    //    between NEW GAME and CONTROLS never blocks the way past.
    let inline = null, inlineAlong = Infinity, inlineOff = Infinity;
    // Anything else ahead, kept only so that nothing is ever unreachable.
    let loose = null, looseCost = Infinity;
    // Behind: the far end of this row or column, for wrapping round.
    let wrap = null, wrapAlong = 0;

    for (const el of live) {
      if (el === cur) continue;
      const m = measure(el);
      if (m.along > 2) {
        if (m.overlap > 1
          && (m.along < inlineAlong - 1 || (m.along < inlineAlong + 1 && m.off < inlineOff))) {
          inline = el; inlineAlong = m.along; inlineOff = m.off;
        }
        const cost = m.along + m.off * 2.6;
        if (cost < looseCost) { looseCost = cost; loose = el; }
      } else if (m.overlap > 1 && -m.along > wrapAlong) {
        wrapAlong = -m.along; wrap = el;
      }
    }

    // 2. Nothing in line at all, which happens when the row ahead is mostly
    //    disabled -- the inventory footer, where only CLOSE is live and it
    //    sits off to the right. Take the line's distance from the greyed-out
    //    entries and find the nearest live control on it.
    if (!inline) {
      let line = Infinity;
      for (const el of all) {
        if (el === cur) continue;
        const m = measure(el);
        if (m.along > 2 && m.overlap > 1 && m.along < line) line = m.along;
      }
      if (line < Infinity) {
        const band = Math.max(8, (horiz ? r.width : r.height) * 0.75);
        let off = Infinity;
        for (const el of live) {
          if (el === cur) continue;
          const m = measure(el);
          if (m.along > 2 && Math.abs(m.along - line) <= band && m.off < off) {
            inline = el; off = m.off;
          }
        }
      }
    }

    // Something always happens: a press that moves nothing reads as a hang.
    this._setFocus(inline || wrap || loose || cur);
  }

  // ---------------------------------------------------------- inventory
  openInventory(tab) {
    const g = this.game;
    this.invTab = tab || this.invTab || 'items';
    this.invSel = this.invSel == null ? 0 : this.invSel;
    const render = () => {
      const t = this.invTab;
      let body = '';
      if (t === 'items') {
        let slots = '';
        for (let i = 0; i < g.inv.size; i++) {
          const s = g.inv.slots[i];
          const sel = i === this.invSel ? ' sel' : '';
          const eq = s && g.equipped === s.id ? ' eq' : '';
          slots += `<div class="slot${sel}${eq}" data-i="${i}"${sel ? ' data-nav-default' : ''}>` +
            (s ? `<img src="${iconFor(s.id)}" alt="">${s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}` : '') +
            `</div>`;
        }
        const s = g.inv.slots[this.invSel];
        const it = s ? ITEMS[s.id] : null;
        body = `<div class="inv-wrap"><div class="slots">${slots}</div>
          <div class="detail"><h3>${it ? it.name : '&mdash;'}</h3>
          <p>${it ? (it.desc || '') : 'Nothing in this slot.'}</p></div></div>
          <p class="khint" style="margin:18px 0 0">
          <kbd>&larr;&uarr;&darr;&rarr;</kbd> move &middot; <kbd>Enter</kbd> select &middot;
          <kbd>I</kbd> or <kbd>Esc</kbd> close</p>`;
      } else if (t === 'files') {
        body = g.files.length
          ? `<div class="files">${g.files.map((f, i) =>
            `<button class="file" data-f="${i}"${i === 0 ? ' data-nav-default' : ''}>${ITEMS[f].title || ITEMS[f].name}</button>`).join('')}</div>`
          : `<p class="khint">You have not picked up any documents.</p>`;
      } else {
        const kills = g.stats.kills, sh = g.stats.shots;
        body = `<div>
          <div class="statrow"><span>CONDITION</span><b>${this.cond ? this.cond.label : 'FINE'}</b></div>
          <div class="statrow"><span>HEALTH</span><b>${Math.ceil(g.hp)} / ${g.maxHp}</b></div>
          <div class="statrow"><span>LOCATION</span><b>${g.room.name}</b></div>
          <div class="statrow"><span>ROUNDS CARRIED</span><b>${g.inv.count('ammo9')}</b></div>
          <div class="statrow"><span>CREATURES DOWNED</span><b>${kills}</b></div>
          <div class="statrow"><span>SHOTS FIRED</span><b>${sh}</b></div>
          <div class="statrow"><span>TIME</span><b>${fmtTime(g.stats.time)}</b></div>
          <div class="statrow"><span>SAVES USED</span><b>${g.stats.saves}</b></div>
        </div>`;
      }
      const s = g.inv.slots[this.invSel];
      const it = s ? ITEMS[s.id] : null;
      const canUse = it && (it.kind === 'heal');
      const canEquip = it && it.kind === 'weapon' && g.equipped !== s.id;
      const html = `<div class="panel">
        <div class="panel-head">
          <div class="tabs">
            <button class="tab${t === 'items' ? ' on' : ''}" data-t="items">ITEMS</button>
            <button class="tab${t === 'files' ? ' on' : ''}" data-t="files">FILES</button>
            <button class="tab${t === 'status' ? ' on' : ''}" data-t="status">STATUS</button>
          </div>
          <div class="panel-title">INVENTORY</div>
        </div>
        <div class="panel-body">${body}</div>
        <div class="panel-foot">
          ${t === 'items' ? `<button class="pbtn" id="iUse" ${canUse ? '' : 'disabled'}>USE</button>
          <button class="pbtn" id="iEquip" ${canEquip ? '' : 'disabled'}>EQUIP</button>
          <button class="pbtn" id="iDrop" ${it && it.kind !== 'weapon' ? '' : 'disabled'}>DISCARD</button>` : ''}
          <button class="pbtn wide" id="iClose">CLOSE</button>
        </div></div>`;
      this.openOverlay('inventory', html, (root) => {
        // Moving the cursor onto a slot selects it, so the detail panel
        // follows the arrow keys without a confirm on every step.
        this._navHook = (el) => {
          if (el.dataset.i === undefined) return;
          const i = +el.dataset.i;
          if (i === this.invSel) return;
          this.invSel = i;
          render();
        };
        root.querySelectorAll('.tab').forEach(b => b.onclick = () => { this.invTab = b.dataset.t; render(); });
        root.querySelectorAll('.slot').forEach(b => b.onclick = () => { this.invSel = +b.dataset.i; render(); });
        root.querySelectorAll('.file').forEach(b => b.onclick = () => this.openDoc(g.files[+b.dataset.f], () => this.openInventory('files')));
        const c = root.querySelector('#iClose'); if (c) c.onclick = () => g.closeMenus();
        const u = root.querySelector('#iUse'); if (u) u.onclick = () => { g.useItem(this.invSel); render(); };
        const e = root.querySelector('#iEquip'); if (e) e.onclick = () => { g.equip(g.inv.slots[this.invSel].id); render(); };
        const d = root.querySelector('#iDrop'); if (d) d.onclick = () => { g.inv.removeSlot(this.invSel); render(); };
      });
    };
    render();
  }

  openDoc(itemId, onClose) {
    const it = ITEMS[itemId];
    this.openOverlay('doc', `<div class="panel">
      <div class="panel-head"><div class="panel-title">${(it.title || it.name).toUpperCase()}</div></div>
      <div class="panel-body"><div class="doc">${escapeHtml(it.body || it.desc || '')}</div></div>
      <div class="panel-foot"><button class="pbtn wide" id="dClose">CLOSE</button></div></div>`,
      (root) => { root.querySelector('#dClose').onclick = () => (onClose ? onClose() : this.game.closeMenus()); },
      () => (onClose ? onClose() : this.game.closeMenus()));
  }

  // ------------------------------------------------------------- keypad
  openKeypad(cfg) {
    let entry = '';
    const render = (bad) => {
      const digits = [];
      for (let i = 0; i < cfg.digits; i++) digits.push(`<div class="kdigit">${entry[i] || '&middot;'}</div>`);
      const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'CLR', 0, 'OK']
        .map(k => `<button data-k="${k}"${k === 'OK' ? ' data-nav-default' : ''}>${k}</button>`).join('');
      this.openOverlay('keypad', `<div class="panel">
        <div class="panel-head"><div class="panel-title">${cfg.title}</div></div>
        <div class="panel-body">
          <p class="khint">${cfg.hint || ''}</p>
          <p class="khint"><kbd>0</kbd>&ndash;<kbd>9</kbd> to type &middot;
            <kbd>Enter</kbd> to confirm &middot; <kbd>Esc</kbd> to step away</p>
          <div class="kdisp${bad ? ' bad' : ''}">${digits.join('')}</div>
          <div class="keypad">${keys}</div>
        </div>
        <div class="panel-foot"><button class="pbtn wide" id="kClose">STEP AWAY</button></div></div>`,
        (root) => {
          this._typeHook = (ch) => {
            if (entry.length >= cfg.digits) return;
            entry += ch;
            if (entry.length === cfg.digits && entry === cfg.code) {
              this.game.closeMenus(); cfg.onSuccess(); return;
            }
            render(false);
          };
          root.querySelector('#kClose').onclick = () => this.game.closeMenus();
          root.querySelectorAll('.keypad button').forEach(b => b.onclick = () => {
            const k = b.dataset.k;
            if (k === 'CLR') entry = '';
            else if (k === 'OK') {
              if (entry === cfg.code) { this.game.closeMenus(); cfg.onSuccess(); return; }
              entry = ''; render(true); return;
            } else if (entry.length < cfg.digits) entry += k;
            if (entry.length === cfg.digits && entry === cfg.code) {
              this.game.closeMenus(); cfg.onSuccess(); return;
            }
            render(false);
          });
        });
    };
    render(false);
  }

  // ----------------------------------------------------------- breakers
  openBreakers(state, onToggle, onClose) {
    const render = () => {
      const cells = state.map((on, i) =>
        `<div class="brk${on ? ' on' : ''}" data-i="${i}"><div class="lamp"></div>
         <div class="lever"></div><div class="lbl">${String.fromCharCode(65 + i)}</div></div>`).join('');
      const solved = state.every(Boolean);
      this.openOverlay('breakers', `<div class="panel">
        <div class="panel-head"><div class="panel-title">BREAKER ARRAY</div></div>
        <div class="panel-body">
          <p class="khint">Six relays, cross-wired. Throwing one also throws its neighbours.<br>
          All six lamps must read green.</p>
          <p class="khint"><kbd>&larr;</kbd><kbd>&rarr;</kbd> to choose a relay &middot;
            <kbd>Enter</kbd> to throw it</p>
          <div class="breakers">${cells}</div>
          <p class="khint" style="margin-top:16px;color:${solved ? '#6fae6a' : '#8a8275'}">
            ${solved ? 'LOAD ACCEPTED — POWER RESTORED' : `${state.filter(Boolean).length} of 6 green`}</p>
        </div>
        <div class="panel-foot"><button class="pbtn wide" id="bClose">STEP AWAY</button></div></div>`,
        (root) => {
          root.querySelector('#bClose').onclick = onClose;
          root.querySelectorAll('.brk').forEach(b => b.onclick = () => {
            onToggle(+b.dataset.i);
            render();
            if (state.every(Boolean)) setTimeout(() => { onClose(true); }, 850);
          });
        },
        () => onClose());
    };
    render();
  }

  // ------------------------------------------------------------ screens
  confirm(title, text, okLabel, onOk) {
    this.openOverlay('confirm', `<div class="panel">
      <div class="panel-head"><div class="panel-title">${title}</div></div>
      <div class="panel-body"><p class="khint">${escapeHtml(text)}</p></div>
      <div class="panel-foot">
        <button class="pbtn" id="cOk">${okLabel}</button>
        <button class="pbtn" id="cNo">CANCEL</button></div></div>`,
      (root) => {
        root.querySelector('#cOk').onclick = () => { this.game.closeMenus(); onOk(); };
        root.querySelector('#cNo').onclick = () => this.game.closeMenus();
      });
  }

  openItemBox(game) {
    const render = () => {
      const grid = (arr, size, tag) => {
        let h = '';
        for (let i = 0; i < size; i++) {
          const s = arr[i];
          h += `<div class="slot" data-${tag}="${i}">` +
            (s ? `<img src="${iconFor(s.id)}" alt="">${s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}` : '') + `</div>`;
        }
        return h;
      };
      this.openOverlay('box', `<div class="panel">
        <div class="panel-head"><div class="panel-title">STORAGE TRUNK</div></div>
        <div class="panel-body">
          <p class="khint">Move the cursor with the arrow keys and press <kbd>Enter</kbd>
          to shift an item between your pack and the trunk.</p>
          <p class="khint" style="letter-spacing:.2em;color:#c8a15a">CARRIED</p>
          <div class="slots">${grid(game.inv.slots, game.inv.size, 'inv')}</div>
          <p class="khint" style="letter-spacing:.2em;color:#c8a15a;margin-top:16px">TRUNK</p>
          <div class="slots">${grid(game.box, 12, 'box')}</div>
        </div>
        <div class="panel-foot"><button class="pbtn wide" id="xClose">CLOSE</button></div></div>`,
        (root) => {
          root.querySelector('#xClose').onclick = () => game.closeMenus();
          root.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { game.toBox(+b.dataset.inv); render(); });
          root.querySelectorAll('[data-box]').forEach(b => b.onclick = () => { game.fromBox(+b.dataset.box); render(); });
        });
    };
    render();
  }

  // ------------------------------------------------------------- update
  update(dt) {
    if (this.talking) this.sayTime = (this.sayTime || 0) + dt;
    if (this._roomTimer > 0) {
      this._roomTimer -= dt;
      if (this._roomTimer <= 0) this.el.roomName.classList.remove('show');
    }
    // EKG
    this.ekgT += dt;
    const c = this.ekgCtx, W = 132, H = 30;
    c.clearRect(0, 0, W, H);
    const frac = this.game.hp / this.game.maxHp;
    const col = frac > 0.62 ? '#6fae6a' : frac > 0.3 ? '#c8a15a' : '#d24a3a';
    const rate = frac > 0.62 ? 1.0 : frac > 0.3 ? 1.5 : 2.3;
    c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath();
    for (let x = 0; x < W; x++) {
      const t = (x / W) * 3 - this.ekgT * rate;
      const p = ((t % 3) + 3) % 3;
      let y = H / 2;
      if (frac > 0) {
        if (p < 0.16) y -= Math.sin(p / 0.16 * Math.PI) * 2.5;
        else if (p < 0.3) y += Math.sin((p - 0.16) / 0.14 * Math.PI) * 3;
        else if (p < 0.42) y -= Math.sin((p - 0.3) / 0.12 * Math.PI) * (H * 0.42) * (frac > 0.3 ? 1 : 0.7);
        else if (p < 0.52) y += Math.sin((p - 0.42) / 0.1 * Math.PI) * 5;
        if (frac <= 0.3) y += Math.sin(x * 1.7 + this.ekgT * 9) * 1.2;
      }
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
}

// Everything the keyboard cursor may land on. Slots and breaker levers are
// divs with click handlers rather than buttons, so they are named too.
const FOCUSABLE = 'button:not([disabled]), .slot, .brk';
const FOCUS_ANY = 'button, .slot, .brk';

function q(sel) { return document.querySelector(sel); }
function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
// A stable name for an element, so the cursor survives a re-render. It has
// to ignore class names: a slot picks up `sel` the moment the cursor lands
// on it, and that must not make it a different slot.
function navKey(el) {
  const d = el.dataset || {};
  for (const k of ['i', 't', 'k', 'f', 'inv', 'box']) {
    if (d[k] !== undefined) return k + ':' + d[k];
  }
  return 'el:' + (el.id || '') + '|' + el.textContent.trim();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
export function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = Math.floor(sec) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
