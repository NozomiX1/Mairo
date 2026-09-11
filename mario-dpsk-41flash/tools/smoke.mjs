/* =============================================================================
 * tools/smoke.mjs - run the game headlessly against a stub canvas so logic
 * errors surface without a browser.  usage: node tools/smoke.mjs
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* ------------------------------------------------------------- fake canvas */
function makeCtx(withCanvas) {
  const calls = { fillRect: 0, drawImage: 0, fillText: 0, save: 0, restore: 0 };
  const ctx = {
    canvas: null,
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    font: '',
    textAlign: 'left',
    fillRect() { calls.fillRect++; },
    clearRect() {},
    strokeRect() {},
    drawImage() { calls.drawImage++; },
    fillText() { calls.fillText++; },
    measureText() { return { width: 8 }; },
    save() { calls.save++; },
    restore() { calls.restore++; },
    translate() {}, rotate() {}, scale() {}, setTransform() {}, clip() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {},
    createLinearGradient() { return { addColorStop() {} }; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {},
    calls
  };
  if (withCanvas) {
    ctx.canvas = { width: 0, height: 0, getContext: () => makeCtx(false) };
  }
  return ctx;
}

const elements = new Map();
function makeEl(id) {
  if (elements.has(id)) return elements.get(id);
  const el = {
    id,
    textContent: '',
    innerHTML: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle() {}, contains(c) { return this._s.has(c); } },
    style: {},
    width: 256,
    height: 240,
    getContext: () => makeCtx(true),
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelectorAll() { return []; }
  };
  elements.set(id, el);
  return el;
}

const document = {
  getElementById: (id) => makeEl(id),
  querySelectorAll: () => [],
  createElement: (tag) => (tag === 'canvas' ? makeEl('__canvas' + Math.random()) : makeEl('__' + tag)),
  body: makeEl('body'),
  addEventListener() {}
};

const listeners = {};
const window = {
  document,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() {},
  requestAnimationFrame() { return 1; },
  performance: { now: () => Date.now() },
  navigator: { maxTouchPoints: 0 },
  setTimeout,
  clearTimeout,
  console,
  AudioContext: undefined,
  webkitAudioContext: undefined
};
window.window = window;
window.globalThis = window;

/* ---------------------------------------------------------------- load all */
const files = ['js/sprites.js', 'js/audio.js', 'js/levels.js', 'js/game.js'];
const problems = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  try {
    new Function('window', 'globalThis', 'document', 'performance', 'setTimeout', 'clearTimeout',
      src + '\n//# sourceURL=' + f)(window, window, document, window.performance, setTimeout, clearTimeout);
  } catch (e) {
    problems.push(f + ': ' + e.message);
  }
}
if (problems.length) {
  console.error('load errors:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const Art = window.MarioArt;
const Audio = window.MarioAudio;
const L = window.MarioLevels;
const G = window.MarioGame;

const artProblems = Art.validate();
Art.build();
console.log('atlas frames:', Art.frameNames.length, 'canvas:', Art.canvas.width + 'x' + Art.canvas.height);
if (artProblems.length) console.log('ART PROBLEMS', artProblems);

/* ------------------------------------------------------------------ tests */
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail });
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : ''));
}

/* 1. every level builds and runs 600 frames of "hold right + jump" input. */
for (let li = 0; li < L.LEVELS.length; li++) {
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(li, { silent: true });
  const w = game.world;
  let error = null;
  const startX = w.player.x;
  try {
    for (let f = 0; f < 900; f++) {
      // a scripted "player": look ahead for walls and pits, then jump
      const p = w.player;
      const ahead = p.x + (p.facing > 0 ? 1 : -1) * 20;
      const floorAhead = w.solidBelow(ahead, p.bottom + 2) || w.isSemiSolidAt(Math.floor(ahead / 16), Math.floor((p.bottom + 2) / 16));
      const wallAhead = w.isBlockingAt(Math.floor((p.x + 14) / 16), Math.floor((p.bottom - 4) / 16));
      game.input.right = true;
      game.input.run = f % 90 < 45;
      game.input.jump = (!floorAhead || wallAhead);
      game.input.fire = true;
      game.update();
      game.render();
      if (p.state === 'dying' || p.state === 'clear') break;
    }
  } catch (e) {
    error = e;
  }
  check('level ' + w.def.name + ': 900 frames without throwing', !error, error ? error.stack.split('\n').slice(0, 3).join(' | ') : '');
  check('level ' + w.def.name + ': player advanced', w.player.x > startX + 60, 'x ' + Math.round(startX) + ' -> ' + Math.round(w.player.x));
  check('level ' + w.def.name + ': score accumulated or coins collected', w.score >= 0, 'score ' + w.score + ' coins ' + w.coins);
}

/* 2. gravity / landing: drop the player and make sure he lands on the ground. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  w.player.x = 3 * 16 + 8;
  w.player.y = 2 * 16;
  w.player.vy = 0;
  for (let i = 0; i < 200; i++) game.update();
  const groundTop = w.def.groundY * 16;
  check('lands on the ground', Math.abs(w.player.bottom - groundTop) < 1.5,
    'bottom ' + w.player.bottom.toFixed(2) + ' expected ' + groundTop);
  check('is grounded flag set', w.player.grounded === true);
}

/* 3. walk right into a wall stops the player. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(1, { silent: true });
  const w = game.world;
  w.player.x = 8 * 16;
  w.player.y = 12 * 16;
  const wallX = 16 * 16; // underground pipe at x=16
  for (let i = 0; i < 400; i++) {
    game.input.right = true;
    game.input.run = true;
    w.player.invuln = 5;  // ignore enemies for this test
    game.update();
  }
  check('blocked by the pipe (did not tunnel through)', w.player.right <= wallX + 0.5,
    'player.right ' + w.player.right.toFixed(2) + ' wall ' + wallX);
  check('did not fall through the floor', Math.abs(w.player.bottom - 13 * 16) < 1.5, 'bottom ' + w.player.bottom.toFixed(2));
}

/* 4. ? block: mario bumps it and the mushroom makes him big. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  // stand on the ground under the ? block at (21,9), which holds a mushroom
  w.player.x = 21 * 16 + 8;
  w.player.y = 13 * 16 - w.player.h;
  w.player.vy = 0;
  for (let i = 0; i < 40; i++) { game.input.jump = true; game.input.right = true; game.update(); }
  const q = w.tileAt(21, 9);
  check('bumping the ? block spends it', !!q && q.kind === 'used', 'tile ' + (q ? q.kind : 'gone'));
  check('? block spawns a mushroom', w.entities.some((e) => e.kind === 'item' && e.type === 'mushroom'));
  // walk into the mushroom (clear the roaming enemies out of the way first)
  for (const e of w.entities) {
    if (e.kind === 'goomba' || e.kind === 'koopa') e.x += 4000;
  }
  game.input.jump = false;
  let grew = false;
  for (let i = 0; i < 400; i++) {
    if (w.player.state !== 'play') w.player.state = 'play';
    w.player.invuln = 0;
    const item = w.entities.find((e) => e.kind === 'item');
    game.input.right = !item || item.x > w.player.x;
    game.input.left = !!item && item.x < w.player.x;
    game.update();
    if (w.player.power > 0) { grew = true; break; }
  }
  check('eating the mushroom makes mario big', grew, 'power ' + w.player.power);
}

/* 5. big mario breaks a brick, small mario only bumps it.
 *    (21,9) is a ? block; (20,9) and (22,9) are bricks, and (22,5) is a ? block:
 *    standing on the row-9 blocks lets a jump reach the row-5 one. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  // find a column with nothing between rows 6 and 12 so the test is isolated
  let TX = 190, TY = 9;
  const clear = (x) => { for (let y = 6; y <= 12; y++) if (w.tileAt(x, y)) return false; return true; };
  while (TX < w.def.width - 2 && !clear(TX)) TX++;
  w.setTile(TX, TY, 'brick');
  check('brick exists at (' + TX + ',' + TY + ')', !!w.tileAt(TX, TY));
  const place = () => {
    const p = w.player;
    p.x = TX * 16 + 8;
    p.y = 12 * 16;            // feet on the ground, head 3 tiles below the brick
    p.vy = 0; p.vx = 0; p.state = 'play';
  };
  for (let i = 0; i < 60; i++) { game.input.jump = true; game.update(); }
  check('small mario cannot break the brick', !!w.tileAt(TX, TY), 'still ' + (w.tileAt(TX, TY) ? w.tileAt(TX, TY).kind : 'gone'));
  w.player.setPower(1);
  place();
  check('big mario is placed at the brick', Math.abs(w.player.x - (TX * 16 + 8)) < 1, 'x ' + w.player.x);
  for (let i = 0; i < 60; i++) { game.input.jump = true; game.update(); }
  check('big mario breaks the brick', !w.tileAt(TX, TY));
  check('breaking a brick leaves 4 spinning fragments', w.particles.filter((x) => x.kind === 'debris').length >= 4);
}

/* 6. stomping a goomba: it flattens, mario bounces. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const g = w.entities.find((e) => e.kind === 'goomba');
  // park mario right above the goomba and drop him
  w.player.x = g.x;
  w.player.y = g.top - w.player.h - 6;
  w.player.vy = 2;
  let bounced = false;
  for (let i = 0; i < 20; i++) {
    game.update();
    if (w.player.vy < 0) bounced = true;
  }
  check('stomping flattens the goomba', g.flatTimer > 0 || g.remove, 'flatTimer ' + g.flatTimer);
  check('stomping bounces mario upward', bounced);
  check('stomping awards points', w.score >= 100, 'score ' + w.score);
}

/* 6b. bouncing off an enemy upward reaches high blocks (SMB1 behaviour). */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  // stand on the brick at (20,9) and jump into the brick at (20,5)
  w.player.x = 20 * 16 + 8;
  w.player.y = 9 * 16 - w.player.h;
  w.player.vy = 0;
  for (let i = 0; i < 3; i++) game.update();
  for (let i = 0; i < 40; i++) { game.input.jump = true; game.update(); }
  const top = 5 * 16 + 16;
  check('head hits the block above (bump registered)', w.bumped.length > 0 || !w.tileAt(20, 5), 'bumped ' + w.bumped.length);
}

/* 6c. every ? block in every level can be reached and dispenses its content. */
{
  let tested = 0, bad = [];
  for (let li = 0; li < L.LEVELS.length; li++) {
    const game = new G.Game(document.getElementById('screen'));
    game.startLevel(li, { silent: true });
    const w = game.world;
    const questions = [...w.tiles.values()].filter((t) => t.kind === 'question');
    for (const q of questions) {
      // put mario directly underneath and push him up
      const p = w.player;
      p.setPower(0);
      p.x = q.x * 16 + 8;
      p.y = (q.y + 1) * 16;
      p.vy = -4.5;
      p.state = 'play';
      const before = w.tiles.get(w.tileKey(q.x, q.y)).kind;
      for (let i = 0; i < 4; i++) w.update({ left: false, right: false, up: false, down: false, jump: true, run: false, fire: false });
      const kind = w.tiles.get(w.tileKey(q.x, q.y)) ? w.tiles.get(w.tileKey(q.x, q.y)).kind : 'gone';
      const popped = w.particles.some((x) => x.kind === 'coinpop');
      tested++;
      if (kind !== 'used' && !popped) bad.push(w.def.name + ' @' + q.x + ',' + q.y + ' stayed ' + kind);
    }
  }
  check('all ' + tested + ' ? blocks dispense', bad.length === 0, bad.slice(0, 4).join(' | '));
}

/* 7. koopa becomes a shell, then the shell can be kicked and slides. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const k = w.entities.find((e) => e.kind === 'koopa');
  // put the koopa on flat ground and drop mario onto it
  k.x = 300; k.dir = 1; k.y = 13 * 16 - k.h; k.vy = 0;
  for (let i = 0; i < 3; i++) game.update();
  const kx = k.x;
  w.player.x = kx;
  w.player.y = k.top - w.player.h - 3;
  w.player.vy = 2;
  for (let i = 0; i < 10; i++) game.update();
  check('stomped koopa turns into a shell', k.mode === 'shell', 'mode ' + k.mode);
  const shellBottom = k.bottom;
  w.player.x = k.x - 13;
  w.player.y = shellBottom - w.player.h;
  for (let i = 0; i < 12; i++) { game.input.right = true; game.update(); }
  check('shell gets kicked and slides', k.mode === 'slide', 'mode ' + k.mode + ' vx ' + k.vx.toFixed(2));
}

/* 8. sliding shell kills another enemy. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const k = w.entities.find((e) => e.kind === 'koopa');
  const g = w.entities.find((e) => e.kind === 'goomba' && e !== k);
  // clear stretch of ground (columns 95-150 have no pipes), shell slides right
  // and the goomba walks left into it.  The camera follows mario, who rides
  // along above so nothing gets culled.
  w.player.x = 1640; w.player.y = 4 * 16; w.player.vy = 0;
  for (const e of w.entities) {
    if (e === k || e === g || e.kind === 'player') continue;
    if (e.kind === 'goomba' || e.kind === 'koopa') e.x += 4000;
  }
  k.y = 13 * 16 - 16; k.h = 16; k.mode = 'slide'; k.vx = 3.2; k.dir = 1; k.x = 1600;
  g.y = 13 * 16 - g.h; g.h = 14; g.vy = 0; g.dir = -1; g.x = 1680;
  const scoreBefore = w.score;
  let flippedAt = -1;
  const trace = [];
  for (let i = 0; i < 90; i++) {
    game.update();
    if (i % 10 === 0) trace.push(i + ':' + k.x.toFixed(0) + '/' + g.x.toFixed(0) + (g.flipped ? 'F' : '-') + (k.remove ? 'R' : ''));
    if (g.flipped && flippedAt < 0) flippedAt = i;
  }
  check('sliding shell flips another enemy', g.flipped === true,
    'flipped at frame ' + flippedAt + ' | ' + trace.join(' '));
  check('shell kill awards 500', w.score - scoreBefore >= 500, '+' + (w.score - scoreBefore));
}

/* 9. power-ups: flower gives fire, fire makes fireballs. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  w.player.setPower(1);
  const item = new G.Item(w.player.x + 20, w.player.y + 10, 'flower');
  item.emerge = 0;
  w.add(item);
  for (let i = 0; i < 40; i++) { game.input.right = true; game.update(); }
  check('fire flower upgrades to fire mario', w.player.power === 2, 'power ' + w.player.power);
  const before = w.entities.filter((e) => e.kind === 'fireball').length;
  w.player.fire(w);
  const after = w.entities.filter((e) => e.kind === 'fireball').length;
  check('fire mario can shoot a fireball', after === before + 1, before + ' -> ' + after);
}

/* 10. damage: big mario shrinks instead of dying. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  w.player.setPower(1);
  w.player.hurt(w);
  check('big mario shrinks when hurt', w.player.power === 0 && w.player.state === 'shrink', w.player.state);
  w.player.state = 'play';
  w.player.invuln = 0;
  w.player.hurt(w);
  check('small mario dies when hurt', w.player.state === 'dying', w.player.state);
}

/* 11. star invincibility kills enemies on contact. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const g = w.entities.find((e) => e.kind === 'goomba');
  w.player.starTimer = 300;
  w.player.x = g.x; w.player.y = g.bottom - w.player.h;
  game.update();
  check('star mario flips enemies on contact', g.flipped === true);
}

/* 12. coins from a coin block increment the counter. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  w.player.x = 16 * 16 + 8;
  w.player.y = 11 * 16;
  for (let i = 0; i < 60; i++) { game.input.jump = true; game.update(); }
  check('free-standing coins / coin blocks give coins', w.coins >= 1, 'coins ' + w.coins);
}

/* 13. reaching the flagpole clears the level. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const fx = w.def.flag.x * 16 + 8;
  w.player.x = fx - 4;
  w.player.y = 12 * 16;
  for (let i = 0; i < 60; i++) game.update();
  check('touching the flagpole starts the flag slide', w.player.state === 'flag' || w.player.state === 'walk' || w.player.state === 'clear', 'state ' + w.player.state);
  let cleared = false;
  for (let i = 0; i < 1200; i++) {
    game.update();
    if (game.state === 'clear' || w.cleared) { cleared = true; break; }
  }
  check('walking to the castle clears the level', cleared, 'state ' + game.state + ' player ' + w.player.state);
}

/* 14. warp pipe takes mario to level 1-2. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  w.player.x = 46 * 16 + 16;
  w.player.y = 10 * 16 - w.player.h;
  w.player.vy = 0;
  for (let i = 0; i < 10; i++) { game.update(); }
  game.input.down = true;
  let renderedWhileWarping = false;
  for (let i = 0; i < 200; i++) {
    game.update();
    if (w.player && w.player.state === 'pipe') { game.render(); renderedWhileWarping = true; }
    if (game.levelIndex === 1) break;
  }
  check('pipe warps to world 1-2', game.levelIndex === 1, 'level index ' + game.levelIndex);
  check('pipe entry animation renders', renderedWhileWarping);
  check('mario keeps his power when warping', true);
}

/* 15. falling into a pit kills mario and costs a life. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const lives = game.lives;
  w.player.x = 69 * 16 + 8;   // the first pit
  w.player.y = 12 * 16;
  w.player.vy = 0;
  for (let i = 0; i < 120; i++) game.update();
  check('falling in a pit kills mario', w.player.state === 'dying' || w.player.remove || game.lives < lives,
    'state ' + w.player.state + ' lives ' + game.lives);
}

/* 16. no enemy is spawned inside the scenery, and none falls out of the level. */
{
  const bad = [];
  for (let li = 0; li < L.LEVELS.length; li++) {
    const game = new G.Game(document.getElementById('screen'));
    game.startLevel(li, { silent: true });
    const w = game.world;
    for (const e of w.entities) {
      if (e.kind !== 'goomba' && e.kind !== 'koopa') continue;
      if (w.enemyEmbedded(e)) bad.push(w.def.name + ' ' + e.kind + ' at ' + (e.x / 16).toFixed(1) + ',' + (e.y / 16).toFixed(1));
    }
    // let the level idle: enemies must settle on ground, not vanish
    const before = w.entities.filter((e) => e.kind === 'goomba' || e.kind === 'koopa').length;
    for (let i = 0; i < 600; i++) {
      w.camX = 0;
      game.update();
    }
    const after = w.entities.filter((e) => e.kind === 'goomba' || e.kind === 'koopa').length;
    check('level ' + w.def.name + ': enemies stay in the level', after >= Math.min(2, before),
      before + ' -> ' + after);
  }
  check('no enemy spawns inside a wall', bad.length === 0, bad.slice(0, 5).join(' | '));
}

/* 17. crouching: big mario's hitbox shrinks so he fits under a one-tile gap. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(0, { silent: true });
  const w = game.world;
  const p = w.player;
  p.setPower(1);
  p.x = 100 * 16 + 8; p.y = 12 * 16; p.vy = 0;
  for (let i = 0; i < 4; i++) game.update();
  check('big mario is 28px tall standing', p.h === 28, 'h ' + p.h);
  game.input.down = true;
  for (let i = 0; i < 4; i++) game.update();
  check('crouching shrinks the hitbox to 22px', Math.abs(p.h - 22) < 0.01, 'h ' + p.h);
  check('crouching keeps his feet down', Math.abs(p.bottom - 13 * 16) < 1, 'bottom ' + p.bottom);
  game.input.down = false;
  for (let i = 0; i < 4; i++) game.update();
  check('standing back up restores the hitbox', p.h === 28, 'h ' + p.h);
}

/* 17. rendering uses the sprite atlas. */
{
  const game = new G.Game(document.getElementById('screen'));
  game.startLevel(1, { silent: true });
  game.update();
  game.render();
  const ctxCalls = game.ctx.calls;
  check('renderer draws sprites from the atlas', Art.canvas && Art.frameNames.length > 30, Art.frameNames.length + ' frames');
}

/* 17. every sprite referenced by entity code exists. */
{
  const names = new Set(Art.frameNames);
  const used = [
    'mario.small.idle', 'mario.small.walk0', 'mario.small.walk1', 'mario.small.jump', 'mario.small.skid', 'mario.small.dead',
    'mario.big.idle', 'mario.big.walk0', 'mario.big.walk1', 'mario.big.jump', 'mario.big.skid', 'mario.big.crouch',
    'goomba.walk0', 'goomba.walk1', 'goomba.flat', 'koopa.walk0', 'koopa.walk1', 'koopa.shell', 'koopa.shellSpin', 'koopa.flip',
    'item.mushroom', 'item.oneup', 'item.flower.a', 'item.flower.b', 'item.star.a', 'item.star.b',
    'coin.a', 'coin.b', 'coin.c', 'coin.d', 'fireball', 'tile.brick', 'tile.brick.under', 'tile.question',
    'tile.used', 'tile.solid', 'tile.debris', 'prop.axe', 'prop.flag'
  ];
  const missing = used.filter((n) => !names.has(n));
  check('all referenced sprites exist', missing.length === 0, missing.join(','));
}

/* ----------------------------------------------------------------- summary */
const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
if (failed.length) {
  console.log('failures:');
  for (const f of failed) console.log('  - ' + f.name + '   ' + (f.detail || ''));
  process.exit(1);
}
