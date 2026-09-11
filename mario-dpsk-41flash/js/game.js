/* =============================================================================
 * game.js - the whole game: physics, entities, blocks, power-ups, renderer.
 *
 * Coordinate system: 1 unit = 1 pixel in level space. The viewport is
 * 256x240 (the NES resolution) and is scaled up with CSS.
 * ========================================================================== */
(function (global) {
  'use strict';

  const Art = global.MarioArt;
  const Audio = global.MarioAudio;
  const L = global.MarioLevels;

  /* =========================================================== constants ==== */
  const TILE = 16;
  const VIEW_W = 256;
  const VIEW_H = 240;

  const PHYS = {
    minJump: -3.2,
    maxWalk: 1.4,
    maxRun: 2.5625,
    friction: 0.07375,
    skidDecel: 0.4,
    maxFall: 4.5,
    walkAccel: { 0: 0.09375, 1: 0.09375, 2: 0.125 },
    runAccel: { 0: 0.09375, 1: 0.09375, 2: 0.140625 },
    jumpV: { 0: -4.4, 1: -4.4, 2: -4.9 },
    // SMB1 keeps ramping the upward velocity for the first few frames while A
    // is held, then uses a gentler gravity while still rising.  Together with
    // the strong gravRiseFree that fires the moment A is released, that is
    // what makes the jump height follow how long the button is held.
    jumpBoost: 0.09375,
    jumpHoldFrames: { 0: 4, 1: 4, 2: 4 },
    // While RISING with A held mario keeps most of his upward speed (SMB1 uses
    // a much gentler gravity while the button is down); releasing A switches to
    // the strong value, which cuts the jump short.
    gravRiseHeld: 0.171875,  // A held, rising   -> tall arc
    gravRiseFree: 0.5,       // A released, rising -> short hop
    gravFallHeld: 0.28125,   // A held, falling
    gravFallFree: 0.21,      // A released, falling
    stompBounce: -4.0,
    stompBounceHigh: -6.0
  };

  const SCORE = {
    coin: 200,
    powerup: 1000,
    goomba: 100,
    koopa: 100,
    shellKill: 500,
    brickBreak: 50,
    flag: 2000,
    flagPerUnit: 100,
    timePerUnit: 50
  };

  const SIZE = {
    small: { w: 12, h: 15 },
    big: { w: 14, h: 28 }
  };

  const K = {
    SOLID: 'solid',
    BRICK: 'brick',
    BRICK_HARD: 'brickhard',
    QUESTION: 'question',
    HIDDEN: 'hidden',
    USED: 'used',
    COIN: 'coin',
    PIPE_TOP: 'pipetop',
    PIPE_BODY: 'pipebody',
    WATER: 'water',
    AXE: 'axe'
  };

  const BLOCKING = {
    solid: 1, brick: 1, brickhard: 1, question: 1, used: 1, hidden: 1,
    pipetop: 1, pipebody: 1
  };
  const BUMPABLE = { brick: 1, brickhard: 1, question: 1, hidden: 1 };
  const T = L.T;   // authoring legend used by levels.js

  /* ============================================================== helpers === */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  function pad(n, len) {
    let s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* ============================================================= particles == */
  class Particle {
    constructor(x, y, vx, vy, kind, extra) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind;
      this.life = (extra && extra.life) || 40;
      this.age = 0;
      this.value = extra && extra.value;
      this.dead = false;
    }
    update() {
      this.age++;
      if (this.age >= this.life) { this.dead = true; return; }
      if (this.kind === 'debris') {
        this.vy += 0.35;
        this.x += this.vx; this.y += this.vy;
      } else if (this.kind === 'coinpop') {
        this.vy += 0.5;
        this.y += this.vy;
      } else if (this.kind === 'sparkle') {
        this.x += this.vx; this.y += this.vy; this.vy += 0.12;
      }
    }
  }

  /* ================================================================ entity == */
  class Entity {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.vx = 0; this.vy = 0;
      this.dir = -1;
      this.grounded = false;
      this.dead = false;
      this.remove = false;
      this.facing = -1;
      this.kind = 'entity';
      this.withSupport = (world) => this.supportedBy(world);
    }
    get left() { return this.x - this.w / 2; }
    get right() { return this.x + this.w / 2; }
    get top() { return this.y; }
    get bottom() { return this.y + this.h; }
    get cy() { return this.y + this.h / 2; }

    overlaps(o, pad) {
      const p = pad || 0;
      return !(this.right <= o.left + p || this.left >= o.right - p ||
               this.bottom <= o.top + p || this.top >= o.bottom - p);
    }

    /** Does the tile grid hold this entity up right where it is? */
    supportedBy(world) {
      if (this.vy < 0) return false;
      const x0 = Math.floor((this.left + 1) / TILE);
      const x1 = Math.floor((this.right - 1) / TILE);
      const yb = Math.floor(this.bottom / TILE);
      if ((this.bottom - yb * TILE) > 2) return false;
      for (let tx = x0; tx <= x1; tx++) {
        if (world.isBlockingAt(tx, yb) || world.isSemiSolidAt(tx, yb)) return true;
      }
      return false;
    }

    moveX(world, dx) {
      this.x += dx;
      let hit = 0;
      const y0 = Math.floor((this.top + 1) / TILE);
      const y1 = Math.floor((this.bottom - 1) / TILE);
      if (dx > 0) {
        const x1 = Math.floor((this.right - 1) / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (world.isBlockingAt(x1, ty)) {
            this.x = x1 * TILE - this.w / 2 - 0.01;
            hit = 1; break;
          }
        }
      } else if (dx < 0) {
        const x0 = Math.floor(this.left / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (world.isBlockingAt(x0, ty)) {
            this.x = (x0 + 1) * TILE + this.w / 2 + 0.01;
            hit = -1; break;
          }
        }
      }
      return hit;
    }

    moveY(world, dy, onBlockHit) {
      this.y += dy;
      let landed = false;
      const x0 = Math.floor((this.left + 1) / TILE);
      const x1 = Math.floor((this.right - 1) / TILE);
      const prevBottom = this.bottom - dy;
      if (dy > 0) {
        const y1 = Math.floor((this.bottom - 0.001) / TILE);
        for (let tx = x0; tx <= x1; tx++) {
          if (world.isBlockingAt(tx, y1) || (world.isSemiSolidAt(tx, y1) && prevBottom <= y1 * TILE + 3)) {
            this.y = Math.round(y1 * TILE - this.h);
            this.vy = 0;
            landed = true;
            break;
          }
        }
      } else if (dy < 0) {
        const y0 = Math.floor(this.top / TILE);
        for (let tx = x0; tx <= x1; tx++) {
          if (world.isBlockingAt(tx, y0)) {
            this.y = (y0 + 1) * TILE;
            this.vy = 0;
            if (onBlockHit) onBlockHit(y0, tx);
            break;
          }
        }
      }
      if (!landed && dy >= 0 && this.withSupport) landed = this.withSupport(world);
      this.grounded = landed;
      return landed;
    }
  }

  /* ================================================================ player == */
  class Player extends Entity {
    constructor(x, y) {
      super(x, y, SIZE.small.w, SIZE.small.h);
      this.kind = 'player';
      this.power = 0;
      this.wantDir = 0;
      this.runBtn = false;
      this.jumpHeld = false;
      this.jumpLock = false;
      this.jumping = false;
      this.crouch = false;
      this.starTimer = 0;
      this.invuln = 0;
      this.growTimer = 0;
      this.shrinkTimer = 0;
      this.fireCool = 0;
      this.state = 'play';
      this.animTimer = 0;
      this.walkPhase = 0;
      this.skidding = false;
      this.dieTimer = 0;
      this.pipeTimer = 0;
      this.pipeDir = 0;
      this.pipeWarp = null;
      this.pipeExitY = 0;
      this.flagBottomY = 0;
    }

    get big() { return this.power > 0; }

    setPower(p) {
      const bottom = this.bottom;
      this.power = p;
      const s = p > 0 ? SIZE.big : SIZE.small;
      this.w = s.w;
      this.h = s.h;
      this.y = bottom - this.h;
    }

    handleInput(input, world) {
      if (this.state !== 'play') { this.wantDir = 0; this.runBtn = false; return; }
      let d = 0;
      if (input.left) d -= 1;
      if (input.right) d += 1;
      this.wantDir = d;
      this.runBtn = !!input.run;
      this.jumpHeld = !!input.jump;
      this.crouch = !!input.down && this.big;
      if (this.crouch) this.wantDir = 0;
      this.inputDown = !!input.down;
      // crouching keeps big mario's head down: the hitbox matches the crouch
      // sprite so he can slide under a one-tile gap.
      if (this.state === 'play' && this.big && world) {
        const wantH = this.crouch && this.grounded ? 22 : SIZE.big.h;
        if (wantH !== this.h && !(wantH > this.h && !world.canStand(this, wantH))) {
          const bottom = this.bottom;
          this.h = wantH;
          this.y = bottom - this.h;
        }
      }
    }

    hurt(world) {
      if (this.invuln > 0 || this.starTimer > 0 || this.state !== 'play') return;
      if (this.power > 0) {
        this.setPower(0);
        this.invuln = 120;
        this.state = 'shrink';
        this.shrinkTimer = 36;
        Audio.shrink();
      } else {
        this.die(world);
      }
    }

    die(world) {
      if (this.state === 'dying') return;
      this.state = 'dying';
      this.vy = -6.4;
      this.vx = 0;
      this.dieTimer = 0;
      world.musicStop();
      Audio.hurt();
    }

    fire(world) {
      if (this.power < 2 || this.fireCool > 0 || this.state !== 'play') return;
      const live = world.entities.filter((e) => e.kind === 'fireball' && !e.remove).length;
      if (live >= 2) return;
      this.fireCool = 12;
      world.add(new Fireball(this.x + this.facing * 8, this.y + (this.big ? 12 : 5), this.facing));
      Audio.fireball();
    }

    update(world) {
      this.animTimer++;
      if (this.invuln > 0) this.invuln--;
      if (this.fireCool > 0) this.fireCool--;
      if (this.starTimer > 0) {
        this.starTimer--;
        if (this.starTimer === 0) world.startMusic(true);
      }

      switch (this.state) {
        case 'grow':
          this.growTimer--;
          if (this.growTimer <= 0) this.state = 'play';
          return;
        case 'shrink':
          this.shrinkTimer--;
          if (this.shrinkTimer <= 0) this.state = 'play';
          return;
        case 'dying':
          this.dieTimer++;
          if (this.dieTimer > 24) {
            this.vy += 0.42;
            this.y += this.vy;
          }
          if (this.y > world.heightPx + 80) this.remove = true;
          return;
        case 'pipe':
          this.pipeTimer--;
          if (this.pipeDir > 0) this.y += 0.75;
          else this.y -= 0.75;
          if (this.pipeTimer <= 0) {
            if (this.pipeDir > 0 && this.pipeWarp) world.doWarp(this.pipeWarp);
            else if (this.pipeDir < 0) { this.state = 'play'; this.y = this.pipeExitY; }
            else this.state = 'play';
          }
          return;
        case 'flag':
          this.y += 2.2;
          if (this.y >= this.flagBottomY) {
            this.y = this.flagBottomY;
            this.state = 'walk';
            this.facing = 1;
            this.walkToCastle = 1;
            world.onFlagLanded();
          }
          return;
        case 'walk': {
          const step = 1.15;
          this.vx = step;
          this.moveX(world, step);
          this.animTimer++;
          this.y = this.flagBottomY;
          if (this.x >= world.castleDoorX) {
            this.state = 'clear';
            world.levelCleared();
          }
          return;
        }
        case 'clear':
          return;
      }

      /* ---------------------------------------------------------- movement */
      const dir = this.wantDir;
      const cap = (this.runBtn ? PHYS.maxRun : PHYS.maxWalk) + (this.starTimer > 0 ? 0.4 : 0);

      if (dir === 0) {
        const fr = this.grounded ? PHYS.friction : 0.04;
        if (Math.abs(this.vx) <= fr) this.vx = 0;
        else this.vx -= fr * sign(this.vx);
        this.skidding = false;
      } else {
        const lvl = Math.min(2, Math.floor(Math.abs(this.vx)));
        const table = this.runBtn ? PHYS.runAccel : PHYS.walkAccel;
        const a = table[lvl];
        if (sign(this.vx) === -dir && this.vx !== 0) {
          this.vx += PHYS.skidDecel * dir;
          this.skidding = this.grounded;
        } else {
          this.vx += a * dir;
          this.skidding = false;
        }
        if (this.vx > cap) this.vx = cap;
        if (this.vx < -cap) this.vx = -cap;
        this.facing = dir;
      }

      this.moveX(world, this.vx);

      /* ------------------------------------------------------------- jumping */
      if (!this.grounded) this.jumpLock = false;   // one jump per landing
      if (this.jumpHeld && this.grounded && !this.jumpLock) {
        const lvl = Math.min(2, Math.floor(Math.abs(this.vx)));
        this.vy = PHYS.jumpV[lvl];
        this.jumping = true;
        this.jumpHold = 0;
        this.jumpLevel = lvl;
        this.jumpLock = true;
        Audio.jump(this.big);
      }
      if (this.jumping && this.jumpHeld && this.vy < 0 && this.jumpHold < PHYS.jumpHoldFrames[this.jumpLevel]) {
        this.vy += PHYS.jumpBoost;
        this.jumpHold++;
      }
      if (!this.jumpHeld) {
        this.jumpLock = false;
        if (this.vy < PHYS.minJump) this.vy = PHYS.minJump;
      }

      const rising = this.vy < 0;
      let g;
      if (rising) g = this.jumpHeld ? PHYS.gravRiseHeld : PHYS.gravRiseFree;
      else g = this.jumpHeld ? PHYS.gravFallHeld : PHYS.gravFallFree;
      this.vy += g;
      if (this.vy > PHYS.maxFall) this.vy = PHYS.maxFall;

      this.moveY(world, this.vy, (ty, tx) => world.headBump(ty, tx, this));
      if (this.grounded) this.jumping = false;

      /* ---------------------------------------------------------- animation */
      if (this.grounded && Math.abs(this.vx) > 0.08) {
        if (this.animTimer % 4 === 0) this.walkPhase = (this.walkPhase + 1) % 4;
      } else if (!this.grounded) {
        this.walkPhase = 0;
      } else {
        this.walkPhase = 0;
      }

      /* ---------------------------------------------------- pipe warping */
      if (this.inputDown && this.grounded) {
        for (const wx of Object.keys(world.warps)) {
          const wxN = parseInt(wx, 10);
          const pTop = Math.floor(this.bottom / TILE);
          const t = world.tileAt(Math.floor(wxN / TILE), pTop);
          if (this.x > wxN - 12 && this.x < wxN + 4 && t && t.kind === K.PIPE_TOP) {
            this.pipeWarp = world.warps[wx];
            this.state = 'pipe';
            this.pipeDir = 1;
            this.pipeTimer = 34;
            this.pipeX = wxN;
            Audio.pipe();
            break;
          }
        }
      }

      world.checkPickups(this);
    }

    spriteName() {
      const size = this.big ? 'big' : 'small';
      let base;
      if (this.state === 'dying') base = 'mario.small.dead';
      else if (this.big && this.crouch && this.grounded && this.state === 'play') base = 'mario.big.crouch';
      else if (this.state === 'flag' || (this.state === 'walk')) base = 'mario.' + size + '.walk0';
      else if (this.state === 'pipe') base = 'mario.' + size + '.idle';
      else if (!this.grounded) base = 'mario.' + size + '.jump';
      else if (this.skidding) base = 'mario.' + size + '.skid';
      else if (Math.abs(this.vx) > 0.08) base = 'mario.' + size + '.' + (this.walkPhase % 2 ? 'walk0' : 'walk1');
      else base = 'mario.' + size + '.idle';
      return this.facing < 0 ? base : '#' + base;
    }
  }

  /* ================================================================ goomba == */
  class Goomba extends Entity {
    constructor(x, y) {
      super(x, y, 14, 14);
      this.kind = 'goomba';
      this.dir = -1;
      this.flatTimer = 0;
      this.anim = Math.floor(Math.random() * 8);
      this.flipped = false;
    }
    update(world) {
      this.anim++;
      if (this.flipped) {
        this.vy += 0.4; this.y += this.vy; this.x += this.vx;
        if (this.y > world.heightPx + 40) this.remove = true;
        return;
      }
      if (this.flatTimer > 0) {
        this.flatTimer--;
        if (this.flatTimer <= 0) this.remove = true;
        return;
      }
      if (world.offscreenFrozen(this)) return;
      const hit = this.moveX(world, 0.5 * this.dir);
      if (hit) this.dir = -hit;
      if (this.grounded) {
        const ahead = this.x + this.dir * 9;
        if (!world.solidBelow(ahead, this.bottom + 2)) this.dir *= -1;
      }
      this.vy += 0.45;
      if (this.vy > 4.5) this.vy = 4.5;
      this.moveY(world, this.vy);
    }
    stomp() { this.flatTimer = 30; }
    killFlip(world, dir) {
      this.flipped = true;
      this.vy = -4;
      this.vx = 1.2 * (dir || 1);
    }
    spriteName() {
      if (this.flipped) return 'goomba.flat';
      return 'goomba.' + (Math.floor(this.anim / 8) % 2 ? 'walk1' : 'walk0');
    }
  }

  /* ================================================================= koopa == */
  class Koopa extends Entity {
    constructor(x, y) {
      super(x, y, 14, 22);
      this.kind = 'koopa';
      this.dir = -1;
      this.mode = 'walk';
      this.shellTimer = 0;
      this.anim = 0;
      this.flipped = false;
    }
    update(world) {
      this.anim++;
      if (this.flipped) {
        this.vy += 0.4; this.y += this.vy; this.x += this.vx;
        if (this.y > world.heightPx + 40) this.remove = true;
        return;
      }
      if (world.offscreenFrozen(this)) return;

      if (this.mode === 'walk') {
        const hit = this.moveX(world, 0.5 * this.dir);
        if (hit) this.dir = -hit;
        if (this.grounded) {
          const ahead = this.x + this.dir * 9;
          if (!world.solidBelow(ahead, this.bottom + 2)) this.dir *= -1;
        }
        this.vy += 0.45;
        if (this.vy > 4.5) this.vy = 4.5;
        this.moveY(world, this.vy);
      } else if (this.mode === 'shell') {
        this.shellTimer++;
        this.vy += 0.45;
        if (this.vy > 4.5) this.vy = 4.5;
        this.moveY(world, this.vy);
        if (this.shellTimer > 420) {
          this.mode = 'walk';
          const bottom = this.bottom;
          this.h = 22;
          this.y = bottom - this.h;
        }
      } else if (this.mode === 'slide') {
        const hit = this.moveX(world, this.vx);
        if (hit) { this.vx = -this.vx; Audio.bump(); }
        this.vy += 0.45;
        if (this.vy > 4.5) this.vy = 4.5;
        this.moveY(world, this.vy);
        for (const e of world.entities) {
          if (e === this || e.remove || e.dead) continue;
          if ((e.kind === 'goomba' || e.kind === 'koopa') && e.mode !== 'slide' && this.overlaps(e)) {
            world.killEnemyByShell(e, sign(this.vx) || 1);
          }
        }
        if (world.offscreenBehind(this, 96)) this.remove = true;
      }
    }
    toShell() {
      if (this.mode === 'walk') {
        const bottom = this.bottom;
        this.mode = 'shell';
        this.shellTimer = 0;
        this.vx = 0;
        this.h = 16;
        this.y = bottom - this.h;
      } else if (this.mode === 'slide') {
        this.mode = 'shell';
        this.vx = 0;
        this.shellTimer = 0;
      }
    }
    kick(world, dir) {
      this.mode = 'slide';
      this.vx = 3.2 * dir;
      Audio.kick();
    }
    killFlip(world, dir) {
      if (this.mode === 'walk') {
        const b = this.bottom;
        this.h = 16;
        this.y = b - this.h;
      }
      this.flipped = true;
      this.mode = 'flipped';
      this.vy = -4;
      this.vx = 1.2 * (dir || 1);
      Audio.kick();
    }
    spriteName() {
      if (this.flipped) return 'koopa.flip';
      if (this.mode === 'walk') return 'koopa.' + (Math.floor(this.anim / 8) % 2 ? 'walk1' : 'walk0');
      if (this.mode === 'slide') return 'koopa.shellSpin';
      return 'koopa.shell';
    }
  }

  /* ================================================================ items == */
  class Item extends Entity {
    constructor(x, y, type) {
      super(x, y, 14, 14);
      this.kind = 'item';
      this.type = type;
      this.emerge = 16;
      this.gravity = 0.4;
      this.anim = 0;
      this.dir = 1;
      if (type === 'flower') { this.w = 16; this.h = 16; }
    }
    update(world) {
      this.anim++;
      if (this.emerge > 0) {
        const step = Math.min(0.5, this.emerge);
        this.y -= step;
        this.emerge -= step;
        return;
      }
      if (this.type === 'flower') {
        this.vy += this.gravity;
        if (this.vy > 4) this.vy = 4;
        this.moveY(world, this.vy);
        return;
      }
      const hit = this.moveX(world, (this.type === 'star' ? 1.4 : 1.0) * this.dir);
      if (hit) this.dir = -hit;
      this.vy += this.gravity;
      if (this.vy > 4) this.vy = 4;
      this.moveY(world, this.vy);
      if (this.y > world.heightPx + 40) this.remove = true;
    }
    spriteName() {
      if (this.type === 'mushroom') return 'item.mushroom';
      if (this.type === 'oneup') return 'item.oneup';
      if (this.type === 'star') return 'item.star.' + (Math.floor(this.anim / 6) % 2 ? 'b' : 'a');
      return 'item.flower.' + (Math.floor(this.anim / 8) % 2 ? 'b' : 'a');
    }
  }

  /* ============================================================= fireball == */
  class Fireball extends Entity {
    constructor(x, y, dir) {
      super(x, y, 8, 8);
      this.kind = 'fireball';
      this.vx = 3.2 * dir;
      this.vy = 2;
      this.gravity = 0.42;
      this.life = 220;
      this.anim = 0;
    }
    update(world) {
      this.anim++;
      this.life--;
      if (this.life <= 0) { this.burst(world); return; }
      if (this.moveX(world, this.vx)) { this.burst(world); return; }
      this.vy += this.gravity;
      if (this.vy > 4) this.vy = 4;
      if (this.moveY(world, this.vy)) this.vy = -2.8;
      if (this.y > world.heightPx + 20 || this.x < world.camX - 40 || this.x > world.camX + VIEW_W + 40) {
        this.remove = true;
      }
      for (const e of world.entities) {
        if (e === this || e.remove || e.dead) continue;
        if ((e.kind === 'goomba' || e.kind === 'koopa') && this.overlaps(e)) {
          if (e.kind === 'koopa' && e.mode === 'slide') continue;
          world.killEnemyByShell(e, sign(this.vx) || 1);
          this.burst(world);
          return;
        }
      }
    }
    burst(world) {
      this.remove = true;
      for (let i = 0; i < 6; i++) {
        world.particles.push(new Particle(this.x, this.y,
          (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, 'sparkle', { life: 14 }));
      }
    }
  }

  /* ==================================================== moving platform ==== */
  class FloatPlatform extends Entity {
    constructor(spec) {
      const w = spec.w * TILE;
      super(spec.x * TILE + w / 2, spec.y * TILE, w, 8);
      this.kind = 'platform';
      this.axis = spec.axis;
      this.range = (spec.range || 0) * TILE;
      this.speed = spec.speed || 0;
      this.origin = { x: this.x, y: this.y };
      this.t = Math.PI / 2;
      this.dx = 0; this.dy = 0;
    }
    update() {
      this.dx = 0; this.dy = 0;
      if (!this.range || !this.speed) return;
      this.t += this.speed * 0.04;
      const off = Math.sin(this.t) * this.range;
      const nx = this.axis === 'x' ? this.origin.x + off : this.origin.x;
      const ny = this.axis === 'y' ? this.origin.y + off : this.origin.y;
      this.dx = nx - this.x;
      this.dy = ny - this.y;
      this.x = nx; this.y = ny;
    }
  }

  /* ================================================================ world == */
  class World {
    constructor(game, levelIndex) {
      this.game = game;
      this.levelIndex = levelIndex;
      this.def = L.LEVELS[levelIndex];
      this.tiles = new Map();
      this.entities = [];
      this.particles = [];
      this.floats = [];
      this.bumped = [];
      this.warps = {};
      this.time = this.def.timeLimit;
      this.timeAcc = 0;
      this.score = 0;
      this.coins = 0;
      this.camX = 0;
      this.camY = 0;
      this.widthPx = this.def.width * TILE;
      this.heightPx = 15 * TILE;
      this.frame = 0;
      this.flagRaised = 0;
      this.flagBottomY = (this.def.groundY - 1) * TILE;
      this.castleDoorX = (this.def.castle.x + 2) * TILE + 8;
      this.cleared = false;
      this.goalType = this.def.goalType || (this.def.underground ? 'axe' : 'flag');
      this.build();
      this.spawnPlayer();
    }

    /* ------------------------------------------------------------ building */
    tileKey(x, y) { return x * 1000 + y; }

    setTile(x, y, kind, content) {
      this.tiles.set(this.tileKey(x, y), {
        x, y, kind,
        content: content || null,
        bump: 0, bumpV: 0, used: 0,
        hidden: kind === K.HIDDEN
      });
    }

    build() {
      const d = this.def;
      for (const [from, to] of d.ground) {
        for (let x = from; x < to; x++) {
          for (let y = d.groundY; y < 15; y++) this.setTile(x, y, K.SOLID);
        }
      }
      if (d.ceilingRows) {
        for (let x = 0; x < d.width; x++) {
          for (let y = 0; y < d.ceilingRows; y++) this.setTile(x, y, K.SOLID);
        }
      }
      if (d.water) {
        for (let x = 0; x < d.width; x++) {
          let hasGround = false;
          for (const [from, to] of d.ground) if (x >= from && x < to) { hasGround = true; break; }
          if (hasGround) continue;
          for (let y = d.groundY; y < 15; y++) this.setTile(x, y, K.WATER);
        }
      }
      for (const b of (d.blocks || [])) {
        const n = b.n || 1;
        for (let i = 0; i < n; i++) {
          const x = b.x + i;
          if (b.kind === T.SOLID) this.setTile(x, b.y, K.SOLID);
          else if (b.kind === T.COIN) this.setTile(x, b.y, K.COIN);
          else if (b.kind === T.BRICK_HARD) this.setTile(x, b.y, K.BRICK_HARD);
          else if (b.kind === T.HIDDEN) this.setTile(x, b.y, K.HIDDEN, b.content || 'coin');
          else if (b.kind === T.QUESTION) this.setTile(x, b.y, K.QUESTION, b.content || 'coin');
          else if (b.kind === T.AXE) this.setTile(x, b.y, K.AXE);
          else this.setTile(x, b.y, K.BRICK);
        }
      }
      for (const p of (d.pipes || [])) {
        for (let y = p.y; y < p.y + p.h; y++) {
          for (let x = p.x; x < p.x + 2; x++) {
            this.setTile(x, y, y === p.y ? K.PIPE_TOP : K.PIPE_BODY);
          }
        }
        if (p.warp) this.warps[p.x * TILE + 16] = p.warp;
      }
      for (const s of (d.platforms || [])) this.floats.push(new FloatPlatform(s));
      for (const e of d.enemies) this.spawnEnemy(e);
      this.decor = d.decor || [];
      this.flag = d.flag;
      this.castle = d.castle;
    }

    spawnEnemy(spec) {
      const e = spec.type === 'goomba'
        ? new Goomba(spec.x * TILE + 8, spec.y * TILE)
        : new Koopa(spec.x * TILE + 8, spec.y * TILE);
      // A hand-written level can place an enemy inside the scenery; lift it up
      // until it has clear space, so a typo can never wedge an enemy in a wall.
      for (let guard = 0; guard < 16 && this.enemyEmbedded(e); guard++) e.y -= TILE;
      this.entities.push(e);
      return e;
    }

    enemyEmbedded(e) {
      const x0 = Math.floor((e.left + 1) / TILE);
      const x1 = Math.floor((e.right - 1) / TILE);
      const y0 = Math.floor((e.top + 1) / TILE);
      const y1 = Math.floor((e.bottom - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.isBlockingAt(tx, ty)) return true;
        }
      }
      return false;
    }

    spawnPlayer() {
      this.player = new Player(2 * TILE + 8, (this.def.groundY - 2) * TILE);
      this.entities.push(this.player);
    }

    add(e) { this.entities.push(e); }

    /* -------------------------------------------------------------- queries */
    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= this.def.width || y >= 15) return null;
      return this.tiles.get(this.tileKey(x, y)) || null;
    }
    isBlocking(t) {
      return !!(t && BLOCKING[t.kind] && !(t.kind === K.HIDDEN && t.hidden));
    }
    isBlockingAt(x, y) { return this.isBlocking(this.tileAt(x, y)); }
    isSemiSolidAt(x, y) { const t = this.tileAt(x, y); return !!(t && t.kind === 'platform'); }
    solidBelow(px, py) {
      const t = this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
      return !!(t && BLOCKING[t.kind]);
    }
    offscreenFrozen(e) { return e.x > this.camX + VIEW_W + 32 || e.x < this.camX - 220; }
    offscreenBehind(e, pad) { return e.x < this.camX - (pad || 64); }

    /** Is there room to stand entity `e` up to height `h` in place? */
    canStand(e, h) {
      const top = e.bottom - h;
      const x0 = Math.floor((e.left + 1) / TILE);
      const x1 = Math.floor((e.right - 1) / TILE);
      const y0 = Math.floor((top + 0.5) / TILE);
      const y1 = Math.floor((e.bottom - 0.5) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.isBlockingAt(tx, ty)) return false;
        }
      }
      return true;
    }

    /* -------------------------------------------------------------- blocks */
    headBump(ty, tx, who) {
      const t = this.tileAt(tx, ty);
      if (!t) return;
      if (!BUMPABLE[t.kind]) { Audio.bump(); return; }
      if (t.kind === K.HIDDEN) t.hidden = false;

      if (t.kind === K.QUESTION) {
        this.dispense(t, tx, ty, who);
        t.kind = K.USED;
        t.used = 1;
        t.bumpV = 2.6;
        this.bumped.push(t);
        return;
      }
      if (t.kind === K.BRICK) {
        if (who && who.big) { this.breakBrick(tx, ty); return; }
        t.bumpV = 2.6;
        this.bumped.push(t);
        Audio.bump();
        this.bumpEnemiesOn(tx, ty);
        return;
      }
      if (t.kind === K.BRICK_HARD || t.kind === K.USED) {
        t.bumpV = 2.6;
        this.bumped.push(t);
        Audio.bump();
        this.bumpEnemiesOn(tx, ty);
      }
    }

    bumpEnemiesOn(tx, ty) {
      for (const e of this.entities) {
        if (e.remove || e.dead || e.kind === 'player') continue;
        if (e.kind !== 'goomba' && e.kind !== 'koopa') continue;
        if (e.flipped) continue;
        const onTop = e.bottom >= ty * TILE - 4 && e.bottom <= ty * TILE + 4 &&
                      e.x + e.w / 2 > tx * TILE && e.x - e.w / 2 < (tx + 1) * TILE;
        if (onTop) e.killFlip(this, Math.random() < 0.5 ? -1 : 1);
      }
    }

    breakBrick(tx, ty) {
      const t = this.tileAt(tx, ty);
      if (!t) return;
      this.tiles.delete(this.tileKey(tx, ty));
      const px = tx * TILE, py = ty * TILE;
      const offs = [[4, 4, -1.1, -4.2], [12, 4, 1.1, -4.2], [4, 12, -1.1, -2.6], [12, 12, 1.1, -2.6]];
      for (const [ox, oy, vx, vy] of offs) {
        this.particles.push(new Particle(px + ox, py + oy, vx, vy, 'debris', { life: 110 }));
      }
      this.addScore(SCORE.brickBreak, px, py);
      Audio.brick();
      this.bumpEnemiesOn(tx, ty);
      for (const e of this.entities) {
        if (e.kind === 'koopa' && e.mode === 'slide' &&
            Math.abs(e.bottom - (ty + 1) * TILE) < 6 && Math.abs(e.x - (px + 8)) < 12) {
          e.killFlip(this, sign(e.vx) || 1);
        }
      }
    }

    dispense(t, tx, ty, who) {
      const content = t.content || 'coin';
      const px = tx * TILE, py = ty * TILE;
      if (content === 'coin') { this.coinPop(px + 8, py); return; }
      if (content === 'coins') {
        this.coinPop(px + 8, py);
        t.content = 'coin';
        return;
      }
      let type = content;
      if (who && who.power === 0 && type === 'flower') type = 'mushroom';
      const item = new Item(px + 8, py, type);
      item.y = py + TILE - item.h;
      this.add(item);
      Audio.powerupAppear();
    }

    coinPop(px, py) {
      this.particles.push(new Particle(px, py + 4, 0, -5.0, 'coinpop', { life: 34 }));
      this.coins++;
      this.addScore(SCORE.coin, px, py);
      Audio.coin();
      if (this.coins >= 100) { this.coins -= 100; this.game.lives++; Audio.oneUp(); }
    }

    addScore(n, px, py) {
      this.score += n;
      if (px !== undefined) {
        this.particles.push(new Particle(px, py, 0, -0.7, 'score', { life: 44, value: n }));
      }
    }

    checkPickups(p) {
      const x0 = Math.floor(p.left / TILE), x1 = Math.floor((p.right - 1) / TILE);
      const y0 = Math.floor(p.top / TILE), y1 = Math.floor((p.bottom - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = this.tileAt(tx, ty);
          if (!t) continue;
          if (t.kind === K.COIN) {
            this.tiles.delete(this.tileKey(tx, ty));
            this.coins++;
            this.addScore(SCORE.coin, tx * TILE + 8, ty * TILE);
            Audio.coin();
            if (this.coins >= 100) { this.coins -= 100; this.game.lives++; Audio.oneUp(); }
          } else if (t.kind === K.AXE && p.state === 'play') {
            this.tiles.delete(this.tileKey(tx, ty));
            this.grabAxe(p);
          }
        }
      }
    }

    grabAxe(p) {
      p.state = 'clear';
      p.vx = 0; p.vy = 0;
      this.addScore(SCORE.flag, p.x, p.y);
      Audio.flagpole();
      setTimeout(() => {
        if (p.state === 'clear') p.state = 'walk';
      }, 900);
      setTimeout(() => {
        this.levelCleared();
      }, 1600);
    }

    killEnemyByShell(e, dir) {
      if (e.kind === 'goomba') {
        e.killFlip(this, dir);
        this.addScore(SCORE.shellKill, e.x, e.y);
      } else if (e.kind === 'koopa') {
        if (e.mode === 'walk') e.killFlip(this, dir);
        else if (e.mode === 'shell') e.kick(this, dir);
        else if (e.mode === 'slide') e.killFlip(this, dir);
        this.addScore(SCORE.shellKill, e.x, e.y);
      }
    }

    /* --------------------------------------------------------------- update */
    update(input) {
      this.frame++;
      const p = this.player;

      p.handleInput(input, this);
      if (input.fire) p.fire(this);
      p.update(this);

      for (const e of this.entities) {
        if (e === p || e.remove || e.dead) continue;
        e.update(this);
      }
      for (const f of this.floats) f.update(this);

      this.resolveInteractions();

      for (const pa of this.particles) pa.update();
      if (this.frame % 8 === 0) this.particles = this.particles.filter((x) => !x.dead);

      for (const t of this.bumped) {
        if (!this.tiles.has(this.tileKey(t.x, t.y))) { t.bumpV = 0; continue; }
        t.bump += t.bumpV;
        t.bumpV -= 0.45;
        if (t.bump <= 0) { t.bump = 0; t.bumpV = 0; }
      }
      this.bumped = this.bumped.filter((t) => t.bumpV !== 0);

      this.entities = this.entities.filter((e) => !e.remove && !e.dead);

      if (p.state !== 'dying' && p.state !== 'clear') {
        this.timeAcc++;
        if (this.timeAcc >= 24) {
          this.timeAcc = 0;
          this.time--;
          if (this.time === 100) Audio.warning();
          if (this.time <= 0) { this.time = 0; p.die(this); }
        }
      }

      this.updateCamera();
    }

    updateCamera() {
      const p = this.player;
      let target = p.x - VIEW_W * 0.42;
      const maxX = Math.max(0, this.widthPx - VIEW_W);
      if (target < 0) target = 0;
      if (target > maxX) target = maxX;
      if (target > this.camX) this.camX = target;
      this.camX = clamp(this.camX, 0, maxX);

      let targetY = 0;
      const maxY = Math.max(0, this.heightPx - VIEW_H);
      if (maxY > 0) {
        if (p.y < 96) targetY = p.y - 96;
        else if (p.bottom > 176) targetY = p.bottom - 176;
        targetY = clamp(targetY, 0, maxY);
      }
      this.camY += (targetY - this.camY) * 0.14;
      if (Math.abs(targetY - this.camY) < 0.4) this.camY = targetY;
    }

    resolveInteractions() {
      const p = this.player;
      const active = (p.state === 'play' || p.state === 'grow' || p.state === 'shrink');

      if (active) {
        for (const e of this.entities) {
          if (e.remove || e.dead || e.kind !== 'item') continue;
          if (e.emerge <= 0 && p.overlaps(e, -2)) this.pickupItem(e, p);
        }
      }

      if (active) {
        for (const e of this.entities) {
          if (e.remove || e.dead) continue;
          if (e.kind !== 'goomba' && e.kind !== 'koopa') continue;
          if (e.flipped || (e.kind === 'goomba' && e.flatTimer > 0)) continue;
          if (!p.overlaps(e, 2)) continue;

          if (p.starTimer > 0) {
            this.killEnemyByShell(e, sign(p.vx) || 1);
            continue;
          }

          const stomping = p.vy > 0.5 && (p.bottom - p.vy) <= e.top + Math.max(5, e.h * 0.5);
          if (stomping) {
            p.vy = p.jumpHeld ? PHYS.stompBounceHigh : PHYS.stompBounce;
            p.y = e.top - p.h;
            p.grounded = false;
            if (e.kind === 'goomba') {
              e.stomp();
              this.addScore(SCORE.goomba, e.x, e.y);
              Audio.stomp();
            } else if (e.mode === 'walk') {
              e.toShell();
              this.addScore(SCORE.koopa, e.x, e.y);
              Audio.stomp();
            } else if (e.mode === 'slide') {
              e.toShell();
              Audio.stomp();
            } else {
              e.kick(this, p.x < e.x ? 1 : -1);
            }
          } else if (e.kind === 'koopa' && e.mode === 'shell') {
            e.kick(this, p.x < e.x ? 1 : -1);
            p.x -= sign(p.x - e.x) * 1.5;
          } else {
            p.hurt(this);
          }
        }
      }

      // moving platforms carry the player
      if (p.state === 'play' || p.state === 'grow' || p.state === 'shrink' || p.state === 'walk') {
        for (const f of this.floats) {
          if (p.vy >= 0 && p.bottom <= f.top + 2 + Math.abs(f.dy) &&
              p.right > f.left && p.left < f.right && p.bottom >= f.top - 1) {
            p.y = f.top - p.h;
            p.vy = 0;
            p.grounded = true;
            if (f.dx) p.x += f.dx;
            if (f.dy) p.y += f.dy;
          }
        }
      }

      // flagpole
      const f = this.flag;
      if (p.state === 'play' && f && this.goalType === 'flag') {
        const poleX = f.x * TILE + 8;
        if (p.right >= poleX - 1 && p.left <= poleX + 3 &&
            p.bottom > f.y * TILE && p.top < (f.y + f.height) * TILE) {
          this.grabFlag();
        }
      }

      // fell in a pit (or the water)
      if (p.state === 'play' && p.top > this.heightPx + 8) {
        if (this.def.water) p.setPower(0);
        p.die(this);
      }
    }

    pickupItem(e, p) {
      e.remove = true;
      if (e.type === 'mushroom') {
        if (p.power === 0) { p.setPower(1); p.state = 'grow'; p.growTimer = 30; p.invuln = 40; }
        this.addScore(SCORE.powerup, e.x, e.y);
        Audio.powerup();
      } else if (e.type === 'oneup') {
        this.game.lives++;
        Audio.oneUp();
      } else if (e.type === 'flower') {
        const wasSmall = p.power === 0;
        p.setPower(2);
        if (wasSmall) { p.state = 'grow'; p.growTimer = 30; p.invuln = 40; }
        this.addScore(SCORE.powerup, e.x, e.y);
        Audio.powerup();
      } else if (e.type === 'star') {
        p.starTimer = 600;
        this.addScore(SCORE.powerup, e.x, e.y);
        Audio.powerup();
        this.startMusic(true);
      }
    }

    grabFlag() {
      const p = this.player;
      p.state = 'flag';
      p.x = this.flag.x * TILE + 8;
      p.vx = 0; p.vy = 0;
      p.flagBottomY = (this.def.groundY - 1) * TILE - p.h;
      p.facing = 1;
      this.flagRaised = 1;
      const units = Math.max(0, Math.floor((p.flagBottomY - p.y) / TILE));
      this.addScore(units * SCORE.flagPerUnit, p.x, p.y);
      Audio.flagpole();
    }

    onFlagLanded() {
      this.addScore(SCORE.flag, this.player.x, this.player.y);
    }

    levelCleared() {
      if (this.cleared) return;
      this.cleared = true;
      this.game.onLevelCleared(this);
    }

    startMusic(restart) { Audio.playMusic(this.def.music, { restart: !!restart }); }
    musicStop() { Audio.stopMusic(); }
    doWarp(warp) { this.game.warpTo(warp.level, warp.x, warp.y); }

    /* --------------------------------------------------------------- render */
    render(ctx) {
      const d = this.def;
      const camX = Math.round(this.camX);
      const camY = Math.round(this.camY);

      ctx.fillStyle = d.bg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.save();
      ctx.translate(-camX, -camY);
      this.renderDecor(ctx, camX);
      ctx.fillStyle = d.underground ? '#000000' : d.bg;
      this.renderTiles(ctx, camX, camY);
      this.renderFlagAndCastle(ctx);
      this.renderEntities(ctx);
      this.renderParticles(ctx);
      ctx.restore();
    }

    renderDecor(ctx, camX) {
      const d = this.def;
      if (d.underground) return;
      for (const item of this.decor) {
        const x = item.x * TILE;
        if (x < camX - 200 || x > camX + VIEW_W + 200) continue;
        if (item.type === 'cloud') drawCloud(ctx, x + 8, (item.y || 2) * TILE + 8, item.size);
        else if (item.type === 'hill') drawHill(ctx, x, d.groundY * TILE, item.size);
        else if (item.type === 'bush') drawBush(ctx, x, d.groundY * TILE, item.size);
      }
    }

    renderTiles(ctx, camX, camY) {
      const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
      const x1 = Math.min(this.def.width - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
      const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
      const underground = this.def.underground;

      // water body first
      if (this.def.water) {
        for (let ty = this.def.groundY; ty < 15; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            const t = this.tileAt(tx, ty);
            if (t && t.kind === K.WATER) {
              const px = tx * TILE, py = ty * TILE;
              ctx.fillStyle = '#0000a8';
              ctx.fillRect(px, py, TILE, TILE);
              if (ty === this.def.groundY) {
                ctx.fillStyle = '#3cbcfc';
                const wob = Math.sin((tx + this.frame / 8) * 0.9) * 1.5;
                ctx.fillRect(px, py + 2 + wob, TILE, 2);
              }
            }
          }
        }
      }

      for (let ty = y0; ty <= 14; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = this.tileAt(tx, ty);
          if (!t) continue;
          const px = tx * TILE;
          const py = ty * TILE - (t.bump > 0 ? Math.round(t.bump) : 0);
          switch (t.kind) {
            case K.SOLID:
              if (underground) {
                ctx.fillStyle = '#0058d8';
                ctx.fillRect(px, py, TILE, TILE);
                ctx.fillStyle = '#3cbcfc';
                ctx.fillRect(px, py, TILE, 2);
                ctx.fillRect(px, py, 2, TILE);
              } else {
                Art.paint(ctx, 'tile.solid', px, py);
              }
              break;
            case K.BRICK:
            case K.BRICK_HARD:
              Art.paint(ctx, underground ? 'tile.brick.under' : 'tile.brick', px, py);
              break;
            case K.QUESTION:
              Art.paint(ctx, 'tile.question', px, py);
              break;
            case K.USED:
              Art.paint(ctx, 'tile.used', px, py);
              break;
            case K.HIDDEN:
              break;
            case K.COIN:
              Art.paint(ctx, 'coin.' + 'abcd'[Math.floor(this.frame / 6) % 4], px, py);
              break;
            case K.PIPE_TOP:
              drawPipeTop(ctx, px, py, underground);
              break;
            case K.PIPE_BODY:
              drawPipeBody(ctx, px, py, underground);
              break;
            case K.AXE:
              Art.paint(ctx, 'prop.axe', px, py);
              break;
          }
        }
      }
    }

    renderFlagAndCastle(ctx) {
      const d = this.def;
      if (this.goalType === 'flag' && d.flag) {
        const f = d.flag;
        const px = f.x * TILE;
        const topY = f.y * TILE;
        const botY = (f.y + f.height) * TILE;
        ctx.fillStyle = '#00a800';
        ctx.fillRect(px + 7, topY, 2, botY - topY);
        ctx.fillStyle = '#58d854';
        ctx.fillRect(px + 7, topY, 1, botY - topY);
        ctx.fillStyle = '#00a800';
        ctx.fillRect(px + 5, topY - 4, 6, 4);
        ctx.fillStyle = '#58d854';
        ctx.fillRect(px + 6, topY - 3, 2, 2);
        const clothY = this.flagRaised ? botY - 16 : topY + 8;
        Art.paint(ctx, 'prop.flag', px + 9, clothY);
        Art.paint(ctx, 'tile.solid', px, (d.groundY - 1) * TILE);
      }
      if (this.goalType === 'flag' && d.castle && !d.castle.hidden) {
        drawCastle(ctx, d.castle.x * TILE, (d.groundY) * TILE);
      }
    }

    renderEntities(ctx) {
      for (const e of this.entities) {
        if (e === this.player) continue;
        if (e.x < this.camX - 40 || e.x > this.camX + VIEW_W + 40) continue;
        if (e.kind === 'item') {
          if (e.type === 'star' && e.emerge <= 0) drawSparkles(ctx, e);
          Art.paintAnchor(ctx, e.spriteName(), e.x, e.bottom);
        } else if (e.kind === 'fireball') {
          drawFireball(ctx, e);
        } else if (e.kind === 'goomba' && e.flatTimer > 0) {
          Art.paintAnchor(ctx, 'goomba.flat', e.x, e.bottom);
        } else {
          Art.paintAnchor(ctx, e.spriteName(), e.x, e.bottom);
        }
      }
      for (const f of this.floats) {
        if (f.x < this.camX - 60 || f.x > this.camX + VIEW_W + 60) continue;
        renderFloat(ctx, f, this.frame);
      }
      this.renderPlayer(ctx);
    }

    renderPlayer(ctx) {
      const p = this.player;
      if (p.remove) return;
      if (p.invuln > 0 && p.state !== 'dying' && Math.floor(this.frame / 3) % 2 === 0) return;
      const name = p.spriteName();

      // sliding into a pipe: the classic spin-in-place effect
      if (p.state === 'pipe') {
        const t = 1 - p.pipeTimer / 34;
        ctx.save();
        ctx.translate(Math.round(p.x - (p.pipeDir > 0 ? 0 : 0)), Math.round(p.y + p.h / 2));
        ctx.rotate(Math.PI * 2 * t);
        ctx.globalAlpha = 0.9;
        Art.paint(ctx, 'mario.' + (p.big ? 'big' : 'small') + '.idle', -8, -p.h / 2);
        ctx.restore();
        return;
      }

      if (p.starTimer > 0 && Math.floor(this.frame / 3) % 2 === 0) {
        Art.paintAnchor(ctx, name, p.x, p.bottom);
        drawTint(ctx, name, p, STAR_COLOURS[Math.floor(this.frame / 3) % STAR_COLOURS.length]);
        return;
      }
      if (p.state === 'shrink' && Math.floor(this.frame / 3) % 2) {
        const alt = p.facing < 0 ? 'mario.small.idle' : '#mario.small.idle';
        Art.paintAnchor(ctx, alt, p.x, p.bottom);
        return;
      }
      Art.paintAnchor(ctx, name, p.x, p.bottom);
    }

    renderParticles(ctx) {
      for (const pa of this.particles) {
        if (pa.kind === 'debris') {
          drawDebris(ctx, pa);
        } else if (pa.kind === 'coinpop') {
          Art.paint(ctx, 'coin.' + 'abcd'[Math.floor(pa.age / 3) % 4], pa.x - 8, pa.y - 8);
        } else if (pa.kind === 'sparkle') {
          ctx.fillStyle = pa.age % 4 < 2 ? '#fcfcfc' : '#fcd800';
          ctx.fillRect(Math.round(pa.x), Math.round(pa.y), 2, 2);
        } else if (pa.kind === 'score') {
          drawScoreText(ctx, pa.value, pa.x, pa.y);
        }
      }
    }
  }

  /* ============================================================== drawing == */
  const STAR_COLOURS = ['#fcd800', '#fcfcfc', '#d82800', '#00a800', '#0058f8'];

  function drawTint(ctx, name, p, colour) {
    const a = Art.ATLAS[name];
    if (!a) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colour;
    const x = Math.round(p.x - a.w / 2), y = Math.round(p.bottom - a.h);
    // only tint pixels that belong to the sprite: redraw it clipped
    const tmp = document.createElement('canvas');
    tmp.width = a.w; tmp.height = a.h;
    const tc = tmp.getContext('2d');
    tc.drawImage(Art.canvas, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = colour;
    tc.fillRect(0, 0, a.w, a.h);
    ctx.drawImage(tmp, x, y);
    ctx.restore();
  }

  function drawDebris(ctx, pa) {
    const a = Art.ATLAS['tile.debris'];
    if (!a) return;
    ctx.save();
    ctx.translate(Math.round(pa.x), Math.round(pa.y));
    ctx.rotate(pa.age * 0.25);
    Art.paint(ctx, 'tile.debris', -8, -8);
    ctx.restore();
  }

  function drawCloud(ctx, x, y, size) {
    const w = size === 3 ? 64 : size === 2 ? 48 : 32;
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(x + 4, y + 6, w - 8, 8);
    const n = size === 3 ? 3 : size === 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cx = x + w / 2 + (i - (n - 1) / 2) * (w / n) * 0.8;
      ctx.fillRect(cx - 7, y + 1, 14, 7);
      ctx.fillRect(cx - 4, y - 2, 8, 4);
    }
    ctx.fillStyle = '#b8d8f8';
    ctx.fillRect(x + 4, y + 13, w - 8, 2);
  }

  function drawHill(ctx, x, groundY, size) {
    const h = size === 2 ? 48 : 32;
    const w = size === 2 ? 80 : 48;
    const top = groundY - h;
    ctx.fillStyle = '#00a800';
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const half = (w / 2) * (0.3 + 0.7 * t);
      ctx.fillRect(Math.round(x + w / 2 - half), top + i, Math.round(half * 2), 1);
    }
    ctx.fillStyle = '#58d854';
    ctx.fillRect(x + w / 2 - 2, top + 6, 4, 4);
    ctx.fillRect(x + w / 2 - 6, top + 12, 4, 4);
    if (size === 2) ctx.fillRect(x + w / 2 - 10, top + 20, 4, 4);
  }

  function drawBush(ctx, x, groundY, size) {
    const w = size === 3 ? 48 : size === 1 ? 16 : 32;
    const top = groundY - 16;
    ctx.fillStyle = '#00a800';
    ctx.fillRect(x + 2, top + 6, w - 4, 10);
    const n = size === 3 ? 3 : size === 1 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const cx = x + w / 2 + (i - (n - 1) / 2) * (w / n) * 0.9;
      ctx.fillRect(Math.round(cx - 8), top + 2, 16, 8);
      ctx.fillRect(Math.round(cx - 5), top, 10, 4);
    }
    ctx.fillStyle = '#58d854';
    ctx.fillRect(x + 4, top + 8, w - 8, 2);
  }

  function drawCastle(ctx, x, groundY) {
    const brick = '#c84c0c';
    const dark = '#883000';
    const black = '#000000';
    const W = 80, H = 80;
    const top = groundY - H;
    ctx.fillStyle = brick;
    ctx.fillRect(x, top, W, H);
    // brick lines
    ctx.fillStyle = dark;
    for (let y = 0; y < H; y += 8) ctx.fillRect(x, top + y, W, 1);
    for (let y = 0; y < H; y += 8) {
      const off = (y / 8) % 2 ? 8 : 0;
      for (let bx = off; bx < W; bx += 16) ctx.fillRect(x + bx, top + y, 1, 8);
    }
    // battlements
    ctx.fillStyle = brick;
    for (let i = 0; i < 5; i++) {
      const bx = x + i * 16 + (i ? 0 : 0);
      ctx.fillRect(x + i * 16, top - 8, 8, 8);
    }
    ctx.fillStyle = dark;
    for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 16 + 8, top - 8, 1, 8);
    // tower
    ctx.fillStyle = brick;
    ctx.fillRect(x + 24, top - 32, 32, 24);
    ctx.fillStyle = dark;
    for (let y = 0; y < 24; y += 8) ctx.fillRect(x + 24, top - 32 + y, 32, 1);
    ctx.fillStyle = brick;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 24 + i * 8, top - 40, 4, 8);
    // door
    ctx.fillStyle = black;
    ctx.fillRect(x + 32, top + H - 24, 16, 24);
    ctx.fillRect(x + 32, top + H - 30, 16, 8);
    ctx.fillStyle = dark;
    ctx.fillRect(x + 32, top + H - 30, 16, 1);
    // windows
    ctx.fillStyle = black;
    ctx.fillRect(x + 16, top + 16, 8, 12);
    ctx.fillRect(x + 56, top + 16, 8, 12);
    ctx.fillRect(x + 36, top - 26, 8, 10);
  }

  function drawPipeTop(ctx, px, py, underground) {
    const light = underground ? '#3cbcfc' : '#58d854';
    const dark = underground ? '#0058d8' : '#00a800';
    const darker = underground ? '#0000a8' : '#007000';
    ctx.fillStyle = dark;
    ctx.fillRect(px - 2, py, TILE + 4, TILE);
    ctx.fillStyle = light;
    ctx.fillRect(px - 2, py, 4, TILE);
    ctx.fillRect(px + 8, py, 4, TILE);
    ctx.fillStyle = darker;
    ctx.fillRect(px + 13, py, 3, TILE);
    ctx.fillStyle = '#000000';
    ctx.fillRect(px - 2, py, TILE + 4, 1);
  }

  function drawPipeBody(ctx, px, py, underground) {
    const light = underground ? '#3cbcfc' : '#58d854';
    const dark = underground ? '#0058d8' : '#00a800';
    const darker = underground ? '#0000a8' : '#007000';
    ctx.fillStyle = dark;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = light;
    ctx.fillRect(px, py, 4, TILE);
    ctx.fillRect(px + 10, py, 4, TILE);
    ctx.fillStyle = darker;
    ctx.fillRect(px + 15, py, 1, TILE);
  }

  function renderFloat(ctx, f, frame) {
    const x = Math.round(f.left), y = Math.round(f.top);
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(x, y, f.w, f.h);
    ctx.fillStyle = '#fcd800';
    ctx.fillRect(x, y, f.w, 2);
    ctx.fillRect(x, y + f.h - 2, f.w, 2);
    ctx.fillStyle = '#883000';
    for (let i = 0; i < f.w; i += 8) ctx.fillRect(x + i + 6, y + 2, 2, f.h - 4);
  }

  function drawFireball(ctx, e) {
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    ctx.rotate(Math.floor(e.anim / 3) * Math.PI / 2);
    Art.paint(ctx, 'fireball', -8, -8);
    ctx.restore();
  }

  function drawSparkles(ctx, e) {
    for (let i = 0; i < 4; i++) {
      const a = (performance.now() / 200) + i * Math.PI / 2;
      ctx.fillStyle = i % 2 ? '#fcfcfc' : '#fcd800';
      ctx.fillRect(Math.round(e.x + Math.cos(a) * 10), Math.round(e.cy + Math.sin(a) * 10), 2, 2);
    }
  }

  const HUD_FONT = '8px "Press Start 2P", "Courier New", monospace';
  function drawScoreText(ctx, value, x, y) {
    ctx.font = HUD_FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText(String(value), Math.round(x), Math.round(y));
    ctx.textAlign = 'left';
  }

  /* ============================================================== the game == */
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.lives = 3;
      this.totalScore = 0;
      this.state = 'playing';
      this.input = {
        left: false, right: false, up: false, down: false,
        jump: false, run: false, fire: false
      };
      this.frame = 0;
      this.hud = {
        scoreEl: document.getElementById('hud-score'),
        coinEl: document.getElementById('hud-coins'),
        worldEl: document.getElementById('hud-world'),
        timeEl: document.getElementById('hud-time'),
        livesEl: document.getElementById('hud-lives')
      };
      this.overlay = document.getElementById('overlay');
      this.overlayTitle = document.getElementById('overlay-title');
      this.overlayBody = document.getElementById('overlay-body');
      this.startLevel(0);
    }

    get world() { return this._world; }

    startLevel(index, opts) {
      this.levelIndex = index;
      this._world = new World(this, index);
      this.state = 'playing';
      if (opts && opts.at) {
        const p = this._world.player;
        p.x = opts.at.x * TILE + 8;
        p.y = opts.at.y * TILE;
        this._world.camX = clamp(p.x - VIEW_W * 0.42, 0, Math.max(0, this._world.widthPx - VIEW_W));
      }
      if (this.keepPower) this._world.player.setPower(this.keepPower);
      if (!opts || !opts.silent) this._world.startMusic();
      this.hideOverlay();
    }

    warpTo(levelIndex, tx, ty) {
      this.keepPower = this._world.player.power;
      const carryScore = this._world.score;
      const carryCoins = this._world.coins;
      this.startLevel(levelIndex, { at: { x: tx, y: ty } });
      this._world.score = carryScore;
      this._world.coins = carryCoins;
      Audio.pipe();
    }

    onLevelCleared(world) {
      if (this.state === 'clear') return;
      this.state = 'clear';
      this.clearTimer = 0;
      world.musicStop();
      Audio.stageClear();
      const timeBonus = world.time * SCORE.timePerUnit;
      world.time = 0;
      world.addScore(timeBonus);
      this.pendingClear = { score: world.score, timeBonus: timeBonus };
      setTimeout(() => {
        if (this.state !== 'clear') return;
        this.showOverlay('COURSE CLEAR!', [
          'SCORE ' + pad(this.pendingClear.score, 6),
          'TIME BONUS ' + this.pendingClear.timeBonus,
          '',
          'PRESS ENTER TO CONTINUE'
        ]);
      }, 2800);
    }

    nextLevel() {
      this.totalScore += this._world.score;
      const next = this.levelIndex + 1;
      if (next >= L.LEVELS.length) {
        this.state = 'gameover';
        this.showOverlay('THANK YOU MARIO!', [
          'YOUR QUEST IS OVER.',
          'TOTAL ' + pad(this.totalScore, 6),
          '',
          'PRESS ENTER TO PLAY AGAIN'
        ]);
      } else {
        this.keepPower = 0;
        this.startLevel(next);
      }
    }

    loseLife() {
      this.lives--;
      this.keepPower = 0;
      if (this.lives <= 0) {
        this.state = 'gameover';
        this.showOverlay('GAME OVER', [
          'SCORE ' + pad(this._world.score, 6),
          '',
          'PRESS ENTER TO TRY AGAIN'
        ]);
        Audio.gameOver();
        return;
      }
      const score = this._world.score, coins = this._world.coins;
      this.startLevel(this.levelIndex);
      this._world.score = score;
      this._world.coins = coins;
    }

    restartGame() {
      this.lives = 3;
      this.totalScore = 0;
      this.keepPower = 0;
      this.startLevel(0);
    }

    showOverlay(title, lines) {
      this.overlayTitle.textContent = title;
      this.overlayBody.innerHTML = lines.map((l) => '<div>' + (l || '&nbsp;') + '</div>').join('');
      this.overlay.classList.add('visible');
    }
    hideOverlay() { this.overlay.classList.remove('visible'); }

    update() {
      this.frame++;
      const w = this._world;
      if (this.state === 'playing') {
        w.update(this.input);
        if (w.player.state === 'dying' && w.player.remove) this.loseLife();
      } else if (this.state === 'clear') {
        w.update({ left: false, right: false, up: false, down: false, jump: false, run: false, fire: false });
      }
      this.updateHud();
    }

    updateHud() {
      const w = this._world;
      if (!w || !this.hud.scoreEl) return;
      this.hud.scoreEl.textContent = pad(w.score, 6);
      this.hud.coinEl.textContent = pad(w.coins, 2);
      this.hud.worldEl.textContent = w.def.name;
      this.hud.timeEl.textContent = pad(Math.max(0, w.time), 3);
      this.hud.livesEl.textContent = String(Math.max(0, this.lives));
    }

    render() {
      this._world.render(this.ctx);
    }
  }

  global.MarioGame = { Game, World, Player, Goomba, Koopa, Item, Fireball, VIEW_W, VIEW_H, TILE, PHYS, K, pad };
})(typeof window !== 'undefined' ? window : globalThis);
