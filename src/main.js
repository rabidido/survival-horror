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

  // A fullscreen request is only granted from a gesture, and browsers refuse
  // it often enough that it needs a button of its own. iOS Safari has no
  // element fullscreen at all, so there we point at Add to Home Screen, which
  // launches the manifest's fullscreen display mode instead.
  const el = document.documentElement;
  const canFull = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const standalone = matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const btnFull = document.getElementById('btnFull');
  const iosHint = document.getElementById('iosHint');
  const isTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  if (!standalone) {
    if (canFull) {
      btnFull.classList.remove('hidden');
      btnFull.onclick = () => {
        const fs = el.requestFullscreen || el.webkitRequestFullscreen;
        try {
          const p = fs.call(el);
          if (p && p.catch) p.catch(() => {});
        } catch (e) { /* refused */ }
      };
    } else if (isTouch) {
      iosHint.classList.remove('hidden');
    }
  }
  const syncFull = () => {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btnFull.textContent = on ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    if (on) btnFull.onclick = () => (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  };
  addEventListener('fullscreenchange', syncFull);
  addEventListener('webkitfullscreenchange', syncFull);

  // wording depends on whether there is a device to turn
  const rt = document.getElementById('rotateText');
  if (rt && !matchMedia('(pointer: coarse)').matches) {
    rt.textContent = 'Ashgrove Manor is played in landscape. Make the window wider than it is tall.';
  }

  loop();
}

function showHelp() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const rows = touch ? [
    ['Pad up', 'Walk forward'],
    ['Pad down', 'Back away, slowly'],
    ['Pad left/right', 'Turn on the spot'],
    ['Pad corners', 'Walk and turn at once \u2014 the corner wedges are the widest'],
    ['RUN', 'Hold to run'],
    ['RUN + down', 'Quick turn \u2014 spin 180\u00b0'],
    ['ACT', 'Examine, take, open doors, advance dialogue'],
    ['AIM', 'Hold to raise your weapon and lock on'],
    ['FIRE', 'Shoot or swing while aiming'],
    ['BAG', 'Inventory, documents and status'],
  ] : [
    ['W / Up', 'Walk forward'],
    ['S / Down', 'Back away, slowly'],
    ['A D / Left Right', 'Turn on the spot'],
    ['Shift', 'Run'],
    ['Shift + Down', 'Quick turn \u2014 spin 180\u00b0'],
    ['E / Enter', 'Examine, take, open doors, advance dialogue'],
    ['Space', 'Hold to aim'],
    ['J / X', 'Fire or swing'],
    ['Q', 'Switch weapon'],
    ['I / Tab', 'Inventory'],
    ['Esc', 'Status screen'],
  ];
  game.ui.openOverlay('help', `<div class="panel">
    <div class="panel-head"><div class="panel-title">CONTROLS</div></div>
    <div class="panel-body help"><dl>
      ${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}
    </dl>
    <p class="khint" style="margin-top:18px">You steer yourself, not the camera: left and right
    turn you on the spot, forward walks the way you face.<br>
    Ammunition is finite. The knife never runs out, but it will cost you blood.<br>
    Save at the typewriter in the Keeper&rsquo;s Office.</p></div>
    <div class="panel-foot"><button class="pbtn wide" id="hClose">BACK</button></div></div>`,
    (root) => { root.querySelector('#hClose').onclick = () => game.ui.closeOverlay(); });
}

// A thrown frame used to vanish into the console, which on a phone means it
// vanishes entirely: the game just stops responding with nothing to report.
let errorShown = false;
function showError(err) {
  if (errorShown) return;
  errorShown = true;
  const d = document.createElement('div');
  d.id = 'errbar';
  d.textContent = String((err && err.message) || err);
  d.title = 'tap to dismiss';
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
let touchCount = 0;
if (dbg) addEventListener('touchstart', () => { touchCount++; }, { passive: true, capture: true });
function updateDebug() {
  const g = game;
  dbg.textContent = [
    `${innerWidth}x${innerHeight} dpr${(devicePixelRatio || 1).toFixed(1)} ${fps}fps`,
    `mode=${g.mode} gated=${!!g.gated}`,
    `touchMode=${g.touchMode} touches=${touchCount}`,
    `touchUI=${!document.getElementById('touch').classList.contains('hidden')}`,
    `coarse=${matchMedia('(pointer: coarse)').matches} maxPts=${navigator.maxTouchPoints || 0}`,
    `stick=${g.input.stick.active ? g.input.stick.x.toFixed(2) + ',' + g.input.stick.y.toFixed(2) : 'off'}`,
    `move=${g.input.move.x.toFixed(2)},${g.input.move.y.toFixed(2)} sp=${g.player.speed.toFixed(2)}`,
    `pos=${g.player.x.toFixed(1)},${g.player.z.toFixed(1)} room=${g.roomId || '-'}`,
  ].join('\n');
}

// Keep the canvas correct when the mobile URL bar shows/hides.
let lastH = innerHeight;
setInterval(() => {
  if (innerHeight !== lastH) { lastH = innerHeight; game && game.resize(); }
}, 500);

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

boot();
