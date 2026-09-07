'use strict';
/* 冒烟测试：stub 浏览器环境，模拟数千帧游戏逻辑，验证关键路径无异常 */
const fs = require('fs');
const path = require('path');

const noop = () => undefined;
function fakeCtx() {
  return new Proxy({}, {
    get: (t, p) => (p === 'canvas' ? {} : (...a) => undefined),
    set: () => true,
  });
}
function fakeCanvas() {
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}
const win = { addEventListener: noop, AudioContext: undefined };
const doc = {
  getElementById: id => (id === 'game' ? fakeCanvas() : null),
  createElement: () => fakeCanvas(),
};

const files = ['audio', 'sprites', 'level', 'entities', 'game'];
const code = files.map(f => fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8')).join('\n;\n');
new Function('window', 'document', 'requestAnimationFrame', code)(win, doc, () => 0);

const G = win.__MARIO_GAME;
if (!G) throw new Error('Game 未创建');
let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}
function clearInput() {
  G.input.left = G.input.right = G.input.down = G.input.jump = G.input.run = false;
}
/* 确保处于干净的对局中 */
function ensurePlaying() {
  if (G.state === 'playing' && !G.flag) return;
  if (G.state !== 'title') { G.state = 'title'; }
  G.lives = 3;
  G.confirm();
  clearInput();
}

/* —— 启动 —— */
G.confirm();
clearInput();
check('confirm 启动进入 playing', G.state === 'playing' && !!G.player && !!G.level);

/* —— 走跑跳跃 3000 帧 —— */
G.input.right = true;
let sawEnemy = false;
try {
  for (let i = 0; i < 3000; i++) {
    G.input.jump = (i % 46) < 14;
    G.input.run = i > 600;
    G.tick();
    if (G.enemies.length > 0) sawEnemy = true;
  }
  check('3000 帧模拟无异常', true);
} catch (e) { console.error(e); check('3000 帧模拟无异常', false); }
check('敌人生成（相机激活）', sawEnemy);
check('玩家前进', G.player && G.player.x > 200);
clearInput();

/* —— 顶 ? 块出金币 —— */
ensurePlaying();
G.hitBlock(16, 9);
check('?块 -> USED + 金币+1', G.level.get(16, 9) === 5 /* USED */ && G.coins >= 1);

/* —— 蘑菇块 —— */
ensurePlaying();
G.level.set(23, 9, 4); // QMUSH
G.hitBlock(23, 9);
check('蘑菇块生成蘑菇', G.items.length >= 1);

/* —— 大马里奥碎砖 —— */
ensurePlaying();
{
  const p = G.player;
  p.big = true; p.h = 26; p.state = 'normal';
  G.level.set(20, 9, 2); // BRICK
  G.hitBlock(20, 9);
  check('大形态顶砖碎裂', G.level.get(20, 9) === 0);
  check('碎块粒子生成', G.effects.some(f => f.constructor.name === 'BrickPiece'));
}

/* —— 吃蘑菇变大 —— */
ensurePlaying();
{
  const p = G.player;
  p.big = false; p.h = 14; p.state = 'normal'; p.invuln = 0; p.vx = 0; p.vy = 0;
  p.x = 23 * 16; p.y = 12 * 16;
  G.level.set(23, 9, 4);
  G.hitBlock(23, 9);
  const m = G.items[0];
  check('蘑菇生成于块上', !!m);
  if (m) {
    m.state = 'walk'; m.x = p.x; m.y = p.y - 2;
    G.tick();
    check('吃蘑菇触发 grow 动画', p.state === 'grow' || p.big === true);
  }
}

/* —— 小形态受伤死亡 + 生命扣减 —— */
ensurePlaying();
{
  const p = G.player;
  p.big = false; p.h = 14; p.state = 'normal'; p.invuln = 0;
  const livesBefore = G.lives;
  p.hurt(G);
  check('小形态受伤 => 死亡动画', p.state === 'dead');
  for (let i = 0; i < 300 && p.state === 'dead'; i++) G.tick();
  check('死亡后生命-1 并重开', G.lives === livesBefore - 1 && G.player.state === 'normal');
}

/* —— 掉坑死亡 —— */
ensurePlaying();
{
  clearInput();
  const p = G.player;
  p.x = 69.5 * 16; p.y = 14.5 * 16; p.vy = 3;
  for (let i = 0; i < 12 && p.state === 'normal'; i++) G.tick();
  check('掉坑触发死亡流程', p.state === 'dead' || p.hidden);
  for (let i = 0; i < 300 && G.state === 'playing' && G.player.state === 'dead'; i++) G.tick();
  check('掉坑后重开正常', G.state === 'playing' && G.player.state === 'normal');
}

/* —— 旗杆通关 —— */
ensurePlaying();
try {
  const p = G.player;
  p.state = 'normal'; p.hidden = false; p.invuln = 0;
  p.x = G.level.poleX - 10; p.y = 10 * 16; p.vy = 0;
  G.tick();
  check('触碰旗杆进入通关序列', !!G.flag && G.flag.phase === 'slide');
  for (let i = 0; i < 5000; i++) { G.tick(); if (G.flag && G.flag.phase === 'done') break; }
  check('通关序列完成 (phase=done)', G.flag && G.flag.phase === 'done');
  check('时间结算加分', G.score > 0);
} catch (e) { console.error(e); check('旗杆通关无异常', false); }

/* —— GAME OVER —— */
ensurePlaying();
try {
  G.lives = 1;
  G.player.state = 'dead'; G.player.hidden = false;
  G.onPlayerDead();
  for (let i = 0; i < 300; i++) G.tick();
  check('生命耗尽 => gameover', G.state === 'gameover');
  G.confirm();
  check('确认回到标题', G.state === 'title');
} catch (e) { console.error(e); check('GAME OVER 流程无异常', false); }

/* —— BOT 自动通关验证（免疫敌人，掉坑自动重试） —— */
ensurePlaying();
{
  let won = false;
  let deaths = 0;
  let lastX = -1;
  let maxX = 0;
  let holdFrames = 0;
  let stuckX = -1, stuckFrames = 0, backing = 0;
  try {
    for (let f = 0; f < 60 * 150 && !won; f++) {
      if (G.state !== 'playing') {
        /* 续命重来 */
        if (G.state !== 'title') G.state = 'title';
        G.lives = 3;
        G.confirm();
        clearInput();
        continue;
      }
      const p = G.player;
      if (p.state === 'dead') { G.tick(); continue; }
      p.invuln = 2; // 免疫敌人伤害，专注验证地形可通行
      G.input.right = true;
      G.input.run = true;
      if (backing > 0) {
        /* 贴壁卡死 → 后拉助跑（就像真实玩家的操作） */
        backing--;
        G.input.right = false;
        G.input.left = true;
        G.input.jump = false;
      } else {
        G.input.left = false;
        G.input.right = true;
        /* 提前 40px 探测墙/坑，onGround 时触发 22 帧跳跃长按 */
        const aheadTx = Math.floor((p.x + p.w + 30) / 16);
        const groundAhead = G.level.get(aheadTx, 13) !== 0 || G.level.get(aheadTx, 14) !== 0;
        const wallTx = Math.floor((p.x + p.w + 40) / 16);
        const midT = G.level.get(wallTx, Math.floor((p.y + p.h - 8) / 16));
        const wallAhead = midT !== 0 && midT !== 11;
        const needJump = (wallAhead || !groundAhead) && p.onGround;
        if (needJump && holdFrames === 0) holdFrames = 22;
        G.input.jump = holdFrames > 0;
        if (G.input.jump) holdFrames--;
        /* 停滞检测：45 帧位置没变 → 后拉助跑 */
        if (p.x === stuckX) {
          stuckFrames++;
          if (stuckFrames > 45) { backing = 45; stuckFrames = 0; }
        } else { stuckX = p.x; stuckFrames = 0; }
      }
      G.tick();
      if (G.flag) { won = true; }
      if (p.x > maxX) maxX = p.x;
      if (p.x < 60 && lastX > 200) deaths++;
      lastX = p.x;
    }
  } catch (e) { console.error(e); }
  if (!won) console.log('  [bot] maxX=' + (maxX / 16).toFixed(1) + ' tiles, final=' + (G.player.x / 16).toFixed(1) + ', time=' + G.time + ', state=' + G.state);
  check('BOT 通关（触发旗杆序列），死亡重试 ' + deaths + ' 次', won);
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : '\n' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
