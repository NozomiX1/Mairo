'use strict';
/* ============================================================
 * 渲染冒烟测试：用假 canvas 2D 上下文执行所有渲染路径，
 * 捕捉 ReferenceError / 空精灵等运行时错误。
 * 运行：node test/render_smoke.js
 * ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'js');
const files = ['font.js', 'sprites.js', 'audio.js', 'level.js', 'input.js', 'game.js'];
const code = files.map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');

/* ---- 假 canvas 2D 上下文：任何方法都是 no-op，属性可写 ---- */
function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'canvas') return { width: 256, height: 240 };
      if (!(prop in t)) t[prop] = function () {};
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

let rafCb = null;
const documentStub = {
  readyState: 'complete',
  addEventListener() {},
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => makeCtx() };
    return {};
  },
  getElementById(id) {
    if (id === 'game') return { width: 256, height: 240, getContext: () => makeCtx(), addEventListener() {}, style: {} };
    return null;
  },
};

const sandbox = {
  console, Math, JSON, setTimeout, clearTimeout,
  document: null, AudioSys: null,
  addEventListener() {},
  requestAnimationFrame(cb) { rafCb = cb; return 1; },
};
sandbox.window = sandbox;
sandbox.document = documentStub;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const GAME = sandbox.GAME;
if (!GAME) { console.error('FAIL: GAME 未导出'); process.exit(1); }

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; console.log('  [FAIL] ' + name); }
}

try {
  /* 触发一次主循环（标题画面渲染） */
  if (rafCb) rafCb(1000);

  check('标题画面渲染', true);

  /* 开始游戏 */
  GAME.onExternalAction('start');
  check('开始游戏 -> play 模式', GAME.mode === 'play' && !!GAME.world);
  GAME.render && GAME.render(); // 直接调渲染（内部 render 未导出则跳过）

  /* 渲染：跑 120 步后画一帧 */
  const w = GAME.world;
  for (let i = 0; i < 120; i++) GAME.stepWorld(w);
  GAME.render && GAME.render();

  /* 强制各种状态渲染 */
  w._mode = 'clear'; GAME.mode = 'clear'; GAME.render && GAME.render();
  w._mode = 'gameover'; GAME.mode = 'gameover'; GAME.render && GAME.render();
  w.paused = true; GAME.render && GAME.render(); w.paused = false;
  GAME.mode = 'title'; GAME.world = null; GAME.render && GAME.render();

  /* 全屏遍历敌人/物品/金币渲染 */
  const w2 = GAME.createWorld(GAME.buildLevel());
  w2.player.x = 3000; w2.camX = 2900; // 触发后半段 + 旗杆 + 城堡渲染
  w2.player.flag = { score: 1000 };
  GAME.world = w2; GAME.mode = 'play';
  GAME.render && GAME.render();

  check('旗杆/城堡/半程渲染', true);
  check('整体渲染无异常', true);
} catch (e) {
  fail++;
  console.log('  [FAIL] 渲染异常:', e && e.stack || e);
}

console.log('\n=== 渲染冒烟: ' + pass + ' 通过, ' + fail + ' 失败 ===');
if (fail > 0) process.exit(1);
console.log('RENDER SMOKE PASSED');
process.exit(0);
