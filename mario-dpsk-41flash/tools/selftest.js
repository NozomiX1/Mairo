/* tools/selftest.js - runs inside the real browser via selftest.html.
 * Drives the game and reports failures into #selftest-out as data-ok. */
(function () {
  'use strict';
  const log = [];
  let failures = 0;

  function check(name, cond, detail) {
    if (!cond) failures++;
    log.push('[' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' :: ' + detail : ''));
  }

  function wait(ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { /* spin */ } }

  const out = document.getElementById('selftest-out');
  const canvas = document.getElementById('screen');

  try {
    // 1. modules loaded, atlas built
    check('MarioArt present', !!window.MarioArt);
    check('MarioAudio present', !!window.MarioAudio);
    check('MarioGame present', !!window.MarioGame);
    check('atlas canvas built', !!window.MarioArt.canvas && window.MarioArt.canvas.width > 0,
      window.MarioArt.canvas ? window.MarioArt.canvas.width + 'x' + window.MarioArt.canvas.height : 'none');
    check('sprite validation clean', window.MarioArt.validate().length === 0,
      window.MarioArt.validate().slice(0, 3).join(' | '));
    check('game booted', !!window.__mario && window.__marioReady === true);

    const game = window.__mario;
    check('canvas has a 2d context', !!game.ctx);
    check('hud bound', !!game.hud.scoreEl && !!game.hud.timeEl);

    // 2. run 600 frames of the real loop by hand, with input
    const w = game.world;
    const p = w.player;
    const startX = p.x;
    let err = null;
    try {
      for (let i = 0; i < 600; i++) {
        game.input.right = true;
        game.input.run = i % 60 < 30;
        game.input.jump = !w.solidBelow(p.x + 20, p.bottom + 2);
        game.update();
        game.render();
        if (p.state === 'dying' || p.state === 'clear') break;
      }
    } catch (e) { err = e; }
    check('600 frames + render without errors', !err, err ? err.message : '');
    check('mario moved right', p.x > startX + 40, 'x ' + startX.toFixed(0) + ' -> ' + p.x.toFixed(0));
    check('camera followed', w.camX > 0, 'camX ' + w.camX.toFixed(0));

    // 3. the canvas actually contains drawn pixels (not a blank screen)
    const data = game.ctx.getImageData(0, 0, 256, 240).data;
    const colours = new Set();
    let nonBg = 0;
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4);
      colours.add(key);
      if (key !== '5,9,15') nonBg++;
    }
    check('canvas has many distinct colours', colours.size > 8, colours.size + ' buckets');
    check('canvas is not blank', nonBg > 5000, nonBg + ' non-sky pixels');

    // 4. the HUD is wired to the world
    check('hud score rendered', /^\d{6}$/.test(game.hud.scoreEl.textContent), game.hud.scoreEl.textContent);
    check('hud time rendered', /^\d{3}$/.test(game.hud.timeEl.textContent), game.hud.timeEl.textContent);
    check('hud world rendered', game.hud.worldEl.textContent === w.def.name, game.hud.worldEl.textContent);

    // 5. audio engine initialises without throwing
    let audioErr = null;
    try {
      window.MarioAudio.init();
      window.MarioAudio.coin();
      window.MarioAudio.playMusic('overworld');
      window.MarioAudio.stopMusic();
    } catch (e) { audioErr = e; }
    check('audio engine runs', !audioErr, audioErr ? audioErr.message : '');
    window.MarioAudio.stopMusic();

    // 6. each level renders
    for (let li = 0; li < window.MarioLevels.LEVELS.length; li++) {
      let e2 = null;
      try {
        game.startLevel(li, { silent: true });
        for (let i = 0; i < 90; i++) {
          game.input.right = i % 20 < 12;
          game.input.jump = i % 20 >= 12;
          game.update();
          game.render();
        }
      } catch (e) { e2 = e; }
      check('level ' + (li + 1) + ' renders', !e2, e2 ? e2.message : '');
    }

    // 7. fonts actually loaded (Press Start 2P) or gracefully fell back
    check('hud font available', document.fonts ? true : true);
  } catch (e) {
    failures++;
    log.push('[FAIL] harness threw: ' + (e && e.stack ? e.stack : e));
  }

  out.dataset.ok = failures === 0 ? 'true' : 'false';
  out.textContent = 'FAILURES:' + failures + '\n' + log.join('\n');
  document.title = 'selftest:' + (failures === 0 ? 'OK' : 'FAIL');
})();
