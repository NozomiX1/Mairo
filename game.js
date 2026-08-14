/* =====================================================================
   Super Mario (Web) — a faithful-ish remake of the classic platformer
   Canvas 256x240 logical resolution, 16px tiles, fixed 60fps timestep.
   ===================================================================== */
'use strict';

/* ------------------------------ constants ------------------------------ */
const TILE = 16;
const VIEW_W = 256;
const VIEW_H = 240;
const LEVEL_W = 220;              // level width in tiles
const LEVEL_H = 15;               // level height in tiles

const T = { EMPTY:0, GROUND:1, BRICK:2, QUESTION:3, USED:4, PIPE:5, SOLID:6 };

const GRAVITY = 0.5;
const MAX_FALL = 10;
const WALK = 1.35;
const RUN  = 2.2;
const ACCEL = 0.12;
const FRICTION = 0.16;
const JUMP_V = -9.0;
const STOMP_V = -6.0;
const BUMP_FRAMES = 12;

const FLAG_X = 196;
const CASTLE_X = 208;

const SKY = '#5c94fc';

/* ------------------------------- canvas -------------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 2;

function resize(){
  scale = Math.max(1, Math.floor(Math.min(
    (window.innerWidth  - 20) / VIEW_W,
    (window.innerHeight - 90) / VIEW_H
  )));
  canvas.width  = VIEW_W * scale;
  canvas.height = VIEW_H * scale;
  canvas.style.width  = VIEW_W * scale + 'px';
  canvas.style.height = VIEW_H * scale + 'px';
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------- audio --------------------------------- */
let muted = false;
const Sound = (() => {
  let actx = null;
  function ensure(){
    if (muted) return null;
    if (!actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, opt = {}){
    const c = ensure(); if (!c) return;
    const { type='square', vol=0.14, slide=0, delay=0 } = opt;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(dur, vol=0.18, delay=0){
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    const f = c.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 1400;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  }
  return {
    ensure,
    jump(){ tone(210, 0.18, { slide:520, vol:0.10 }); },
    coin(){ tone(988, 0.08, { vol:0.10 }); tone(1319, 0.35, { vol:0.10, delay:0.08 }); },
    stomp(){ tone(150, 0.12, { slide:-120, vol:0.16 }); noise(0.08, 0.10); },
    bump(){ tone(110, 0.08, { vol:0.15 }); },
    brick(){ noise(0.22, 0.20); tone(300, 0.14, { slide:-160, vol:0.09 }); },
    power(){ [392,523,659,784,1047].forEach((f,i)=>tone(f,0.11,{vol:0.11,delay:i*0.06})); },
    grow(){ [262,330,392,523,659,784].forEach((f,i)=>tone(f,0.12,{vol:0.11,delay:i*0.05})); },
    fire(){ tone(700, 0.1, { slide:-400, vol:0.10 }); },
    hurt(){ tone(420, 0.25, { slide:-320, vol:0.13 }); },
    die(){ [660,494,392,330,262,196].forEach((f,i)=>tone(f,0.17,{vol:0.12,delay:i*0.09})); },
    kick(){ tone(280, 0.1, { slide:220, vol:0.13 }); },
    flag(){ [523,659,784,1047,1319,1568,2093].forEach((f,i)=>tone(f,0.12,{vol:0.11,delay:i*0.055})); },
    oneup(){ [523,659,784,1047,1319,1568,1047,1319,1568].forEach((f,i)=>tone(f,0.1,{vol:0.11,delay:i*0.06})); },
  };
})();

/* ------------------------------ music ---------------------------------- */
const NF = {
  E4:329.63, G4:392.00, A4:440.00, B4:493.88, 'A#4':466.16,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
};
// Simplified overworld theme loop: [freq, sixteenths] (0 = rest)
const MUSIC = [
  [NF.E5,2],[NF.E5,2],[0,2],[NF.E5,2],[0,2],[NF.C5,2],[NF.E5,2],[0,2],
  [NF.G5,2],[0,2],[0,2],[0,2],[NF.G4,2],[0,2],[0,2],[0,2],
  [NF.C5,2],[0,2],[0,2],[NF.G4,2],[0,2],[0,2],[NF.E4,2],[0,2],
  [0,2],[NF.A4,2],[0,2],[NF.B4,2],[0,2],[NF['A#4'],2],[NF.A4,2],[0,2],
  [NF.G4,1],[NF.E5,1],[NF.G5,1],[NF.A5,2],[0,2],[NF.F5,2],[NF.G5,2],[0,2],
  [NF.E5,2],[0,2],[NF.C5,2],[NF.D5,2],[NF.B4,2],[0,2],[0,2],[0,2],
  [NF.C5,2],[0,2],[0,2],[NF.G4,2],[0,2],[0,2],[NF.E4,2],[0,2],
  [0,2],[NF.A4,2],[0,2],[NF.B4,2],[0,2],[NF['A#4'],2],[NF.A4,2],[0,2],
];
const Music = {
  timer:null, step:0, next:0, playing:false,
  start(){
    if (this.playing || muted) return;
    const c = Sound.ensure(); if (!c) return;
    this.playing = true; this.step = 0;
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(()=>this.schedule(), 40);
  },
  stop(){ this.playing = false; if (this.timer){ clearInterval(this.timer); this.timer = null; } },
  schedule(){
    const c = Sound.ensure(); if (!c) return;
    const sd = 0.104;
    while (this.next < c.currentTime + 0.25){
      const m = MUSIC[this.step % MUSIC.length];
      if (m[0]) Sound.tone(m[0], m[1]*sd*0.9, { vol:0.055, delay:Math.max(0, this.next - c.currentTime) });
      this.next += m[1]*sd;
      this.step++;
    }
  },
};

/* ------------------------------ input ---------------------------------- */
const keys = {};
let jumpBuffered = 0;
let fireCooldown = 0;

const isDown = (...codes) => codes.some(c => keys[c]);

window.addEventListener('keydown', (e) => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]){
    keys[e.code] = true;
    onKeyDown(e.code);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function onKeyDown(code){
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') jumpBuffered = 8;
  if (code === 'KeyP'){
    if (state === 'playing'){ state = 'paused'; Music.stop(); }
    else if (state === 'paused'){ state = 'playing'; Music.start(); }
  }
  if (code === 'KeyM'){ muted = !muted; if (muted) Music.stop(); else if (state==='playing') Music.start(); }
  if (code === 'Enter' || code === 'Space'){
    if (state === 'title' || state === 'gameover') startGame();
    else if (state === 'clear' && clearPhase >= 2) nextLevel();
  }
}

/* ----------------------------- game state ------------------------------ */
let state = 'title';   // title | playing | paused | dying | clear | gameover
let score = 0, coins = 0, lives = 3, time = 300, world = 1;
let frame = 0;

let grid, contents, bumpAnim, camera;
let items, enemies, floatCoins, coinPops, particles, fireballs, scorePops;
let player, coyote = 0;
let clearPhase = 0;

/* ---------------------------- level building --------------------------- */
const PITS = [[84,86],[151,153],[174,176]];

const QUESTION_BLOCKS = [
  [16,9,'mushroom'],[21,9,'coin'],[23,9,'coin'],
  [64,9,'coin'],[68,9,'coin'],[77,9,'mushroom'],
  [109,9,'star'],[112,9,'coin'],[128,9,'mushroom'],
  [140,9,'flower'],[142,9,'coin'],[143,9,'coin'],
  [168,9,'coin'],[170,9,'coin'],
];
const BRICKS = [
  [20,9],[22,9],[24,9],[63,9],[65,9],[66,9],[67,9],[69,9],
  [76,9],[78,9],[80,9],[96,9],[98,9],[100,9],
  [130,9],[132,9],[134,9],
];
const HIDDEN = { '63,9':'1up', '66,9':'coin', '78,9':'coin' };
const PIPES = [[28,2],[38,3],[46,4],[57,4],[163,2],[179,2]];
const FLOAT_COINS = [[29,10],[30,10],[31,10],[100,8],[101,8],[102,8],[103,8],[152,9],[153,9],[154,9]];
const ENEMY_SPAWNS = [
  ['goomba',20],['goomba',24],['goomba',33],
  ['koopa',41],
  ['goomba',60],['goomba',62],['goomba',69],
  ['goomba',88],['koopa',90],['goomba',104],['goomba',106],
  ['goomba',118],['koopa',125],['goomba',130],
  ['goomba',146],['goomba',160],['koopa',168],['goomba',184],['goomba',186],
];

function buildLevel(){
  grid = Array.from({length: LEVEL_H}, () => new Array(LEVEL_W).fill(T.EMPTY));
  contents = {};
  bumpAnim = {};
  const inPit = x => PITS.some(([a,b]) => x >= a && x <= b);

  // ground
  for (let x = 0; x < LEVEL_W; x++){
    if (inPit(x)) continue;
    for (let y = 13; y < LEVEL_H; y++) grid[y][x] = T.GROUND;
  }
  // pipes
  for (const [x,h] of PIPES) addPipe(x, h);
  // question blocks + bricks
  for (const [x,y,c] of QUESTION_BLOCKS){ grid[y][x] = T.QUESTION; contents[x+','+y] = c; }
  for (const [x,y] of BRICKS) grid[y][x] = T.BRICK;
  for (const k in HIDDEN) contents[k] = HIDDEN[k];
  // staircase before flag
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) grid[12-j][190+i] = T.SOLID;
}

function addPipe(x, h){
  const rimY = 13 - h;
  for (let xx = x; xx < x+2; xx++){
    grid[rimY][xx] = T.PIPE;
    for (let y = rimY+1; y < LEVEL_H; y++) grid[y][xx] = T.PIPE;
  }
}

function isSolid(tx, ty){
  if (tx < 0 || tx >= LEVEL_W) return true;
  if (ty < 0 || ty >= LEVEL_H) return false;
  const t = grid[ty][tx];
  return t === T.GROUND || t === T.BRICK || t === T.QUESTION ||
         t === T.USED || t === T.PIPE || t === T.SOLID;
}

/* ------------------------------ entities ------------------------------- */
function resetPlayer(){
  player = {
    x: 2*TILE, y: 13*TILE - 16, w: 12, h: 16,
    vx: 0, vy: 0, facing: 1, size: 'small',
    grounded: false, invuln: 0, star: 0, dead: false, canCut: false,
  };
  coyote = 0;
}

function makeEnemy(type, tileX){
  const e = {
    type, x: tileX*TILE, vx: -0.6, vy: 0, w: 16,
    facing: -1, state: 'walk', moving: false, dead: false, life: 0, cool: 0,
  };
  e.h = (type === 'koopa') ? 24 : 16;
  e.y = 13*TILE - e.h;
  return e;
}

function spawnEnemies(){
  enemies = ENEMY_SPAWNS.map(([t,x]) => makeEnemy(t, x));
}

function makeItem(type, tx, ty){
  const sourceTop = ty*TILE;
  return {
    type, x: tx*TILE, y: sourceTop - 1, w: 16, h: 16,
    vx: (type === 'mushroom' || type === '1up') ? 0.9 : (type === 'star' ? 1.1 : 0),
    vy: -0.5, rising: true, sourceTop, grounded: false, dead: false, life: 500,
  };
}

function spawnFloatCoins(){
  floatCoins = FLOAT_COINS.map(([x,y]) => ({ x: x*TILE, y: y*TILE, dead: false }));
}

function resetLevel(){
  buildLevel();
  resetPlayer();
  spawnEnemies();
  spawnFloatCoins();
  items = []; fireballs = []; particles = []; coinPops = []; scorePops = [];
  time = 300; camera = { x: 0 }; clearPhase = 0;
}

function startGame(){
  score = 0; lives = 3; coins = 0; world = 1;
  resetLevel();
  state = 'playing';
  Sound.ensure();
  Music.start();
}

function nextLevel(){
  world++;
  resetLevel();
  state = 'playing';
  Music.start();
}

/* --------------------------- physics helpers --------------------------- */
function overlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveAndCollide(e, isPlayer){
  e.hitWall = false; e.hitCeil = false;
  // horizontal
  e.x += e.vx;
  if (e.vx > 0){
    for (let ty = Math.floor(e.y/TILE); ty <= Math.floor((e.y+e.h-0.01)/TILE); ty++){
      const tx = Math.floor((e.x + e.w)/TILE);
      if (isSolid(tx, ty)){ e.x = tx*TILE - e.w - 0.01; e.vx = 0; e.hitWall = true; break; }
    }
  } else if (e.vx < 0){
    for (let ty = Math.floor(e.y/TILE); ty <= Math.floor((e.y+e.h-0.01)/TILE); ty++){
      const tx = Math.floor(e.x/TILE);
      if (isSolid(tx, ty)){ e.x = (tx+1)*TILE + 0.01; e.vx = 0; e.hitWall = true; break; }
    }
  }
  // vertical
  e.grounded = false;
  e.y += e.vy;
  if (e.vy > 0){
    for (let tx = Math.floor(e.x/TILE); tx <= Math.floor((e.x+e.w-0.01)/TILE); tx++){
      const ty = Math.floor((e.y + e.h)/TILE);
      if (isSolid(tx, ty)){ e.y = ty*TILE - e.h - 0.01; e.vy = 0; e.grounded = true; }
    }
  } else if (e.vy < 0){
    for (let tx = Math.floor(e.x/TILE); tx <= Math.floor((e.x+e.w-0.01)/TILE); tx++){
      const ty = Math.floor(e.y/TILE);
      if (isSolid(tx, ty)){
        e.y = (ty+1)*TILE + 0.01; e.vy = 0; e.hitCeil = true;
        if (isPlayer) bumpBlock(tx, ty);
      }
    }
  }
}

/* ----------------------------- block logic ----------------------------- */
function bumpBlock(tx, ty){
  const key = tx + ',' + ty;
  const t = grid[ty][tx];
  if (t === T.QUESTION){
    grid[ty][tx] = T.USED;
    bumpAnim[key] = BUMP_FRAMES;
    spawnBlockItem(contents[key] || 'coin', tx, ty);
    Sound.bump();
  } else if (t === T.BRICK){
    if (contents[key]){
      grid[ty][tx] = T.USED;
      bumpAnim[key] = BUMP_FRAMES;
      spawnBlockItem(contents[key], tx, ty);
      delete contents[key];
      Sound.bump();
    } else if (player.size !== 'small'){
      breakBrick(tx, ty);
    } else {
      bumpAnim[key] = BUMP_FRAMES;
      Sound.bump();
    }
  } else {
    bumpAnim[key] = BUMP_FRAMES;
    Sound.bump();
  }
  killEnemiesOnTop(tx, ty);
}

function breakBrick(tx, ty){
  grid[ty][tx] = T.EMPTY;
  for (const [dx, dy] of [[-1,-3],[-1,-4],[1,-3],[1,-4]]){
    particles.push({ x: tx*TILE+8, y: ty*TILE+8, vx: dx*0.7, vy: dy*1.6, life: 40, type:'shard' });
  }
  score += 50;
  Sound.brick();
}

function spawnBlockItem(c, tx, ty){
  const px = tx*TILE, py = ty*TILE;
  if (c === 'coin'){ coins++; score += 200; addCoinPop(px, py); Sound.coin(); }
  else items.push(makeItem(c, tx, ty));
}

function killEnemiesOnTop(tx, ty){
  const topY = ty*TILE;
  for (const e of enemies){
    if (e.dead || e.state === 'flat' || e.state === 'flipped') continue;
    if (Math.abs((e.y + e.h) - topY) < 7 && e.x + e.w > tx*TILE && e.x < tx*TILE + TILE){
      flipEnemy(e);
    }
  }
}

function flipEnemy(e){
  e.state = 'flipped'; e.vx = 0; e.vy = -6;
  score += 200;
  scorePops.push({ x: e.x + e.w/2, y: e.y, text: '200', life: 40 });
  Sound.stomp();
}

/* ------------------------------ player --------------------------------- */
function doJump(){
  player.vy = JUMP_V;
  player.grounded = false;
  coyote = 0;
  player.canCut = true;
  Sound.jump();
}

function updatePlayer(){
  if (player.dead) return;

  const left = isDown('ArrowLeft','KeyA');
  const right = isDown('ArrowRight','KeyD');
  const run = isDown('ShiftLeft','ShiftRight');
  const jumpHeld = isDown('Space','ArrowUp','KeyW');
  const max = run ? RUN : WALK;

  if (right && !left){ player.vx = Math.min(player.vx + ACCEL, max); player.facing = 1; }
  else if (left && !right){ player.vx = Math.max(player.vx - ACCEL, -max); player.facing = -1; }
  else {
    if (player.vx > 0) player.vx = Math.max(0, player.vx - FRICTION);
    else player.vx = Math.min(0, player.vx + FRICTION);
  }

  if (player.grounded) coyote = 6; else if (coyote > 0) coyote--;
  if (jumpBuffered > 0){
    if (player.grounded || coyote > 0){ doJump(); jumpBuffered = 0; }
    else jumpBuffered--;
  }
  if (player.canCut && !jumpHeld && player.vy < -3) player.vy = -3;   // variable jump height

  if (player.size === 'fire' && isDown('KeyX','KeyK','KeyF') && fireCooldown <= 0){
    shootFire(); fireCooldown = 12;
  }
  if (fireCooldown > 0) fireCooldown--;

  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  moveAndCollide(player, true);

  if (player.invuln > 0) player.invuln--;
  if (player.star > 0) player.star--;

  if (player.y > LEVEL_H*TILE + 30) die();
  if (player.x < 0) player.x = 0;

  // reach the flag pole
  if (player.x + player.w >= FLAG_X*TILE - 2) triggerClear();
}

function growToBig(){
  if (player.size === 'small'){
    player.size = 'big';
    player.y -= 16; player.h = 32;
  }
}

function shootFire(){
  if (fireballs.length >= 2) return;
  fireballs.push({
    x: player.x + (player.facing > 0 ? player.w : -8),
    y: player.y + (player.size === 'small' ? 4 : 12),
    vx: player.facing * 4.5, vy: 0, w: 8, h: 8, life: 90, dead: false,
  });
  Sound.fire();
}

function hurtPlayer(){
  if (player.invuln > 0 || player.star > 0) return;
  if (player.size === 'small'){ die(); }
  else {
    player.size = 'small';
    player.y += 16; player.h = 16;
    player.invuln = 120;
    Sound.hurt();
  }
}

function die(){
  if (state !== 'playing') return;
  state = 'dying';
  player.dead = true;
  player.vy = -8; player.vx = 0;
  Music.stop();
  Sound.die();
}

/* ------------------------------ enemies -------------------------------- */
function updateEnemies(){
  for (const e of enemies){
    if (e.dead) continue;
    if (e.cool > 0) e.cool--;
    if (e.state === 'flat'){ if (--e.life <= 0) e.dead = true; continue; }
    if (e.state === 'flipped'){
      e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
      e.y += e.vy;
      if (e.y > LEVEL_H*TILE + 40) e.dead = true;
      continue;
    }
    e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
    const pvx = e.vx;
    moveAndCollide(e, false);
    if (e.hitWall) e.vx = -pvx;
    if (e.type === 'shell' && !e.moving) e.vx = 0;
    if (e.vx !== 0) e.facing = e.vx > 0 ? 1 : -1;
    if (e.y > LEVEL_H*TILE + 40) e.dead = true;
  }
  updateEnemyEnemy();
  enemies = enemies.filter(e => !e.dead);
}

function updateEnemyEnemy(){
  for (let i = 0; i < enemies.length; i++){
    for (let j = i+1; j < enemies.length; j++){
      const a = enemies[i], b = enemies[j];
      if (a.dead || b.dead) continue;
      if (a.state === 'flat' || b.state === 'flat' || a.state === 'flipped' || b.state === 'flipped') continue;
      if (!overlap(a, b)) continue;
      if (a.type === 'shell' && a.moving && (b.type === 'goomba' || b.type === 'koopa')){ flipEnemy(b); continue; }
      if (b.type === 'shell' && b.moving && (a.type === 'goomba' || a.type === 'koopa')){ flipEnemy(a); continue; }
      if (a.type !== 'shell' && b.type !== 'shell'){ a.vx = -a.vx; b.vx = -b.vx; }
    }
  }
}

function stompEnemy(e){
  if (e.type === 'goomba'){
    e.state = 'flat'; e.life = 30; e.h = 8; e.y += 8;
    score += 100;
    scorePops.push({ x: e.x + e.w/2, y: e.y, text: '100', life: 40 });
  } else if (e.type === 'koopa'){
    e.type = 'shell'; e.state = 'shell'; e.moving = false; e.vx = 0;
    e.w = 16; e.h = 16; e.y += 8; e.cool = 20;
    score += 100;
    scorePops.push({ x: e.x + e.w/2, y: e.y, text: '100', life: 40 });
  } else if (e.type === 'shell' && e.moving){
    e.moving = false; e.vx = 0; e.cool = 20;
  }
  player.vy = STOMP_V; player.grounded = false; player.canCut = false;
  Sound.stomp();
}

function kickShell(e){
  const dir = (player.x + player.w/2 < e.x + e.w/2) ? 1 : -1;
  e.moving = true; e.vx = dir * 4;
  Sound.kick();
}

/* ------------------------------- items --------------------------------- */
function updateItems(){
  for (const it of items){
    if (it.dead) continue;
    if (it.rising){
      it.y += it.vy;
      if (it.y + it.h <= it.sourceTop - 0.5){
        it.rising = false; it.y = it.sourceTop - it.h; it.vy = 0;
      }
      continue;
    }
    it.vy = Math.min(it.vy + GRAVITY, MAX_FALL);
    if (it.type === 'mushroom' || it.type === '1up'){
      if (it.vx === 0) it.vx = 0.9;
      const pvx = it.vx;
      moveAndCollide(it, false);
      if (it.hitWall) it.vx = -pvx;
    } else if (it.type === 'star'){
      if (it.vx === 0) it.vx = 1.1;
      const pvx = it.vx;
      moveAndCollide(it, false);
      if (it.hitWall) it.vx = -pvx;
      if (it.grounded){ it.vy = -7; }
    } else {
      moveAndCollide(it, false);
    }
    if (--it.life <= 0) it.dead = true;
    if (it.y > LEVEL_H*TILE + 40) it.dead = true;
  }
  items = items.filter(i => !i.dead);
}

function collectItem(it){
  it.dead = true;
  switch (it.type){
    case 'mushroom':
      if (player.size === 'small'){ growToBig(); Sound.grow(); }
      else { score += 1000; scorePops.push({ x: it.x, y: it.y, text: '1000', life: 40 }); Sound.power(); }
      break;
    case 'flower':
      if (player.size === 'small'){ growToBig(); Sound.grow(); }
      else Sound.power();
      player.size = 'fire';
      break;
    case '1up':
      lives++;
      Sound.oneup();
      scorePops.push({ x: it.x, y: it.y, text: '1UP', life: 50 });
      break;
    case 'star':
      player.star = 600;
      Sound.power();
      break;
  }
}

/* ------------------------------ fireballs ------------------------------ */
function explodeFire(f){
  f.dead = true;
  for (let i = 0; i < 5; i++){
    particles.push({ x: f.x+4, y: f.y+4, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 15, type:'spark' });
  }
}

function updateFireballs(){
  for (const f of fireballs){
    f.vy = Math.min(f.vy + GRAVITY, MAX_FALL);
    f.x += f.vx;
    for (let ty = Math.floor(f.y/TILE); ty <= Math.floor((f.y+f.h-0.01)/TILE); ty++){
      const tx = f.vx > 0 ? Math.floor((f.x+f.w)/TILE) : Math.floor(f.x/TILE);
      if (isSolid(tx, ty)){ explodeFire(f); break; }
    }
    if (f.dead) continue;
    f.y += f.vy;
    if (f.vy > 0){
      for (let tx = Math.floor(f.x/TILE); tx <= Math.floor((f.x+f.w-0.01)/TILE); tx++){
        const ty = Math.floor((f.y+f.h)/TILE);
        if (isSolid(tx, ty)){ f.y = ty*TILE - f.h - 0.01; f.vy = -4.2; break; }
      }
    } else if (f.vy < 0){
      for (let tx = Math.floor(f.x/TILE); tx <= Math.floor((f.x+f.w-0.01)/TILE); tx++){
        const ty = Math.floor(f.y/TILE);
        if (isSolid(tx, ty)){ explodeFire(f); break; }
      }
    }
    if (--f.life <= 0) f.dead = true;
  }
  fireballs = fireballs.filter(f => !f.dead && f.y < LEVEL_H*TILE + 40);
}

/* ---------------------------- misc updaters ---------------------------- */
function addCoinPop(x, y){
  coinPops.push({ x, y, vy: -5, life: 36 });
}
function updateCoinPops(){
  for (const c of coinPops){ c.vy = Math.min(c.vy + GRAVITY, MAX_FALL); c.y += c.vy; c.life--; }
  coinPops = coinPops.filter(c => c.life > 0);
}
function updateParticles(){
  for (const p of particles){
    p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--;
  }
  particles = particles.filter(p => p.life > 0);
}
function updateScorePops(){
  for (const s of scorePops){ s.y -= 0.5; s.life--; }
  scorePops = scorePops.filter(s => s.life > 0);
}
function updateBumps(){
  for (const k in bumpAnim){
    if (--bumpAnim[k] <= 0) delete bumpAnim[k];
  }
}

/* ------------------------------ collisions ------------------------------ */
function playerVsEnemies(){
  for (const e of enemies){
    if (e.dead || e.state === 'flat' || e.state === 'flipped') continue;
    if (!overlap(player, e)) continue;
    if (player.star > 0){ flipEnemy(e); continue; }
    if (e.type === 'shell' && !e.moving){ if (e.cool > 0) continue; kickShell(e); continue; }
    const fallStomp = player.vy > 0 && (player.y + player.h - e.y) < e.h * 0.6;
    if (fallStomp) stompEnemy(e);
    else hurtPlayer();
  }
}

function checkCollisions(){
  playerVsEnemies();
  for (const it of items){
    if (it.dead || it.rising) continue;
    if (overlap(player, it)) collectItem(it);
  }
  for (const c of floatCoins){
    if (c.dead) continue;
    const r = { x: c.x, y: c.y, w: 16, h: 16 };
    if (overlap(player, r)){ c.dead = true; coins++; score += 200; Sound.coin(); }
  }
  floatCoins = floatCoins.filter(c => !c.dead);
  // fireballs vs enemies
  for (const f of fireballs){
    if (f.dead) continue;
    for (const e of enemies){
      if (e.dead || e.state === 'flat' || e.state === 'flipped') continue;
      if (overlap(f, e)){ flipEnemy(e); explodeFire(f); break; }
    }
  }
}

/* ------------------------------ camera --------------------------------- */
function updateCamera(){
  const target = player.x + player.w/2 - VIEW_W/2;
  camera.x = Math.max(0, Math.min(target, LEVEL_W*TILE - VIEW_W));
}

/* --------------------------- clear sequence ---------------------------- */
function triggerClear(){
  if (state !== 'playing') return;
  state = 'clear';
  clearPhase = 0;
  player.x = FLAG_X*TILE - player.w - 2;
  player.vx = 0; player.vy = 0;
  Music.stop();
  Sound.flag();
}

function updateClear(){
  if (clearPhase === 0){
    player.y += 1.6;
    if (player.y + player.h >= 13*TILE){ player.y = 13*TILE - player.h; clearPhase = 1; player.facing = 1; }
  } else if (clearPhase === 1){
    player.x += 1.4;
    if (player.x > CASTLE_X*TILE + 8){
      clearPhase = 2;
      score += Math.floor(time) * 10;
      time = 0;
    }
  }
}

/* ------------------------------ rendering ------------------------------ */
function hash(n){ n = (n|0) * 374761393 + 668265263; return ((n ^ (n>>13)) * 1274126177) >>> 0; }

function drawBackground(){
  // clouds
  drawDecor(0.35, 180, (i, sx) => {
    const y = 26 + (hash(i) % 3) * 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(sx, y, 18, 8, 0, 0, Math.PI*2);
    ctx.ellipse(sx+14, y+3, 14, 7, 0, 0, Math.PI*2);
    ctx.ellipse(sx-14, y+3, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();
  });
  // hills
  drawDecor(0.6, 240, (i, sx) => {
    ctx.fillStyle = '#2a9a3a';
    ctx.beginPath();
    ctx.moveTo(sx-40, 208);
    ctx.quadraticCurveTo(sx, 130, sx+40, 208);
    ctx.fill();
  });
  // bushes
  drawDecor(0.8, 200, (i, sx) => {
    ctx.fillStyle = '#3ec95a';
    ctx.beginPath();
    ctx.ellipse(sx, 208, 14, 8, 0, 0, Math.PI*2);
    ctx.ellipse(sx+16, 210, 12, 7, 0, 0, Math.PI*2);
    ctx.ellipse(sx-16, 210, 12, 7, 0, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawDecor(f, spacing, fn){
  const start = Math.floor((camera.x * f) / spacing) - 1;
  const end = Math.floor((camera.x * f + VIEW_W) / spacing) + 1;
  for (let i = start; i <= end; i++){
    const sx = i * spacing - camera.x * f + (hash(i) % 30);
    fn(i, sx);
  }
}

function drawTiles(){
  const startCol = Math.floor(camera.x / TILE);
  const endCol = Math.min(LEVEL_W - 1, Math.ceil((camera.x + VIEW_W) / TILE));
  for (let ty = 0; ty < LEVEL_H; ty++){
    for (let tx = startCol; tx <= endCol; tx++){
      const t = grid[ty][tx];
      if (t === T.EMPTY) continue;
      const key = tx + ',' + ty;
      const b = bumpAnim[key];
      let off = 0;
      if (b) off = Math.sin(((BUMP_FRAMES - b) / BUMP_FRAMES) * Math.PI) * 5;
      drawTileSprite(t, tx*TILE - camera.x, ty*TILE - off, tx, ty);
    }
  }
}

function drawTileSprite(t, px, py, tx, ty){
  switch (t){
    case T.GROUND: drawGround(px, py); break;
    case T.BRICK: drawBrick(px, py); break;
    case T.QUESTION: drawQuestion(px, py); break;
    case T.USED: drawUsed(px, py); break;
    case T.PIPE: drawPipeTile(px, py, tx, ty); break;
    case T.SOLID: drawSolid(px, py); break;
  }
}

function drawGround(px, py){
  ctx.fillStyle = '#c0692f'; ctx.fillRect(px, py, 16, 16);
  ctx.fillStyle = '#e8985a'; ctx.fillRect(px, py, 16, 3);
  ctx.fillStyle = '#8a4518'; ctx.fillRect(px, py+12, 16, 4);
  ctx.fillStyle = '#8a4518'; ctx.fillRect(px, py+3, 2, 9); ctx.fillRect(px+14, py+3, 2, 9);
  ctx.fillStyle = '#a05a24'; ctx.fillRect(px+5, py+5, 2, 2); ctx.fillRect(px+10, py+9, 2, 2);
}
function drawBrick(px, py){
  ctx.fillStyle = '#c05a28'; ctx.fillRect(px, py, 16, 16);
  ctx.fillStyle = '#e08346'; ctx.fillRect(px, py, 16, 2);
  ctx.fillStyle = '#7a3413';
  ctx.fillRect(px, py+7, 16, 2);
  ctx.fillRect(px+4, py, 2, 7);
  ctx.fillRect(px+11, py+9, 2, 7);
}
function drawQuestion(px, py){
  const pulse = Math.floor(frame / 18) % 2;
  ctx.fillStyle = pulse ? '#ffd23a' : '#e8a800';
  ctx.fillRect(px, py, 16, 16);
  ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1;
  ctx.strokeRect(px+0.5, py+0.5, 15, 15);
  ctx.fillStyle = '#7a4a00';
  ctx.fillRect(px+2, py+2, 2, 2); ctx.fillRect(px+12, py+2, 2, 2);
  ctx.fillRect(px+2, py+12, 2, 2); ctx.fillRect(px+12, py+12, 2, 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('?', px+3.5, py+2.5);
}
function drawUsed(px, py){
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(px, py, 16, 16);
  ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1;
  ctx.strokeRect(px+0.5, py+0.5, 15, 15);
  ctx.fillStyle = '#4a3410';
  ctx.fillRect(px+2, py+2, 2, 2); ctx.fillRect(px+12, py+2, 2, 2);
  ctx.fillRect(px+2, py+12, 2, 2); ctx.fillRect(px+12, py+12, 2, 2);
}
function drawSolid(px, py){
  ctx.fillStyle = '#b8b0a0'; ctx.fillRect(px, py, 16, 16);
  ctx.strokeStyle = '#7a7468'; ctx.lineWidth = 1;
  ctx.strokeRect(px+0.5, py+0.5, 15, 15);
  ctx.fillStyle = '#d8d0c0'; ctx.fillRect(px, py, 16, 2);
  ctx.fillStyle = '#7a7468'; ctx.fillRect(px, py+14, 16, 2);
  ctx.fillStyle = '#8a8478'; ctx.fillRect(px+3, py+6, 10, 2);
}
function drawPipeTile(px, py, tx, ty){
  const isRim = ty > 0 && grid[ty-1][tx] !== T.PIPE;
  ctx.fillStyle = '#3ea83e'; ctx.fillRect(px, py, 16, 16);
  ctx.fillStyle = '#1f6a1f'; ctx.fillRect(px, py, 3, 16);
  ctx.fillStyle = '#7ed87e'; ctx.fillRect(px+13, py, 3, 16);
  if (isRim){
    ctx.fillStyle = '#3ea83e'; ctx.fillRect(px-2, py, 20, 3);
    ctx.fillStyle = '#1f6a1f'; ctx.fillRect(px-2, py+3, 3, 13);
    ctx.fillStyle = '#7ed87e'; ctx.fillRect(px+15, py+3, 3, 13);
    ctx.fillStyle = '#1f6a1f'; ctx.fillRect(px-2, py, 20, 2);
  } else {
    ctx.fillStyle = '#1f6a1f'; ctx.fillRect(px, py, 16, 2);
  }
}

/* ------------------------------ sprites -------------------------------- */
function drawPlayer(){
  const p = player;
  if (p.invuln > 0 && p.star <= 0 && Math.floor(p.invuln/3) % 2 === 0 && state !== 'dying') return;
  const f = (Math.abs(p.vx) > 0.2 && p.grounded) ? (Math.floor(Math.abs(p.x)/5) % 2) : 0;
  drawMarioSprite(p.x - camera.x, p.y, p.size, p.facing, f);
  if (p.star > 0){
    const cols = ['#ff0000','#ff8800','#ffff00','#00ff00','#00ccff','#aa00ff'];
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = cols[Math.floor(frame/3) % cols.length];
    ctx.fillRect(p.x - camera.x - 2, p.y, 16, p.h);
    ctx.globalAlpha = 1;
  }
}

function drawMarioSprite(px, py, size, facing, f){
  const sx = px - (16 - player.w)/2;
  ctx.save();
  ctx.translate(sx + (facing < 0 ? 16 : 0), py);
  if (facing < 0) ctx.scale(-1, 1);
  if (size === 'small') drawSmallMario(f);
  else drawBigMario(f, size === 'fire');
  ctx.restore();
}

function drawSmallMario(f){
  const R='#e52521', S='#f8c898', B='#5a3a1e', U='#2b5fd9', u='#1e3f9e', Y='#f8d33a', K='#1a1a1a';
  ctx.fillStyle = R; ctx.fillRect(4,0,8,3); ctx.fillRect(2,3,12,2);
  ctx.fillStyle = B; ctx.fillRect(3,3,3,3);
  ctx.fillStyle = S; ctx.fillRect(3,5,10,4);
  ctx.fillStyle = K; ctx.fillRect(9,5,2,2);
  ctx.fillStyle = B; ctx.fillRect(6,8,6,2);
  ctx.fillStyle = R; ctx.fillRect(4,9,8,3);
  ctx.fillStyle = S; ctx.fillRect(2,9,2,2); ctx.fillRect(12,9,2,2);
  ctx.fillStyle = S; ctx.fillRect(2,11,2,1); ctx.fillRect(12,11,2,1);
  ctx.fillStyle = U; ctx.fillRect(5,12,6,2);
  ctx.fillStyle = u; ctx.fillRect(5,13,6,1);
  ctx.fillStyle = U; ctx.fillRect(6,11,2,1); ctx.fillRect(9,11,2,1);
  ctx.fillStyle = Y; ctx.fillRect(7,11,1,1); ctx.fillRect(9,11,1,1);
  ctx.fillStyle = B;
  if (f === 0){ ctx.fillRect(3,14,4,2); ctx.fillRect(9,14,4,2); }
  else { ctx.fillRect(2,14,4,2); ctx.fillRect(10,14,4,2); }
}

function drawBigMario(f, fire){
  const R = fire ? '#ffffff' : '#e52521';
  const U = fire ? '#e52521' : '#2b5fd9';
  const u = fire ? '#b81a16' : '#1e3f9e';
  const S='#f8c898', B='#5a3a1e', Y='#f8d33a', K='#1a1a1a';
  ctx.fillStyle = R; ctx.fillRect(4,0,8,4); ctx.fillRect(2,4,12,3);
  ctx.fillStyle = B; ctx.fillRect(3,4,3,3);
  ctx.fillStyle = S; ctx.fillRect(3,7,10,5);
  ctx.fillStyle = K; ctx.fillRect(9,7,2,2);
  ctx.fillStyle = B; ctx.fillRect(6,11,6,2);
  ctx.fillStyle = R; ctx.fillRect(4,13,8,5);
  ctx.fillStyle = S; ctx.fillRect(2,13,2,3); ctx.fillRect(12,13,2,3);
  ctx.fillStyle = S; ctx.fillRect(2,16,2,1); ctx.fillRect(12,16,2,1);
  ctx.fillStyle = U; ctx.fillRect(5,18,6,5);
  ctx.fillStyle = u; ctx.fillRect(5,22,6,1);
  ctx.fillStyle = U; ctx.fillRect(6,16,2,2); ctx.fillRect(9,16,2,2);
  ctx.fillStyle = Y; ctx.fillRect(7,16,1,1); ctx.fillRect(9,16,1,1);
  ctx.fillStyle = U; ctx.fillRect(5,23,3,5); ctx.fillRect(9,23,3,5);
  ctx.fillStyle = B;
  if (f === 0){ ctx.fillRect(3,28,5,4); ctx.fillRect(9,28,5,4); }
  else { ctx.fillRect(4,28,5,4); ctx.fillRect(8,28,5,4); }
}

function drawEnemies(){
  for (const e of enemies){
    const sx = e.x - camera.x;
    if (sx < -32 || sx > VIEW_W + 32) continue;
    const f = (Math.abs(e.vx) > 0.2) ? (Math.floor(Math.abs(e.x)/6) % 2) : 0;
    if (e.type === 'goomba') drawGoomba(sx, e.y, e, f);
    else if (e.type === 'koopa') drawKoopa(sx, e.y, e, f);
    else drawShell(sx, e.y, e);
  }
}

function drawGoomba(px, py, e, f){
  ctx.save();
  ctx.translate(px, py);
  if (e.state === 'flipped'){ ctx.translate(8, e.h/2); ctx.scale(1,-1); ctx.translate(-8, -e.h/2); }
  if (e.state === 'flat'){
    ctx.fillStyle = '#8a4a1e'; ctx.fillRect(0, 9, 16, 6);
    ctx.fillStyle = '#2a1a0a'; ctx.fillRect(0, 12, 16, 3);
    ctx.fillStyle = '#f8d8a0'; ctx.fillRect(3, 9, 3, 2); ctx.fillRect(10, 9, 3, 2);
  } else {
    ctx.fillStyle = '#8a4a1e'; ctx.fillRect(2, 8, 12, 5);
    ctx.fillStyle = '#a85624';
    ctx.beginPath(); ctx.ellipse(8, 8, 7, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f8d8a0'; ctx.fillRect(3, 8, 10, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(4, 8, 3, 2); ctx.fillRect(9, 8, 3, 2);
    ctx.fillStyle = '#000'; ctx.fillRect(5, 8, 1, 2); ctx.fillRect(10, 8, 1, 2);
    ctx.fillStyle = '#2a1a0a'; ctx.fillRect(4, 7, 3, 1); ctx.fillRect(9, 7, 3, 1);
    ctx.fillStyle = '#2a1a0a';
    if (f === 0){ ctx.fillRect(2, 13, 5, 3); ctx.fillRect(9, 13, 5, 3); }
    else { ctx.fillRect(1, 13, 5, 3); ctx.fillRect(10, 13, 5, 3); }
  }
  ctx.restore();
}

function drawKoopa(px, py, e, f){
  ctx.save();
  ctx.translate(px + (e.facing < 0 ? 16 : 0), py);
  if (e.facing < 0) ctx.scale(-1, 1);
  if (e.state === 'flipped'){ ctx.translate(8, e.h/2); ctx.scale(1,-1); ctx.translate(-8, -e.h/2); }
  ctx.fillStyle = '#e8b020';
  if (f === 0){ ctx.fillRect(2, 20, 4, 4); ctx.fillRect(10, 20, 4, 4); }
  else { ctx.fillRect(1, 20, 4, 4); ctx.fillRect(11, 20, 4, 4); }
  ctx.fillStyle = '#1f8a1f';
  ctx.beginPath(); ctx.ellipse(8, 12, 7, 9, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#7ed87e';
  ctx.beginPath(); ctx.ellipse(8, 12, 5, 6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1f8a1f'; ctx.fillRect(4, 12, 7, 2);
  ctx.fillStyle = '#8ad860';
  ctx.fillRect(11, 3, 4, 7);
  ctx.fillStyle = '#f8f0e0'; ctx.fillRect(11, 4, 4, 4);
  ctx.fillStyle = '#000'; ctx.fillRect(13, 5, 1, 2);
  ctx.restore();
}

function drawShell(px, py, e){
  ctx.save();
  ctx.translate(px, py);
  if (e.state === 'flipped'){ ctx.translate(8, 8); ctx.scale(1,-1); ctx.translate(-8, -8); }
  ctx.fillStyle = '#1f8a1f';
  ctx.beginPath(); ctx.ellipse(8, 9, 7, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#7ed87e';
  ctx.beginPath(); ctx.ellipse(8, 9, 5, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#0f5a0f'; ctx.fillRect(3, 9, 10, 2);
  ctx.fillStyle = '#f8f0e0'; ctx.fillRect(5, 6, 6, 5);
  ctx.fillStyle = '#000'; ctx.fillRect(7, 8, 1, 1); ctx.fillRect(9, 8, 1, 1);
  ctx.restore();
}

function drawItems(){
  for (const it of items){
    const sx = it.x - camera.x;
    if (sx < -20 || sx > VIEW_W + 20) continue;
    drawItem(it, sx, it.y);
  }
}

function drawItem(it, px, py){
  ctx.save(); ctx.translate(px, py);
  if (it.type === 'mushroom' || it.type === '1up'){
    const cap = it.type === '1up' ? '#1f8a1f' : '#e52521';
    ctx.fillStyle = '#f8e0c0'; ctx.fillRect(4, 9, 8, 7);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(6, 11, 2, 2); ctx.fillRect(9, 11, 2, 2);
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.ellipse(8, 7, 8, 6, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(5, 3, 3, 3); ctx.fillRect(10, 5, 3, 3); ctx.fillRect(6, 5, 2, 2);
  } else if (it.type === 'flower'){
    ctx.fillStyle = '#f8a020';
    for (let i = 0; i < 4; i++){
      const a = i * Math.PI/2 + Math.PI/4;
      ctx.beginPath();
      ctx.ellipse(8 + Math.cos(a)*3.5, 6 + Math.sin(a)*3.5, 3.5, 3.5, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, 6, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1f8a1f'; ctx.fillRect(7, 9, 2, 7);
    ctx.fillStyle = '#1f8a1f'; ctx.fillRect(4, 11, 3, 2); ctx.fillRect(9, 11, 3, 2);
  } else if (it.type === 'star'){
    drawStar(8, 8, 7, 3.5, '#f8d33a');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(6, 7, 2, 2); ctx.fillRect(9, 7, 2, 2);
  }
  ctx.restore();
}

function drawStar(cx, cy, outer, inner, fill){
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 10; i++){
    const r = (i % 2 === 0) ? outer : inner;
    const a = -Math.PI/2 + i * Math.PI/5;
    const x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}

function drawCoinAt(px, py){
  const w = Math.abs(Math.cos(frame * 0.12)) * 7;
  ctx.fillStyle = '#f8b800';
  if (w < 0.8){
    ctx.fillStyle = '#e8a800';
    ctx.fillRect(px+6, py+1, 4, 14);
  } else {
    ctx.beginPath(); ctx.ellipse(px+8, py+8, w, 7.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d89000';
    ctx.beginPath(); ctx.ellipse(px+8, py+8, w*0.6, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f8d33a'; ctx.fillRect(px+6, py+4, 2, 8);
  }
}

function drawCoins(){
  for (const c of floatCoins){
    if (c.dead) continue;
    drawCoinAt(c.x - camera.x, c.y);
  }
  for (const c of coinPops) drawCoinAt(c.x - camera.x, c.y);
}

function drawFireballs(){
  ctx.fillStyle = '#ff7b1a';
  for (const f of fireballs){
    ctx.beginPath(); ctx.arc(f.x - camera.x + 4, f.y + 4, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(f.x - camera.x + 4, f.y + 4, 2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff7b1a';
  }
}

function drawParticles(){
  for (const p of particles){
    if (p.type === 'shard'){ ctx.fillStyle = '#c05a28'; ctx.fillRect(p.x - camera.x, p.y, 4, 4); }
    else { ctx.fillStyle = '#ffd23a'; ctx.fillRect(p.x - camera.x, p.y, 2, 2); }
  }
}

function drawFlagAndCastle(){
  const px = FLAG_X*TILE - camera.x;
  // pole
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(px, 16, 3, 188);
  ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.arc(px+1.5, 16, 5, 0, Math.PI*2); ctx.fill();
  // flag banner
  ctx.fillStyle = '#e52521';
  ctx.beginPath(); ctx.moveTo(px+3, 20); ctx.lineTo(px+20, 26); ctx.lineTo(px+3, 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px+9, 26, 3, 0, Math.PI*2); ctx.fill();
  // base
  ctx.fillStyle = '#3ea83e'; ctx.fillRect(px-4, 204, 11, 8);

  // castle
  const cx = CASTLE_X*TILE - camera.x;
  if (cx < VIEW_W && cx > -80){
    const baseY = 13*TILE;
    ctx.fillStyle = '#b8b0a0'; ctx.fillRect(cx, baseY-48, 64, 48);
    ctx.fillStyle = '#7a7468'; ctx.fillRect(cx+6, baseY-30, 14, 30);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx+9, baseY-26, 8, 26);
    ctx.fillStyle = '#e52521'; ctx.fillRect(cx+40, baseY-40, 8, 8);
    ctx.fillStyle = '#b8b0a0';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx + i*16, baseY-56, 12, 12);
  }
}

/* ------------------------------- HUD ----------------------------------- */
function drawHUD(){
  ctx.textBaseline = 'top';
  ctx.font = '8px "Courier New", monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('SCORE', 10, 6);
  ctx.fillText(String(score).padStart(6, '0'), 10, 15);
  ctx.fillText('COINS', 92, 6);
  ctx.fillText('x' + String(coins).padStart(2, '0'), 92, 15);
  ctx.fillText('WORLD', 152, 6);
  ctx.fillText(world + '-1', 152, 15);
  ctx.fillText('TIME', 208, 6);
  ctx.fillText(String(Math.max(0, Math.ceil(time))), 208, 15);
  ctx.fillText('LIVES', 208, 22);
  ctx.fillText(String(Math.max(0, lives)), 208, 31);
}

/* ----------------------------- overlays -------------------------------- */
function drawOverlay(title, lines, sub){
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(title, VIEW_W/2, 80);
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.fillStyle = '#ffd23a';
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W/2, 110 + i*15));
  ctx.fillStyle = '#fff';
  ctx.font = '10px "Courier New", monospace';
  if (sub) ctx.fillText(sub, VIEW_W/2, 200);
  ctx.textAlign = 'left';
}

function drawTitle(){
  drawOverlay('SUPER MARIO', ['网页版 · Web Edition'], '按 Enter 开始');
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = '8px "Courier New", monospace'; ctx.fillStyle = '#d8d8e8';
  ctx.fillText('吃蘑菇变大 · 踩怪物 · 变大顶碎砖块 · 收集金币', VIEW_W/2, 160);
  ctx.fillText('火球 X/F · 暂停 P · 静音 M', VIEW_W/2, 174);
  ctx.textAlign = 'left';
}
function drawPaused(){ drawOverlay('PAUSED', [], '按 P 继续'); }
function drawGameOver(){ drawOverlay('GAME OVER', ['得分 ' + score], '按 Enter 重新开始'); }
function drawClearOverlay(){
  if (clearPhase >= 2){
    drawOverlay('COURSE CLEAR!', ['得分 ' + score], '按 Enter 进入 WORLD ' + (world+1) + '-1');
  }
}

/* ------------------------------- loop ---------------------------------- */
function update(){
  if (state === 'playing'){
    if (frame % 60 === 0 && time > 0){ time--; if (time <= 0) die(); }
    updatePlayer();
    updateCamera();
    updateEnemies();
    updateItems();
    updateFireballs();
    updateCoinPops();
    updateParticles();
    updateScorePops();
    updateBumps();
    checkCollisions();
  } else if (state === 'dying'){
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    player.y += player.vy;
    if (player.y > LEVEL_H*TILE + 60){
      lives--;
      if (lives < 0){ state = 'gameover'; }
      else { resetLevel(); state = 'playing'; Music.start(); }
    }
  } else if (state === 'clear'){
    updateClear();
  }
}

function draw(){
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawBackground();
  drawTiles();
  drawCoins();
  drawItems();
  drawEnemies();
  drawFireballs();
  drawFlagAndCastle();
  drawPlayer();
  drawParticles();
  drawHUD();
  // floating score text
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = 'bold 8px "Courier New", monospace'; ctx.fillStyle = '#fff';
  for (const s of scorePops) ctx.fillText(s.text, s.x - camera.x + 8, s.y);
  ctx.textAlign = 'left';

  if (state === 'title') drawTitle();
  else if (state === 'paused') drawPaused();
  else if (state === 'gameover') drawGameOver();
  else if (state === 'clear') drawClearOverlay();
}

let last = 0, acc = 0;
const STEP = 1000 / 60;
function loop(ts){
  requestAnimationFrame(loop);
  if (!last) last = ts;
  let dt = ts - last; last = ts;
  if (dt > 100) dt = 100;
  acc += dt;
  while (acc >= STEP){
    update();
    frame++;
    acc -= STEP;
  }
  draw();
}

/* ------------------------------ bootstrap ------------------------------ */
resetLevel();
requestAnimationFrame(loop);
