'use strict';
/* ============================================================
 * game.js — 游戏主逻辑：状态机、碰撞、渲染、HUD、输入
 * ============================================================ */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /* ---------------- 输入 ---------------- */
  const input = { left: false, right: false, down: false, jump: false, run: false };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump', ArrowUp: 'jump', KeyW: 'jump',
    KeyX: 'run', KeyJ: 'run', ShiftLeft: 'run', ShiftRight: 'run',
  };
  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === 'Enter') { AudioSys.unlock(); Game.confirm(); e.preventDefault(); }
    if (e.code === 'KeyP' && Game.state === 'playing') Game.paused = !Game.paused;
    if (e.code === 'KeyM') AudioSys.toggleMute();
  });
  window.addEventListener('keyup', e => {
    if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = false; e.preventDefault(); }
  });
  /* 触屏虚拟按键 */
  function bindTouch(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = e => { e.preventDefault(); AudioSys.unlock(); input[key] = true; };
    const off = e => { e.preventDefault(); input[key] = false; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindTouch('btn-left', 'left');
  bindTouch('btn-right', 'right');
  bindTouch('btn-jump', 'jump');
  bindTouch('btn-run', 'run');

  /* ---------------- 游戏对象 ---------------- */
  const COMBO_SCORES = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

  const Game = {
    state: 'title',        // title | playing | gameover
    paused: false,
    input,                 // 挂到 Game 上供实体读取
    level: null,
    player: null,
    enemies: [], items: [], effects: [],
    spawns: [],
    camX: 0,
    frame: 0,
    score: 0, coins: 0, lives: 3, time: 300,
    world: '1-1',
    timeAcc: 0,
    bumps: [],
    decorations: [],
    flag: null,            // 通关序列状态
    deathTimer: 0,
    titleBlink: 0,

    /* ---------- 流程 ---------- */
    confirm() {
      if (this.state === 'title') {
        this.startGame();
      } else if (this.state === 'gameover') {
        this.state = 'title';
        AudioSys.Bgm.stop();
      } else if (this.state === 'playing' && this.flag && this.flag.phase === 'done') {
        this.state = 'title';
        AudioSys.Bgm.stop();
      }
    },
    startGame() {
      this.score = 0; this.coins = 0; this.lives = 3;
      this.startLevel();
    },
    startLevel() {
      this.level = buildLevel1();
      this.player = new Player(this.level.start.x, this.level.start.y);
      this.enemies = [];
      this.items = [];
      this.effects = [];
      this.bumps = [];
      this.spawns = this.level.spawns.slice().sort((a, b) => a.x - b.x);
      this.camX = 0;
      this.time = this.level.timeLimit;
      this.timeAcc = 0;
      this.flag = null;
      this.deathTimer = 0;
      this.paused = false;
      /* 背景装饰 */
      this.decorations = [];
      for (let i = 0; i < 12; i++) this.decorations.push({ type: 'hill', x: (i * 46 + 6) * 16, s: i % 2 ? 1 : 2 });
      for (let i = 0; i < 14; i++) this.decorations.push({ type: 'bush', x: (i * 33 + 18) * 16, s: 1 + (i % 3) });
      for (let i = 0; i < 18; i++) this.decorations.push({ type: 'cloud', x: (i * 27 + 5) * 16, y: 28 + (i % 3) * 30, s: 1 + (i % 3) });
      this.state = 'playing';
      AudioSys.Bgm.start();
    },
    sfx(name) { AudioSys.play(name); },
    addScore(n, x, y) {
      this.score += n;
      if (x !== undefined) this.effects.push(new FloatText(n, x, y));
    },
    addCoin() {
      this.coins++;
      this.score += 200;
      if (this.coins >= 100) {
        this.coins -= 100;
        this.lives++;
        this.sfx('oneUp');
      }
    },

    /* ---------- 顶块 ---------- */
    hitBlock(tx, ty) {
      const t = this.level.get(tx, ty);
      const bx = tx * 16, by = ty * 16;
      if (t === T.BRICK) {
        if (this.player.big) {
          this.level.set(tx, ty, T.EMPTY);
          this.sfx('brick');
          this.score += 50;
          this.effects.push(new BrickPiece(bx + 2, by + 2, -1.4, -5.5));
          this.effects.push(new BrickPiece(bx + 12, by + 2, 1.4, -5.5));
          this.effects.push(new BrickPiece(bx + 2, by + 10, -1.0, -3.5));
          this.effects.push(new BrickPiece(bx + 12, by + 10, 1.0, -3.5));
          this.bumpKillEnemies(tx, ty);
        } else {
          this.sfx('bump');
          this.bumps.push({ tx, ty, t: 0 });
          this.bumpKillEnemies(tx, ty);
        }
      } else if (t === T.QCOIN) {
        this.level.set(tx, ty, T.USED);
        this.bumps.push({ tx, ty, t: 0 });
        this.addCoin();
        this.sfx('coin');
        this.effects.push(new CoinPop(bx + 8, by));
        this.effects.push(new FloatText(200, bx + 2, by - 10));
        this.bumpKillEnemies(tx, ty);
      } else if (t === T.QMUSH) {
        this.level.set(tx, ty, T.USED);
        this.bumps.push({ tx, ty, t: 0 });
        this.sfx('appear');
        this.items.push(new Mushroom(tx, ty));
        this.bumpKillEnemies(tx, ty);
      } else if (TILE_SOLID.has(t)) {
        this.sfx('bump');
      }
    },
    /* 顶块震死块上方敌人 */
    bumpKillEnemies(tx, ty) {
      const bx = tx * 16, top = ty * 16;
      for (const e of this.enemies) {
        if (e.remove || e.flipDead || (e.squash > 0)) continue;
        if (Math.abs((e.y + e.h) - top) < 5 && e.x + e.w > bx && e.x < bx + 16) {
          e.killFlip(this, e.x < bx + 8 ? -1 : 1);
          this.addScore(100, e.x, e.y);
        }
      }
    },

    /* ---------- 死亡 ---------- */
    onPlayerDead() {
      AudioSys.Bgm.stop();
      this.sfx('die');
      this.deathTimer = 200;
    },
    onPlayerFall() {
      this.player.hidden = true;
      this.player.state = 'dead';
      this.player.vy = 0;
      this.onPlayerDead();
    },

    /* ---------- 通关 ---------- */
    startClear() {
      const p = this.player;
      AudioSys.Bgm.stop();
      this.sfx('flag');
      const bonus = Math.max(100, Math.min(5000, Math.round((12 * 16 - p.y) / 16) * 200));
      this.addScore(bonus, p.x, p.y - 8);
      this.flag = { phase: 'slide', flagY: 48, t: 0, t2: undefined };
      p.x = this.level.poleX - p.w - 1;
      p.vx = 0; p.vy = 0;
      input.left = input.right = false;
    },
    updateClear() {
      const f = this.flag;
      const p = this.player;
      if (!f) return;
      if (f.phase === 'slide') {
        if (f.flagY < 11 * 16) f.flagY = Math.min(f.flagY + 2.6, 11 * 16);
        const bottomTarget = 12 * 16 - p.h;
        if (p.y < bottomTarget) p.y = Math.min(p.y + 2.6, bottomTarget);
        else if (f.flagY >= 11 * 16) { f.phase = 'pause'; f.t = 24; }
      } else if (f.phase === 'pause') {
        if (--f.t <= 0) { f.phase = 'walk'; p.x = this.level.poleX + 2; }
      } else if (f.phase === 'walk') {
        p.faceRight = true;
        p.vx = 1.2;
        p.animT += 1.2;
        p.x += p.vx;
        p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);
        p.y += p.vy;
        const ty = Math.floor((p.y + p.h) / 16);
        if (solidRowCols(this.level, p.x + 1, p.x + p.w - 1, ty).length && p.vy >= 0) {
          p.y = ty * 16 - p.h; p.vy = 0;
        }
        if (p.x >= this.level.doorX - 10) { p.hidden = true; f.phase = 'count'; }
      } else if (f.phase === 'count') {
        if (this.time > 0) {
          this.time = Math.max(0, this.time - 2);
          this.score += 100;
          if (this.frame % 4 === 0) this.sfx('tick');
        } else {
          if (f.t2 === undefined) { f.t2 = 80; this.sfx('clear'); }
          else if (--f.t2 <= 0) f.phase = 'done';
        }
      }
    },

    /* ---------- 主更新 ---------- */
    tick() {
      this.frame++;
      if (this.state !== 'playing' || this.paused) return;

      /* 死亡流程 */
      if (this.player.state === 'dead') {
        this.player.update(this);
        if (--this.deathTimer <= 0) {
          this.lives--;
          if (this.lives <= 0) { this.state = 'gameover'; }
          else this.startLevel();
        }
        return;
      }

      /* 通关序列 */
      if (this.flag) {
        this.updateClear();
        this.updateEffects();
        return;
      }

      const p = this.player;
      p.update(this);

      /* 敌人生成 */
      while (this.spawns.length && this.spawns[0].x < this.camX + VIEW_W + 24) {
        const s = this.spawns.shift();
        if (s.type === 'goomba') this.enemies.push(new Goomba(s.x, 13 * 16 - 13));
        else this.enemies.push(new Koopa(s.x, 13 * 16 - 14));
      }

      for (const e of this.enemies) e.update(this);
      for (const m of this.items) m.update(this);
      this.updateEffects();

      /* —— 碰撞：玩家 vs 敌人（变大/变小动画期间无敌） —— */
      if (p.state === 'normal') {
        for (const e of this.enemies) {
          if (e.remove || e.flipDead || (e.squash > 0) || !e.active) continue;
          if (e.noHurt > 0) continue;
          if (!p.overlaps(e)) continue;
          const stomping = p.vy > 0 && (p.y + p.h) - e.y < Math.max(8, p.vy + 4);
          if (stomping) {
            p.y = e.y - p.h;
            p.vy = input.jump ? -7 : -4.6;
            const sc = COMBO_SCORES[Math.min(p.comboLevel, COMBO_SCORES.length - 1)];
            p.comboLevel++;
            this.addScore(sc, e.x, e.y - 6);
            e.stomp(this);
          } else if (e instanceof Koopa && e.mode === 'shell') {
            const dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
            e.kick(this, dir);
          } else {
            p.hurt(this);
          }
        }
      }

      /* —— 碰撞：滑行龟壳 vs 其他敌人 —— */
      for (const sh of this.enemies) {
        if (!(sh instanceof Koopa) || sh.mode !== 'slide' || sh.remove) continue;
        for (const o of this.enemies) {
          if (o === sh || o.remove || o.flipDead || (o.squash > 0)) continue;
          if (sh.overlaps(o)) {
            o.killFlip(this, Math.sign(sh.vx) || 1);
            this.addScore(500, o.x, o.y - 6);
          }
        }
      }

      /* —— 碰撞：玩家 vs 道具 —— */
      for (const m of this.items) {
        if (m.remove || m.state !== 'walk' || !p.overlaps(m)) continue;
        m.remove = true;
        this.addScore(1000, m.x, m.y - 6);
        if (!p.big && p.state === 'normal') {
          const bottom = p.y + p.h;
          p.big = true; p.h = 26; p.y = bottom - p.h;
          p.state = 'grow'; p.animTimer = 40;
          this.sfx('powerUp');
        }
      }

      /* —— 收集场景金币 —— */
      {
        const tx0 = Math.floor(p.x / 16), tx1 = Math.floor((p.x + p.w) / 16);
        const ty0 = Math.floor(p.y / 16), ty1 = Math.floor((p.y + p.h) / 16);
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            if (this.level.get(tx, ty) === T.COIN) {
              this.level.set(tx, ty, T.EMPTY);
              this.addCoin();
              this.sfx('coin');
              this.effects.push(new FloatText(200, tx * 16, ty * 16 - 4));
            }
          }
        }
      }

      /* —— 旗杆：靠近杆即触发（底座会先挡住玩家，不能等完全越过杆心） —— */
      if (p.x + p.w >= this.level.poleX - 10 && p.x <= this.level.poleX + 40) this.startClear();

      /* 清理 */
      this.enemies = this.enemies.filter(e => !e.remove);
      this.items = this.items.filter(m => !m.remove);
      this.effects = this.effects.filter(f => !f.remove);
      for (const b of this.bumps) b.t++;
      this.bumps = this.bumps.filter(b => b.t <= 10);

      /* 相机 */
      const target = p.x - 100;
      if (target > this.camX) this.camX = Math.min(target, this.level.w * 16 - VIEW_W);

      /* 时间 */
      this.timeAcc += 1 / 60;
      while (this.timeAcc >= 0.4) {
        this.timeAcc -= 0.4;
        this.time--;
        if (this.time <= 0) { this.time = 0; p.die(this); }
      }
    },
    updateEffects() {
      for (const f of this.effects) f.update(this);
      this.effects = this.effects.filter(f => !f.remove);
    },

    /* ---------- 渲染 ---------- */
    render() {
      const g = ctx;
      if (this.state === 'title') { this.renderTitle(g); return; }
      if (this.state === 'gameover') { this.renderGameOver(g); return; }
      this.renderWorld(g);
      this.renderHUD(g);
      if (this.paused) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(0, 0, VIEW_W, VIEW_H);
        drawTextCentered(g, 'PAUSED', VIEW_W / 2, 112, '#ffffff', 2);
      }
    },
    renderWorld(g) {
      const cam = Math.floor(this.camX);
      /* 天空 */
      g.fillStyle = '#5c94fc';
      g.fillRect(0, 0, VIEW_W, VIEW_H);

      /* 背景装饰 */
      for (const d of this.decorations) {
        const dx = d.x - cam;
        if (dx < -120 || dx > VIEW_W + 120) continue;
        if (d.type === 'hill') this.drawHill(g, dx, 13 * 16, d.s);
        else if (d.type === 'bush') this.drawBush(g, dx, 13 * 16, d.s);
        else this.drawCloud(g, dx, d.y, d.s);
      }

      /* 城堡 */
      this.drawCastle(g, this.level.castleX - cam, 13 * 16);

      /* 旗子 */
      {
        const flagY = this.flag ? this.flag.flagY : 48;
        drawSprite(g, Sprites.flag, this.level.poleX - 10 - cam, flagY, false);
      }

      /* 正在升起的蘑菇画在砖块后面 */
      for (const m of this.items) {
        if (m.state === 'rise') { g.save(); g.translate(-cam, 0); m.draw(g); g.restore(); }
      }

      /* tiles */
      const blink = [0, 0, 0, 0, 1, 2, 1][Math.floor(this.frame / 8) % 7];
      const c0 = Math.max(0, Math.floor(cam / 16) - 1);
      const c1 = Math.min(this.level.w - 1, Math.floor((cam + VIEW_W) / 16) + 1);
      for (let ty = 0; ty < LEVEL_H; ty++) {
        for (let tx = c0; tx <= c1; tx++) {
          const t = this.level.get(tx, ty);
          if (t === T.EMPTY) continue;
          const px = tx * 16 - cam;
          let py = ty * 16;
          const bump = this.bumps.find(b => b.tx === tx && b.ty === ty);
          if (bump) py -= Math.sin(bump.t / 10 * Math.PI) * 6;
          if (t === T.COIN) {
            const sx = Math.abs(Math.cos(this.frame * 0.09));
            drawSprite(g, Sprites.coin, px + 3 + (1 - sx) * 5, py + 2, false, sx);
          } else if (t === T.QCOIN || t === T.QMUSH) {
            g.drawImage(TileArt[t + '_' + blink], px, Math.round(py));
          } else if (TileArt[t]) {
            g.drawImage(TileArt[t], px, Math.round(py));
          }
        }
      }

      /* 实体 */
      g.save(); g.translate(-cam, 0);
      for (const m of this.items) if (m.state !== 'rise') m.draw(g);
      for (const e of this.enemies) e.draw(g, this.frame);
      if (!this.player.hidden) this.player.draw(g, this.frame);
      for (const f of this.effects) f.draw(g, this.frame);
      g.restore();

      /* 通关文案 */
      if (this.flag && (this.flag.phase === 'done' || this.flag.phase === 'count' && this.time === 0)) {
        drawTextCentered(g, 'COURSE CLEAR!', VIEW_W / 2, 96, '#ffffff', 2);
        if (this.flag.phase === 'done' && Math.floor(this.frame / 30) % 2 === 0) {
          drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 128, '#ffd94a', 1);
        }
      }
    },
    drawHill(g, x, baseY, size) {
      const r = size * 14;
      g.fillStyle = '#1d7a25';
      g.beginPath();
      g.moveTo(x - r, baseY);
      g.quadraticCurveTo(x, baseY - r * 1.6, x + r, baseY);
      g.closePath();
      g.fill();
      g.fillStyle = '#0c3d10';
      g.fillRect(x - 4, baseY - r * 0.9, 2, 2);
      g.fillRect(x + 6, baseY - r * 0.55, 2, 2);
      g.fillRect(x - 12, baseY - r * 0.5, 2, 2);
    },
    drawBush(g, x, baseY, n) {
      g.fillStyle = '#2fa82f';
      for (let i = 0; i < n; i++) {
        g.beginPath();
        g.arc(x + i * 12, baseY - 6, 8, Math.PI, 0);
        g.fill();
      }
      g.fillRect(x - 8, baseY - 6, n * 12 + 4, 6);
    },
    drawCloud(g, x, y, n) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        g.beginPath();
        g.arc(x + i * 12, y + 6, 8, 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(x - 4, y + 6, n * 12 + 4, 6);
    },
    drawCastle(g, x, baseY) {
      const BR = '#c84c0c', DK = '#3c1800', BK = '#000000';
      if (x < -100 || x > VIEW_W + 20) return;
      /* 主体 */
      g.fillStyle = BR; g.fillRect(x, baseY - 48, 80, 48);
      /* 垛口 */
      for (let i = 0; i < 5; i++) g.fillRect(x + i * 16, baseY - 56, 10, 8);
      /* 上塔 */
      g.fillStyle = BR; g.fillRect(x + 16, baseY - 80, 48, 32);
      for (let i = 0; i < 3; i++) g.fillRect(x + 18 + i * 16, baseY - 88, 10, 8);
      /* 窗与门 */
      g.fillStyle = BK;
      g.fillRect(x + 24, baseY - 72, 8, 10);
      g.fillRect(x + 48, baseY - 72, 8, 10);
      g.fillRect(x + 32, baseY - 24, 16, 24);
      g.beginPath(); g.arc(x + 40, baseY - 24, 8, Math.PI, 0); g.fill();
      /* 砖缝 */
      g.fillStyle = DK;
      for (let yy = baseY - 44; yy < baseY; yy += 8) g.fillRect(x, yy, 80, 1);
    },
    renderHUD(g) {
      drawText(g, 'MARIO', 16, 8, '#ffffff', 1);
      drawText(g, String(this.score).padStart(6, '0'), 16, 16, '#ffffff', 1);
      g.drawImage(Sprites.coin, 88, 14);
      drawText(g, 'x' + String(this.coins).padStart(2, '0'), 100, 16, '#ffffff', 1);
      drawText(g, 'WORLD', 144, 8, '#ffffff', 1);
      drawText(g, this.world, 148, 16, '#ffffff', 1);
      drawText(g, 'TIME', 200, 8, '#ffffff', 1);
      drawText(g, String(Math.max(0, this.time)).padStart(3, '0'), 204, 16, '#ffffff', 1);
      drawText(g, 'LIVES x' + this.lives, 16, 226, '#ffffff', 1);
    },
    renderTitle(g) {
      g.fillStyle = '#5c94fc';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      /* 地面 */
      for (let tx = 0; tx < VIEW_W / 16; tx++) {
        g.drawImage(TileArt[T.GROUND], tx * 16, 13 * 16);
        g.drawImage(TileArt[T.GROUND], tx * 16, 14 * 16);
      }
      this.drawHill(g, 60, 13 * 16, 1);
      this.drawBush(g, 180, 13 * 16, 3);
      this.drawCloud(g, 40, 36, 3);
      this.drawCloud(g, 150, 52, 2);
      /* 牌匾 */
      g.fillStyle = '#9c1a10';
      g.fillRect(38, 44, 180, 56);
      g.fillStyle = '#e73c2e';
      g.fillRect(42, 48, 172, 48);
      g.fillStyle = '#3c1800';
      g.fillRect(38, 44, 180, 2); g.fillRect(38, 98, 180, 2);
      g.fillRect(38, 44, 2, 56); g.fillRect(178 + 38, 44, 2, 56);
      drawTextCentered(g, 'SUPER', VIEW_W / 2, 54, '#ffd94a', 3);
      drawTextCentered(g, 'MARIO JS', VIEW_W / 2, 76, '#ffffff', 2);
      drawTextCentered(g, 'A FAN-MADE TRIBUTE', VIEW_W / 2, 112, '#ffffff', 1);
      if (Math.floor(this.frame / 30) % 2 === 0) {
        drawTextCentered(g, 'PRESS ENTER TO START', VIEW_W / 2, 132, '#ffffff', 1);
      }
      drawTextCentered(g, 'ARROWS: MOVE   Z: JUMP', VIEW_W / 2, 156, '#c0d8ff', 1);
      drawTextCentered(g, 'X: RUN   DOWN: CROUCH', VIEW_W / 2, 166, '#c0d8ff', 1);
      drawTextCentered(g, 'P: PAUSE   M: SOUND', VIEW_W / 2, 176, '#c0d8ff', 1);
      this.frame++;
    },
    renderGameOver(g) {
      g.fillStyle = '#000000';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawTextCentered(g, 'GAME OVER', VIEW_W / 2, 100, '#ffffff', 2);
      drawText(g, 'SCORE ' + String(this.score).padStart(6, '0'), 88, 130, '#ffffff', 1);
      if (Math.floor(this.frame / 30) % 2 === 0) {
        drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 150, '#ffd94a', 1);
      }
      this.frame++;
    },
  };

  /* ---------------- 主循环（固定 60fps 步长） ---------------- */
  let last = 0, acc = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!last) last = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    const step = 1 / 60;
    let n = 0;
    while (acc >= step && n < 5) { Game.tick(); acc -= step; n++; }
    Game.render();
  }
  requestAnimationFrame(loop);

  window.__MARIO_GAME = Game;
})();
