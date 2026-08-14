'use strict';
/* ============================================================
 * Super Mario Bros. Web —— 核心引擎
 * 固定步长物理 / 实体 / 碰撞 / 渲染 / 状态机
 * ============================================================ */
(function () {
  const VIEW_W = 256, VIEW_H = 240;
  const TS = 16;

  /* 物理常量（像素/帧 @60fps） */
  const GRAV = 0.5, MAX_FALL = 9.0;
  const JUMP_V = -6.8, JUMP_HOLD_G = 0.28, JUMP_RELEASE_G = 0.75;
  const WALK_MAX = 1.6, RUN_MAX = 2.6, ACCEL = 0.30, FRICTION = 0.82;
  const GOOMBA_SPEED = 0.9, KOOPA_SPEED = 0.8, SHELL_SPEED = 5.5, MUSH_SPEED = 1.4;
  const FLAG_SCORE_TIERS = [[0.25, 5000], [0.45, 2000], [0.65, 800], [0.85, 400], [1.1, 100]];

  const GameInputs = (typeof window !== 'undefined' && window.GameInputs) ? window.GameInputs : {
    left: false, right: false, run: false, jumpHeld: false, _jump: false,
    consumeJump() { const j = this._jump; this._jump = false; return j; },
  };

  function snd(n) { if (typeof AudioSys !== 'undefined' && AudioSys) AudioSys.sfx(n); }
  function music(n) { if (typeof AudioSys !== 'undefined' && AudioSys) AudioSys.playTheme(n); }
  function stopMusic() { if (typeof AudioSys !== 'undefined' && AudioSys) AudioSys.stopTheme(); }

  /* ---------- 小工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function tileAt(world, c, r) {
    if (c < 0) return T.GROUND;
    if (c >= world.cols || r < 0 || r >= world.rows) return T.EMPTY;
    return world.grid[r][c];
  }
  function isSolid(t) {
    return t === T.GROUND || t === T.BRICK || t === T.Q || t === T.USED ||
           t === T.PIPE_TL || t === T.PIPE_TR || t === T.PIPE_BL || t === T.PIPE_BR;
  }

  /* ---------- 世界 ---------- */
  function createWorld(level, carry) {
    const w = {
      level,
      grid: level.grid, cols: level.cols, rows: level.rows,
      qContents: level.qContents,
      camX: 0,
      frame: 0,
      time: 300, timeFrames: 0,
      score: carry ? carry.score : 0,
      coinsCount: carry ? carry.coinsCount : 0,
      lives: carry ? carry.lives : 3,
      stompCombo: 100,
      starTimer: 0, starCombo: 100,
      fireCd: 0,
      paused: false,
      player: new Player(level.playerX, level.playerY),
      enemies: [], items: [], fireballs: [],
      popups: [], particles: [], bumps: [], coinPops: [],
      spawns: level.entities.map(e => ({ ...e })).sort((a, b) => a.x - b.x),
      coins: level.coins.map(c => ({ ...c, taken: false })),
      clouds: level.clouds, hills: level.hills, bushes: level.bushes,
      flagX: level.flagX, flagTopY: level.flagTopRow * 16,
      castleX: level.castleX,
      flagSlide: 0,
      _mode: 'play', _starMusic: false, _timeBonus: 0, _clearTimer: 0,
      _mutedShown: false,
    };
    return w;
  }

  /* ---------- 玩家 ---------- */
  function Player(x, y) {
    this.x = x; this.y = y; this.w = 12; this.h = 16;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.state = 'small';       // small | big | fire
    this.invuln = 0;            // 受伤无敌闪烁
    this.grow = 0;              // 变大闪烁
    this.dead = 0;
    this.flag = null;           // {score}
    this.walkAnim = 0;
    this.skid = false;
  }

  function resetWorld(world, carry) {
    const nw = createWorld(world.level, carry);
    nw.frame = world.frame;
    nw._mode = world._mode;
    for (const k in world) delete world[k];
    for (const k in nw) world[k] = nw[k];
  }

  /* ---------- 加分 / 特效 ---------- */
  function addScore(world, n, x, y) {
    world.score += n;
    world.popups.push({ x: x, y: y, t: 0, text: String(n) });
  }
  function addBump(world, c, r) { world.bumps.push({ c, r, t: 8 }); }
  function coinPop(world, c, r) {
    world.coinPops.push({ x: c * TS + 4, y: r * TS - 2, t: 0 });
  }

  function breakBrick(world, c, r) {
    world.grid[r][c] = T.EMPTY;
    addBump(world, c, r);
    addScore(world, 50, c * TS + 8, r * TS);
    for (let i = 0; i < 4; i++) {
      world.particles.push({
        x: c * TS + (i % 2) * 8, y: r * TS + (i < 2 ? 0 : 8),
        vx: (i % 2 ? 1 : -1) * (1.2 + Math.random() * 0.6),
        vy: -4.5 - Math.random() * 1.5, t: 60, brick: true,
      });
    }
    snd('brick');
  }

  function spawnItem(world, c, r, kind) {
    let k;
    if (kind === '1up') k = 'mushroom1up';
    else if (kind === 'flower') k = 'flower';
    else if (kind === 'star') k = 'star';
    else k = 'mushroom';
    const item = {
      kind: k,
      x: c * TS, y: r * TS,
      w: 14, h: 14,
      vx: 0, vy: 0, rise: 14,
      remove: false,
    };
    if (k === 'mushroom' || k === 'mushroom1up' || k === 'star') item.vx = MUSH_SPEED;
    world.items.push(item);
  }

  /* ---------- 撞砖 ---------- */
  function bumpBlock(world, c, r, t) {
    const key = c + ',' + r;
    if (t === T.Q) {
      const kind = world.qContents.get(key) || 'coin';
      world.grid[r][c] = T.USED;
      addBump(world, c, r);
      if (kind === 'coin') {
        world.coinsCount++;
        addScore(world, 200, c * TS + 8, r * TS);
        coinPop(world, c, r);
        snd('coin');
      } else {
        spawnItem(world, c, r, kind);
        snd('bump');
      }
    } else if (t === T.HIDDEN) {
      const kind = world.qContents.get(key) || '1up';
      world.grid[r][c] = T.USED;
      addBump(world, c, r);
      spawnItem(world, c, r, kind);
      snd('bump');
    } else if (t === T.BRICK) {
      if (world.player.state !== 'small') breakBrick(world, c, r);
      else { addBump(world, c, r); snd('bump'); }
    } else {
      addBump(world, c, r);
      snd('bump');
    }
  }

  /* ---------- 玩家移动与碰撞 ---------- */
  function movePlayerX(world, p, dx) {
    p.x += dx;
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 1) / TS);
    const c = dx > 0 ? Math.floor((p.x + p.w) / TS) : Math.floor(p.x / TS);
    if (c < 0) { p.x = 0; p.vx = 0; return; }
    for (let r = r0; r <= r1; r++) {
      if (isSolid(tileAt(world, c, r))) {
        if (dx > 0) p.x = c * TS - p.w - 0.001; else p.x = (c + 1) * TS + 0.001;
        p.vx = 0;
        return;
      }
    }
  }
  function movePlayerY(world, p, dy) {
    p.y += dy;
    const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + p.w - 1) / TS);
    if (dy >= 0) {
      const r = Math.floor((p.y + p.h) / TS);
      for (let c = c0; c <= c1; c++) {
        if (isSolid(tileAt(world, c, r))) {
          p.y = r * TS - p.h; p.vy = 0; p.onGround = true;
          return;
        }
      }
      p.onGround = false;
    } else {
      const r = Math.floor(p.y / TS);
      for (let c = c0; c <= c1; c++) {
        const t = tileAt(world, c, r);
        if (isSolid(t) || t === T.HIDDEN) {
          bumpBlock(world, c, r, t);
          p.y = (r + 1) * TS; p.vy = 0;
          return;
        }
      }
    }
  }

  function updatePlayer(world) {
    const p = world.player, inp = GameInputs;
    if (p.dead) {
      p.vy += 0.35;
      if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      p.y += p.vy; p.x += p.vx;
      return;
    }
    if (p.flag) { updateFlag(world); return; }

    const run = inp.run;
    const maxV = run ? RUN_MAX : WALK_MAX;
    if (inp.left) { p.vx -= ACCEL; p.facing = -1; }
    else if (inp.right) { p.vx += ACCEL; p.facing = 1; }
    else { p.vx *= FRICTION; if (Math.abs(p.vx) < 0.06) p.vx = 0; }
    p.vx = clamp(p.vx, -maxV, maxV);

    if (inp.consumeJump()) {
      if (p.onGround) { p.vy = JUMP_V; p.onGround = false; snd('jump'); }
    }

    const g = p.vy < 0 ? (inp.jumpHeld ? JUMP_HOLD_G : JUMP_RELEASE_G) : GRAV;
    p.vy += g;
    if (p.vy > MAX_FALL) p.vy = MAX_FALL;

    p.skid = (inp.left && p.vx > 0.8) || (inp.right && p.vx < -0.8);
    if (p.onGround && Math.abs(p.vx) > 0.2) p.walkAnim += Math.abs(p.vx) * 0.09;
    else p.walkAnim = 0;

    movePlayerX(world, p, p.vx);
    movePlayerY(world, p, p.vy);

    /* 火球 */
    if (p.state === 'fire' && inp.run && world.fireCd <= 0 && world.fireballs.length < 2) {
      world.fireballs.push({
        x: p.facing > 0 ? p.x + p.w : p.x - 6, y: p.y + 4,
        w: 6, h: 6, vx: 3.5 * p.facing, vy: 0, bounces: 0,
      });
      world.fireCd = 18;
      snd('fireball');
    }
    if (world.fireCd > 0) world.fireCd--;

    /* 落地重置连击 */
    if (p.onGround && world.stompCombo > 100) world.stompCombo = 100;
  }

  /* ---------- 敌人 ---------- */
  function moveEnemy(world, e, dx) {
    e.x += dx;
    const r0 = Math.floor(e.y / TS), r1 = Math.floor((e.y + e.h - 1) / TS);
    const c = dx > 0 ? Math.floor((e.x + e.w) / TS) : Math.floor(e.x / TS);
    for (let r = r0; r <= r1; r++) {
      if (isSolid(tileAt(world, c, r))) {
        e.vx = -e.vx;
        if (dx > 0) e.x = c * TS - e.w - 0.001; else e.x = (c + 1) * TS + 0.001;
        return;
      }
    }
    if (e.onGround) {
      const cAhead = dx > 0 ? Math.floor((e.x + e.w + 1) / TS) : Math.floor((e.x - 1) / TS);
      const rFeet = Math.floor((e.y + e.h + 1) / TS);
      if (!isSolid(tileAt(world, cAhead, rFeet))) e.vx = -e.vx;
    }
  }
  function enemyGravity(world, e) {
    e.vy += GRAV;
    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
    e.y += e.vy;
    const c0 = Math.floor(e.x / TS), c1 = Math.floor((e.x + e.w - 1) / TS);
    const r = Math.floor((e.y + e.h) / TS);
    for (let c = c0; c <= c1; c++) {
      if (isSolid(tileAt(world, c, r))) {
        e.y = r * TS - e.h; e.vy = 0; e.onGround = true;
        return;
      }
    }
    e.onGround = false;
  }

  function spawnEnemy(world, sp) {
    const type = sp.type;
    if (type === 'goomba') {
      world.enemies.push({
        kind: 'goomba', x: sp.x, y: sp.y + 16 - 16, w: 16, h: 16,
        vx: sp.dir * GOOMBA_SPEED, vy: 0, onGround: false,
        anim: 0, squashT: 0, flyT: 0, remove: false,
      });
    } else if (type === 'koopa') {
      world.enemies.push({
        kind: 'koopa', x: sp.x, y: sp.y + 16 - 24, w: 16, h: 24,
        vx: sp.dir * KOOPA_SPEED, vy: 0, onGround: false,
        anim: 0, shell: false, shellMode: 'idle', flyT: 0, remove: false,
      });
    }
  }

  function updateShell(world, e) {
    e.anim++;
    if (e.shellMode === 'moving') {
      e.x += e.vx;
      const r0 = Math.floor(e.y / TS), r1 = Math.floor((e.y + e.h - 1) / TS);
      const c = e.vx > 0 ? Math.floor((e.x + e.w) / TS) : Math.floor(e.x / TS);
      for (let r = r0; r <= r1; r++) {
        if (isSolid(tileAt(world, c, r))) {
          e.vx = -e.vx;
          e.x = clamp(e.x, c * TS - e.w - 0.001, (c + 1) * TS + 0.001);
          break;
        }
      }
      enemyGravity(world, e);
    } else {
      enemyGravity(world, e);
    }
  }

  function updateEnemies(world) {
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      e.anim++;
      if (e.flyT > 0) {
        e.flyT--;
        e.vy += 0.3; e.y += e.vy; e.x += e.vx;
        if (e.y > VIEW_H + 40) world.enemies.splice(i, 1);
        continue;
      }
      if (e.kind === 'goomba') {
        if (e.squashT > 0) { e.squashT--; if (e.squashT === 0) world.enemies.splice(i, 1); continue; }
        moveEnemy(world, e, e.vx);
        enemyGravity(world, e);
      } else if (e.kind === 'koopa') {
        if (e.shell) { updateShell(world, e); continue; }
        moveEnemy(world, e, e.vx);
        enemyGravity(world, e);
      }
      /* 出屏清理 */
      if (e.x < world.camX - 48 || e.x > world.camX + VIEW_W + 48) world.enemies.splice(i, 1);
    }
  }

  function spawnActivation(world) {
    while (world.spawns.length && world.spawns[0].x < world.camX + VIEW_W + 32) {
      const sp = world.spawns.shift();
      spawnEnemy(world, sp);
    }
  }

  function killEnemyFly(world, e, score) {
    e.flyT = 40; e.vy = -4; e.vx = 0;
    addScore(world, score, e.x + 8, e.y);
    if (e.kind === 'koopa' && e.shell) e.h = 24; /* 显示完整乌龟飞走 */
  }

  function stompEnemy(world, e) {
    const p = world.player;
    const bounce = GameInputs.run ? -5.5 : -4.5;
    p.vy = bounce;
    p.onGround = false;
    addScore(world, world.stompCombo, e.x + 8, e.y);
    world.stompCombo = Math.min(1600, world.stompCombo * 2);
    snd('stomp');
    if (e.kind === 'goomba') {
      e.squashT = 30; e.vx = 0;
    } else if (e.kind === 'koopa') {
      if (!e.shell) {
        e.shell = true; e.shellMode = 'idle'; e.vx = 0;
        e.h = 12; e.y = e.y + 24 - 12;
      } else if (e.shellMode === 'moving') {
        e.shellMode = 'idle'; e.vx = 0;
      }
    }
  }

  /* ---------- 物品 / 金币 / 火球 ---------- */
  function updateItems(world) {
    const p = world.player;
    for (let i = world.items.length - 1; i >= 0; i--) {
      const it = world.items[i];
      if (it.rise > 0) {
        it.rise--;
        it.y -= 1.2;
      } else {
        if (it.kind === 'flower') { /* 静止 + 微浮 */ }
        else if (it.kind === 'star') {
          it.vy += GRAV * 0.8;
          if (it.vy > 7) it.vy = 7;
          it.y += it.vy;
          it.x += it.vx;
          const c0 = Math.floor(it.x / TS), c1 = Math.floor((it.x + it.w - 1) / TS);
          const r = Math.floor((it.y + it.h) / TS);
          for (let c = c0; c <= c1; c++) {
            if (isSolid(tileAt(world, c, r))) { it.y = r * TS - it.h; it.vy = -4.2; break; }
          }
          /* 墙壁反弹 */
          const wall = it.vx > 0 ? Math.floor((it.x + it.w) / TS) : Math.floor(it.x / TS);
          const wr = Math.floor((it.y + 4) / TS);
          if (isSolid(tileAt(world, wall, wr))) it.vx = -it.vx;
        } else {
          /* 蘑菇：滑行并掉落悬崖 */
          it.x += it.vx;
          const wall = it.vx > 0 ? Math.floor((it.x + it.w) / TS) : Math.floor(it.x / TS);
          const wr = Math.floor((it.y + 4) / TS);
          if (isSolid(tileAt(world, wall, wr))) it.vx = -it.vx;
          enemyGravity(world, it);
        }
      }
      /* 收集 */
      if (overlap(p, it)) {
        collectItem(world, it);
        world.items.splice(i, 1);
        continue;
      }
      if (it.x < world.camX - 48 || it.x > world.camX + VIEW_W + 48) world.items.splice(i, 1);
    }
  }

  function collectItem(world, it) {
    const p = world.player;
    if (it.kind === 'mushroom') {
      if (p.state === 'small') { p.state = 'big'; p.h = 32; p.grow = 24; }
      addScore(world, 1000, it.x + 8, it.y);
      snd('powerup');
    } else if (it.kind === 'mushroom1up') {
      world.lives++;
      addScore(world, 1000, it.x + 8, it.y);
      world.popups.push({ x: it.x + 8, y: it.y, t: 0, text: '1UP' });
      snd('oneup');
    } else if (it.kind === 'flower') {
      if (p.state === 'small') { p.state = 'big'; p.h = 32; p.grow = 24; }
      else p.state = 'fire';
      addScore(world, 1000, it.x + 8, it.y);
      snd('powerup');
    } else if (it.kind === 'star') {
      world.starTimer = 600;
      world.starCombo = 100;
      addScore(world, 1000, it.x + 8, it.y);
      snd('powerup');
    }
  }

  function updateCoins(world) {
    const p = world.player;
    for (let i = world.coins.length - 1; i >= 0; i--) {
      const c = world.coins[i];
      if (c.taken) { world.coins.splice(i, 1); continue; }
      const box = { x: c.x, y: c.y, w: 10, h: 14 };
      if (overlap(p, box)) {
        c.taken = true;
        world.coinsCount++;
        addScore(world, 200, c.x + 5, c.y);
        snd('coin');
        if (world.coinsCount >= 100) { world.coinsCount -= 100; world.lives++; snd('oneup'); }
      }
    }
  }

  function updateFireballs(world) {
    for (let i = world.fireballs.length - 1; i >= 0; i--) {
      const fb = world.fireballs[i];
      fb.vy += GRAV;
      if (fb.vy > 7) fb.vy = 7;
      fb.x += fb.vx; fb.y += fb.vy;
      /* 地面反弹 */
      const c0 = Math.floor(fb.x / TS), c1 = Math.floor((fb.x + fb.w - 1) / TS);
      const r = Math.floor((fb.y + fb.h) / TS);
      let hitGround = false;
      for (let c = c0; c <= c1; c++) {
        if (isSolid(tileAt(world, c, r))) { fb.y = r * TS - fb.h; fb.vy = -3; hitGround = true; fb.bounces++; break; }
      }
      /* 墙壁 */
      const wall = fb.vx > 0 ? Math.floor((fb.x + fb.w) / TS) : Math.floor(fb.x / TS);
      const wr = Math.floor((fb.y + 2) / TS);
      if (isSolid(tileAt(world, wall, wr)) && !hitGround) {
        world.fireballs.splice(i, 1); continue;
      }
      if (fb.bounces > 7 || fb.y > VIEW_H + 20 || fb.x < world.camX - 20 || fb.x > world.camX + VIEW_W + 20) {
        world.fireballs.splice(i, 1); continue;
      }
      /* 击杀敌人 */
      for (let j = world.enemies.length - 1; j >= 0; j--) {
        const e = world.enemies[j];
        if (e.flyT > 0) continue;
        if (overlap(fb, e)) {
          killEnemyFly(world, e, 100);
          snd('kick');
          world.fireballs.splice(i, 1);
          break;
        }
      }
    }
  }

  /* ---------- 玩家受击 / 死亡 ---------- */
  function hurtPlayer(world) {
    const p = world.player;
    if (p.invuln > 0 || p.dead || world.starTimer > 0) return;
    if (p.state === 'fire') { p.state = 'big'; p.invuln = 120; snd('powerdown'); }
    else if (p.state === 'big') { p.state = 'small'; p.h = 16; p.invuln = 120; snd('powerdown'); }
    else startDeath(world, true);
  }
  function startDeath(world, bounce) {
    const p = world.player;
    if (p.dead) return;
    p.dead = 1;
    p.vx = 0;
    p.vy = bounce ? -7 : 9;
    snd('die');
    stopMusic();
  }
  function finishDeath(world) {
    world.lives--;
    if (world.lives < 0) {
      world._mode = 'gameover';
    } else {
      resetWorld(world, { score: world.score, coinsCount: world.coinsCount, lives: world.lives });
    }
  }

  /* ---------- 玩家与敌人的碰撞 ---------- */
  function playerVsEnemies(world) {
    const p = world.player;
    if (p.dead || p.flag) return;
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      if (e.flyT > 0 || e.squashT > 0) continue;
      if (!overlap(p, e)) continue;
      if (world.starTimer > 0) {
        killEnemyFly(world, e, world.starCombo);
        world.starCombo = Math.min(1600, world.starCombo * 2);
        snd('stomp');
        continue;
      }
      const stomping = p.vy > 0 && (p.y + p.h - e.y) < 12;
      if (stomping) {
        stompEnemy(world, e);
      } else if (e.kind === 'koopa' && e.shell) {
        if (e.shellMode === 'idle') {
          /* 踢壳 */
          e.shellMode = 'moving';
          e.vx = (p.x + p.w / 2 < e.x + e.w / 2) ? -SHELL_SPEED : SHELL_SPEED;
          addScore(world, 100, e.x + 8, e.y);
          snd('kick');
        } else {
          hurtPlayer(world);
        }
      } else {
        hurtPlayer(world);
      }
    }
  }

  /* ---------- 移动中的壳杀敌人 ---------- */
  function shellVsEnemies(world) {
    const movers = world.enemies.filter(e => e.kind === 'koopa' && e.shell && e.shellMode === 'moving');
    for (const e of movers) {
      for (let j = world.enemies.length - 1; j >= 0; j--) {
        const o = world.enemies[j];
        if (o === e || o.flyT > 0) continue;
        if (overlap(e, o)) {
          killEnemyFly(world, o, 100);
        }
      }
    }
  }

  /* ---------- 旗杆 / 通关 ---------- */
  function checkFlag(world) {
    const p = world.player;
    if (p.dead || p.flag) return;
    const px = world.flagX * TS;
    if (p.x + p.w >= px && p.x < px + TS) {
      const groundY = 12 * TS, topY = world.flagTopY;
      const frac = (p.y + p.h - topY) / (groundY - topY);
      let score = 100;
      for (const [t, s] of FLAG_SCORE_TIERS) { if (frac < t) { score = s; break; } }
      addScore(world, score, px + 8, p.y);
      p.flag = { score };
      p.x = px + 8 - p.w / 2;
      p.vx = 0; p.vy = 0;
      snd('flag');
    }
  }
  function updateFlag(world) {
    const p = world.player;
    p.y += 4.5;
    const groundY = 12 * TS;
    if (p.y + p.h >= groundY) {
      p.y = groundY - p.h;
      p.flag.slide = true;
      world.flagSlide = clamp(p.y + p.h - world.flagTopY, 0, groundY - world.flagTopY);
      p.x += 1.5;
      if (p.x > world.castleX + 60) {
        world._mode = 'clear';
        world._timeBonus = world.time * 50;
        addScore(world, world._timeBonus, p.x, p.y);
        stopMusic();
        snd('clear');
      }
    } else {
      world.flagSlide = clamp(p.y + p.h - world.flagTopY, 0, groundY - world.flagTopY);
    }
  }

  /* ---------- 主步进 ---------- */
  function stepWorld(world) {
    world.frame++;
    const p = world.player;

    if (world._mode !== 'play') return;

    /* 计时 */
    if (!p.dead && !p.flag) {
      world.timeFrames++;
      if (world.timeFrames % 60 === 0) {
        world.time--;
        if (world.time <= 0) { world.time = 0; startDeath(world, true); }
      }
    }

    /* 星星 */
    if (world.starTimer > 0) {
      world.starTimer--;
      if (!world._starMusic) { world._starMusic = true; music('star'); }
      if (world.starTimer === 0) { world._starMusic = false; music('ground'); }
    }

    spawnActivation(world);
    updatePlayer(world);

    if (p.dead) {
      if (p.y > VIEW_H + 40) finishDeath(world);
      updateEffects(world);
      return;
    }

    updateEnemies(world);
    updateItems(world);
    updateCoins(world);
    updateFireballs(world);
    shellVsEnemies(world);
    playerVsEnemies(world);
    checkFlag(world);

    /* 掉落 */
    if (!p.dead && !p.flag && p.y > VIEW_H + 40) startDeath(world, false);

    /* 受伤计时 */
    if (p.invuln > 0) p.invuln--;
    if (p.grow > 0) p.grow--;

    /* 相机 */
    world.camX = clamp(p.x - 88, 0, world.cols * TS - VIEW_W);

    updateEffects(world);
  }

  function updateEffects(world) {
    for (let i = world.popups.length - 1; i >= 0; i--) {
      const pp = world.popups[i];
      pp.t++; pp.y -= 0.6;
      if (pp.t > 45) world.popups.splice(i, 1);
    }
    for (let i = world.particles.length - 1; i >= 0; i--) {
      const pt = world.particles[i];
      pt.t--; pt.vy += 0.35; pt.x += pt.vx; pt.y += pt.vy;
      if (pt.t <= 0 || pt.y > VIEW_H + 20) world.particles.splice(i, 1);
    }
    for (let i = world.bumps.length - 1; i >= 0; i--) {
      world.bumps[i].t--;
      if (world.bumps[i].t <= 0) world.bumps.splice(i, 1);
    }
    for (let i = world.coinPops.length - 1; i >= 0; i--) {
      const cp = world.coinPops[i];
      cp.t++;
      if (cp.t <= 12) cp.y -= 0.9;
      if (cp.t > 26) world.coinPops.splice(i, 1);
    }
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  let cloudCv = null, hillCv = null, bushCv = null;

  function makeCloud() {
    if (cloudCv) return cloudCv;
    cloudCv = document.createElement('canvas'); cloudCv.width = 52; cloudCv.height = 26;
    const g = cloudCv.getContext('2d');
    g.fillStyle = '#fcfcfc';
    g.beginPath(); g.arc(13, 22, 11, 0, 7); g.fill();
    g.beginPath(); g.arc(26, 12, 11, 0, 7); g.fill();
    g.beginPath(); g.arc(39, 22, 11, 0, 7); g.fill();
    g.fillStyle = '#c8c8c8';
    g.fillRect(2, 23, 48, 3);
    return cloudCv;
  }
  function makeHill() {
    if (hillCv) return hillCv;
    hillCv = document.createElement('canvas'); hillCv.width = 68; hillCv.height = 34;
    const g = hillCv.getContext('2d');
    g.fillStyle = '#00a800';
    g.beginPath(); g.ellipse(34, 34, 34, 30, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#007800';
    g.fillRect(0, 31, 68, 3);
    return hillCv;
  }
  function makeBush() {
    if (bushCv) return bushCv;
    bushCv = document.createElement('canvas'); bushCv.width = 52; bushCv.height = 20;
    const g = bushCv.getContext('2d');
    g.fillStyle = '#00a800';
    g.beginPath(); g.arc(13, 16, 9, 0, 7); g.fill();
    g.beginPath(); g.arc(26, 10, 10, 0, 7); g.fill();
    g.beginPath(); g.arc(39, 16, 9, 0, 7); g.fill();
    g.fillStyle = '#007800';
    g.fillRect(2, 17, 48, 2);
    return bushCv;
  }

  function drawSky(ctx, world) {
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    /* 云 */
    for (const c of world.clouds) {
      const x = c * TS - world.camX;
      if (x > -60 && x < VIEW_W + 60) ctx.drawImage(makeCloud(), x, 14);
    }
    /* 山 */
    for (const c of world.hills) {
      const x = c * TS - world.camX - 8;
      if (x > -70 && x < VIEW_W + 70) ctx.drawImage(makeHill(), x, 158);
    }
    /* 灌木 */
    for (const c of world.bushes) {
      const x = c * TS - world.camX - 6;
      if (x > -60 && x < VIEW_W + 60) ctx.drawImage(makeBush(), x, 176);
    }
  }

  function drawGround(ctx, x, y, r) {
    if (r === 12) {
      ctx.fillStyle = '#e8a050';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#c07030';
      const h1 = (x / TS * 7 + y / TS * 13) % 3;
      ctx.fillRect(x + 3, y + 4, 3, 3);
      if (h1 === 0) ctx.fillRect(x + 10, y + 8, 3, 3);
      if (h1 === 1) ctx.fillRect(x + 11, y + 3, 3, 3);
      ctx.fillStyle = '#9c4a10';
      ctx.fillRect(x, y + 13, TS, 3);
    } else {
      ctx.fillStyle = '#d86838';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#c07030';
      const h1 = (x / TS * 7 + y / TS * 13) % 4;
      ctx.fillRect(x + 4, y + 5, 3, 3);
      if (h1 === 0) ctx.fillRect(x + 10, y + 10, 3, 3);
      if (h1 === 1) ctx.fillRect(x + 2, y + 11, 3, 3);
      ctx.fillStyle = '#9c4a10';
      ctx.fillRect(x, y + 14, TS, 2);
    }
  }

  function drawBrick(ctx, x, y) {
    ctx.fillStyle = '#9c4a10';
    ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = '#d86838';
    ctx.fillRect(x + 1, y + 1, 6, 6); ctx.fillRect(x + 9, y + 1, 6, 6);
    ctx.fillRect(x + 1, y + 9, 6, 6); ctx.fillRect(x + 9, y + 9, 6, 6);
    ctx.fillStyle = '#f09858';
    ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 9, y + 1, 2, 2);
    ctx.fillRect(x + 1, y + 9, 2, 2); ctx.fillRect(x + 9, y + 9, 2, 2);
  }

  function drawPipeTL(ctx, x, y) {
    ctx.fillStyle = '#00a800'; ctx.fillRect(x, y + 4, TS, 12);
    ctx.fillStyle = '#58f858'; ctx.fillRect(x + 1, y + 6, 2, 9);
    ctx.fillStyle = '#007800'; ctx.fillRect(x + 12, y + 4, 2, 12);
    /* 管沿 */
    ctx.fillStyle = '#00a800'; ctx.fillRect(x - 2, y, 20, 6);
    ctx.fillStyle = '#007800'; ctx.fillRect(x - 2, y + 4, 20, 2);
    ctx.fillStyle = '#58f858'; ctx.fillRect(x, y + 1, 2, 3);
  }
  function drawPipeTR(ctx, x, y) {
    ctx.fillStyle = '#00a800'; ctx.fillRect(x, y + 4, TS, 12);
    ctx.fillStyle = '#007800'; ctx.fillRect(x + 13, y + 4, 2, 12);
    ctx.fillStyle = '#00a800'; ctx.fillRect(x, y, 20, 6);
    ctx.fillStyle = '#007800'; ctx.fillRect(x, y + 4, 20, 2);
  }
  function drawPipeBL(ctx, x, y) {
    ctx.fillStyle = '#00a800'; ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = '#58f858'; ctx.fillRect(x + 1, y, 2, TS);
    ctx.fillStyle = '#007800'; ctx.fillRect(x + 12, y, 2, TS);
  }
  function drawPipeBR(ctx, x, y) {
    ctx.fillStyle = '#00a800'; ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = '#007800'; ctx.fillRect(x + 13, y, 2, TS);
  }

  function drawCoinSprite(ctx, x, y, frame) {
    const scaleX = [1, 0.35, 1, 0.35][frame % 4];
    ctx.save();
    ctx.translate(x + 8, y + 8);
    ctx.scale(scaleX, 1);
    ctx.fillStyle = '#f8d800';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8a000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(-4, -5, 3, 3);
    ctx.restore();
  }

  function drawTile(ctx, world, t, c, r) {
    const x = c * TS - world.camX, y = r * TS;
    let off = 0;
    for (const b of world.bumps) {
      if (b.c === c && b.r === r && b.t > 4) { off = -4; break; }
    }
    switch (t) {
      case T.GROUND: drawGround(ctx, x, y, r); break;
      case T.BRICK: drawBrick(ctx, x, y + off); break;
      case T.Q: drawSprite(ctx, SPRITES.blockQ, x, y + off); break;
      case T.USED: drawSprite(ctx, SPRITES.blockUsed, x, y + off); break;
      case T.PIPE_TL: drawPipeTL(ctx, x, y); break;
      case T.PIPE_TR: drawPipeTR(ctx, x, y); break;
      case T.PIPE_BL: drawPipeBL(ctx, x, y); break;
      case T.PIPE_BR: drawPipeBR(ctx, x, y); break;
    }
  }

  function drawFlag(ctx, world) {
    const px = world.flagX * TS;
    const sx = px - world.camX;
    const top = world.flagTopY;
    const groundY = 12 * TS;
    const slide = world.flagSlide || 0;
    /* 球 */
    ctx.fillStyle = '#00a800';
    ctx.beginPath(); ctx.arc(sx + 8, top - 6, 4, 0, 7); ctx.fill();
    /* 杆 */
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(sx + 6, top - 3, 5, groundY - top + 3);
    ctx.fillStyle = '#888888'; ctx.fillRect(sx + 9, top - 3, 2, groundY - top + 3);
    /* 旗 */
    const fy = top + 6 + slide;
    if (fy < groundY - 4) {
      ctx.fillStyle = '#00a800';
      ctx.beginPath();
      ctx.moveTo(sx + 10, fy);
      ctx.lineTo(sx + 44, fy + 15);
      ctx.lineTo(sx + 10, fy + 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#005000'; ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawCastle(ctx, world) {
    const x = world.castleX - world.camX;
    const y = 192 - 84;
    /* 主体 */
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(x, y + 20, 96, 84);
    /* 城垛 */
    for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 16, y, 8, 20);
    ctx.fillStyle = '#8a7a5a';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 16, y + 2, 8, 3);
    /* 轮廓 */
    ctx.strokeStyle = '#403020';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 96, 104);
    /* 门洞 */
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(x + 34, y + 60, 28, 44);
    ctx.beginPath(); ctx.arc(x + 48, y + 60, 14, Math.PI, 0); ctx.fill();
    /* 塔顶旗 */
    ctx.strokeStyle = '#403020';
    ctx.beginPath(); ctx.moveTo(x + 20, y - 2); ctx.lineTo(x + 20, y - 16); ctx.stroke();
    ctx.fillStyle = '#e52521';
    ctx.beginPath(); ctx.moveTo(x + 20, y - 16); ctx.lineTo(x + 36, y - 11); ctx.lineTo(x + 20, y - 6); ctx.closePath(); ctx.fill();
  }

  function drawFireball(ctx, world) {
    for (const fb of world.fireballs) {
      const x = fb.x - world.camX, y = fb.y;
      ctx.fillStyle = '#f83800';
      ctx.beginPath(); ctx.arc(x + 3, y + 3, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#f8f8f8';
      ctx.beginPath(); ctx.arc(x + 2.5, y + 2.5, 1.4, 0, 7); ctx.fill();
    }
  }

  function playerSpriteName(world) {
    const p = world.player;
    if (p.dead) return 'smallDead';
    if (p.flag) return 'jump';
    if (!p.onGround) return 'jump';
    if (p.skid) return 'skid';
    if (Math.abs(p.vx) > 0.2) return (Math.floor(p.walkAnim) % 2) ? 'walk1' : 'walk2';
    return 'stand';
  }

  function drawPlayer(ctx, world) {
    const p = world.player;
    if (p.invuln > 0 && Math.floor(world.frame / 4) % 2 === 0 && !p.dead) return;
    let spr;
    const name = playerSpriteName(world);
    if (p.dead) spr = SPRITES.smallDead;
    else if (p.state === 'small') spr = SPRITES['small' + name.charAt(0).toUpperCase() + name.slice(1)];
    else if (p.state === 'fire') spr = SPRITES.bigFire[name];
    else spr = SPRITES['big' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (!spr) spr = SPRITES.smallStand;
    let dx = p.x - 2 - world.camX, dy = p.y;
    if (p.grow > 0 && Math.floor(world.frame / 2) % 2 === 0) {
      /* 变大闪烁：短暂画小形态 */
      spr = SPRITES['small' + name.charAt(0).toUpperCase() + name.slice(1)] || SPRITES.smallStand;
      dy = p.y + (p.h - 16);
    }
    drawSprite(ctx, spr, dx, dy, p.facing < 0);
  }

  function drawEnemy(ctx, world, e) {
    let spr = null, dx = e.x - world.camX, dy = e.y;
    if (e.kind === 'goomba') {
      if (e.squashT > 0) spr = SPRITES.goombaSquash;
      else spr = (Math.floor(e.anim / 12) % 2) ? SPRITES.goomba1 : SPRITES.goomba2;
    } else if (e.kind === 'koopa') {
      if (e.shell) {
        spr = SPRITES.shell;
        dy = e.y + e.h - 12;
      } else {
        spr = (Math.floor(e.anim / 12) % 2) ? SPRITES.koopa1 : SPRITES.koopa2;
      }
    }
    if (!spr) return;
    drawSprite(ctx, spr, dx, dy, e.vx > 0);
  }

  function drawWorld(ctx, world) {
    drawSky(ctx, world);
    const c0 = Math.max(0, Math.floor(world.camX / TS));
    const c1 = Math.min(world.cols - 1, Math.ceil((world.camX + VIEW_W) / TS));
    for (let r = 0; r < world.rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = world.grid[r][c];
        if (t !== T.EMPTY && t !== T.HIDDEN) drawTile(ctx, world, t, c, r);
      }
    }
    drawFlag(ctx, world);
    drawCastle(ctx, world);
    /* 漂浮金币 */
    const cf = Math.floor(world.frame / 7);
    for (const cn of world.coins) {
      const x = cn.x - world.camX;
      if (x > -20 && x < VIEW_W + 20) drawCoinSprite(ctx, x, cn.y, cf);
    }
    /* 物品 */
    for (const it of world.items) {
      let spr = SPRITES.mushroom;
      if (it.kind === 'mushroom1up') spr = SPRITES.mushroom1up;
      else if (it.kind === 'flower') spr = SPRITES.flower;
      else if (it.kind === 'star') spr = (Math.floor(world.frame / 10) % 2) ? SPRITES.star1 : SPRITES.star2;
      const x = it.x - world.camX;
      if (x > -20 && x < VIEW_W + 20) drawSprite(ctx, spr, x - 1, it.y - 1);
    }
    /* 金币弹出 */
    for (const cp of world.coinPops) drawCoinSprite(ctx, cp.x - world.camX, cp.y, 1);
    /* 敌人 */
    for (const e of world.enemies) drawEnemy(ctx, world, e);
    /* 火球 */
    drawFireball(ctx, world);
    /* 砖块碎片 */
    for (const pt of world.particles) {
      ctx.fillStyle = '#d86838';
      ctx.fillRect(pt.x - world.camX, pt.y, 8, 8);
      ctx.fillStyle = '#9c4a10';
      ctx.fillRect(pt.x - world.camX, pt.y + 6, 8, 2);
    }
    /* 玩家 */
    drawPlayer(ctx, world);
    /* 得分弹字 */
    for (const pp of world.popups) {
      drawText(ctx, pp.text, pp.x - world.camX - 8, pp.y, '#fcfcfc');
    }
  }

  function drawHUD(ctx, world) {
    const c = '#fcfcfc';
    drawText(ctx, 'MARIO', 10, 3, c);
    drawText(ctx, String(world.score).padStart(6, '0'), 48, 3, c);
    drawCoinSprite(ctx, 90, 2, 1);
    drawText(ctx, 'x' + String(world.coinsCount).padStart(2, '0'), 108, 3, c);
    drawText(ctx, 'WORLD 1-1', 134, 3, c);
    drawText(ctx, 'TIME', 194, 3, c);
    drawText(ctx, String(Math.max(0, world.time)).padStart(3, '0'), 224, 3, c);
    drawText(ctx, 'LIVES x' + String(world.lives), 10, 13, c);
    if (typeof AudioSys !== 'undefined' && AudioSys && AudioSys.isMuted && AudioSys.isMuted()) drawText(ctx, 'MUTE', 220, 13, '#f8d800');
  }

  function drawTitle(ctx, g) {
    drawSky(ctx, g);
    /* 地面 */
    for (let c = 0; c < 16; c++) {
      drawGround(ctx, c * 16, 192, 12);
      drawGround(ctx, c * 16, 208, 13);
      drawGround(ctx, c * 16, 224, 14);
    }
    drawText(ctx, 'SUPER', 66, 30, '#e52521', 2);
    drawText(ctx, 'MARIO BROS.', 26, 52, '#e52521', 2);
    drawText(ctx, 'WORLD 1-1', 86, 82, '#fcfcfc', 2);
    const blink = Math.floor(g.frame / 30) % 2 === 0;
    if (blink) drawText(ctx, 'PRESS ENTER OR TAP', 58, 112, '#fcfcfc');
    drawText(ctx, 'ARROWS/WASD MOVE  X RUN  Z/SPACE JUMP', 26, 146, '#fcfcfc');
    drawText(ctx, 'M MUTE  P PAUSE  R RESTART', 54, 158, '#fcfcfc');
    drawText(ctx, '吃蘑菇变大, 顶坏砖块, 踩扁怪物!', 22, 178, '#f8d800');
    /* 小演示马力欧 */
    const spr = SPRITES.smallStand;
    if (spr) ctx.drawImage(spr, 118, 176);
  }

  function drawPause(ctx, g) {
    drawText(ctx, 'PAUSED', 92, 110, '#fcfcfc', 2);
    drawText(ctx, 'PRESS P TO CONTINUE', 60, 130, '#fcfcfc');
  }

  function drawGameOver(ctx, g) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'GAME OVER', 80, 104, '#e52521', 2);
    if (Math.floor(g.frame / 30) % 2 === 0) drawText(ctx, 'PRESS ENTER OR TAP', 58, 134, '#fcfcfc');
  }

  function drawClear(ctx, g) {
    drawText(ctx, 'COURSE CLEAR!', 56, 96, '#f8d800', 2);
    drawText(ctx, 'TIME BONUS  ' + String(g._timeBonus), 66, 122, '#fcfcfc');
  }

  /* ============================================================
   * 应用状态机 + 主循环
   * ============================================================ */
  const GAME = {
    mode: 'title',
    world: null,
    frame: 0,
    canvas: null,
    ctx: null,
  };

  function startPlay() {
    GAME.mode = 'play';
    GAME.world = createWorld(buildLevel());
    music('ground');
  }

  function tick() {
    GAME.frame++;
    if (GAME.mode === 'play' && GAME.world) {
      if (GAME.world.paused) {
        /* 什么都不做 */
      } else {
        stepWorld(GAME.world);
        if (GAME.world._mode === 'clear') {
          GAME.mode = 'clear';
          GAME.clearTimer = 0;
        } else if (GAME.world._mode === 'gameover') {
          GAME.mode = 'gameover';
        }
      }
    } else if (GAME.mode === 'clear') {
      GAME.clearTimer++;
      if (GAME.clearTimer > 260) {
        GAME.mode = 'title';
        GAME.world = null;
        stopMusic();
      }
    }
  }

  function render() {
    const ctx = GAME.ctx, g = GAME.world;
    if (!ctx) return;
    if (GAME.mode === 'title') {
      drawTitle(ctx, {
        frame: GAME.frame, camX: 0,
        clouds: [9, 38, 75, 103, 138, 168, 201], hills: [4, 31, 71], bushes: [],
      });
      return;
    }
    if (!g) return;
    drawWorld(ctx, g);
    drawHUD(ctx, g);
    if (GAME.mode === 'clear') drawClear(ctx, g);
    if (GAME.mode === 'gameover') drawGameOver(ctx, g);
    if (g.paused) drawPause(ctx, g);
  }

  let rafId = null, lastT = 0, acc = 0;
  function loop(t) {
    const now = t || 0;
    if (!lastT) lastT = now;
    let dt = now - lastT;
    lastT = now;
    if (dt > 120) dt = 120;
    if (dt < 0) dt = 0;
    acc += dt;
    const stepMs = 1000 / 60;
    let n = 0;
    while (acc >= stepMs && n < 4) { tick(); acc -= stepMs; n++; }
    render();
    rafId = requestAnimationFrame(loop);
  }

  function boot() {
    if (!document) return;
    ensureSprites();
    const canvas = document.getElementById('game');
    if (!canvas) return;
    GAME.canvas = canvas;
    GAME.ctx = canvas.getContext('2d');
    lastT = 0; acc = 0;
    rafId = requestAnimationFrame(loop);
  }

  /* 外部动作（键盘 / 触摸 / 点击） */
  GAME.onExternalAction = function (action) {
    if (action === 'start') {
      if (GAME.mode === 'title' || GAME.mode === 'gameover') {
        if (typeof AudioSys !== 'undefined' && AudioSys) AudioSys.ensure();
        startPlay();
      } else if (GAME.mode === 'play' && GAME.world && GAME.world.paused) {
        GAME.world.paused = false;
      }
    } else if (action === 'restart') {
      if (GAME.mode === 'play') {
        startPlay();
      }
    } else if (action === 'mute') {
      if (typeof AudioSys !== 'undefined') AudioSys.toggleMute();
    } else if (action === 'pause') {
      if (GAME.mode === 'play' && GAME.world) {
        GAME.world.paused = !GAME.world.paused;
        snd('pause');
      }
    } else if (action === 'jump') {
      /* 跳键在标题/结束画面也当启动 */
      if (GAME.mode === 'title' || GAME.mode === 'gameover') GAME.onExternalAction('start');
    }
  };

  GAME.buildLevel = buildLevel;
  GAME.createWorld = createWorld;
  GAME.stepWorld = stepWorld;
  GAME.render = render; /* 测试用 */

  /* 无头模拟（测试用） */
  GAME.simulate = function (level, frames, scriptFn) {
    const world = createWorld(level);
    for (let f = 0; f < frames; f++) {
      if (scriptFn) scriptFn(f, world, GameInputs);
      stepWorld(world);
      if (world._mode !== 'play') break;
    }
    return {
      x: world.player.x, y: world.player.y,
      dead: !!world.player.dead, flag: !!world.player.flag,
      time: world.time, score: world.score, lives: world.lives,
      mode: world._mode,
    };
  };

  if (typeof window !== 'undefined') window.GAME = GAME;
  if (document) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
