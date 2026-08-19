'use strict';
/* ============================================================
 * entities.js — 实体：马里奥、敌人、道具、火球
 * 物理参数尽量还原 SMB1（60fps，单位：像素/帧）
 * ============================================================ */

const PHYS = {
  WALK_ACC: 0.038, RUN_ACC: 0.056, DECEL: 0.05, SKID: 0.1015,
  MAX_WALK: 1.5625, MAX_RUN: 2.5625,
  JUMP: 4.0, JUMP_FAST: 4.25, GRAV_HOLD: 0.125, GRAV: 0.4375, MAX_FALL: 4.5,
  ENEMY_G: 0.35, STOMP_BOUNCE: 2.6, STOMP_BOUNCE_HOLD: 4.0,
};

// ---------------- 基类 ----------------
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.room = 'main'; this.remove = false; this.facing = 1;
    this.grounded = false; this.hitWall = 0;
  }
  get right() { return this.x + this.w; }
  get bottom() { return this.y + this.h; }
  get top() { return this.y; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  overlaps(o) {
    return this.x < o.x + o.w && this.x + this.w > o.x &&
           this.y < o.y + o.h && this.y + this.h > o.y;
  }
}

// ---------------- 瓦片碰撞 ----------------
// 返回头顶撞到的瓦片（供玩家顶砖），其余情况返回 null
function isSolidFor(ent, tx, ty, goingUp) {
  const c = Level.tile(ent.room, tx, ty);
  if (c === 'H') return !!(goingUp && ent.isPlayer);   // 隐藏块只有玩家上升时是实体
  return Level.isSolid(c);
}

function moveAndCollide(ent, opts) {
  opts = opts || {};
  let bumped = null;
  const spanY = (e) => [Math.floor(e.y / 16), Math.floor((e.y + e.h - 0.01) / 16)];

  // ---- X 轴 ----
  ent.x += ent.vx;
  ent.hitWall = 0;
  {
    const [y0, y1] = spanY(ent);
    if (ent.vx > 0) {
      const tx = Math.floor((ent.x + ent.w - 0.01) / 16);
      for (let ty = y0; ty <= y1; ty++) {
        if (isSolidFor(ent, tx, ty, false)) {
          ent.x = tx * 16 - ent.w; ent.hitWall = 1;
          if (opts.bounce) ent.vx = Math.abs(ent.vx); else ent.vx = 0;
          if (opts.onWall) opts.onWall(tx, ty);
          break;
        }
      }
    } else if (ent.vx < 0) {
      const tx = Math.floor(ent.x / 16);
      for (let ty = y0; ty <= y1; ty++) {
        if (isSolidFor(ent, tx, ty, false)) {
          ent.x = (tx + 1) * 16; ent.hitWall = -1;
          if (opts.bounce) ent.vx = -Math.abs(ent.vx); else ent.vx = 0;
          if (opts.onWall) opts.onWall(tx, ty);
          break;
        }
      }
    }
  }

  // ---- Y 轴 ----
  ent.y += ent.vy;
  ent.grounded = false;
  {
    const x0 = Math.floor(ent.x / 16), x1 = Math.floor((ent.x + ent.w - 0.01) / 16);
    if (ent.vy > 0) {
      const ty = Math.floor((ent.y + ent.h - 0.01) / 16);
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolidFor(ent, tx, ty, false)) {
          ent.y = ty * 16 - ent.h; ent.vy = 0; ent.grounded = true;
          if (opts.onLand) opts.onLand(tx, ty);
          break;
        }
      }
    } else if (ent.vy < 0) {
      const ty = Math.floor(ent.y / 16);
      const hits = [];
      for (let tx = x0; tx <= x1; tx++) if (isSolidFor(ent, tx, ty, true)) hits.push(tx);
      if (hits.length) {
        ent.y = (ty + 1) * 16; ent.vy = 0;
        let best = hits[0], bd = 1e9;
        for (const tx of hits) {
          const d = Math.abs(tx * 16 + 8 - (ent.x + ent.w / 2));
          if (d < bd) { bd = d; best = tx; }
        }
        bumped = { tx: best, ty };
      }
    }
  }
  return bumped;
}

// ---------------- 马里奥 ----------------
class Player extends Entity {
  constructor(x, y) {
    super(x, y, 12, 15);
    this.isPlayer = true;
    this.power = 0;             // 0 小 1 大 2 火
    this.facing = 1;
    this.jumpHeld = false;
    this.crouch = false;
    this.skidding = false;
    this.invT = 0;              // 受伤无敌
    this.starT = 0;             // 无敌星
    this.transform = 0;         // 变身冻结帧
    this.transformFrom = 0; this.transformTo = 0;
    this.stompChain = 0;
    this.starChain = 0;
    this.dead = false; this.deadT = 0;
    this.animT = 0;
    this.fireCd = 0;
    this.flagMode = null;       // 'slide'|'off'|'walk'|'done'
    this.pipeMode = null;       // {dir:'down'|'up'|'right', t}
  }

  get big() { return this.power > 0; }

  applyPower(p) {
    const feet = this.bottom;
    this.power = p;
    this.h = p > 0 ? 30 : 15;
    this.y = feet - this.h;
  }

  hurt(game) {
    if (this.invT > 0 || this.starT > 0 || this.transform > 0) return;
    if (this.power > 0) {
      this.transformFrom = this.power; this.transformTo = 0;
      this.transform = 48; this.invT = 150;
      Sound.sfx.shrink();
    } else {
      game.killPlayer();
    }
  }

  update(game) {
    const inp = game.input;

    // ---- 变身冻结 ----
    if (this.transform > 0) {
      this.transform--;
      if (this.transform === 0) this.applyPower(this.transformTo);
      return;
    }

    // ---- 死亡动画 ----
    if (this.dead) {
      this.deadT++;
      if (this.deadT === 24) this.vy = -4.2;
      if (this.deadT > 24) { this.vy = Math.min(this.vy + 0.2, 4.5); this.y += this.vy; }
      return;
    }

    // ---- 旗杆序列 ----
    if (this.flagMode === 'slide') {
      this.y = Math.min(this.y + 2.2, 12 * 16 - this.h);
      return;
    }
    if (this.flagMode === 'off') {   // 跳下旗杆
      this.x += 1.2; this.vy = Math.min(this.vy + 0.3, 4);
      this.y += this.vy;
      const b = moveAndCollide(this, {});
      if (this.grounded) this.flagMode = 'walk';
      return;
    }
    if (this.flagMode === 'walk') {  // 走向城堡
      this.facing = 1; this.vx = 1.1;
      this.vy = Math.min(this.vy + PHYS.GRAV, PHYS.MAX_FALL);
      this.animT += 0.55;
      moveAndCollide(this, {});
      if (this.x >= game.castleDoorX) { this.flagMode = 'done'; game.onMarioAtCastle(); }
      return;
    }
    if (this.flagMode === 'done') return;

    // ---- 水管动画 ----
    if (this.pipeMode) {
      const pm = this.pipeMode;
      pm.t++;
      if (pm.dir === 'down') this.y += 0.7;
      else if (pm.dir === 'up') this.y -= 0.7;
      else if (pm.dir === 'right') this.x += 0.7;
      if (pm.t >= 46) game.pipeArrived();
      return;
    }

    // ---- 输入 ----
    const left = inp.left, right = inp.right;
    const run = inp.run;
    this.crouch = this.big && inp.down && this.grounded;
    if (!this.big) this.crouch = false;

    const acc = run ? PHYS.RUN_ACC : PHYS.WALK_ACC;
    const maxV = run ? PHYS.MAX_RUN : PHYS.MAX_WALK;
    this.skidding = false;

    if (!this.crouch && (left || right)) {
      const dir = right ? 1 : -1;
      if (this.grounded && this.vx * dir < 0 && Math.abs(this.vx) > 0.4) {
        this.skidding = true;
        this.vx += dir * PHYS.SKID;
      } else {
        this.vx += dir * acc;
      }
      this.facing = dir;
    } else if (this.grounded) {
      if (Math.abs(this.vx) < PHYS.DECEL) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * PHYS.DECEL;
    }
    this.vx = Math.max(-PHYS.MAX_RUN, Math.min(PHYS.MAX_RUN, this.vx));
    if (Math.abs(this.vx) > maxV) {
      // 只在超速时缓慢回落（跑动中松开 B）
      this.vx -= Math.sign(this.vx) * PHYS.DECEL;
      if (Math.abs(this.vx) < maxV) this.vx = Math.sign(this.vx) * maxV;
    }

    // 跳跃
    if (inp.jumpEdge && this.grounded) {
      this.vy = -(Math.abs(this.vx) > 2.2 ? PHYS.JUMP_FAST : PHYS.JUMP);
      this.grounded = false;
      if (this.big) Sound.sfx.jumpBig(); else Sound.sfx.jump();
    }
    this.jumpHeld = inp.jump;

    // 重力（上升中按住跳跃键 = 低重力，实现可变跳高）
    const g = (this.vy < 0 && this.jumpHeld) ? PHYS.GRAV_HOLD : PHYS.GRAV;
    this.vy = Math.min(this.vy + g, PHYS.MAX_FALL);

    // 火球
    if (this.fireCd > 0) this.fireCd--;
    if (inp.runEdge && this.power === 2 && game.fireballs.length < 2 && !this.crouch) {
      game.spawnFireball();
      this.fireCd = 8;
    }

    // 蹲下时压缩碰撞盒（保持脚底）
    const wantH = (this.big && this.crouch) ? 16 : (this.big ? 30 : 15);
    if (wantH !== this.h) {
      if (wantH < this.h) { this.y += this.h - wantH; this.h = wantH; }
      else {
        // 站起前检查头顶是否有砖
        const headTy = Math.floor((this.bottom - wantH) / 16);
        let blocked = false;
        for (let tx = Math.floor(this.x / 16); tx <= Math.floor((this.x + this.w - 0.01) / 16); tx++)
          if (isSolidFor(this, tx, headTy, false)) blocked = true;
        if (!blocked) { this.y -= wantH - this.h; this.h = wantH; }
        else this.crouch = true;
      }
    }

    // 移动 + 碰撞
    const bumped = moveAndCollide(this, {});
    if (bumped) game.bumpTile(bumped.tx, bumped.ty);

    // 边界
    if (this.x < game.camX) { this.x = game.camX; if (this.vx < 0) this.vx = 0; }
    const maxX = Level.rooms[this.room].w * 16 - this.w - 8;
    if (this.x > maxX) this.x = maxX;

    // 掉坑
    if (this.y > 15 * 16 + 16) { game.killPlayer(true); return; }

    // 进入水管（站在水管上按 ↓）
    if (inp.down && this.grounded) {
      const w = Level.rooms[this.room].warps;
      if (w) for (const wp of w) {
        // 站在该水管顶部
        const topY = (Level.rooms[this.room].h - 2 - wp.h) * 16;
        if (this.x + this.w > wp.x * 16 + 2 && this.x < (wp.x + 2) * 16 - 2 && Math.abs(this.bottom - topY) < 2) {
          game.startPipe(wp);
          return;
        }
      }
    }

    // 旗杆（碰到旗杆所在列即触发，含底座方块）
    if (this.x + this.w >= game.flagX && game.flagX > 0) {
      game.startFlag();
    }

    if (this.invT > 0) this.invT--;
    if (this.starT > 0) {
      this.starT--;
      if (this.starT === 0) game.onStarEnd();
    }
    if (this.grounded) { this.stompChain = 0; this.starChain = 0; }

    // 动画计时
    if (Math.abs(this.vx) > 0.1) this.animT += Math.abs(this.vx) * 0.28;
    else this.animT = 0;
  }

  // 绘制（game 提供 ctx 与相机）
  draw(ctx, camX) {
    if (this.flagMode === 'done') return;
    let name, big = this.big;
    if (this.dead) { name = 'smDie'; big = false; }
    else if (this.flagMode === 'slide') name = big ? 'bgClimb' : 'smClimb';
    else if (this.crouch && big) name = 'bgCrouch';
    else if (!this.grounded && !this.pipeMode) name = big ? 'bgJump' : 'smJump';
    else if (this.skidding) name = big ? 'bgSkid' : 'smSkid';
    else if (Math.abs(this.vx) > 0.1) {
      const f = (Math.floor(this.animT) % 3) + 1;
      name = (big ? 'bgWalk' : 'smWalk') + f;
    } else name = big ? 'bgStand' : 'smStand';

    let variant = '';
    if (this.starT > 0) variant = ['', 'fire', 'starA', 'starB'][Math.floor(game.frame / 3) % 4];
    else if (this.power === 2) variant = 'fire';

    // 变身闪烁
    if (this.transform > 0) {
      const flip = Math.floor(this.transform / 4) % 2 === 0;
      if (this.transformTo > this.transformFrom) { big = flip; }         // 变大
      else { big = !flip; }                                              // 变小
      if (this.transformTo === 2 && this.transformFrom === 1) big = true; // 变火
      name = big ? 'bgStand' : 'smStand';
      if (this.transformTo === 2 && this.transformFrom > 0) {
        name = 'bgStand'; variant = (Math.floor(this.transform / 4) % 2 === 0) ? 'fire' : '';
      }
    }

    const spr = Sprites.get(name, variant, this.facing < 0);
    if (!spr) return;
    // 受伤无敌闪烁
    if (this.invT > 0 && Math.floor(game.frame / 4) % 2 === 0 && !this.transform) return;
    const dx = Math.round(this.x - camX) - 2;
    const dy = Math.round(this.bottom) - spr.height;
    ctx.drawImage(spr, dx, dy);
  }
}

// ---------------- 板栗仔 ----------------
class Goomba extends Entity {
  constructor(x, y) {
    super(x, y, 12, 15);
    this.vx = -0.55;
    this.squashT = 0;
    this.flip = false;       // 被火球/龟壳/星星击杀（翻转坠落）
    this.active = false;
  }
  update(game) {
    if (this.squashT > 0) { this.squashT--; if (!this.squashT) this.remove = true; return; }
    if (this.flip) {
      this.vy = Math.min(this.vy + 0.3, 4.5); this.y += this.vy; this.x += this.vx;
      if (this.y > 260) this.remove = true;
      return;
    }
    this.vy = Math.min(this.vy + PHYS.ENEMY_G, 4.5);
    moveAndCollide(this, { bounce: true });
    if (this.y > 260) this.remove = true;
  }
  stomp(game) {
    const feet = this.bottom;
    this.squashT = 30;
    this.h = 8; this.y = feet - 8;
    Sound.sfx.stomp();
  }
  killFlip(game, score) {
    this.flip = true; this.vy = -3; this.vx = 0.5 * (Math.random() < 0.5 ? -1 : 1);
    game.addScore(score || 100, this.x, this.y);
  }
  draw(ctx, camX) {
    let spr;
    if (this.squashT > 0) spr = Sprites.get('goombaFlat');
    else spr = Sprites.get('goomba', '', Math.floor(game.frame / 12) % 2 === 0);
    const dx = Math.round(this.x - camX) - 2;
    let dy = Math.round(this.bottom) - 16 + 1;
    if (this.flip) {   // 上下翻转
      ctx.save();
      ctx.translate(dx + 8, dy + 8); ctx.scale(1, -1);
      ctx.drawImage(Sprites.get('goomba'), -8, -8);
      ctx.restore();
      return;
    }
    ctx.drawImage(spr, dx, dy);
  }
}

// ---------------- 乌龟（绿壳）----------------
class Koopa extends Entity {
  constructor(x, y) {
    super(x, y, 12, 21);
    this.vx = -0.5;
    this.state = 'walk';        // walk | shell | shellMove | wake
    this.idleT = 0;
    this.noHurtT = 0;           // 刚被踢时不伤玩家
    this.flip = false;
    this.active = false;
  }
  get isShell() { return this.state !== 'walk'; }
  update(game) {
    if (this.noHurtT > 0) this.noHurtT--;
    if (this.flip) {
      this.vy = Math.min(this.vy + 0.3, 4.5); this.y += this.vy; this.x += this.vx;
      if (this.y > 260) this.remove = true;
      return;
    }
    this.vy = Math.min(this.vy + PHYS.ENEMY_G, 4.5);
    if (this.state === 'walk') {
      moveAndCollide(this, { bounce: true });
    } else if (this.state === 'shell') {
      moveAndCollide(this, { bounce: false });
      this.idleT++;
      if (this.idleT > 360) { this.state = 'wake'; this.idleT = 0; }
    } else if (this.state === 'wake') {
      moveAndCollide(this, {});
      this.idleT++;
      if (this.idleT > 60) {    // 苏醒：恢复行走
        this.state = 'walk';
        const feet = this.bottom;
        this.h = 21; this.y = feet - 21;
        this.vx = -0.5;
      }
    } else if (this.state === 'shellMove') {
      const prevDir = Math.sign(this.vx);
      moveAndCollide(this, {
        bounce: true,
        onWall: (tx, ty) => {
          const c = Level.tile(this.room, tx, ty);
          if (c === 'B' || c === 'C') game.breakBrick(tx, ty);
          else if (c !== ' ') Sound.sfx.bump();
        },
      });
      if (Math.sign(this.vx) !== prevDir) Sound.sfx.bump();
      this.idleT++;
    }
    if (this.y > 260) this.remove = true;
  }
  toShell(game) {
    const feet = this.bottom;
    this.state = 'shell'; this.idleT = 0;
    this.h = 13; this.y = feet - 13; this.vx = 0;
    Sound.sfx.stomp();
  }
  kick(game, dir) {
    this.state = 'shellMove';
    this.vx = 3.3 * dir;
    this.noHurtT = 12;
    this.idleT = 0;
    Sound.sfx.kick();
    game.addScore(400, this.x, this.y);
  }
  killFlip(game, score) {
    this.flip = true; this.vy = -3; this.vx = 0.5 * (Math.random() < 0.5 ? -1 : 1);
    game.addScore(score || 200, this.x, this.y);
  }
  draw(ctx, camX) {
    const dx = Math.round(this.x - camX) - 2;
    if (this.flip) {
      ctx.save();
      ctx.translate(dx + 8, Math.round(this.y) + 8); ctx.scale(1, -1);
      ctx.drawImage(Sprites.get('shell'), -8, -8);
      ctx.restore();
      return;
    }
    if (this.state === 'walk') {
      const f = Math.floor(game.frame / 10) % 2 ? 'koopa2' : 'koopa1';
      const spr = Sprites.get(f, '', this.vx > 0);
      ctx.drawImage(spr, dx, Math.round(this.bottom) - 24 + 1);
    } else if (this.state === 'wake') {
      const spr = Sprites.get(Math.floor(game.frame / 6) % 2 ? 'shellWake' : 'shell');
      ctx.drawImage(spr, dx, Math.round(this.bottom) - 14);
    } else {
      const spr = Sprites.get('shell');
      ctx.drawImage(spr, dx, Math.round(this.bottom) - 14);
    }
  }
}

// ---------------- 道具（蘑菇/花/星星/1UP）----------------
class Item extends Entity {
  constructor(x, y, kind) {
    super(x, y, 12, 13);
    this.kind = kind;               // mushroom | flower | star | oneup
    this.emerge = 32;               // 从砖里升出的帧数
    this.baseY = y;
    this.vx = 0;
  }
  update(game) {
    if (this.emerge > 0) {
      this.emerge--;
      this.y -= 0.5;
      if (this.emerge === 0) {
        if (this.kind === 'mushroom' || this.kind === 'oneup') this.vx = 0.62;
        if (this.kind === 'star') this.vx = 0.85;
      }
      return;
    }
    if (this.kind === 'flower') return;   // 花不动
    const g = this.kind === 'star' ? 0.22 : PHYS.ENEMY_G;
    this.vy = Math.min(this.vy + g, 4.5);
    moveAndCollide(this, { bounce: true, onLand: () => { if (this.kind === 'star') this.vy = -3.1; } });
    if (this.y > 260) this.remove = true;
  }
  draw(ctx, camX) {
    // 升出过程中画在砖块后面（game 负责分层）
    let name, variant = '';
    if (this.kind === 'mushroom') name = 'mushroom';
    else if (this.kind === 'oneup') { name = 'mushroom'; variant = 'oneup'; }
    else if (this.kind === 'flower') name = 'flower', variant = Math.floor(game.frame / 6) % 2 ? 'alt' : '';
    else name = 'starItem', variant = Math.floor(game.frame / 5) % 2 ? 'alt' : '';
    const spr = Sprites.get(name, variant);
    ctx.drawImage(spr, Math.round(this.x - camX) - 2, Math.round(this.bottom) - 16 + 2);
  }
}

// ---------------- 火球 ----------------
class Fireball extends Entity {
  constructor(x, y, dir) {
    super(x, y, 8, 8);
    this.vx = 3.3 * dir;
    this.vy = 1.5;
    this.life = 240;
  }
  update(game) {
    this.life--;
    if (this.life <= 0) { this.remove = true; return; }
    this.vy = Math.min(this.vy + 0.3, 4);
    moveAndCollide(this, {
      bounce: false,
      onLand: () => { this.vy = -2.3; },
      onWall: () => { this.remove = true; game.spawnPoof(this.x, this.y); },
    });
    if (this.x < game.camX - 24 || this.x > game.camX + 280) this.remove = true;
    if (this.y > 260) this.remove = true;
  }
  draw(ctx, camX) {
    const spr = Sprites.fireballRot[Math.floor(game.frame / 4) % 4];
    ctx.drawImage(spr, Math.round(this.x - camX), Math.round(this.y));
  }
}
