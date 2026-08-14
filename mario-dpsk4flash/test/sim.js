'use strict';
/* ============================================================
 * 无头冒烟测试（node test/sim.js）
 * 1) 全关模拟：验证运行稳定、能推进
 * 2) 无障碍通关：验证关卡几何可通行、旗杆/通关逻辑
 * 3) 单元测试：踩怪 / 顶碎砖 / 蘑菇变大 / 1UP / 踢壳 / 旗杆 / 掉坑
 * ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'js');
const code =
  fs.readFileSync(path.join(jsDir, 'level.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(jsDir, 'game.js'), 'utf8');

const sandbox = {
  console, Math, JSON,
  window: null, document: null, AudioSys: null,
  setTimeout, clearTimeout,
  GameInputs: {
    left: false, right: false, run: false, jumpHeld: false, _jump: false,
    consumeJump() { const j = this._jump; this._jump = false; return j; },
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const GAME = sandbox.GAME;
const T_ = sandbox.T;
if (!GAME) { console.error('FAIL: GAME not exported'); process.exit(1); }
const level = GAME.buildLevel();

/* ============ 关卡预览 ============ */
function preview(level) {
  const glyph = {
    [T_.EMPTY]: ' ', [T_.GROUND]: '#', [T_.BRICK]: 'B', [T_.Q]: '?',
    [T_.USED]: 'U', [T_.HIDDEN]: 'H',
    [T_.PIPE_TL]: '|', [T_.PIPE_TR]: '|', [T_.PIPE_BL]: '!', [T_.PIPE_BR]: '!',
  };
  const g = level.grid.map(row => row.map(t => glyph[t] || ' ').join(''));
  for (const e of level.entities) {
    const col = Math.floor(e.x / 16);
    if (g[11][col] === ' ') { const a = g[11].split(''); a[col] = e.type === 'goomba' ? 'o' : 'k'; g[11] = a.join(''); }
  }
  for (const c of level.coins) {
    const col = Math.floor(c.x / 16), row = Math.floor(c.y / 16);
    if (g[row][col] === ' ') { const a = g[row].split(''); a[col] = 'o'; g[row] = a.join(''); }
  }
  return g;
}
console.log('=== 关卡预览 (W:224 H:15, o=敌人 k=乌龟 o=金币) ===');
preview(level).forEach((row, i) => console.log(String(i).padStart(2, ' ') + ' ' + row));

/* ============ 1) 全关模拟（含敌人） ============ */
console.log('\n=== 测试1: 全关稳定性模拟 ===');
let maxX = 0;
const deaths = [];
let prevDead = false, jumpQueued = false;
GAME.simulate(level, 60 * 40, (f, world, inp) => {
  const p = world.player;
  if (p.dead && !prevDead) deaths.push({ f, x: Math.floor(p.x) });
  prevDead = !!p.dead;
  maxX = Math.max(maxX, p.x);

  inp.left = false; inp.right = true; inp.run = true;
  inp.jumpHeld = false; inp._jump = false;
  if (p.dead || p.flag) return;

  const ahead = Math.floor((p.x + p.w + 8) / 16);
  const ahead2 = Math.floor((p.x + p.w + 26) / 16);
  const blocky = (r, c) => {
    if (c < 0 || c >= world.cols || r < 0 || r >= world.rows) return true;
    const t = world.grid[r][c];
    return t === T_.BRICK || t === T_.Q || t === T_.PIPE_TL || t === T_.PIPE_TR ||
           t === T_.PIPE_BL || t === T_.PIPE_BR || t === T_.GROUND;
  };
  const hasObstacle = [8, 9, 10, 11].some(r => blocky(r, ahead));
  const isPit = !blocky(12, ahead) || !blocky(12, ahead2);
  const enemyClose = world.enemies.some(e =>
    e.flyT === 0 && e.x > p.x && e.x < p.x + p.w + 48 &&
    e.y + e.h > p.y + 8 && e.y < p.y + p.h + 8);
  if (p.onGround) jumpQueued = false;
  if (p.onGround && (hasObstacle || isPit || enemyClose)) { inp._jump = true; jumpQueued = true; }
  if (jumpQueued && !p.onGround && p.vy < 0) inp.jumpHeld = true;
});
console.log('  最远到达 x=' + Math.floor(maxX) + ' (总长 ' + level.cols * 16 + ')');
if (deaths.length) console.log('  死亡记录:', JSON.stringify(deaths));
if (maxX > 500) console.log('  OK: 稳定运行且推进正常（AI 卡在难点属正常，人类玩家可踩怪通过）');
else { console.log('  FAIL: 推进异常'); process.exit(1); }

/* ============ 2) 无障碍通关 ============ */
console.log('\n=== 测试2: 无敌人通关（验证关卡可通行 + 旗杆/通关） ===');
jumpQueued = false;
let gotFlag = false, finalX = 0, finalScore = 0;
const res2 = GAME.simulate(level, 60 * 75, (f, world, inp) => {
  const p = world.player;
  /* 移除威胁：让敌人全部飞走（保留实体系统本身逻辑） */
  for (const e of world.enemies) { if (!e.flyT) { e.flyT = 60; e.vy = -4; } }
  finalX = Math.max(finalX, p.x);
  finalScore = world.score;
  inp.left = false; inp.right = true; inp.run = true;
  inp.jumpHeld = false; inp._jump = false;
  if (p.dead || p.flag) { if (p.flag) gotFlag = true; return; }

  const ahead = Math.floor((p.x + p.w + 8) / 16);
  const ahead2 = Math.floor((p.x + p.w + 26) / 16);
  const blocky = (r, c) => {
    if (c < 0 || c >= world.cols || r < 0 || r >= world.rows) return true;
    const t = world.grid[r][c];
    return t === T_.BRICK || t === T_.Q || t === T_.PIPE_TL || t === T_.PIPE_TR ||
           t === T_.PIPE_BL || t === T_.PIPE_BR || t === T_.GROUND;
  };
  const hasObstacle = [8, 9, 10, 11].some(r => blocky(r, ahead));
  const isPit = !blocky(12, ahead) || !blocky(12, ahead2);
  if (p.onGround) jumpQueued = false;
  if (p.onGround && (hasObstacle || isPit)) { inp._jump = true; jumpQueued = true; }
  if (jumpQueued && !p.onGround && p.vy < 0) inp.jumpHeld = true;
});
const gotClear = res2.mode === 'clear';
console.log('  抓到旗杆: ' + gotFlag + '  通关: ' + gotClear + '  最远 x=' + Math.floor(finalX) + ' 分数=' + finalScore);
if (!gotFlag || !gotClear) { console.log('  FAIL: 未能通关'); process.exit(1); }
console.log('  PASS: 完整通关！');

/* ============ 3) 单元测试 ============ */
console.log('\n=== 测试3: 核心机制单元测试 ===');
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; console.log('  [FAIL] ' + name); }
}

/* 3.1 踩扁板栗仔 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  p.x = 300; p.y = 150; p.vy = 5; p.onGround = false;
  w.enemies.push({ kind: 'goomba', x: 300, y: 176, w: 16, h: 16, vx: 0, vy: 0, onGround: true, anim: 0, squashT: 0, flyT: 0, remove: false });
  for (let i = 0; i < 8; i++) GAME.stepWorld(w);
  check('踩扁板栗仔(+100)', w.enemies.some(e => e.squashT > 0) && w.score >= 100);
}

/* 3.2 变大后顶碎砖块 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  p.state = 'big'; p.h = 32; p.x = 200; p.y = 160; p.vy = -6;
  w.grid[9][12] = T_.BRICK;
  for (let i = 0; i < 12; i++) GAME.stepWorld(w);
  check('变大顶碎砖块(+50)', w.grid[9][12] === T_.EMPTY && w.score >= 50);
}

/* 3.3 小身板顶砖块不碎 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  p.x = 200; p.y = 160; p.vy = -6;
  w.grid[9][12] = T_.BRICK;
  for (let i = 0; i < 12; i++) GAME.stepWorld(w);
  check('小身板顶砖不碎', w.grid[9][12] === T_.BRICK);
}

/* 3.4 问号砖出蘑菇 → 变大 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  w.grid[9][5] = T_.Q;
  w.qContents.set('5,9', 'mushroom');
  p.x = 80; p.y = 160; p.vy = -6;
  for (let i = 0; i < 200; i++) {
    GAME.stepWorld(w);
    if (w.items.length) { const it = w.items[0]; p.x = it.x + 1; p.y = it.y + 10; }
  }
  check('问号砖变已用', w.grid[9][5] === T_.USED);
  check('吃到蘑菇变大(+1000)', p.state === 'big' && w.score >= 1000);
}

/* 3.5 隐藏 1UP 蘑菇 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  w.grid[9][7] = T_.HIDDEN;
  w.qContents.set('7,9', '1up');
  p.x = 112; p.y = 160; p.vy = -6;
  for (let i = 0; i < 240; i++) {
    GAME.stepWorld(w);
    if (w.items.length) { const it = w.items[0]; p.x = it.x + 1; p.y = it.y + 10; }
    if (w.lives > 3) break;
  }
  check('隐藏1UP蘑菇(+1命)', w.grid[9][7] === T_.USED && w.lives === 4);
}

/* 3.6 踩乌龟变壳，再踢出去 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  w.enemies.push({ kind: 'koopa', x: 300, y: 168, w: 16, h: 24, vx: 0, vy: 0, onGround: true, anim: 0, shell: false, shellMode: 'idle', flyT: 0, remove: false });
  p.x = 300; p.y = 150; p.vy = 6;
  for (let i = 0; i < 10; i++) GAME.stepWorld(w);
  const k = w.enemies[0];
  check('踩乌龟变壳', !!k && k.shell && k.shellMode === 'idle' && k.h === 12);
  /* 走过去踢壳 */
  sandbox.GameInputs.right = true;
  p.x = k.x - 14; p.y = 176; p.vy = 0; p.onGround = true;
  for (let i = 0; i < 40; i++) { GAME.stepWorld(w); if (w.enemies.some(e => e.shell && e.shellMode === 'moving')) break; }
  sandbox.GameInputs.right = false;
  check('踢出龟壳', w.enemies.some(e => e.shell && e.shellMode === 'moving'));
}

/* 3.7 旗杆 + 通关 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  p.x = w.flagX * 16 - 8; p.y = 100;
  for (let i = 0; i < 400; i++) {
    GAME.stepWorld(w);
    if (w._mode === 'clear') break;
  }
  check('抓到旗杆并通关', w._mode === 'clear');
}

/* 3.8 掉坑死亡 / 生命扣减 */
{
  const w = GAME.createWorld(level); w.spawns = [];
  const p = w.player;
  p.x = 100; p.y = 300;
  GAME.stepWorld(w);
  const died = p.dead === 1;   /* 第一步进入死亡动画 */
  GAME.stepWorld(w);           /* 第二步结算扣命并重生 */
  check('掉坑死亡扣命', died && w.lives === 2);
}

console.log('\n=== 单元测试: ' + pass + ' 通过, ' + fail + ' 失败 ===');
if (fail > 0) process.exit(1);
console.log('ALL TESTS PASSED');
process.exit(0);
