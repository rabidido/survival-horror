import { Game } from './game.js';

const canvas = document.getElementById('gl');
let game;

function boot() {
  try {
    game = new Game(canvas);
  } catch (err) {
    document.getElementById('title').innerHTML =
      `<div class="title-inner"><h1>NO SIGNAL</h1>
       <p class="title-blurb">This browser could not start WebGL.<br>
       Try a recent Chrome, Firefox or Safari with hardware acceleration enabled.</p>
       <p class="title-foot">${String(err && err.message || err)}</p></div>`;
    throw err;
  }
  window.game = game;

  const btnNew = document.getElementById('btnNew');
  const btnContinue = document.getElementById('btnContinue');
  const btnHelp = document.getElementById('btnHelp');
  btnContinue.disabled = !Game.hasSave();

  btnNew.onclick = () => game.start(false);
  btnContinue.onclick = () => game.start(true);
  btnHelp.onclick = () => showHelp();

  // F11 does this too, but the game is played borderless and the button is
  // the discoverable way in. A request is only granted from inside a real
  // click handler, which is why there is a button rather than a call on boot.
  const el = document.documentElement;
  const btnFull = document.getElementById('btnFull');
  const canFull = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (canFull) {
    btnFull.classList.remove('hidden');
    btnFull.onclick = () => {
      try {
        if (isFull()) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          exit.call(document);
          return;
        }
        const fs = el.requestFullscreen || el.webkitRequestFullscreen;
        const p = fs.call(el);
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* refused */ }
    };
  }
  const syncFull = () => { btnFull.textContent = isFull() ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; };
  addEventListener('fullscreenchange', syncFull);
  addEventListener('webkitfullscreenchange', syncFull);

  // The title screen is driven with the keyboard like everything else.
  game.ui.handleNav(game.input);

  loop();
}

function showHelp() {
  const rows = [
    ['<kbd>W</kbd> <kbd>&uarr;</kbd>', 'Walk forward'],
    ['<kbd>S</kbd> <kbd>&darr;</kbd>', 'Back away, slowly'],
    ['<kbd>A</kbd> <kbd>D</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd>', 'Turn on the spot'],
    ['<kbd>Shift</kbd>', 'Hold to run'],
    ['<kbd>Shift</kbd> + <kbd>S</kbd>', 'Quick turn \u2014 spin 180\u00b0'],
    ['<kbd>E</kbd> <kbd>Enter</kbd>', 'Examine, take, open doors, advance dialogue'],
    ['<kbd>Space</kbd>', 'Hold to raise your weapon; it locks on to the nearest target'],
    ['<kbd>J</kbd> <kbd>X</kbd> <kbd>Ctrl</kbd>', 'Fire or swing while the weapon is up'],
    ['<kbd>Q</kbd>', 'Switch between handgun and knife'],
    ['<kbd>I</kbd> <kbd>Tab</kbd>', 'Inventory, documents and status'],
    ['<kbd>Esc</kbd>', 'Status screen, and back out of any menu'],
    ['<kbd>F11</kbd>', 'Fullscreen'],
  ];
  game.ui.openOverlay('help', `<div class="panel">
    <div class="panel-head"><div class="panel-title">CONTROLS</div></div>
    <div class="panel-body help"><dl>
      ${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}
    </dl>
    <p class="khint" style="margin-top:22px">You steer yourself, not the camera: left and right
    turn you on the spot, forward walks the way you face.<br>
    Every menu is driven with the arrow keys and <kbd>Enter</kbd>.<br>
    Ammunition is finite. The knife never runs out, but it will cost you blood.<br>
    Save at the typewriter in the Keeper&rsquo;s Office.</p></div>
    <div class="panel-foot"><button class="pbtn wide" id="hClose">BACK</button></div></div>`,
    (root) => { root.querySelector('#hClose').onclick = () => game.ui.closeOverlay(); },
    () => game.ui.closeOverlay());
}

// A thrown frame used to vanish into the console: the game would just stop
// responding, with nothing on screen to say why.
let errorShown = false;
function showError(err) {
  if (errorShown) return;
  errorShown = true;
  const d = document.createElement('div');
  d.id = 'errbar';
  d.textContent = String((err && err.message) || err);
  d.title = 'click to dismiss';
  d.onclick = () => d.remove();
  document.body.appendChild(d);
}
addEventListener('error', (e) => showError(e.error || e.message));
addEventListener('unhandledrejection', (e) => showError(e.reason));

let frames = 0, fpsAt = performance.now(), fps = 0;
function loop() {
  requestAnimationFrame(loop);
  try {
    game.update();
  } catch (err) {
    console.error(err);
    showError(err);
  }
  frames++;
  const now = performance.now();
  if (now - fpsAt >= 500) { fps = Math.round(frames * 1000 / (now - fpsAt)); frames = 0; fpsAt = now; }
  if (dbg) updateDebug();
}

// ?debug prints live state, so a problem on a device I cannot reach can be
// reported as facts rather than guessed at.
const dbg = new URLSearchParams(location.search).has('debug')
  ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'dbg' })
  : null;
function updateDebug() {
  const g = game;
  dbg.textContent = [
    `${innerWidth}x${innerHeight} dpr${(devicePixelRatio || 1).toFixed(1)} ${fps}fps`,
    `mode=${g.mode} gated=${!!g.gated} overlay=${g.ui.overlayOpen || '-'}`,
    `keys=${Array.from(g.input.keys).join(' ') || '-'}`,
    `run=${g.input.runHeld} aim=${g.input.aimHeld}`,
    `move=${g.input.move.x},${g.input.move.y} sp=${g.player.speed.toFixed(2)}`,
    `pos=${g.player.x.toFixed(1)},${g.player.z.toFixed(1)} room=${g.roomId || '-'}`,
  ].join('\n');
}

boot();
