/* tools/debug.mjs - single-scenario frame tracer for the game logic.
 * usage: node tools/debug.mjs [land|bump|pipe|koopa|levels]
 *   land   - drop mario and print his landing frames
 *   bump   - jump into a ? block and print what it dispenses
 *   pipe   - walk into the underground pipe and print collision frames
 *   koopa  - stomp a koopa and print shell state transitions
 *   levels - dump tile/enemy statistics for every level
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

function makeCtx() {
  const c = {
    canvas: null, imageSmoothingEnabled: true, globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', font: '', textAlign: 'left',
    fillRect() {}, clearRect() {}, strokeRect() {}, drawImage() {}, fillText() {},
    measureText: () => ({ width: 8 }),
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, clip() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {}
  };
  c.canvas = { width: 0, height: 0, getContext: () => makeCtx() };
  return c;
}
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, textContent: '', innerHTML: '', style: {}, width: 256, height: 240,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    getContext: () => makeCtx(), addEventListener() {}, getAttribute: () => null
  });
  return els.get(id);
}
const document = { getElementById: el, querySelectorAll: () => [], createElement: () => el('tmp'), body: el('body'), addEventListener() {} };
const window = { document, addEventListener() {}, requestAnimationFrame: () => 1, performance: { now: () => 0 }, navigator: {}, setTimeout, clearTimeout, console };
window.window = window; window.globalThis = window;

for (const f of ['js/sprites.js', 'js/audio.js', 'js/levels.js', 'js/game.js']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  new Function('window', 'globalThis', 'document', 'performance', 'setTimeout', 'clearTimeout', src)(window, window, document, window.performance, setTimeout, clearTimeout);
}
const Art = window.MarioArt; Art.build();
const G = window.MarioGame;
const L = window.MarioLevels;

const scenario = process.argv[2] || 'land';

function newGame(level) {
  const g = new G.Game(el('screen'));
  g.startLevel(level, { silent: true });
  return g;
}

if (scenario === 'land') {
  const g = newGame(0);
  const w = g.world;
  const p = w.player;
  p.x = 3 * 16 + 8; p.y = 2 * 16; p.vy = 0;
  for (let i = 0; i < 60; i++) {
    g.update();
    console.log(i, 'y=' + p.y.toFixed(2), 'bottom=' + p.bottom.toFixed(2), 'vy=' + p.vy.toFixed(3), 'grounded=' + p.grounded,
      'row=' + Math.floor((p.bottom - 1) / 16), 'solid=' + !!w.isBlockingAt(Math.floor(p.x / 16), Math.floor((p.bottom - 1) / 16)));
    if (i > 24) break;
  }
}

if (scenario === 'bump') {
  const g = newGame(0);
  const w = g.world;
  const p = w.player;
  p.x = 16 * 16 + 8; p.y = 11 * 16; p.vy = 0;
  for (let i = 0; i < 90; i++) {
    g.input.jump = true;
    const before = w.tileAt(16, 9);
    g.update();
    const after = w.tileAt(16, 9);
    console.log(i, 'y=' + p.y.toFixed(2), 'top=' + p.top.toFixed(2), 'vy=' + p.vy.toFixed(3), 'grounded=' + p.grounded,
      'tile(16,9)=' + (after ? after.kind : 'none'), 'power=' + p.power,
      'items=' + w.entities.filter((e) => e.kind === 'item').map((e) => e.type + '@' + e.y.toFixed(0)).join(','));
    if (i > 40) break;
  }
}

if (scenario === 'pipe') {
  const g = newGame(1);
  const w = g.world;
  const p = w.player;
  p.x = 8 * 16; p.y = 12 * 16; p.vy = 0;
  for (let i = 0; i < 40; i++) {
    g.input.right = true; g.input.run = true;
    g.update();
    console.log(i, 'x=' + p.x.toFixed(2), 'right=' + p.right.toFixed(2), 'y=' + p.y.toFixed(2), 'bottom=' + p.bottom.toFixed(2),
      'grounded=' + p.grounded, 'vy=' + p.vy.toFixed(2), 'state=' + p.state);
  }
}

if (scenario === 'koopa') {
  const g = newGame(0);
  const w = g.world;
  const p = w.player;
  const k = w.entities.find((e) => e.kind === 'koopa');
  console.log('koopa at', k.x, k.y, k.w, k.h, 'bottom', k.bottom);
  p.x = k.x; p.y = k.top - p.h - 4; p.vy = 2;
  for (let i = 0; i < 20; i++) {
    g.update();
    console.log(i, 'player y=' + p.y.toFixed(2), 'bottom=' + p.bottom.toFixed(2), 'vy=' + p.vy.toFixed(2),
      '| koopa y=' + k.y.toFixed(2), 'top=' + k.top.toFixed(2), 'bottom=' + k.bottom.toFixed(2), 'h=' + k.h, 'mode=' + k.mode);
  }
}

if (scenario === 'levels') {
  for (let i = 0; i < L.LEVELS.length; i++) {
    const g = newGame(i);
    const w = g.world;
    const fills = {};
    for (const t of w.tiles.values()) fills[t.kind] = (fills[t.kind] || 0) + 1;
    console.log('level', w.def.name, 'tiles', w.tiles.size, JSON.stringify(fills));
    console.log('  enemies', w.entities.filter((e) => e.kind === 'goomba' || e.kind === 'koopa').length,
      'floats', w.floats.length, 'warps', JSON.stringify(w.warps), 'width', w.widthPx);
    // find any enemy that starts inside a solid tile
    for (const e of w.entities) {
      if (e.kind !== 'goomba' && e.kind !== 'koopa') continue;
      if (w.isBlockingAt(Math.floor(e.x / 16), Math.floor((e.bottom - 1) / 16))) {
        console.log('  ! enemy stuck in wall at', e.kind, e.x / 16, e.y / 16);
      }
    }
  }
}
