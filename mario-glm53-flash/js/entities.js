'use strict';
/* ============================================================
 * entities.js — 玩家与实体：物理、AI、绘制
 * tile 碰撞助手由本文件提供，游戏主逻辑在 game.js。
 * ============================================================ */

const PHYS = {
  walkAccel: 0.07,
  runAccel: 0.11,
  maxWalk: 1.35,
  maxRun: 2.4,
  friction: 0.06,
  gravity: 0.5,
  jumpGravity: 0.24,   // 按住跳跃时上升重力更小 => 跳更高
  maxFall: 8,
  jumpBase: 7.0,
  jumpRunBonus: 0.35,
};

/* ---------------- tile 碰撞助手 ---------------- */
function solidCol(level, tx, y0, y1) {
  const a = Math.floor(y0 / 16), b = Math.floor(y1 / 16);
  for (let ty = a; ty <= b; ty++) if (TILE_SOLID.has(level.get(tx, ty))) return true;
  return false;
}
function solidRowCols(level, x0, x1, ty) {
  const out = [];
  const a = Math.floor(x0 / 16), b = Math.floor(x1 / 16);
  for (let tx = a; tx <= b; tx++) if (TILE_SOLID.has(level.get(tx, ty))) out.push(tx);
  return out;
}
/* 通用实体移动 + 碰撞（敌人/道具用）；返回 {hitWall: -1|0|1} */
function moveEntity(e, level) {
  let hitWall = 0;
  e.x += e.vx;
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w) / 16);
    if (solidCol(level, tx, e.y + 2, e.y + e.h - 1)) { e.x = tx * 16 - e.w; hitWall = 1; }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / 16);
    if (solidCol(level, tx, e.y + 2, e.y + e.h - 1)) { e.x = (tx + 1) * 16; hitWall = -1; }
  }
  e.onGround = false;
  e.y += e.vy;
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h) / 16);
    if (solidRowCols(level, e.x + 1, e.x + e.w - 1, ty).length) {
      e.y = ty * 16 - e.h; e.vy = 0; e.onGround = true;
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / 16);
    if (solidRowCols(level, e.x + 1, e.x + e.w - 1, ty).length) {
      e.y = (ty + 1) * 16; e.vy = 0;
    }
  }
  e.hitWall = hitWall;
  return hitWall;
}
/* 上下翻转绘制（被弹飞的敌人） */
function drawFlipV(ctx, img, x, y) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) + img.height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/* ---------------- 实体基类 ---------------- */
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.remove = false;
    this.faceRight = false;
    this.hitWall = 0;
  }
  overlaps(o) {
    return this.x < o.x + o.w && this.x + this.w > o.x &&
           this.y < o.y + o.h && this.y + this.h > o.y;
  }
  offscreenH(game) { return this.y > VIEW_H + 48; }
}

/* ---------------- 玩家 ---------------- */
class Player extends Entity {
  constructor(x, y) {
    super(x, y, 12, 14);
    this.big = false;
    this.crouching = false;
    this.invuln = 0;
    this.state = 'normal';   // normal | grow | shrink | dead
    this.animTimer = 0;
    this.animT = 0;
    this.jumpHeld = false;
    this.jumpPrev = false;
    this.faceRight = true;
    this.comboLevel = 0;     // 连踩计数
  }
  setBig(v, game) {
    if (v === this.big) return;
    const bottom = this.y + this.h;
    this.big = v;
    this.h = v ? 26 : 14;
    this.y = bottom - this.h;
    if (v) game.sfx('powerUp'); else { game.sfx('shrink'); this.invuln = 120; }
  }
  hurt(game) {
    if (this.invuln > 0 || this.state !== 'normal') return;
    if (this.big) {
      const bottom = this.y + this.h;
      this.big = false; this.crouching = false;
      this.h = 14; this.y = bottom - this.h;
      this.state = 'shrink'; this.animTimer = 40;
      game.sfx('shrink');
    } else {
      this.die(game);
    }
  }
  die(game) {
    this.state = 'dead';
    this.vy = -8.5;
    this.vx = 0;
    game.onPlayerDead();
  }
  update(game) {
    if (this.state === 'dead') {
      this.vy = Math.min(this.vy + 0.4, 10);
      this.y += this.vy;
      return;
    }
    if (this.state === 'grow' || this.state === 'shrink') {
      this.animTimer--;
      if (this.animTimer <= 0) {
        if (this.state === 'grow') this.big = true;
        else { this.big = false; this.invuln = 120; }
        this.state = 'normal';
      }
      return;
    }
    if (this.invuln > 0) this.invuln--;

    const input = game.input;
    const level = game.level;

    /* 蹲下（仅大形态、地面） */
    const wantCrouch = this.big && input.down && this.onGround;
    if (wantCrouch && !this.crouching) {
      this.crouching = true;
      const bottom = this.y + this.h;
      this.h = 14; this.y = bottom - this.h;
    } else if (this.crouching && (!this.big || !input.down)) {
      /* 起身需检查头顶 */
      const top = this.y + this.h - 26;
      const blocked = solidCol(level, Math.floor((this.x + this.w / 2) / 16), top + 1, this.y + this.h - 14);
      if (!blocked) {
        this.crouching = false;
        const bottom = this.y + this.h;
        this.h = 26; this.y = bottom - this.h;
      }
    }

    /* 水平移动 */
    if (!this.crouching) {
      const accel = input.run ? PHYS.runAccel : PHYS.walkAccel;
      const maxV = input.run ? PHYS.maxRun : PHYS.maxWalk;
      if (input.left && !input.right) {
        this.faceRight = false;
        this.vx -= this.vx > 0 ? PHYS.runAccel + 0.12 : accel;
        if (this.vx < -maxV) this.vx = Math.max(this.vx + 0.05, -maxV);
      } else if (input.right && !input.left) {
        this.faceRight = true;
        this.vx += this.vx < 0 ? PHYS.runAccel + 0.12 : accel;
        if (this.vx > maxV) this.vx = Math.min(this.vx - 0.05, maxV);
      } else if (this.onGround) {
        if (Math.abs(this.vx) <= PHYS.friction) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * PHYS.friction;
      }
    } else if (this.onGround) {
      if (Math.abs(this.vx) <= PHYS.friction * 2) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * PHYS.friction * 2;
    }

    /* 跳跃 */
    if (input.jump && !this.jumpPrev && this.onGround) {
      this.vy = -(PHYS.jumpBase + Math.abs(this.vx) * PHYS.jumpRunBonus);
      this.jumpHeld = true;
      game.sfx(this.big ? 'jumpBig' : 'jump');
    }
    if (!input.jump) this.jumpHeld = false;
    this.jumpPrev = input.jump;

    /* 重力 */
    this.vy = Math.min(this.vy + ((this.jumpHeld && this.vy < 0) ? PHYS.jumpGravity : PHYS.gravity), PHYS.maxFall);

    /* ---- X 轴移动 + 碰撞 ---- */
    this.x += this.vx;
    if (this.x < game.camX) { this.x = game.camX; this.vx = Math.max(0, this.vx); }
    if (this.vx > 0) {
      const tx = Math.floor((this.x + this.w) / 16);
      if (solidCol(level, tx, this.y + 2, this.y + this.h - 1)) { this.x = tx * 16 - this.w; this.vx = 0; }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.x / 16);
      if (solidCol(level, tx, this.y + 2, this.y + this.h - 1)) { this.x = (tx + 1) * 16; this.vx = 0; }
    }

    /* ---- Y 轴移动 + 碰撞 ---- */
    this.y += this.vy;
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.vy > 0) {
      const ty = Math.floor((this.y + this.h) / 16);
      if (solidRowCols(level, this.x + 1, this.x + this.w - 1, ty).length) {
        this.y = ty * 16 - this.h; this.vy = 0; this.onGround = true;
        this.comboLevel = 0;
      }
    } else if (this.vy < 0) {
      const ty = Math.floor(this.y / 16);
      const hits = solidRowCols(level, this.x + 1, this.x + this.w - 1, ty);
      if (hits.length) {
        this.y = (ty + 1) * 16; this.vy = 0;
        /* 选择距头部中心最近的块触发 */
        const cx = this.x + this.w / 2;
        let best = hits[0], bd = Infinity;
        for (const hx of hits) {
          const d = Math.abs((hx + 0.5) * 16 - cx);
          if (d < bd) { bd = d; best = hx; }
        }
        game.hitBlock(best, ty);
      }
    }

    /* 动画计时 */
    this.animT += Math.abs(this.vx);

    /* 掉坑：掉出屏幕底部即死 */
    if (this.y > VIEW_H + 8) game.onPlayerFall();
  }
  draw(ctx, frame) {
    if (this.invuln > 0 && Math.floor(frame / 3) % 2 === 0) return;
    const smallSet = Sprites.small;
    const bigSet = Sprites.big;
    let useBig = this.big;
    if (this.state === 'grow' || this.state === 'shrink') {
      useBig = Math.floor(frame / 5) % 2 === 0;
    }
    const set = useBig ? bigSet : smallSet;
    let img;
    if (this.state === 'dead') img = smallSet.dead;
    else if (useBig && this.crouching && this.state === 'normal') img = bigSet.crouch;
    else if (!this.onGround) img = set.jump;
    else if (Math.abs(this.vx) > 0.15) img = (Math.floor(this.animT / 9) % 2) ? set.walk1 : set.walk2;
    else img = set.idle;
    const sh = img.height;
    drawSprite(ctx, img, this.x - (img.width - this.w) / 2, this.y + this.h - sh, !this.faceRight);
  }
}

/* ---------------- Goomba ---------------- */
class Goomba extends Entity {
  constructor(x, y) {
    super(x, y, 14, 13);
    this.vx = -0.42;
    this.active = false;
    this.squash = 0;      // >0 被踩扁倒计时
    this.flipDead = false; // 被顶块/龟壳弹飞
  }
  update(game) {
    if (!this.active) {
      if (this.x < game.camX + VIEW_W + 24) this.active = true;
      else return;
    }
    if (this.flipDead) {
      this.vy = Math.min(this.vy + 0.4, 9);
      this.x += this.vx; this.y += this.vy;
      if (this.offscreenH(game)) this.remove = true;
      return;
    }
    if (this.squash > 0) {
      this.squash--;
      if (this.squash === 0) this.remove = true;
      return;
    }
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    if (moveEntity(this, game.level) !== 0) this.vx = -this.vx;
    if (this.offscreenH(game)) this.remove = true;
  }
  stomp(game) {
    this.squash = 32;
    this.vx = 0;
    game.sfx('stomp');
  }
  killFlip(game, dir) {
    this.flipDead = true;
    this.vy = -4.5;
    this.vx = 1.2 * (dir || 1);
    game.sfx('kick');
  }
  draw(ctx, frame) {
    if (this.squash > 0) {
      drawSprite(ctx, Sprites.goomba.flat, this.x - 1, this.y + this.h - Sprites.goomba.flat.height, false);
      return;
    }
    if (this.flipDead) {
      drawFlipV(ctx, Sprites.goomba.walk, this.x - 1, this.y + this.h - Sprites.goomba.walk.height);
      return;
    }
    const flip = Math.floor(frame / 10) % 2 === 1;
    drawSprite(ctx, Sprites.goomba.walk, this.x - 1, this.y + this.h - Sprites.goomba.walk.height, flip);
  }
}

/* ---------------- Koopa（绿龟 / 龟壳） ---------------- */
class Koopa extends Entity {
  constructor(x, y) {
    super(x, y, 12, 14);
    this.vx = -0.4;
    this.active = false;
    this.mode = 'walk';      // walk | shell | slide
    this.flipDead = false;
    this.wake = 0;           // 静止壳复苏计时
    this.noHurt = 0;         // 踢出后的免伤帧（防止踢壳瞬间误伤自己）
  }
  update(game) {
    if (!this.active) {
      if (this.x < game.camX + VIEW_W + 24) this.active = true;
      else return;
    }
    if (this.flipDead) {
      this.vy = Math.min(this.vy + 0.4, 9);
      this.x += this.vx; this.y += this.vy;
      if (this.offscreenH(game)) this.remove = true;
      return;
    }
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    const wall = moveEntity(this, game.level);
    if (this.noHurt > 0) this.noHurt--;
    if (this.mode === 'walk') {
      if (wall !== 0) this.vx = -this.vx;
      if (this.vx < 0) this.faceRight = false;
      else if (this.vx > 0) this.faceRight = true;
    } else if (this.mode === 'slide') {
      if (wall !== 0) { this.vx = -this.vx; game.sfx('bump'); }
    } else { // shell 静止
      this.vx = 0;
      this.wake++;
      if (this.wake > 420) {  // ~7 秒后复苏
        this.mode = 'walk';
        this.wake = 0;
        this.vx = -0.4;
      }
    }
    if (this.offscreenH(game)) this.remove = true;
  }
  stomp(game) {
    if (this.mode === 'walk') {
      this.mode = 'shell';
      this.wake = 0;
      this.vx = 0;
      game.sfx('stomp');
    } else if (this.mode === 'slide') {
      this.mode = 'shell';
      this.vx = 0;
      this.wake = 0;
      game.sfx('stomp');
    } else if (this.mode === 'shell') {
      /* 踩静止的壳 = 把它踢出去 */
      this.kick(game, (game.player.x + game.player.w / 2) < (this.x + this.w / 2) ? 1 : -1);
    }
  }
  kick(game, dir) {
    this.mode = 'slide';
    this.vx = 3.2 * dir;
    this.wake = 0;
    this.noHurt = 14;
    game.sfx('kick');
  }
  killFlip(game, dir) {
    this.flipDead = true;
    this.vy = -4.5;
    this.vx = 1.2 * (dir || 1);
    game.sfx('kick');
  }
  draw(ctx, frame) {
    const S = Sprites.koopa;
    if (this.flipDead) {
      const img = this.mode === 'walk' ? S.walk1 : S.shell;
      drawFlipV(ctx, img, this.x - 2, this.y + this.h - img.height);
      return;
    }
    if (this.mode === 'shell' || this.mode === 'slide') {
      const shake = (this.mode === 'shell' && this.wake > 300) ? Math.floor(Math.sin(frame * 0.8) * 1.5) : 0;
      drawSprite(ctx, S.shell, this.x - 2 + shake, this.y + this.h - S.shell.height, false);
      return;
    }
    const img = Math.floor(frame / 10) % 2 ? S.walk1 : S.walk2;
    drawSprite(ctx, img, this.x - 2, this.y + this.h - img.height, !this.faceRight);
  }
}

/* ---------------- 蘑菇 ---------------- */
class Mushroom extends Entity {
  constructor(tx, ty) {
    super(tx * 16 + 1, ty * 16 - 2, 14, 14);
    this.riseTo = ty * 16 - 15;
    this.state = 'rise';
    this.vx = 0.6;
    this.active = true;
  }
  update(game) {
    if (this.state === 'rise') {
      this.y -= 0.25;
      if (this.y <= this.riseTo) { this.y = this.riseTo; this.state = 'walk'; }
      return;
    }
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    if (moveEntity(this, game.level) !== 0) this.vx = -this.vx;
    if (this.offscreenH(game)) this.remove = true;
  }
  draw(ctx) {
    drawSprite(ctx, Sprites.mushroom, this.x - 1, this.y + this.h - Sprites.mushroom.height, false);
  }
}

/* ---------------- 顶块弹出的金币 ---------------- */
class CoinPop {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vy = -5.4;
    this.groundY = y;
    this.remove = false;
  }
  update() {
    this.vy += 0.35;
    this.y += this.vy;
    if (this.vy > 0 && this.y >= this.groundY) this.remove = true;
  }
  draw(ctx, frame) {
    const sx = Math.abs(Math.cos(frame * 0.35));
    drawSprite(ctx, Sprites.coin, this.x - 5 + (1 - sx) * 5, this.y - 12, false, sx);
  }
}

/* ---------------- 砖块碎片 ---------------- */
class BrickPiece {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.rot = 0;
    this.remove = false;
  }
  update() {
    this.vy += 0.4;
    this.x += this.vx;
    this.y += this.vy;
    this.rot += 0.15 * Math.sign(this.vx);
    if (this.y > VIEW_H + 32) this.remove = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.rot);
    ctx.fillStyle = '#c15020';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#e89050';
    ctx.fillRect(-4, -4, 8, 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-4, 2, 8, 2);
    ctx.restore();
  }
}

/* ---------------- 飘分文字 ---------------- */
class FloatText {
  constructor(text, x, y) {
    this.text = String(text);
    this.x = x; this.y = y;
    this.life = 50;
    this.remove = false;
  }
  update() {
    this.y -= 0.6;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }
  draw(ctx) {
    drawText(ctx, this.text, this.x - this.text.length * 2, this.y, '#ffffff', 1);
  }
}
