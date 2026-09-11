/* =============================================================================
 * main.js - bootstrap: atlas, input, fixed-timestep loop.
 * ========================================================================== */
(function () {
  'use strict';

  const Art = window.MarioArt;
  const Audio = window.MarioAudio;
  const G = window.MarioGame;

  /* ----------------------------------------------------------- build atlas */
  const problems = Art.validate();
  if (problems.length) console.warn('sprite problems:', problems);
  Art.build();

  /* ---------------------------------------------------------------- canvas */
  const canvas = document.getElementById('screen');
  const game = new G.Game(canvas);
  window.__mario = game; // handy for debugging / automated tests

  /* ----------------------------------------------------------------- input */
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyJ: 'run'
  };

  function setKey(code, down) {
    const action = KEYMAP[code];
    if (!action) return false;
    game.input[action] = down;
    if (action === 'jump' && down) game.input.fire = true;
    if (action === 'jump' && !down) game.input.fire = false;
    return true;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) {
      if (KEYMAP[e.code]) e.preventDefault();
      return;
    }
    Audio.resume();
    if (setKey(e.code, true)) e.preventDefault();

    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      handleConfirm();
    }
    if (e.code === 'KeyP') {
      game.pausedByUser = !game.pausedByUser;
      Audio.duckMusic(game.pausedByUser);
    }
    if (e.code === 'KeyM') {
      Audio.setMuted(!Audio.muted);
    }
    if (e.code === 'KeyR') {
      if (game.state === 'playing' || game.state === 'clear') game.loseLife();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (setKey(e.code, false)) e.preventDefault();
  });

  window.addEventListener('blur', () => {
    for (const k of Object.keys(game.input)) game.input[k] = false;
  });

  function handleConfirm() {
    Audio.resume();
    if (game.state === 'clear') {
      if (game.pendingClear) game.nextLevel();
      return;
    }
    if (game.state === 'gameover') {
      game.restartGame();
      return;
    }
    if (!Audio._curSong) game.world.startMusic();
  }

  /* ----------------------------------------------------------- touch input */
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch-enabled');

  for (const btn of document.querySelectorAll('[data-key]')) {
    const key = btn.getAttribute('data-key');
    const press = (down) => (ev) => {
      ev.preventDefault();
      Audio.resume();
      btn.classList.toggle('active', down);
      if (key === 'jump') {
        game.input.jump = down;
        game.input.fire = down;
      } else if (key === 'run') {
        game.input.run = down;
      } else {
        game.input[key] = down;
      }
    };
    btn.addEventListener('touchstart', press(true), { passive: false });
    btn.addEventListener('touchend', press(false), { passive: false });
    btn.addEventListener('touchcancel', press(false), { passive: false });
    btn.addEventListener('mousedown', press(true));
    btn.addEventListener('mouseup', press(false));
    btn.addEventListener('mouseleave', press(false));
  }

  canvas.addEventListener('pointerdown', () => {
    Audio.resume();
    if (game.state === 'clear' || game.state === 'gameover') handleConfirm();
    else if (!Audio._curSong) game.world.startMusic();
  });

  /* ------------------------------------------------------------ game loop */
  const STEP_MS = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  let hudTick = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let delta = now - last;
    last = now;
    if (delta > 250) delta = STEP_MS;   // tab was hidden: do not fast-forward
    acc += delta;

    let steps = 0;
    while (acc >= STEP_MS && steps < 5) {
      acc -= STEP_MS;
      steps++;
      if (!game.pausedByUser) game.update();
    }
    game.render();
  }

  requestAnimationFrame(frame);

  /* Show a welcome overlay so the first click can unlock audio. */
  game.showOverlay('SUPER MARIO', [
    'CANVAS EDITION',
    '',
    '&#8592; &#8594; MOVE &nbsp; SPACE JUMP',
    'SHIFT RUN / FIRE &nbsp; &#8595; CROUCH',
    '',
    '<span class="blink">PRESS ENTER TO START</span>'
  ]);
  window.__marioReady = true;
})();
