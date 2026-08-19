'use strict';
/* ============================================================
 * game.js — 主循环、碰撞交互、HUD、游戏状态
 * ============================================================ */

const game = {
  state: 'title',          // title | lives | playing | clear | gameover | win
  frame: 0,
  camX: 0,
  score: 0, coins: 0, lives: 3, time: 400, timeFrac: 0, hurry: false,
  room: 'main',
  player: null,
  enemies: [], items: [], fireballs: [], particles: [],
  spawnIdx: 0,
  bumps: [],               // 顶砖动画 {tx,ty,t}
  multiBlocks: {},         // 连打金币砖状态
  flagY: 3 * 16, flagDone: false,
  castleFlagT: -1,
  clearPhase: '', clearT: 0,
  livesT: 0, goT: 0, winT: 0,
  paused: false,
  flagX: 198 * 16, castleDoorX: 202 * 16 + 40 - 10,
  input: { left: false, right: false, down: false, jump: false, run: false, jumpEdge: false, runEdge: false },
  errors: [],
};

const STOMP_CHAIN = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, '1UP'];
const STAR_CHAIN  = [100, 200, 400, 800, 1000, 2000, 4000, 5000, 8000, '1UP'];
const SHELL_CHAIN = [500, 800, 1000, 2000, 4000, 5000, 8000, '1UP'];

// ================= 初始化 =================
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const params = new URLSearchParams(location.search);
const QA = {
  sheet: params.get('sheet') === '1',
  map: params.get('map') === '1',
  shot: params.get('shot') ? parseInt(params.get('shot'), 10) : 0,
  demo: params.get('demo') === '1',
  room: params.get('room') === 'bonus' ? 'bonus' : 'main',
};

window.addEventListener('error', (e) => {
  game.errors.push(String(e.message || e));
});

// ================= 输入 =================
const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyS: 'down',
  KeyZ: 'jump', KeyK: 'jump', Space: 'jump',
  KeyX: 'run', KeyJ: 'run', ShiftLeft: 'run', ShiftRight: 'run',
};

function firstGesture() {
  if (Sound.ensure()) {
    if (game.state === 'playing' && !game.player.dead) {
      Sound.startMusic(game.room === 'bonus' ? 'underground' : 'over', game.hurry ? 1.35 : 1);
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') { e.preventDefault(); onConfirm(); firstGesture(); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { Sound.toggleMute(); return; }
  if (e.code === 'KeyR') { if (game.state !== 'title') toTitle(); return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat) {
    if (k === 'jump' && !game.input.jump) game.input.jumpEdge = true;
    if (k === 'run' && !game.input.run) game.input.runEdge = true;
  }
  game.input[k] = true;
  firstGesture();
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) game.input[k] = false;
});

// 触屏
document.querySelectorAll('.tbtn').forEach(btn => {
  const k = btn.dataset.k;
  const down = (e) => {
    e.preventDefault();
    if (k === 'jump' && !game.input.jump) game.input.jumpEdge = true;
    if (k === 'run' && !game.input.run) game.input.runEdge = true;
    if (k === 'jump' && (game.state === 'title' || game.state === 'gameover' || game.state === 'win')) { onConfirm(); }
    game.input[k] = true;
    firstGesture();
  };
  const up = (e) => { e.preventDefault(); game.input[k] = false; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
});

function onConfirm() {
  if (game.state === 'title') {
    game.score = 0; game.coins = 0; game.lives = 3;
    startLevel();
    game.state = 'lives'; game.livesT = 110;
  } else if (game.state === 'gameover' || game.state === 'win') {
    toTitle();
  }
}

function togglePause() {
  if (game.state !== 'playing' && game.state !== 'clear') return;
  game.paused = !game.paused;
  Sound.setPaused(game.paused);
  Sound.sfx.pause();
}

function toTitle() {
  game.state = 'title';
  game.paused = false;
  Sound.stopMusic();
  Sound.setPaused(false);
  startLevel();          // 场景作为标题背景
  game.player.x = 40;
}

// ================= 关卡 / 生命周期 =================
function startLevel() {
  Level.reset();
  game.room = QA.room;
  game.enemies = []; game.items = []; game.fireballs = []; game.particles = [];
  game.bumps = []; game.multiBlocks = {};
  game.spawnIdx = 0;
  game.camX = 0;
  game.time = 400; game.timeFrac = 0; game.hurry = false; game.timeUp = false;
  game.flagY = 3 * 16; game.flagDone = false;
  game.castleFlagT = -1;
  game.clearPhase = ''; game.clearT = 0;
  game.paused = false;
  const p = new Player(40, 208 - 15);
  p.room = game.room;
  if (game.room === 'bonus') { p.x = 34; p.y = -20; }
  game.player = p;
  const spawns = Level.rooms.main.spawns;
  spawns.sort((a, b) => a.x - b.x);
}

function afterDeath() {
  game.lives--;
  saveTop();
  if (game.lives < 0) {
    game.state = 'gameover'; game.goT = 0;
    Sound.playJingle('gameover', () => {});
  } else {
    startLevel();
    game.state = 'lives'; game.livesT = 110;
  }
}

function saveTop() {
  try {
    const top = parseInt(localStorage.getItem('smb_web_top') || '0', 10);
    if (game.score > top) localStorage.setItem('smb_web_top', String(game.score));
  } catch (e) {}
}

// ================= 得分 =================
function addScore(v, x, y) {
  if (v === '1UP') {
    game.lives++;
    game.particles.push({ type: 'text', txt: '1UP', x, y, t: 0, color: '#80d010' });
    Sound.sfx.oneup();
    return;
  }
  game.score += v;
  game.particles.push({ type: 'text', txt: String(v), x, y, t: 0, color: '#fcfcfc' });
}

function addCoin() {
  game.coins++;
  game.score += 200;
  if (game.coins >= 100) {
    game.coins -= 100;
    game.lives++;
    Sound.sfx.oneup();
    game.particles.push({ type: 'text', txt: '1UP', x: game.player.x, y: game.player.y - 8, t: 0, color: '#80d010' });
  }
}

// ================= 顶砖 =================
function bumpTile(tx, ty) {
  const room = game.room;
  const c = Level.tile(room, tx, ty);
  const px = tx * 16, py = ty * 16;

  const spawnItem = (kind) => {
    const it = new Item(px + 2, py, kind);
    it.room = room;
    game.items.push(it);
    Sound.sfx.appear();
  };

  switch (c) {
    case '?':
      Level.setTile(room, tx, ty, 'U');
      coinFromBlock(px, py);
      bumpAnim(tx, ty);
      break;
    case 'M':
      Level.setTile(room, tx, ty, 'U');
      spawnItem(game.player.power === 0 ? 'mushroom' : 'flower');
      bumpAnim(tx, ty);
      break;
    case 'W':
      Level.setTile(room, tx, ty, 'U');
      spawnItem('star');
      bumpAnim(tx, ty);
      break;
    case 'H':
      Level.setTile(room, tx, ty, 'U');
      spawnItem('oneup');
      bumpAnim(tx, ty);
      break;
    case 'C': {
      const key = tx + ',' + ty;
      let mb = game.multiBlocks[key];
      if (!mb) { mb = game.multiBlocks[key] = { count: 9, expire: game.frame + 300 }; }
      coinFromBlock(px, py);
      mb.count--;
      if (mb.count <= 0 || game.frame > mb.expire) {
        Level.setTile(room, tx, ty, 'U');
        delete game.multiBlocks[key];
      }
      bumpAnim(tx, ty);
      break;
    }
    case 'B':
      if (game.player.big) {
        breakBrick(tx, ty);
      } else {
        Sound.sfx.bump();
        bumpAnim(tx, ty);
      }
      break;
    default:
      Sound.sfx.bump();
      return;
  }

  // 顶飞上方的敌人 / 弹起道具
  for (const e of game.enemies) {
    if (e.remove || e.flip || e.squashT > 0) continue;
    if (e.x + e.w > px && e.x < px + 16 && Math.abs(e.bottom - py) < 4) {
      if (e instanceof Koopa && e.state !== 'walk') { e.killFlip(game, 200); Sound.sfx.kick(); }
      else e.killFlip(game, 100);
    }
  }
  for (const it of game.items) {
    if (it.remove || it.emerge > 0 || it.kind === 'flower') continue;
    if (it.x + it.w > px && it.x < px + 16 && Math.abs(it.bottom - py) < 4) {
      it.vy = -3; it.vx = -it.vx || 0.6;
    }
  }
}

function bumpAnim(tx, ty) {
  game.bumps.push({ tx, ty, t: 0 });
}

function coinFromBlock(px, py) {
  addCoin();
  Sound.sfx.coin();
  game.particles.push({ type: 'coin', x: px, y: py - 16, t: 0 });
}

function breakBrick(tx, ty) {
  Level.setTile(game.room, tx, ty, ' ');
  game.score += 50;
  Sound.sfx.brick();
  const px = tx * 16, py = ty * 16;
  game.particles.push({ type: 'frag', x: px + 2, y: py + 4, vx: -1.1, vy: -3.6, t: 0 });
  game.particles.push({ type: 'frag', x: px + 8, y: py + 4, vx: 1.1, vy: -3.6, t: 0 });
  game.particles.push({ type: 'frag', x: px + 2, y: py + 10, vx: -0.7, vy: -2.4, t: 0 });
  game.particles.push({ type: 'frag', x: px + 8, y: py + 10, vx: 0.7, vy: -2.4, t: 0 });
}

function spawnPoof(x, y) {
  game.particles.push({ type: 'poof', x, y, t: 0 });
}

// ================= 玩家相关 =================
function killPlayer(pit) {
  const p = game.player;
  if (p.dead || p.flagMode) return;
  p.dead = true;
  p.deadT = pit ? 23 : 0;
  p.vx = 0; p.vy = 0;
  Sound.stopMusic();
  Sound.playJingle('die', () => {});
}

function spawnFireball() {
  const p = game.player;
  const f = new Fireball(p.facing > 0 ? p.right - 2 : p.left - 6, p.y + (p.big ? 8 : 4), p.facing);
  f.room = game.room;
  game.fireballs.push(f);
  Sound.sfx.fireball();
}

function onStarEnd() {
  if (game.state !== 'playing') return;
  Sound.startMusic(game.room === 'bonus' ? 'underground' : 'over', game.hurry ? 1.35 : 1);
}

// ---- 水管 ----
function startPipe(wp) {
  game.state = 'playing';
  game.player.pipeMode = { dir: 'down', t: 0, warp: wp };
  game.player.vx = 0; game.player.vy = 0;
  game.player.x = wp.x * 16 + 16 - game.player.w / 2 - 6;
  Sound.sfx.shrink();
}

function pipeArrived() {
  const p = game.player;
  const pm = p.pipeMode;
  if (pm.dir === 'down') {
    game.room = 'bonus';
    p.room = 'bonus';
    p.x = 34; p.y = -20; p.vx = 0; p.vy = 0.5;
    p.pipeMode = null;
    game.camX = 0;
    Sound.startMusic('underground', game.hurry ? 1.35 : 1);
  } else if (pm.dir === 'right') {
    game.room = 'main';
    p.room = 'main';
    p.x = 163 * 16 + 16 - p.w / 2;
    p.y = 208 - p.h;
    p.pipeMode = { dir: 'up', t: 0 };
    game.camX = Math.max(game.camX, p.x - 108);
    game.camX = Math.min(game.camX, Level.rooms.main.w * 16 - 256);
  } else if (pm.dir === 'up') {
    p.y = 176 - p.h;
    p.pipeMode = null;
    p.grounded = true;
    Sound.startMusic('over', game.hurry ? 1.35 : 1);
  }
}

// ---- 旗杆 ----
function startFlag() {
  const p = game.player;
  if (game.state !== 'playing' || p.flagMode || p.dead) return;
  game.state = 'clear';
  game.clearPhase = 'slide';
  p.flagMode = 'slide';
  p.x = game.flagX - 4;
  p.vx = 0; p.vy = 0;
  p.facing = 1;
  Sound.stopMusic();
  Sound.sfx.flagpole();
  // 依据抓杆高度得分
  const b = p.bottom;
  const v = b < 80 ? 5000 : b < 112 ? 2000 : b < 144 ? 800 : b < 176 ? 400 : b < 208 ? 200 : 100;
  addScore(v, p.x, p.y - 8);
}

function onMarioAtCastle() {
  game.clearPhase = 'fanfare';
  game.clearT = 0;
  Sound.playJingle('clear', () => {
    if (game.clearPhase === 'fanfare') game.clearPhase = 'count';
  });
}

function updateClear() {
  const p = game.player;
  if (game.clearPhase === 'slide') {
    if (game.flagY < 11 * 16) game.flagY = Math.min(11 * 16, game.flagY + 2.4);
    if (p.bottom >= 12 * 16 - p.h + p.h && p.y >= 12 * 16 - p.h) {
      // 到底后跳下
      if (game.flagY >= 11 * 16) {
        game.clearPhase = 'off';
        p.flagMode = 'off';
        p.x = game.flagX + 10;
        p.vy = -1.8;
      }
    }
  } else if (game.clearPhase === 'off') {
    if (p.flagMode === 'walk') game.clearPhase = 'walk';
  } else if (game.clearPhase === 'walk') {
    // 玩家走向城堡（player.update 处理），到达后触发 onMarioAtCastle
    const room = Level.rooms[game.room];
    const target = game.player.x - 108;
    if (target > game.camX) game.camX = target;
    game.camX = Math.max(0, Math.min(game.camX, room.w * 16 - 256));
  } else if (game.clearPhase === 'count') {
    if (game.time > 0) {
      const n = Math.min(2, game.time);
      game.time -= n;
      game.score += 50 * n;
      if (game.frame % 6 === 0) Sound.sfx.coin();
    } else {
      game.clearPhase = 'castleflag';
      game.clearT = 0;
    }
  } else if (game.clearPhase === 'castleflag') {
    game.clearT++;
    if (game.clearT > 50) {
      game.clearPhase = 'won';
      game.winT = 0;
      game.state = 'win';
      saveTop();
      Sound.playJingle('win', () => {});
    }
  }
  p.update(game);
}

// ================= 敌人刷新与交互 =================
function spawnEnemies() {
  const spawns = Level.rooms.main.spawns;
  while (game.spawnIdx < spawns.length && spawns[game.spawnIdx].x < game.camX + 280) {
    const s = spawns[game.spawnIdx++];
    if (game.room !== 'main') continue;
    let e;
    if (s.type === 'koopa') e = new Koopa(s.x, 208 - 21);
    else e = new Goomba(s.x, 208 - 15);
    e.room = 'main';
    game.enemies.push(e);
  }
}

function collectCoinTiles() {
  const p = game.player;
  const x0 = Math.floor(p.x / 16), x1 = Math.floor((p.x + p.w - 0.01) / 16);
  const y0 = Math.floor(p.y / 16), y1 = Math.floor((p.y + p.h - 0.01) / 16);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (Level.tile(game.room, tx, ty) === 'o') {
      Level.setTile(game.room, tx, ty, ' ');
      addCoin();
      Sound.sfx.coin();
    }
  }
}

function itemPickups() {
  const p = game.player;
  for (const it of game.items) {
    if (it.remove || it.emerge > 0) continue;
    if (!p.overlaps(it)) continue;
    it.remove = true;
    if (it.kind === 'mushroom') {
      addScore(1000, it.x, it.y - 8);
      Sound.sfx.powerup();
      if (p.power === 0) { p.transformFrom = 0; p.transformTo = 1; p.transform = 48; }
    } else if (it.kind === 'flower') {
      addScore(1000, it.x, it.y - 8);
      Sound.sfx.powerup();
      if (p.power < 2) { p.transformFrom = p.power; p.transformTo = 2; p.transform = 48; }
    } else if (it.kind === 'star') {
      addScore(1000, it.x, it.y - 8);
      p.starT = 660;
      Sound.startMusic('star');
    } else if (it.kind === 'oneup') {
      addScore('1UP', it.x, it.y - 8);
    }
  }
}

function stompBounce() {
  const p = game.player;
  p.vy = -(game.input.jump ? PHYS.STOMP_BOUNCE_HOLD : PHYS.STOMP_BOUNCE);
}

function playerVsEnemies() {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.remove || e.flip || e.squashT > 0) continue;
    if (e.room !== game.room) continue;
    if (!p.overlaps(e)) continue;

    if (p.starT > 0) {
      p.starChain = Math.min(p.starChain, STAR_CHAIN.length - 1);
      e.killFlip(game, STAR_CHAIN[p.starChain++]);
      Sound.sfx.kick();
      continue;
    }

    const stomping = p.vy > 0 && (p.bottom - Math.max(p.vy, 0)) <= e.top + 4;

    if (e instanceof Koopa) {
      if (e.state === 'walk') {
        if (stomping) { e.toShell(game); stompBounce(); chainScore(); }
        else p.hurt(game);
      } else if (e.state === 'shell') {
        if (stomping) { e.kick(game, p.cx < e.cx ? 1 : -1); stompBounce(); }
        else e.kick(game, p.cx < e.cx ? 1 : -1);
      } else if (e.state === 'shellMove') {
        if (stomping) {
          e.state = 'shell'; e.vx = 0; e.idleT = 0;
          stompBounce(); Sound.sfx.stomp(); addScore(100, e.x, e.y);
        } else if (e.noHurtT <= 0) p.hurt(game);
      } else { // wake
        if (stomping) { e.toShell(game); stompBounce(); chainScore(); }
        else p.hurt(game);
      }
    } else {
      if (stomping) { e.stomp(game); stompBounce(); chainScore(); }
      else p.hurt(game);
    }
  }
}

function chainScore() {
  const p = game.player;
  p.stompChain = Math.min(p.stompChain, STOMP_CHAIN.length - 1);
  addScore(STOMP_CHAIN[p.stompChain++], p.x, p.y - 10);
}

function fireballHits() {
  for (const f of game.fireballs) {
    if (f.remove) continue;
    for (const e of game.enemies) {
      if (e.remove || e.flip || e.squashT > 0 || e.room !== game.room) continue;
      if (!f.overlaps(e)) continue;
      f.remove = true;
      spawnPoof(f.x, f.y);
      if (e instanceof Koopa) e.killFlip(game, 200);
      else e.killFlip(game, 100);
      Sound.sfx.kick();
      break;
    }
  }
}

function shellHits() {
  const shells = game.enemies.filter(e => e instanceof Koopa && e.state === 'shellMove' && !e.remove && !e.flip);
  for (const s of shells) {
    s.chain = s.chain || 0;
    for (const e of game.enemies) {
      if (e === s || e.remove || e.flip || e.squashT > 0) continue;
      if (!s.overlaps(e)) continue;
      const v = SHELL_CHAIN[Math.min(s.chain++, SHELL_CHAIN.length - 1)];
      e.killFlip(game, v);
      Sound.sfx.kick();
    }
  }
}

function enemyEnemy() {
  const list = game.enemies.filter(e => !e.remove && !e.flip && e.squashT === 0 &&
    ((e instanceof Goomba) || (e instanceof Koopa && e.state === 'walk')));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (!a.overlaps(b)) continue;
    if (a.cx < b.cx) { if (a.vx > 0) a.vx = -Math.abs(a.vx); if (b.vx < 0) b.vx = Math.abs(b.vx); }
    else { if (a.vx < 0) a.vx = Math.abs(a.vx); if (b.vx > 0) b.vx = -Math.abs(b.vx); }
  }
}

// ================= 主更新 =================
function tick() {
  game.frame++;

  if (game.state === 'title') { clearEdges(); return; }
  if (game.state === 'lives') {
    game.livesT--;
    if (game.livesT <= 0) {
      game.state = 'playing';
      Sound.startMusic(game.room === 'bonus' ? 'underground' : 'over', 1);
    }
    clearEdges(); return;
  }
  if (game.state === 'gameover') {
    game.goT++;
    if (game.goT > 300) toTitle();
    clearEdges(); return;
  }
  if (game.state === 'win') {
    game.winT++;
    clearEdges(); return;
  }
  if (game.paused) { clearEdges(); return; }

  // 水管动画期间冻结世界
  if (game.player.pipeMode) {
    game.player.update(game);
    updateParticles();
    clearEdges();
    return;
  }

  // 死亡期间冻结世界
  if (game.player.dead) {
    game.player.update(game);
    updateParticles();
    if (game.player.deadT > 220) afterDeath();
    clearEdges();
    return;
  }

  if (game.state === 'clear') {
    updateClear();
    updateParticles();
    updateBumps();
    clearEdges();
    return;
  }

  // ---------- 正常游玩 ----------
  if (QA.demo) demoInput();

  game.player.update(game);
  spawnEnemies();

  for (const e of game.enemies) if (!e.remove && e.room === game.room) e.update(game);
  for (const it of game.items) if (!it.remove) it.update(game);
  for (const f of game.fireballs) if (!f.remove) f.update(game);

  collectCoinTiles();
  itemPickups();
  playerVsEnemies();
  fireballHits();
  shellHits();
  enemyEnemy();

  updateBumps();
  updateParticles();

  // 奖励房出口
  if (game.room === 'bonus') {
    const ep = Level.rooms.bonus.exitPipe;
    if (game.player.right >= ep.x + 4 && game.player.bottom > 11 * 16) {
      game.player.pipeMode = { dir: 'right', t: 0 };
      game.player.vx = 0; game.player.vy = 0;
      Sound.sfx.shrink();
    }
  }

  // 相机（只前进不后退）
  const room = Level.rooms[game.room];
  const target = game.player.x - 108;
  if (target > game.camX) game.camX = target;
  game.camX = Math.max(0, Math.min(game.camX, room.w * 16 - 256));

  // 时间
  game.timeFrac++;
  if (game.timeFrac >= 24) {
    game.timeFrac = 0;
    game.time--;
    if (game.time === 100 && !game.hurry) {
      game.hurry = true;
      Sound.sfx.warning();
      Sound.setSpeed(1.35);
    }
    if (game.time <= 0) {
      game.time = 0;
      killPlayer(false);
    }
  }

  // 清理
  game.enemies = game.enemies.filter(e => !e.remove);
  game.items = game.items.filter(e => !e.remove);
  game.fireballs = game.fireballs.filter(e => !e.remove);

  clearEdges();
}

function clearEdges() {
  game.input.jumpEdge = false;
  game.input.runEdge = false;
}

function demoInput() {
  game.input.right = true;
  game.input.run = true;
  if (game.frame % 80 === 0) game.input.jumpEdge = true;
  game.input.jump = (game.frame % 80) < 26;
}

function updateBumps() {
  for (const b of game.bumps) b.t++;
  game.bumps = game.bumps.filter(b => b.t < 14);
}

function updateParticles() {
  for (const p of game.particles) {
    p.t++;
    if (p.type === 'coin') { /* 轨迹在绘制时计算 */ }
    else if (p.type === 'frag') { p.vy += 0.24; p.x += p.vx; p.y += p.vy; }
    else if (p.type === 'text') p.y -= 0.7;
  }
  game.particles = game.particles.filter(p => p.t < (p.type === 'coin' ? 34 : p.type === 'poof' ? 18 : 55));
}

// ================= 渲染 =================
const FONT = '"Press Start 2P", monospace';

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (QA.sheet) { renderSheet(); return; }
  if (QA.map) { renderMap(); return; }

  if (game.state === 'lives') { renderLivesScreen(); drawErrors(); return; }
  if (game.state === 'gameover') { renderGameOver(); drawErrors(); return; }

  renderWorld();

  if (game.state === 'title') renderTitle();
  else {
    renderHUD();
    if (game.state === 'win') renderWin();
    if (game.paused) renderPause();
  }
  drawErrors();
}

function renderWorld() {
  const room = Level.rooms[game.room];
  const dark = !!room.dark;
  ctx.fillStyle = dark ? '#000000' : '#5c94fc';
  ctx.fillRect(0, 0, 256, 240);
  const camX = game.camX;

  // 背景装饰
  if (room.decor) {
    const d = room.decor;
    for (const h of d.hills) {
      const spr = Sprites.get(h.big ? 'hillBig' : 'hillSmall');
      const x = h.x - camX * 0.99;   // 轻微视差
      if (x > -90 && x < 260) ctx.drawImage(spr, Math.round(x), 208 - spr.height);
    }
    for (const b of d.bushes) {
      const spr = Sprites.get('bush' + b.n);
      const x = b.x - camX;
      if (x > -60 && x < 260) ctx.drawImage(spr, Math.round(x), 208 - spr.height + 2);
    }
    for (const c of d.clouds) {
      const spr = Sprites.get('cloud' + c.n);
      const x = c.x - camX * 0.95;
      if (x > -60 && x < 260) ctx.drawImage(spr, Math.round(x), c.y);
    }
    // 城堡
    const castle = Sprites.get('castle');
    const cx = d.castle - camX;
    if (cx > -90 && cx < 260) {
      ctx.drawImage(castle, Math.round(cx), 208 - 80);
      // 通关后城堡升旗
      if (game.castleFlagT >= 0 || game.clearPhase === 'castleflag' || game.state === 'win') {
        const t = game.clearPhase === 'castleflag' ? Math.min(1, game.clearT / 40) : 1;
        const fy = 208 - 80 - Math.round(26 * t);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(Math.round(cx + 39), fy, 1, 208 - 80 - fy + 1);
        ctx.fillRect(Math.round(cx + 40), fy, 9, 7);
      }
    }
    // 旗杆
    const pole = Sprites.get('pole'), ball = Sprites.get('poleBall');
    const fx = d.flagX - camX;
    if (fx > -20 && fx < 270) {
      for (let ry = 3; ry <= 11; ry++) ctx.drawImage(pole, fx, ry * 16);
      ctx.drawImage(ball, fx, 2 * 16);
      const flag = Sprites.get('flag');
      ctx.drawImage(flag, fx - 8, Math.round(game.flagY));
    }
  }

  // 正在升出的道具（画在砖后面）
  for (const it of game.items) if (!it.remove && it.emerge > 0) it.draw(ctx, camX);

  // 水管动画中的玩家画在砖后面
  if (game.player && game.player.pipeMode) game.player.draw(ctx, camX);

  // 瓦片
  const tx0 = Math.floor(camX / 16), tx1 = Math.ceil((camX + 256) / 16);
  const ug = dark ? 'ug' : '';
  const qFrame = [1, 2, 3, 2][Math.floor(game.frame / 8) % 4];
  const cFrame = ['coin1', 'coin2', 'coin3', 'coin2'][Math.floor(game.frame / 6) % 4];
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = Level.tile(game.room, tx, ty);
      if (c === ' ' || c === 'H') continue;
      let spr = null;
      switch (c) {
        case 'X': spr = Sprites.get('ground', ug); break;
        case 'B': case 'C': case 'W': spr = Sprites.get('brick', ug); break;
        case 'U': spr = Sprites.get('used', ug); break;
        case 'D': spr = Sprites.get('solid', ug); break;
        case '?': case 'M': spr = Sprites.get('qblock', String(qFrame)); break;
        case '[': spr = Sprites.get('pipeTL'); break;
        case ']': spr = Sprites.get('pipeTR'); break;
        case '{': spr = Sprites.get('pipeBL'); break;
        case '}': spr = Sprites.get('pipeBR'); break;
        case 'o': spr = Sprites.get(cFrame); break;
      }
      if (!spr) continue;
      let dy = 0;
      for (const b of game.bumps) if (b.tx === tx && b.ty === ty) {
        dy = -Math.round(Math.sin(Math.PI * b.t / 14) * 6);
      }
      ctx.drawImage(spr, Math.round(tx * 16 - camX), ty * 16 + dy);
    }
  }

  // 奖励房出口水管（水平）
  if (room.exitPipe) {
    const ex = Math.round(room.exitPipe.x - camX);
    if (ex > -60 && ex < 270) {
      const P = Sprites.PAL.pipe;
      ctx.fillStyle = P.B; ctx.fillRect(ex, 11 * 16, 16, 32);       // 唇缘
      ctx.fillStyle = P.L; ctx.fillRect(ex + 2, 11 * 16 + 1, 4, 30);
      ctx.fillStyle = P.G; ctx.fillRect(ex + 6, 11 * 16 + 1, 9, 30);
      ctx.fillStyle = P.B; ctx.fillRect(ex + 15, 11 * 16, 48 + 16, 32);
      ctx.fillStyle = P.L; ctx.fillRect(ex + 15, 11 * 16 + 2, 4, 28);
      ctx.fillStyle = P.G; ctx.fillRect(ex + 19, 11 * 16 + 2, 40, 28);
      ctx.fillStyle = P.D; ctx.fillRect(ex + 59, 11 * 16 + 2, 4, 28);
    }
  }

  // 实体
  for (const it of game.items) if (!it.remove && it.emerge === 0) it.draw(ctx, camX);
  for (const e of game.enemies) if (!e.remove && e.room === game.room) e.draw(ctx, camX);
  for (const f of game.fireballs) if (!f.remove) f.draw(ctx, camX);

  // 粒子
  for (const p of game.particles) {
    if (p.type === 'coin') {
      const spr = Sprites.get(['coin1', 'coin2', 'coin3', 'coin2'][Math.floor(p.t / 3) % 4]);
      const dy = -(4.2 * p.t - 0.13 * p.t * p.t);
      ctx.drawImage(spr, Math.round(p.x - camX), Math.round(p.y + dy));
    } else if (p.type === 'frag') {
      ctx.drawImage(Sprites.get('frag', ug), Math.round(p.x - camX), Math.round(p.y));
    } else if (p.type === 'poof') {
      ctx.drawImage(Sprites.get(p.t < 8 ? 'poof1' : 'poof2'), Math.round(p.x - camX), Math.round(p.y));
    } else if (p.type === 'text') {
      ctx.font = '8px ' + FONT;
      ctx.fillStyle = p.color;
      ctx.textBaseline = 'top';
      ctx.fillText(p.txt, Math.round(p.x - camX), Math.round(p.y));
    }
  }

  // 玩家
  if (game.player && !game.player.pipeMode) game.player.draw(ctx, camX);
}

function text(txt, x, y, color, size, align) {
  ctx.font = (size || 8) + 'px ' + FONT;
  ctx.fillStyle = color || '#fcfcfc';
  ctx.textBaseline = 'top';
  ctx.textAlign = align || 'left';
  ctx.fillText(txt, x, y);
  ctx.textAlign = 'left';
}

const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

function renderHUD() {
  text('MARIO', 16, 8);
  text(pad(game.score, 6), 16, 17);
  ctx.drawImage(Sprites.get('hudCoin'), 88, 16);
  text('x' + pad(game.coins, 2), 96, 17);
  text('WORLD', 144, 8);
  text('1-1', 152, 17);
  text('TIME', 208, 8);
  text(game.state === 'title' ? '' : pad(game.time, 3), 216, 17);
}

function renderTitle() {
  ctx.textAlign = 'center';
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = '#000';
  ctx.fillText('SUPER', 130, 42); ctx.fillText('MARIO BROS.', 130, 66);
  ctx.fillStyle = '#d82800';
  ctx.fillText('SUPER', 128, 40); ctx.fillText('MARIO BROS.', 128, 64);
  ctx.textAlign = 'left';
  text('WEB FAN REMAKE', 128, 92, '#fcfcfc', 8, 'center');
  let top = 0;
  try { top = parseInt(localStorage.getItem('smb_web_top') || '0', 10); } catch (e) {}
  text('TOP ' + pad(top, 6), 128, 106, '#fcb830', 8, 'center');
  if (Math.floor(game.frame / 30) % 2 === 0)
    text('PRESS ENTER TO START', 128, 148, '#fcfcfc', 8, 'center');
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#c8c8c8';
  ctx.textAlign = 'center';
  ctx.fillText('按 Enter 开始 · Z/空格 跳跃 · X/Shift 加速与火球', 128, 176);
  ctx.fillText('↓ 进入水管 · 踩敌顶砖 · 吃蘑菇变大', 128, 190);
  ctx.textAlign = 'left';
}

function renderLivesScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 240);
  text('WORLD 1-1', 128, 88, '#fcfcfc', 8, 'center');
  const spr = Sprites.get('smStand');
  ctx.drawImage(spr, 104, 110);
  text('x  ' + game.lives, 128, 114, '#fcfcfc', 8);
}

function renderGameOver() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 240);
  text('GAME OVER', 128, 104, '#fcfcfc', 8, 'center');
  if (Math.floor(game.frame / 30) % 2 === 0)
    text('PRESS ENTER', 128, 140, '#c8c8c8', 8, 'center');
}

function renderWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 40, 256, 130);
  text('THANK YOU MARIO!', 128, 64, '#fcfcfc', 8, 'center');
  text('YOUR QUEST IS OVER.', 128, 84, '#fcb830', 8, 'center');
  text('SCORE ' + pad(game.score, 6), 128, 108, '#fcfcfc', 8, 'center');
  if (Math.floor(game.frame / 30) % 2 === 0)
    text('PRESS ENTER', 128, 140, '#c8c8c8', 8, 'center');
}

function renderPause() {
  text('PAUSE', 128, 112, '#fcfcfc', 8, 'center');
}

function drawErrors() {
  if (!game.errors.length) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 224, 256, 16);
  ctx.font = '6px monospace';
  ctx.fillStyle = '#ff4040';
  ctx.textBaseline = 'top';
  ctx.fillText(game.errors[game.errors.length - 1].slice(0, 60), 2, 227);
}

// ---------- QA：精灵表 ----------
function renderSheet() {
  const all = Sprites.all();
  const cols = 10, cw = 100, ch = 60;
  canvas.width = cols * cw;
  canvas.height = Math.ceil(all.length / cols) * ch;
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  all.forEach((s, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.fillStyle = '#383838';
    ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    ctx.drawImage(s.canvas, x + (cw - s.canvas.width * 2) / 2, y + 6, s.canvas.width * 2, s.canvas.height * 2);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#ffd040';
    ctx.textBaseline = 'top';
    ctx.fillText(s.name, x + 4, y + ch - 12);
  });
}

// ---------- QA：关卡小地图 ----------
function renderMap() {
  const room = Level.rooms.main;
  const s = 5;
  canvas.width = room.w * s;
  canvas.height = room.h * s + 12;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const COLORS = {
    X: '#a04000', B: '#c84c0c', C: '#c84c0c', W: '#c84c0c', U: '#803000',
    '?': '#fcb830', M: '#fcb830', H: '#808080', D: '#fc9838',
    '[': '#00a800', ']': '#00a800', '{': '#00a800', '}': '#00a800', o: '#fcb830',
  };
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    const c = room.tiles[y][x];
    if (c === ' ') continue;
    ctx.fillStyle = COLORS[c] || '#f0f';
    ctx.fillRect(x * s, y * s, s, s);
  }
  ctx.fillStyle = '#ff4040';
  for (const sp of room.spawns) ctx.fillRect(Math.round(sp.x / 16) * s, 12 * s, s, s);
  ctx.fillStyle = '#40a0ff';
  ctx.fillRect(198 * s, 3 * s, 2, 9 * s);
  ctx.fillStyle = '#fff';
  ctx.font = '7px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('WORLD 1-1  ' + room.w + ' tiles   red=enemy blue=flag', 2, room.h * s + 2);
}

// 把实体需要调用的方法挂到 game 对象上
Object.assign(game, {
  bumpTile, breakBrick, spawnPoof, addScore, killPlayer, spawnFireball,
  onStarEnd, startPipe, pipeArrived, startFlag, onMarioAtCastle,
});

// ================= 主循环 =================
let last = 0, acc = 0, running = true;

function loop(t) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  acc += dt;
  let n = 0;
  while (acc >= 1 / 60 && n < 5) { tick(); acc -= 1 / 60; n++; }
  if (n === 5) acc = 0;
  render();
  if (QA.shot && game.frame >= QA.shot) { running = false; }
}

// ================= QA：ASCII 转储（配合 headless --dump-dom） =================
const ASCII_PAL = [
  [92, 148, 252, '.'], [0, 0, 0, '#'], [252, 252, 252, 'W'], [216, 40, 0, 'r'],
  [252, 160, 68, 's'], [136, 48, 0, 'b'], [200, 76, 12, 'o'], [252, 152, 56, 'y'],
  [0, 168, 0, 'g'], [128, 208, 16, 'G'], [152, 232, 88, 'L'], [252, 184, 48, 'Y'],
  [160, 72, 0, 'B'], [0, 88, 248, 'U'], [60, 188, 252, 'C'], [252, 216, 168, 'c'],
  [0, 88, 0, 'D'], [228, 92, 16, 'O'], [32, 32, 32, ' '], [56, 56, 56, ' '],
];

function asciiArt(cv, ds) {
  ds = ds || 1;
  const g = cv.getContext('2d');
  const img = g.getImageData(0, 0, cv.width, cv.height).data;
  const W = Math.floor(cv.width / ds), H = Math.floor(cv.height / ds);
  let out = '';
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const i = (y * ds * cv.width + x * ds) * 4;
      if (img[i + 3] < 128) { line += ' '; continue; }
      const R = img[i], Gc = img[i + 1], B = img[i + 2];
      let best = '?', bd = 1e9;
      for (const p of ASCII_PAL) {
        const d = (R - p[0]) * (R - p[0]) + (Gc - p[1]) * (Gc - p[1]) + (B - p[2]) * (B - p[2]);
        if (d < bd) { bd = d; best = p[3]; }
      }
      line += best;
    }
    out += line + '\n';
  }
  return out;
}

function dumpOutput(s) {
  const pre = document.createElement('pre');
  pre.id = 'qa-dump';
  pre.style.cssText = 'position:fixed;left:0;top:0;color:#8f8;font:6px monospace;white-space:pre;z-index:99;background:#000';
  document.body.appendChild(pre);
  pre.textContent = s;
}

function exportPng(scale) {
  // 把当前画布放大导出为 base64 PNG（放在 DOM 里供 --dump-dom 提取）
  try {
    const c = document.createElement('canvas');
    c.width = canvas.width * scale; c.height = canvas.height * scale;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(canvas, 0, 0, c.width, c.height);
    const a = document.createElement('a');
    a.id = 'qa-png';
    a.href = c.toDataURL('image/png');
    document.body.appendChild(a);
  } catch (e) {
    const pre = document.createElement('pre');
    pre.id = 'qa-png';
    pre.textContent = 'PNGERROR:' + e.message;
    document.body.appendChild(pre);
  }
}

function dumpSprites(names) {
  const filter = names ? names.split(',') : null;
  const all = Sprites.all().filter(s => !filter || filter.some(n => s.name.indexOf(n) === 0));
  let out = '';
  for (const s of all) {
    out += '=== ' + s.name + ' (' + s.canvas.width + 'x' + s.canvas.height + ') ===\n';
    out += asciiArt(s.canvas, 1) + '\n';
  }
  dumpOutput(out);
}

function dumpMap() {
  const room = Level.rooms.main;
  const M = { X: 'X', B: 'B', C: 'C', W: 'B', U: 'U', '?': '?', M: 'M', H: ' ', D: 'D', o: 'o', ' ': '.' };
  const grid = [];
  for (let y = 0; y < room.h; y++) {
    let line = '';
    for (let x = 0; x < room.w; x++) {
      const c = room.tiles[y][x];
      line += ('[]{}'.includes(c)) ? 'n' : (M[c] || '?');
    }
    grid.push(line.split(''));
  }
  for (const sp of room.spawns) grid[12][Math.round(sp.x / 16)] = sp.type === 'koopa' ? 'K' : 'e';
  dumpOutput(grid.map(l => l.join('')).join('\n'));
}

function statusLine() {
  const p = game.player;
  let tr = '';
  if (game.trace && game.trace.length) tr = '\nTRACE\n' + game.trace.join('\n') + '\n';
  return `STATUS state=${game.state} room=${game.room} power=${p.power} score=${game.score} coins=${game.coins} time=${game.time} lives=${game.lives} px=${p.x | 0} py=${p.y | 0} vx=${p.vx.toFixed(2)} vy=${p.vy.toFixed(2)} enemies=${game.enemies.length} items=${game.items.length} phase=${game.clearPhase || '-'} flag=${p.flagMode || '-'} star=${p.starT} inv=${p.invT} dead=${p.dead} tiles16_9=${Level.tile(game.room, 16, 9)} tiles20_9=${Level.tile(game.room, 20, 9)}\n` + tr;
}

function runTest(name) {
  const p = game.player;
  switch (name) {
    case 'bumpQ': game.bumpTile(16, 9); break;
    case 'bumpM': game.bumpTile(21, 9); break;
    case 'break':
      p.applyPower(1); p.x = 20 * 16;
      game.bumpTile(20, 9);
      break;
    case 'stomp': {
      p.x = 300; p.y = 170; p.vy = 2;
      const g = new Goomba(298, 208 - 15); g.room = 'main'; game.enemies.push(g);
      game.trace = [];
      for (let i = 0; i < 6; i++) {
        tick();
        game.trace.push(`t${i}: p(${p.x.toFixed(1)},${p.y.toFixed(1)}) vy=${p.vy.toFixed(2)} dead=${p.dead} score=${game.score} | g(${g.x.toFixed(1)},${g.y.toFixed(1)}) sq=${g.squashT}`);
      }
      break;
    }
    case 'hurt': {
      p.applyPower(1);
      p.x = 288; p.y = 208 - p.h;
      const g = new Goomba(304, 208 - 15); g.room = 'main'; game.enemies.push(g);
      game.input.right = true;
      game.trace = [];
      for (let i = 0; i < 30; i++) {
        tick();
        if (i % 4 === 0 || i > 14) game.trace.push(`t${i}: p(${p.x.toFixed(1)},${p.y.toFixed(1)}) power=${p.power} inv=${p.invT} tf=${p.transform} dead=${p.dead} score=${game.score} | g(${g.x.toFixed(1)},${g.y.toFixed(1)})`);
      }
      break;
    }
    case 'grow': {
      const it = new Item(42, 208 - 13, 'mushroom'); it.emerge = 0; it.room = 'main';
      game.items.push(it);
      game.trace = [];
      for (let i = 0; i < 55; i++) {
        tick();
        if (i % 10 === 0 || i > 48) game.trace.push(`t${i}: power=${p.power} tf=${p.transform} items=${game.items.length} score=${game.score} | it(${it.x.toFixed(1)},${it.y.toFixed(1)})`);
      }
      break;
    }
    case 'flower': {
      p.applyPower(1);
      const it = new Item(42, 208 - 13, 'flower'); it.emerge = 0; it.room = 'main';
      game.items.push(it);
      game.trace = [];
      for (let i = 0; i < 55; i++) {
        tick();
        if (i % 10 === 0 || i > 48) game.trace.push(`t${i}: power=${p.power} tf=${p.transform} score=${game.score}`);
      }
      break;
    }
    case 'star': {
      const it = new Item(42, 208 - 13, 'star'); it.emerge = 0; it.room = 'main';
      game.items.push(it);
      game.trace = [];
      for (let i = 0; i < 55; i++) {
        tick();
        if (i % 10 === 0 || i > 48) game.trace.push(`t${i}: star=${p.starT} score=${game.score} | it(${it.x.toFixed(1)},${it.y.toFixed(1)})`);
      }
      break;
    }
    case 'koopa': {
      p.x = 300; p.y = 170; p.vy = 2;
      const k = new Koopa(298, 208 - 21); k.room = 'main'; game.enemies.push(k);
      game.trace = [];
      for (let i = 0; i < 8; i++) {
        tick();
        game.trace.push(`t${i}: p(${p.x.toFixed(1)},${p.y.toFixed(1)}) vy=${p.vy.toFixed(2)} dead=${p.dead} score=${game.score} | k(${k.x.toFixed(1)},${k.y.toFixed(1)}) st=${k.state} kvy=${k.vy.toFixed(2)}`);
      }
      const sh = game.enemies[0];
      if (sh && sh.state === 'shell') sh.kick(game, 1);
      for (let i = 0; i < 3; i++) tick();
      break;
    }
    case 'pipe': {
      p.x = 57 * 16 + 8; p.y = (15 - 2 - 4) * 16 - p.h; p.grounded = true;
      game.input.down = true;
      for (let i = 0; i < 60; i++) tick();
      break;
    }
    case 'bonus': {
      game.room = 'bonus'; p.room = 'bonus'; p.x = 34; p.y = -20;
      game.input.right = true;
      game.trace = [];
      for (let i = 0; i < 400; i++) {
        tick();
        if (i % 40 === 0) game.trace.push(`t${i}: room=${game.room} px=${p.x | 0} py=${p.y | 0} coins=${game.coins} pipe=${p.pipeMode ? p.pipeMode.dir : '-'}`);
      }
      break;
    }
    case 'fire': {
      p.applyPower(2);
      game.input.runEdge = true;
      tick();
      break;
    }
    case 'flag': {
      p.x = game.flagX - 60;
      game.input.right = true; game.input.run = true;
      for (let i = 0; i < 600; i++) {
        tick();
        if (game.clearPhase === 'fanfare') game.clearPhase = 'count'; // 跳过等待音乐回调
      }
      break;
    }
  }
}

function boot() {
  const dump = params.get('dump');
  if (dump === 'sprites') { dumpSprites(params.get('names')); return; }
  if (dump === 'map') { dumpMap(); return; }
  startLevel();
  if (QA.shot) game.state = 'playing';
  if (dump === 'world') {
    const n = QA.shot || 0;
    let err = '';
    try {
      const test = params.get('test');
      if (test) {
        game.state = 'playing';
        runTest(test);
      } else {
        for (let i = 0; i < n; i++) tick();
      }
      render();
    } catch (e) {
      err = 'ERROR: ' + ((e && e.stack) || e) + '\nstate=' + game.state + ' frame=' + game.frame + '\n';
    }
    dumpOutput(err + statusLine() + asciiArt(canvas, parseInt(params.get('ds') || '2', 10)));
    if (params.get('png')) exportPng(parseInt(params.get('png'), 10) || 3);
    return;
  }
  if (QA.sheet || QA.map) {
    render();
    return;
  }
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
}

window.addEventListener('load', () => {
  try {
    boot();
  } catch (e) {
    game.errors.push('BOOT: ' + e.message);
    drawErrors();
  }
});
