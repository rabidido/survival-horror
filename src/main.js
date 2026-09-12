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
    ['Stick up', 'Walk forward. Push fully forward to run.'],
    ['Stick down', 'Back away, slowly'],
    ['Stick left/right', 'Turn on the spot'],
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

function loop() {
  requestAnimationFrame(loop);
  try {
    game.update();
  } catch (err) {
    console.error(err);
  }
}

// Keep the canvas correct when the mobile URL bar shows/hides.
let lastH = innerHeight;
setInterval(() => {
  if (innerHeight !== lastH) { lastH = innerHeight; game && game.resize(); }
}, 500);

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

boot();
