/* =====================================================================
   SUPER MARIO — Web Edition
   A single-file HTML5 Canvas platformer (no external assets).
   Features: run/jump, small <-> big Mario, mushroom + fire flower,
   fireballs, goombas, koopas + shells, brick/question/ground/pipe blocks,
   brick-breaking when Big Mario head-bumps, coins, flagpole goal, pits,
   lives, timer, camera scroll, retro sound.
   ===================================================================== */
(function () {
  "use strict";

  // ============================== CONFIG ==============================
  const TILE = 32;
  const VIEW_W = 512;
  const VIEW_H = 480;

  // Physics (60 fps fixed step)
  const GRAVITY   = 0.62;
  const MAX_FALL  = 15;
  const WALK_ACCEL= 0.36;
  const RUN_ACCEL = 0.52;
  const WALK_MAX  = 2.4;
  const RUN_MAX   = 4.1;
  const FRICTION  = 0.80;
  const JUMP_VEL  = -11.6;
  const JUMP_CANCEL= 0.45;             // cut upward vel when jump released early
  const STOMP_BOUNCE= -8.6;
  const COYOTE     = 6;                // frames of grace after leaving ground
  const JUMP_BUFFER= 6;               // frames of pre-press buffering

  // Palette
  const C = {
    sky:"#5c94fc", red:"#e52521", blue:"#2b46e5", skin:"#fcb98b",
    brown:"#7c4318", brownDark:"#5a2f10", shoe:"#6b3a0d",
    white:"#ffffff", black:"#101010",
    dirt:"#c2611b", dirtDark:"#7a3a0f", grass:"#3aa028", grassDark:"#1f6f16",
    brick:"#d4641c", brickDark:"#9c3f0a",
    qOrange:"#e3a118", qOrangeDark:"#b87b0e",
    used:"#a26010", usedDark:"#6b3a07",
    stone:"#9a9a9a", stoneDark:"#6b6b6b",
    pipeGreen:"#2aa92a", pipeGreenLight:"#5fd35f", pipeGreenDark:"#0c7a1c",
    fireOrange:"#ff8c1a", fireYellow:"#ffd800",
    coinGold:"#ffd800", coinEdge:"#c89000",
    flagPole:"#cfcfcf", flagGreen:"#21a030",
  };

  // ================================ DOM ===============================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const elOverlay      = document.getElementById("overlay");
  const elOverlayTitle = document.getElementById("overlay-title");
  const elOverlaySub   = document.getElementById("overlay-sub");
  const elOverlayMsg   = document.getElementById("overlay-msg");
  const elStartBtn     = document.getElementById("start-btn");
  const elScore = document.getElementById("score");
  const elCoins = document.getElementById("coins");
  const elWorld = document.getElementById("world");
  const elTime  = document.getElementById("time");
  const elLives = document.getElementById("lives");

  // ============================== INPUT ==============================
  const Input = { left:false, right:false, up:false, jump:false, run:false };
  function jumpDown(){ return Input.up || Input.jump; }

  const KEYMAP = {
    ArrowLeft:"left", KeyA:"left",
    ArrowRight:"right", KeyD:"right",
    ArrowUp:"up", KeyW:"up", Space:"jump",
    ShiftLeft:"run", ShiftRight:"run", KeyX:"run",
  };

  window.addEventListener("keydown", function (e) {
    const a = KEYMAP[e.code];
    if (!a) {
      if (e.code === "KeyP") { togglePause(); e.preventDefault(); return; }
      if (e.code === "KeyR") { requestRestart(); e.preventDefault(); return; }
      return;
    }
    if (e.repeat) { e.preventDefault(); return; }
    Input[a] = true;
    Sound.resume();
    e.preventDefault();
  }, { passive:false });
  window.addEventListener("keyup", function (e) {
    const a = KEYMAP[e.code];
    if (!a) return;
    Input[a] = false;
    e.preventDefault();
  }, { passive:false });

  // Touch buttons
  function bindTouch(sel, key) {
    const btn = document.querySelector(sel); if (!btn) return;
    const press = (e)=>{ e.preventDefault(); Input[key]=true; Sound.resume(); btn.classList.add("pressed"); };
    const release=(e)=>{ e.preventDefault(); Input[key]=false; btn.classList.remove("pressed"); };
    btn.addEventListener("touchstart", press, { passive:false });
    btn.addEventListener("touchend",   release,{ passive:false });
    btn.addEventListener("touchcancel",release,{ passive:false });
    btn.addEventListener("mousedown",   press);
    window.addEventListener("mouseup",  release);
    btn.addEventListener("mouseleave", release);
  }
  bindTouch("[data-key='left']","left");
  bindTouch("[data-key='right']","right");
  bindTouch("[data-key='jump']","up");
  bindTouch("[data-key='run']","run");

  // ============================== SOUND ==============================
  const Sound = (function () {
    let actx = null;
    function ensure() {
      if (actx) return actx;
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ actx=null; }
      return actx;
    }
    function tone(freq, dur, type, vol, slideTo) {
      const a = ensure(); if (!a) return;
      if (a.state === "suspended") a.resume();
      const t = a.currentTime;
      const o = a.createOscillator(); const g = a.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      resume:()=>ensure(),
      jump:   ()=>tone(520,0.18,"square",0.10,880),
      stomp:  ()=>tone(170,0.10,"square",0.16,90),
      coin:   ()=>{ tone(988,0.06,"square",0.12); setTimeout(()=>tone(1319,0.12,"square",0.12),60); },
      bump:   ()=>tone(220,0.06,"square",0.10,120),
      sbreak: ()=>{ tone(140,0.05,"square",0.16); tone(90,0.10,"square",0.14); },
      power:  ()=>{ [392,523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,0.10,"square",0.12),i*70)); },
      die:    ()=>{ tone(392,0.18,"square",0.16); setTimeout(()=>tone(196,0.5,"square",0.16),160); },
      kick:   ()=>tone(300,0.08,"square",0.12,140),
      fire:   ()=>tone(660,0.06,"square",0.10,300),
      flag:   ()=>{ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.14,"square",0.12),i*110)); },
      pipe:   ()=>tone(220,0.30,"square",0.12,60),
    };
  })();

  // ============================== UTIL ===============================
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function rand(a,b){ return a + Math.random()*(b-a); }
  function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function pad(n,len){ n=""+n; while(n.length<len) n="0"+n; return n; }

  // ============================== LEVEL ==============================
  // Tile codes:
  //  ' ' empty   'X' ground   'B' brick   '?' question(coin)
  //  'M' question(mushroom/flower)   'F' question(flower)
  //  'U' used block   'S' stone(hard)   'p' pipe   'o' free coin
  const LevelData = (function () {
    const COLS = 212, ROWS = 15;
    const g = [];
    for (let r=0;r<ROWS;r++){ const row=[]; for(let c=0;c<COLS;c++) row.push(" "); g.push(row); }
    function set(c,r,t){ if(r>=0&&r<ROWS&&c>=0&&c<COLS) g[r][c]=t; }

    // Ground (rows 13 & 14) with a couple of pits
    const pits = [[69,71],[86,88]];
    for (let c=0;c<COLS;c++){
      let isPit=false; for(const p of pits){ if(c>=p[0]&&c<=p[1]) isPit=true; }
      if(!isPit){ set(c,13,"X"); set(c,14,"X"); }
    }
    // Pipes
    function pipe(col,height){
      const top=13-height;
      set(col,top,"p"); set(col+1,top,"p");
      for(let r=top+1;r<=12;r++){ set(col,r,"p"); set(col+1,r,"p"); }
    }
    pipe(28,2); pipe(38,3); pipe(46,3); pipe(163,2);
    // Block helper
    const b=(c,r,t)=>set(c,r,t);
    b(16,9,"?");
    b(20,9,"B"); b(21,9,"?"); b(22,9,"B"); b(23,9,"M"); b(24,9,"B");
    b(21,5,"?");
    b(40,9,"B"); b(41,9,"B"); b(42,9,"?"); b(44,9,"?");
    for(let c=51;c<=56;c++) b(c,5,"B");
    b(52,5,"?"); b(55,5,"F");
    for(let c=52;c<=55;c++) set(c,7,"o");     // floating coins
    b(77,9,"B"); b(78,9,"?"); b(79,9,"B"); b(80,9,"B"); b(81,9,"M"); b(82,9,"B");
    // Stairs
    function stairUp(start,h){ for(let i=0;i<h;i++) for(let s=0;s<=i;s++) set(start+i,12-s,"S"); }
    function stairDown(start,h){ for(let i=0;i<h;i++) for(let s=0;s<=(h-1-i);s++) set(start+i,12-s,"S"); }
    stairUp(134,4); stairDown(180,4);

    return {
      grid:g, cols:COLS, rows:ROWS,
      flagCol:195, spawn:{ x:2*TILE, y:13*TILE },
      enemies:[
        {c:22,t:"goomba"},{c:40,t:"goomba"},{c:50,t:"koopa"},{c:51,t:"goomba"},
        {c:80,t:"goomba"},{c:81,t:"goomba"},{c:97,t:"goomba"},{c:98,t:"koopa"},
        {c:122,t:"goomba"},{c:123,t:"goomba"},{c:150,t:"goomba"},{c:151,t:"goomba"},{c:152,t:"goomba"},
        {c:172,t:"goomba"},{c:185,t:"koopa"},
      ],
    };
  })();

  function tileAt(c,r){
    if(r<0||r>=LevelData.rows) return " ";
    if(c<0||c>=LevelData.cols) return "S";
    return LevelData.grid[r][c];
  }
  function setTile(c,r,t){ if(r>=0&&r<LevelData.rows&&c>=0&&c<LevelData.cols) LevelData.grid[r][c]=t; }
  function isSolidCode(code){ return code==="X"||code==="B"||code==="?"||code==="U"||code==="S"||code==="p"||code==="M"||code==="F"; }
  function isBumpableCode(code){ return code==="B"||code==="?"||code==="U"||code==="M"||code==="F"||code==="S"; }

  // Tile bump animation table: "c,r" -> timer
  const bumpTable = Object.create(null);
  function addBump(c,r){ bumpTable[c+","+r] = 6; }
  function updateBumps(){
    for (const k in bumpTable){ bumpTable[k]--; if (bumpTable[k]<=0) delete bumpTable[k]; }
  }

  // Pristine copy of the tile grid so death/respawn restores broken bricks &
  // re-fills used question blocks (matches the original behaviour).
  const pristineGrid = LevelData.grid.map(function(row){ return row.slice(); });
  function resetLevelGrid(){
    LevelData.grid = pristineGrid.map(function(row){ return row.slice(); });
    for (const k in bumpTable) delete bumpTable[k];
  }

  // ============================== STATE ==============================
  let state = "menu";            // menu|play|paused|dead|gameover|win
  let cameraX = 0;
  let score = 0, coinCount = 0, timeLeft = 400, lives = 3;
  let timeAcc = 0;
  let player, enemies, items, particles, fireballs;
  let flag = null;
  let levelClearFlag = false, winTimer = 0;
  let shake = 0;
  let frameCounter = 0;
  let lastTime = 0, acc = 0;
  const STEP = 1000/60;
  let lastRun = false;

  // ============================== ENTITY ==============================
  function makePlayer(){
    return {
      type:"mario", x:LevelData.spawn.x, y:LevelData.spawn.y,
      w:24, h:28, vx:0, vy:0, facing:1,
      big:false, fire:false,
      onGround:false, coyote:0, jumpBuffer:0, jumpHeld:false,
      inv:0, growShrink:0, fireCooldown:0,
      dead:false, deathTimer:0, anim:0, animTimer:0,
    };
  }
  function sizeFor(p){ p.w=24; p.h = p.big?56:28; }

  function spawnEnemy(spec){
    const gx = spec.c*TILE;
    if (spec.t==="goomba")
      enemies.push({ type:"goomba", x:gx, y:12*TILE, w:30, h:30, vx:-0.6, vy:0,
        onGround:false, alive:true, dead:false, deadTimer:0, anim:0, animTimer:0,
        hitWall:null, active:false, remove:false });
    else if (spec.t==="koopa")
      enemies.push({ type:"koopa", x:gx, y:11*TILE, w:30, h:44, vx:-0.55, vy:0,
        onGround:false, alive:true, shell:false, shellMoving:false, dead:false, deadTimer:0,
        anim:0, animTimer:0, hitWall:null, active:false, remove:false });
  }

  function spawnMushroom(cx, cy, kind){
    items.push({ type:kind, x:cx, y:cy, w:28, h:28,
      vx:(kind==="flower"?0:0.9), vy:-1.2,
      emerging:TILE, emerged:false, onGround:false, remove:false, anim:0, animTimer:0 });
  }
  function spawnCoinPop(cx, cy){
    items.push({ type:"coinpop", x:cx, y:cy, w:16, h:16, vy:-7, t:0, life:30, remove:false });
    coinCount++; score+=200; Sound.coin(); updateHud();
    if (coinCount>=100){ coinCount-=100; lives++; Sound.power(); spawnScorePop(cx,cy-14,"1UP",C.fireYellow); }
    updateHud();
  }
  function spawnBrickFragments(cx, cy){
    for(let i=0;i<4;i++){
      const dir = (i%2===0)? -1:1;
      const up  = (i<2)? -7: -5;
      particles.push({ type:"frag", x:cx+(i%2===0?4:20), y:cy+8, w:8, h:8,
        vx:dir*rand(1.5,3), vy:up, life:40, color:C.brick, remove:false });
    }
    Sound.sbreak(); shake = Math.max(shake, 4);
  }
  function spawnScorePop(cx, cy, text, color){
    particles.push({ type:"score", x:cx, y:cy, w:0, h:0, vy:-0.7, life:40,
      text:text, color:color||C.white, remove:false });
  }
  function spawnSpark(x,y){ particles.push({ type:"spark", x,y,w:6,h:6, vx:0,vy:0, life:8, color:C.white, remove:false }); }

  // ============================ HIT BLOCKS ============================
  function hitBlock(c, r, mario){
    const code = tileAt(c,r);
    if (!isBumpableCode(code)) return;       // ground/pipe just stop the head
    if (code === "B"){
      if (mario.big){                                        // Big -> smash brick
        setTile(c,r," ");
        spawnBrickFragments(c*TILE, r*TILE);
        score += 50;
        spawnScorePop(c*TILE, r*TILE-8, "+50", C.white);
        updateHud();
      } else {                                               // Small -> bump
        addBump(c,r); Sound.bump();
      }
    } else if (code === "?"){                               // question -> coin
      setTile(c,r,"U"); addBump(c,r);
      Sound.bump(); spawnCoinPop(c*TILE+8, r*TILE);
    } else if (code === "M"){                               // question -> mushroom/flower
      setTile(c,r,"U"); addBump(c,r);
      const cx = c*TILE + (TILE-28)/2;
      if (mario.big) spawnMushroom(cx, r*TILE, "flower");
      else          spawnMushroom(cx, r*TILE, "mushroom");
    } else if (code === "F"){                               // question -> fire flower
      setTile(c,r,"U"); addBump(c,r);
      spawnMushroom(c*TILE + (TILE-28)/2, r*TILE, "flower");
    } else {                                                // "U" or "S"
      addBump(c,r); Sound.bump();
    }
  }

  // ============================ COLLISIONS ============================
  function collideX(e){
    e.x += e.vx;
    const top = Math.floor(e.y/TILE);
    const bot = Math.floor((e.y+e.h-1)/TILE);
    if (e.vx > 0){
      const col = Math.floor((e.x+e.w-1)/TILE);
      for(let r=top;r<=bot;r++) if (isSolidCode(tileAt(col,r))){ e.x = col*TILE - e.w; if(e.hitWall) e.hitWall(); else e.vx=0; break; }
    } else if (e.vx < 0){
      const col = Math.floor(e.x/TILE);
      for(let r=top;r<=bot;r++) if (isSolidCode(tileAt(col,r))){ e.x = (col+1)*TILE; if(e.hitWall) e.hitWall(); else e.vx=0; break; }
    }
  }
  function collideY(e, headHit){
    e.y += e.vy;
    const left  = Math.floor(e.x/TILE);
    const right = Math.floor((e.x+e.w-1)/TILE);
    if (e.vy > 0){
      const row = Math.floor((e.y+e.h-1)/TILE);
      for(let c=left;c<=right;c++) if (isSolidCode(tileAt(c,row))){ e.y = row*TILE - e.h; e.vy=0; e.onGround=true; break; }
    } else if (e.vy < 0){
      const row = Math.floor(e.y/TILE);
      const bumps=[];
      for(let c=left;c<=right;c++) if (isSolidCode(tileAt(c,row))) bumps.push(c);
      if (bumps.length){
        e.y = (row+1)*TILE; e.vy = 0;
        if (headHit) for(const c of bumps) headHit(c, row);
      }
    }
  }
  function moveEntity(e, headHit){
    e.onGround = false;
    collideX(e);
    collideY(e, headHit);
    if (!e.onGround && e.vy >= 0){
      const left  = Math.floor(e.x/TILE);
      const right = Math.floor((e.x+e.w-1)/TILE);
      const row   = Math.floor((e.y+e.h)/TILE);
      for(let c=left;c<=right;c++) if (isSolidCode(tileAt(c,row))){ e.onGround=true; break; }
    }
  }

  // ============================== PLAYER ==============================
  function runEdge(){                                        // true once per run press
    const e = (Input.run && !lastRun); lastRun = Input.run; return e;
  }

  function applyInput(p){
    const running = Input.run;
    const accel = running? RUN_ACCEL : WALK_ACCEL;
    const maxSpd= running? RUN_MAX : WALK_MAX;

    if (Input.left && !Input.right){ p.vx -= accel; p.facing = -1; }
    else if (Input.right && !Input.left){ p.vx += accel; p.facing = 1; }
    else { p.vx *= FRICTION; if (Math.abs(p.vx)<0.05) p.vx=0; }
    p.vx = clamp(p.vx, -maxSpd, maxSpd);

    // jump buffering (press slightly before landing still triggers)
    if (jumpDown() && !p.jumpHeld) p.jumpBuffer = JUMP_BUFFER;
    p.jumpHeld = jumpDown();
    if (p.jumpBuffer>0) p.jumpBuffer--;
    if (p.coyote>0) p.coyote--;

    if (p.jumpBuffer>0 && (p.onGround || p.coyote>0)){
      p.vy = JUMP_VEL - (running?0.5:0);
      p.onGround=false; p.coyote=0; p.jumpBuffer=0;
      Sound.jump();
    }
    if (!jumpDown() && p.vy<0) p.vy *= JUMP_CANCEL;     // variable jump height

    // fireballs
    if (p.fire){
      if (p.fireCooldown>0) p.fireCooldown--;
      if (runEdge() && p.fireCooldown<=0){
        const dir = p.facing || 1;
        fireballs.push({ x:p.x+(dir>0?p.w:0)-6, y:p.y+p.h-20, w:12, h:12,
          vx:dir*5, vy:1, life:120, bounces:6, remove:false });
        p.fireCooldown = 12; Sound.fire();
      }
    } else {
      runEdge();   // keep latch fresh so it doesn't fire on fire-up
    }
  }

  function updatePlayer(p){
    if (p.dead){
      p.deathTimer++;
      if (p.deathTimer===1){ p.vy = -JUMP_VEL*0.8; Sound.die(); }
      p.vy += GRAVITY;
      p.y += p.vy;
      if (p.deathTimer>90) respawn();
      return;
    }
    if (p.inv>0) p.inv--;
    if (p.fireCooldown>0) p.fireCooldown--;

    applyInput(p);
    p.vy += GRAVITY;
    if (p.vy>MAX_FALL) p.vy=MAX_FALL;

    const wasGround = p.onGround;
    moveEntity(p, function(c,r){ hitBlock(c,r,p); });
    if (wasGround && !p.onGround) p.coyote = COYOTE;

    // walk anim
    p.animTimer++;
    if (Math.abs(p.vx)>0.1 && p.onGround){
      const spd=Math.abs(p.vx);
      if (p.animTimer > Math.max(2, 8 - spd*1.4)){ p.anim=(p.anim+1)%3; p.animTimer=0; }
    } else if (!p.onGround){ p.anim=1; }
    else { p.anim=0; }

    if (p.y > LevelData.rows*TILE + 40) killPlayer();
    if (flag && !levelClearFlag && p.x + p.w > flag.x) levelClear();
  }

  function killPlayer(){
    if (player.dead) return;
    player.dead=true; player.deathTimer=0; player.vx=0; player.vy=-8;
  }
  function damagePlayer(){
    const p=player; if (p.inv>0||p.dead||levelClearFlag) return;
    if (p.fire){ p.fire=false; p.inv=120; p.growShrink=12; Sound.pipe(); }
    else if (p.big){ p.big=false; p.inv=120; p.growShrink=12; p.y += (p.h-28); sizeFor(p); Sound.pipe(); }
    else killPlayer();
  }
  function growPlayer(){
    const p=player; if (!p.big){ p.big=true; p.growShrink=16; p.y -= (56-p.h); sizeFor(p); Sound.power(); }
  }
  function firePlayer(){
    const p=player;
    if (!p.big){ p.big=true; p.fire=true; p.growShrink=16; p.y-=(56-p.h); sizeFor(p); Sound.power(); }
    else if (!p.fire){ p.fire=true; p.growShrink=16; Sound.power(); }
  }
  function respawn(){
    lives--; updateHud();
    if (lives<=0){ state="gameover"; showOverlay("GAME OVER","Press START / R to retry",""); return; }
    initLevel(true); state="play";
  }
  function levelClear(){ levelClearFlag=true; winTimer=0; player.inv=9999; Sound.flag(); }

  // ============================== ENEMIES ==============================
  function updateEnemies(){
    const camRight = cameraX + VIEW_W + 96;
    for(const e of enemies){
      if(!e.active){ if(e.x < camRight) e.active=true; else continue; }
      // despawn once it has scrolled fully off the left edge (classic behaviour)
      if (e.x + e.w < cameraX - 64){ e.remove=true; continue; }
      if (e.dead){ e.deadTimer++; if(e.deadTimer>30) e.remove=true; continue; }

      e.vy += GRAVITY; if (e.vy>MAX_FALL) e.vy=MAX_FALL;
      e.animTimer++;
      const spd = Math.abs(e.vx)||0.6;
      if (e.animTimer > Math.max(3, 10-spd*2)){ e.anim=(e.anim+1)%2; e.animTimer=0; }

      if (e.type==="koopa" && e.shell && !e.shellMoving) e.vx = 0;

      e.hitWall = function(){ e.vx = -e.vx; e.facing = (e.vx>0)?1:-1; };
      moveEntity(e);

      if (e.y > LevelData.rows*TILE+60) e.remove=true;

      // moving shell clears other enemies
      if (e.type==="koopa" && e.shell && e.shellMoving){
        for(const o of enemies){
          if (o===e || o.dead || !o.active) continue;
          if (aabb(e,o)){
            o.dead=true; o.deadTimer=0; o.vx=0;
            spawnScorePop(o.x,o.y,"+100",C.white); score+=100; updateHud(); Sound.stomp();
          }
        }
      }
    }
    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].remove) enemies.splice(i,1);
  }

  function playerEnemyCollisions(){
    const p=player; if (p.dead || p.inv>0) return;
    for(const e of enemies){
      if (e.dead || !e.active) continue;
      if (!aabb(p,e)) continue;
      const stomp = p.vy > 0.5 && (p.y + p.h - e.y) < 18;
      if (e.type==="goomba"){
        if (stomp){
          e.dead=true; e.deadTimer=0; e.vx=0;
          p.vy = STOMP_BOUNCE; p.onGround=false;
          score+=100; spawnScorePop(e.x,e.y,"+100",C.white); Sound.stomp(); updateHud();
        } else damagePlayer();
      } else if (e.type==="koopa"){
        if (e.shell && e.shellMoving){
          if (stomp){ e.shellMoving=false; e.vx=0; p.vy=STOMP_BOUNCE; p.onGround=false; Sound.stomp(); }
          else damagePlayer();
        } else if (e.shell && !e.shellMoving){
          if (stomp){
            // stomp a still shell: just bounce, it stays put
            p.vy = STOMP_BOUNCE*0.7; p.onGround=false; Sound.stomp();
          } else {
            // kick the shell away from mario
            const dir = (p.x+p.w/2) < (e.x+e.w/2) ? 1 : -1;
            e.shellMoving=true; e.vx=dir*4.2; e.facing=dir; Sound.kick();
            p.x += dir*4;
          }
        } else {
          if (stomp){
            e.shell=true; e.shellMoving=false; e.vx=0;
            e.y += (e.h-26); e.w=30; e.h=26;
            p.vy=STOMP_BOUNCE; p.onGround=false; Sound.stomp();
            score+=100; spawnScorePop(e.x,e.y,"+100",C.white); updateHud();
          } else damagePlayer();
        }
      }
    }
  }

  // ============================ FIREBALLS ============================
  function updateFireballs(){
    for(const f of fireballs){
      f.life--;
      f.vy += GRAVITY*0.9; if (f.vy>8) f.vy=8;
      f.x += f.vx; f.y += f.vy;
      const left=Math.floor(f.x/TILE), right=Math.floor((f.x+f.w-1)/TILE);
      const row=Math.floor((f.y+f.h-1)/TILE);
      for(let c=left;c<=right;c++) if (isSolidCode(tileAt(c,row))){ f.y=row*TILE-f.h; f.vy=-6; f.bounces--; if(f.bounces<0) f.life=0; break; }
      const r1=Math.floor(f.y/TILE), r2=Math.floor((f.y+f.h-1)/TILE);
      const col = f.vx>0?Math.floor((f.x+f.w-1)/TILE):Math.floor(f.x/TILE);
      for(let r=r1;r<=r2;r++) if (isSolidCode(tileAt(col,r))){ f.life=0; spawnSpark(f.x,f.y); break; }
      if (f.y>LevelData.rows*TILE+40) f.life=0;
      if (f.life<=0) f.remove=true;
    }
    for(let i=fireballs.length-1;i>=0;i--) if(fireballs[i].remove) fireballs.splice(i,1);
  }
  function fireballEnemyCollisions(){
    for(const f of fireballs){
      if (f.remove) continue;
      for(const e of enemies){
        if (e.dead || !e.active) continue;
        if (aabb(f,e)){
          if (e.type==="goomba"){ e.dead=true; e.deadTimer=0; spawnScorePop(e.x,e.y,"+100",C.white); score+=100; updateHud(); Sound.stomp(); }
          else if (e.type==="koopa"){
            if (e.shell && !e.shellMoving){ e.shellMoving=true; e.vx=(f.vx>0?1:-1)*4.2; Sound.kick(); }
            else if (!e.shell){ e.shell=true; e.shellMoving=false; e.y+=(e.h-26); e.h=26; e.vx=0; Sound.stomp(); }
          }
          f.life=0; f.remove=true; spawnSpark(f.x,f.y); break;
        }
      }
    }
  }

  // ============================== ITEMS ==============================
  function updateItems(){
    for(const it of items){
      if (it.type==="coinpop"){ it.t++; it.y+=it.vy; it.vy+=0.5; if (it.t>it.life) it.remove=true; continue; }
      if (it.emerging>0){
        it.y -= 1.4; it.emerging = Math.max(0, it.emerging-1.4);
        if (it.emerging===0){ it.y=Math.round(it.y); it.emerged=true; }
        continue;
      }
      it.vy += GRAVITY; if (it.vy>MAX_FALL) it.vy=MAX_FALL;
      it.onGround=false;
      it.x += it.vx;
      const top=Math.floor(it.y/TILE), bot=Math.floor((it.y+it.h-1)/TILE);
      if (it.vx>0){ const col=Math.floor((it.x+it.w-1)/TILE); for(let r=top;r<=bot;r++) if(isSolidCode(tileAt(col,r))){ it.x=col*TILE-it.w; it.vx=-it.vx; break; } }
      else if (it.vx<0){ const col=Math.floor(it.x/TILE); for(let r=top;r<=bot;r++) if(isSolidCode(tileAt(col,r))){ it.x=(col+1)*TILE; it.vx=-it.vx; break; } }
      it.y += it.vy;
      const left=Math.floor(it.x/TILE), right=Math.floor((it.x+it.w-1)/TILE);
      if (it.vy>0){ const row=Math.floor((it.y+it.h-1)/TILE); for(let c=left;c<=right;c++) if(isSolidCode(tileAt(c,row))){ it.y=row*TILE-it.h; it.vy=0; it.onGround=true; break; } }
      if (it.y>LevelData.rows*TILE+40) it.remove=true;
      it.animTimer++; if(it.animTimer>6){ it.anim=(it.anim+1); it.animTimer=0; }
    }
    const p=player;
    if (!p.dead){
      for(const it of items){
        if (it.remove) continue;
        if (it.emerging>0) continue;
        if (!aabb(p,it)) continue;
        if (it.type==="mushroom"){ growPlayer(); it.remove=true; spawnScorePop(it.x,it.y,"+1000",C.white); score+=1000; updateHud(); }
        else if (it.type==="flower"){ firePlayer(); it.remove=true; spawnScorePop(it.x,it.y,"+1000",C.white); score+=1000; updateHud(); }
      }
    }
    for(let i=items.length-1;i>=0;i--) if(items[i].remove) items.splice(i,1);
  }

  function updateCoinTiles(){
    const p=player;
    const c0=Math.floor(p.x/TILE), c1=Math.floor((p.x+p.w-1)/TILE);
    const r0=Math.floor(p.y/TILE), r1=Math.floor((p.y+p.h-1)/TILE);
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      if (tileAt(c,r)==="o"){ setTile(c,r," "); spawnCoinPop(c*TILE+8, r*TILE); }
    }
  }

  // ============================== FLAG ==============================
  function updateFlag(){
    if (!flag) return;
    if (!levelClearFlag) return;
    winTimer++;
    const groundY = 13*TILE - player.h;
    if (winTimer < 60){
      if (player.y < groundY) player.y = Math.min(groundY, player.y+5);
      flag.flagY = Math.min(13*TILE-16, flag.flagY+4);
    } else if (winTimer < 80){
      player.vx=0; player.facing=1;
    } else if (winTimer < 220){
      player.vx=2.2; player.x += player.vx;
      player.animTimer++; if (player.animTimer>4){ player.anim=(player.anim+1)%3; player.animTimer=0; }
    } else {
      player.vx=0;
      if (winTimer>240 && !flag.celebrated){
        flag.celebrated=true;
        state="win";
        const bonus = Math.max(0, timeLeft)*50;
        score += bonus;
        showOverlay("LEVEL CLEAR!","You reached the goal!","Time bonus +"+bonus+"<br><span style='color:#ffd800'>Press START for victory lap.</span>");
        updateHud();
      }
    }
  }

  // ============================ PARTICLES ============================
  function updateParticles(){
    for(const p of particles){
      p.life--;
      if (p.type==="frag"){ p.vy+=GRAVITY; p.x+=p.vx; p.y+=p.vy; }
      else if (p.type==="score"){ p.y+=p.vy; }
      if (p.life<=0) p.remove=true;
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].remove) particles.splice(i,1);
  }

  // ============================== CAMERA ==============================
  function updateCamera(){
    let target = player.x + player.w/2 - VIEW_W*0.42;
    target = clamp(target, 0, LevelData.cols*TILE - VIEW_W);
    cameraX += (target - cameraX)*0.18;
    cameraX = clamp(cameraX, 0, LevelData.cols*TILE - VIEW_W);
  }

  // ============================== STEP ==============================
  function step(){
    if (state!=="play" && state!=="dead") return;

    timeAcc += STEP;
    if (timeAcc>=400){
      timeAcc-=400;
      if (state==="play" && !levelClearFlag && !player.dead && timeLeft>0){
        timeLeft--; if (timeLeft<=0){ timeLeft=0; killPlayer(); } updateHud();
      }
    }

    if (state==="dead"){ updatePlayer(player); if(shake>0) shake*=0.85; return; }

    // state === "play"
    if (levelClearFlag){
      updateFlag();
      updateParticles();
      updateCamera();
      if (shake>0) shake*=0.85;
      updateBumps();
      return;
    }

    updatePlayer(player);
    if (player.dead){ state="dead"; return; }
    updateEnemies();
    playerEnemyCollisions();
    updateFireballs(); fireballEnemyCollisions();
    updateItems();
    updateCoinTiles();
    updateParticles();
    updateCamera();
    updateBumps();
    if (shake>0) shake*=0.85;
    if (player.dead) state="dead";
  }

  // ============================ RENDER ============================
  function rrect(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(x|0,y|0,w|0,h|0); }
  function frame(mod){ return Math.floor(frameCounter%mod); }

  function drawBackground(){
    ctx.fillStyle = C.sky; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    const para = cameraX*0.4;
    const clouds = [[40,60],[160,40],[280,80],[420,40],[560,72],[700,50],[840,80],[980,48]];
    for(const cl of clouds){
      const x = ((cl[0]-para)%1000+1000)%1000 - 60;
      if (x>-80 && x<VIEW_W+40) drawCloud(x, cl[1]);
    }
    const hills = [0,200,420,640,860,1080,1300];
    for(const hi of hills){
      const x = ((hi-para*0.6)%1300+1300)%1300 - 100;
      if (x>-160 && x<VIEW_W+80) drawHill(x);
    }
  }
  function drawCloud(x,y){
    rrect(x+10,y,40,20,C.white); rrect(x,y+6,16,16,C.white); rrect(x+48,y+6,16,16,C.white); rrect(x+18,y-6,16,12,C.white);
  }
  function drawHill(x){
    ctx.fillStyle = C.grassDark;
    ctx.beginPath();
    ctx.moveTo(x, 13*TILE);
    ctx.quadraticCurveTo(x+80, 13*TILE-90, x+160, 13*TILE);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.grass; rrect(x+70, 13*TILE-30, 20, 6, C.grass);
  }

  function drawTiles(){
    const cStart = Math.floor(cameraX/TILE)-1;
    const cEnd   = Math.floor((cameraX+VIEW_W)/TILE)+1;
    for(let c=cStart;c<=cEnd;c++) for(let r=0;r<LevelData.rows;r++){
      const code = tileAt(c,r);
      if (code===" "||code==="o") continue;
      let oy=0; const bt = bumpTable[c+","+r];
      if (bt) oy = -Math.sin((1-bt/6)*Math.PI)*8;
      const sx=(c*TILE-cameraX)|0, sy=((r*TILE+oy)|0);
      drawTile(code, sx, sy, c, r);
    }
    for(let c=cStart;c<=cEnd;c++) for(let r=0;r<LevelData.rows;r++){
      if (tileAt(c,r)==="o") drawCoin((c*TILE-cameraX)|0, (r*TILE)|0, frame(16));
    }
  }

  function drawTile(code, sx, sy, c, r){
    if (code==="X") drawGround(sx,sy,c,r);
    else if (code==="B") drawBrick(sx,sy);
    else if (code==="?"||code==="M"||code==="F") drawQuestion(sx,sy,c,r);
    else if (code==="U") drawUsed(sx,sy);
    else if (code==="S") drawStone(sx,sy);
    else if (code==="p") drawPipe(sx,sy,c,r);
  }
  function drawGround(sx,sy,c,r){
    const grassTop = !isSolidCode(tileAt(c,r-1));
    ctx.fillStyle = C.dirt; ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle = C.dirtDark;
    for(let i=0;i<4;i++){ rrect(sx+4+i*8, sy+10,3,3,C.dirtDark); rrect(sx+6+((i*8)%TILE), sy+22,3,3,C.dirtDark); }
    if (grassTop){ rrect(sx,sy,TILE,8,C.grass); rrect(sx,sy+8,TILE,3,C.grassDark); }
  }
  function drawBrick(sx,sy){
    ctx.fillStyle = C.brick; ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle = C.brickDark;
    rrect(sx,sy,TILE,2,C.brickDark);
    rrect(sx,sy+15,TILE,2,C.brickDark);
    rrect(sx+15,sy,2,16,C.brickDark);
    rrect(sx+7,sy+17,2,15,C.brickDark);
    rrect(sx+23,sy+17,2,15,C.brickDark);
  }
  function drawQuestion(sx,sy,c,r){
    const golden = (frame(40)<30);                                  // slow blink
    ctx.fillStyle = golden? C.qOrange : C.qOrangeDark; ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle = C.qOrangeDark;
    rrect(sx,sy,TILE,3,C.qOrangeDark); rrect(sx,sy+TILE-3,TILE,3,C.qOrangeDark);
    rrect(sx,sy,3,TILE,C.qOrangeDark); rrect(sx+TILE-3,sy,3,TILE,C.qOrangeDark);
    rrect(sx+4,sy+4,4,4,C.usedDark); rrect(sx+TILE-8,sy+4,4,4,C.usedDark);
    rrect(sx+4,sy+TILE-8,4,4,C.usedDark); rrect(sx+TILE-8,sy+TILE-8,4,4,C.usedDark);
    ctx.fillStyle = C.white;
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("?", (sx+TILE/2)|0, (sy+TILE/2+1)|0);
  }
  function drawUsed(sx,sy){
    ctx.fillStyle = C.used; ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle = C.usedDark;
    rrect(sx,sy,TILE,3,C.usedDark); rrect(sx,sy+TILE-3,TILE,3,C.usedDark);
    rrect(sx,sy,3,TILE,C.usedDark); rrect(sx+TILE-3,sy,3,TILE,C.usedDark);
    rrect(sx+4,sy+4,4,4,C.usedDark); rrect(sx+TILE-8,sy+4,4,4,C.usedDark);
    rrect(sx+4,sy+TILE-8,4,4,C.usedDark); rrect(sx+TILE-8,sy+TILE-8,4,4,C.usedDark);
  }
  function drawStone(sx,sy){
    ctx.fillStyle = C.stone; ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle = C.stoneDark;
    rrect(sx,sy,TILE,3,C.stoneDark); rrect(sx,sy+TILE-3,TILE,3,C.stoneDark);
    rrect(sx,sy,3,TILE,C.stoneDark); rrect(sx+TILE-3,sy,3,TILE,C.stoneDark);
  }
  function drawPipe(sx,sy,c,r){
    const cap = !isSolidCode(tileAt(c,r-1));
    ctx.fillStyle = C.pipeGreen; ctx.fillRect(sx,sy,TILE,TILE);
    rrect(sx+3,sy,6,TILE,C.pipeGreenLight);
    rrect(sx+TILE-7,sy,4,TILE,C.pipeGreenDark);
    if (cap){
      rrect(sx-3,sy,TILE+6,10,C.pipeGreen);
      rrect(sx-3,sy,3,10,C.pipeGreenDark);
      rrect(sx+TILE,sy,3,10,C.pipeGreenDark);
      rrect(sx-3,sy+10,TILE+6,2,C.pipeGreenDark);
    }
  }

  function drawFlag(){
    if (!flag) return;
    const baseX = (flag.x-cameraX)|0;
    rrect(baseX,0,6,13*TILE,C.flagPole);
    rrect(baseX-2,0,10,8,C.flagPole);
    ctx.fillStyle = C.flagGreen;
    ctx.beginPath();
    ctx.moveTo(baseX+6, flag.flagY);
    ctx.lineTo(baseX-22, flag.flagY+8);
    ctx.lineTo(baseX+6, flag.flagY+16);
    ctx.closePath(); ctx.fill();
    rrect(baseX-10, 13*TILE-8, 26, 8, C.stone);
    // castle
    const cx = baseX+40;
    rrect(cx, 13*TILE-44, 96, 44, C.brick);
    rrect(cx+18, 13*TILE-60, 60, 16, C.brick);
    rrect(cx+38, 13*TILE-76, 20, 16, C.brick);
    rrect(cx+45, 13*TILE-76, 6, 8, C.flagPole);
    ctx.fillStyle = C.black;
    ctx.fillRect(cx+20, 13*TILE-30, 24, 30);   // door
    ctx.fillRect(cx+60, 13*TILE-36, 14, 14);  // window
  }

  // ---- composed characters ----
  function drawMario(p){
    if (p.inv>0 && !p.dead && (Math.floor(frameCounter/3)%2===0) ) return; // flicker
    const sx=(p.x-cameraX)|0, sy=p.y|0;
    ctx.save();
    if (p.facing===-1){ ctx.translate(sx+p.w, sy); ctx.scale(-1,1); }
    else ctx.translate(sx, sy);
    const W=p.w, H=p.h;
    const t=W;
    let hat=C.red, shirt=C.red, overall=C.blue;
    if (p.fire){ hat="#ffffff"; shirt="#ffffff"; overall=C.red; }

    const headH = H*0.38;
    // hat
    rrect(t*0.18,0, t*0.66, headH*0.42, hat);
    rrect(t*0.04, headH*0.22, t*0.92, headH*0.24, hat);
    // hair
    rrect(t*0.08, headH*0.46, t*0.16, headH*0.30, C.brownDark);
    rrect(t*0.76, headH*0.46, t*0.16, headH*0.30, C.brownDark);
    // face
    rrect(t*0.24, headH*0.44, t*0.52, headH*0.56, C.skin);
    // eye
    rrect(t*0.54, headH*0.52, t*0.09, headH*0.22, C.black);
    // mustache
    rrect(t*0.28, headH*0.78, t*0.48, headH*0.16, C.brownDark);

    const bodyY=headH, bodyH=H-headH;
    // shirt (sides)
    rrect(t*0.10, bodyY, t*0.80, bodyH*0.42, shirt);
    // overalls
    rrect(t*0.18, bodyY+bodyH*0.16, t*0.64, bodyH*0.58, overall);
    rrect(t*0.22, bodyY, t*0.10, bodyH*0.5, overall);
    rrect(t*0.68, bodyY, t*0.10, bodyH*0.5, overall);
    rrect(t*0.24, bodyY+bodyH*0.24, t*0.07, t*0.08, C.white);
    rrect(t*0.69, bodyY+bodyH*0.24, t*0.07, t*0.08, C.white);
    // arms + gloves
    rrect(t*0.02, bodyY+bodyH*0.06, t*0.13, bodyH*0.42, C.skin);
    rrect(t*0.85, bodyY+bodyH*0.06, t*0.13, bodyH*0.42, C.skin);
    rrect(t*0.00, bodyY+bodyH*0.40, t*0.16, t*0.18, C.white);
    rrect(t*0.84, bodyY+bodyH*0.40, t*0.16, t*0.18, C.white);
    // legs
    const legY=bodyY+bodyH*0.74, legH=H-legY;
    if (p.onGround && Math.abs(p.vx)>0.1){
      if (p.anim===0||p.anim===2){
        rrect(t*0.18, legY, t*0.30, legH, C.shoe);
        rrect(t*0.52, legY+t*0.10, t*0.30, legH*0.85, C.shoe);
      } else {
        rrect(t*0.30, legY, t*0.30, legH, C.shoe);
        rrect(t*0.40, legY, t*0.30, legH, C.shoe);
      }
    } else if (!p.onGround){
      rrect(t*0.08, legY-t*0.06, t*0.30, legH*0.9, C.shoe);
      rrect(t*0.60, legY-t*0.06, t*0.30, legH*0.9, C.shoe);
    } else {
      rrect(t*0.22, legY, t*0.26, legH, C.shoe);
      rrect(t*0.52, legY, t*0.26, legH, C.shoe);
    }
    ctx.restore();
  }

  function drawGoomba(e){
    const sx=(e.x-cameraX)|0, sy=e.y|0;
    ctx.save(); ctx.translate(sx,sy);
    const W=e.w,H=e.h;
    ctx.fillStyle=C.brownDark;
    if (!e.dead){
      if (e.anim===0){ rrect(W*0.05,H*0.78,W*0.34,H*0.22,C.brownDark); rrect(W*0.60,H*0.78,W*0.34,H*0.22,C.brownDark); }
      else { rrect(W*0.12,H*0.78,W*0.34,H*0.22,C.brownDark); rrect(W*0.54,H*0.78,W*0.34,H*0.22,C.brownDark); }
    }
    ctx.fillStyle=C.brown;
    ctx.beginPath();
    ctx.moveTo(W*0.10,H*0.72);
    ctx.quadraticCurveTo(W*0.0,H*0.28,W*0.5,H*0.10);
    ctx.quadraticCurveTo(W*1.0,H*0.28,W*0.90,H*0.72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle="#f2c79a";
    rrect(W*0.22,H*0.42,W*0.56,H*0.28,"#f2c79a");
    rrect(W*0.30,H*0.42,W*0.16,H*0.20,C.white);
    rrect(W*0.54,H*0.42,W*0.16,H*0.20,C.white);
    rrect(W*0.34,H*0.46,W*0.07,H*0.12,C.black);
    rrect(W*0.58,H*0.46,W*0.07,H*0.12,C.black);
    rrect(W*0.28,H*0.40,W*0.20,H*0.04,C.brownDark);
    rrect(W*0.52,H*0.40,W*0.20,H*0.04,C.brownDark);
    if (e.dead){ ctx.fillStyle=C.brown; ctx.fillRect(0,H*0.78,W,H*0.22);
      rrect(W*0.30,H*0.80,W*0.12,H*0.06,"#f2c79a"); rrect(W*0.58,H*0.80,W*0.12,H*0.06,"#f2c79a"); }
    ctx.restore();
  }

  function drawKoopa(e){
    const sx=(e.x-cameraX)|0, sy=e.y|0;
    ctx.save(); ctx.translate(sx,sy);
    const W=e.w,H=e.h;
    if (e.shell){
      rrect(W*0.05,H*0.18,W*0.90,H*0.70,"#2aa92a");
      rrect(W*0.10,H*0.82,W*0.80,H*0.12,"#e0c020");
      rrect(W*0.28,H*0.30,W*0.44,H*0.42,"#0a8c1a");
      rrect(W*0.42,H*0.40,W*0.16,H*0.26,"#9be89b");
      ctx.restore(); return;
    }
    ctx.fillStyle="#b8401a";
    if (e.anim===0){ rrect(W*0.10,H*0.86,W*0.28,H*0.14,"#b8401a"); rrect(W*0.55,H*0.86,W*0.28,H*0.14,"#b8401a"); }
    else { rrect(W*0.18,H*0.86,W*0.28,H*0.14,"#b8401a"); rrect(W*0.50,H*0.86,W*0.28,H*0.14,"#b8401a"); }
    rrect(W*0.10,H*0.40,W*0.80,H*0.46,"#2aa92a");
    rrect(W*0.18,H*0.54,W*0.64,H*0.30,"#0a8c1a");
    rrect(W*0.22,H*0.62,W*0.56,H*0.20,"#f3e2a0");
    rrect(W*0.55,H*0.05,W*0.40,H*0.40,"#1ec81e");
    rrect(W*0.70,H*0.12,W*0.14,H*0.16,C.white);
    rrect(W*0.76,H*0.16,W*0.06,H*0.10,C.black);
    rrect(W*0.85,H*0.28,W*0.15,H*0.10,"#ffa030");
    ctx.restore();
  }

  function drawMushroomItem(it){
    const sx=(it.x-cameraX)|0, sy=it.y|0;
    ctx.save(); ctx.translate(sx,sy);
    const W=it.w,H=it.h;
    rrect(W*0.30,H*0.50,W*0.40,H*0.50,"#ffe0b0");
    rrect(W*0.30,H*0.50,W*0.10,H*0.50,"#e8c890");
    rrect(W*0.40,H*0.62,W*0.06,H*0.14,"#000");
    rrect(W*0.56,H*0.62,W*0.06,H*0.14,"#000");
    ctx.fillStyle=C.red;
    ctx.beginPath();
    ctx.moveTo(W*0.10,H*0.50);
    ctx.quadraticCurveTo(W*0.0,H*0.10,W*0.5,H*0.05);
    ctx.quadraticCurveTo(W*1.0,H*0.10,W*0.90,H*0.50);
    ctx.closePath(); ctx.fill();
    rrect(W*0.22,H*0.20,W*0.18,W*0.18,C.white);
    rrect(W*0.60,H*0.15,W*0.20,W*0.20,C.white);
    rrect(W*0.42,H*0.30,W*0.16,W*0.16,C.white);
    ctx.restore();
  }
  function drawFlowerItem(it){
    const sx=(it.x-cameraX)|0, sy=it.y|0;
    ctx.save(); ctx.translate(sx,sy);
    const W=it.w,H=it.h, fr=frame(20)<10;
    const cx=W*0.5, cy=H*0.4;
    ctx.fillStyle=fr?C.fireOrange:C.fireYellow;
    for(let i=0;i<4;i++){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(i*Math.PI/2+(fr?0:0.3));
      rrect(2,-3,8,6,ctx.fillStyle); ctx.restore(); }
    rrect(cx-3,cy-3,6,6, fr?C.fireYellow:C.fireOrange);
    rrect(W*0.42,H*0.55,W*0.16,H*0.45,C.grass);
    rrect(W*0.58,H*0.62,W*0.18,H*0.16,C.grass);
    ctx.restore();
  }
  function drawCoin(sx,sy,af){
    const W=16,H=16;
    const ph=Math.abs(Math.sin(af*0.25));
    const w=Math.max(3,W*ph);
    ctx.save(); ctx.translate(sx|0,sy|0);
    rrect(W*0.5-w/2,0,w,H,C.coinGold);
    rrect(W*0.5-w/2,0,2,H,C.coinEdge);
    rrect(W*0.5+w/2-2,0,2,H,C.coinEdge);
    ctx.restore();
  }
  function drawCoinPop(it){ drawCoin((it.x-cameraX)|0, it.y|0, frame(6)); }
  function drawFireball(f){
    const sx=(f.x-cameraX)|0, sy=f.y|0;
    ctx.save(); ctx.translate(sx,sy);
    ctx.fillStyle=C.fireOrange; ctx.beginPath(); ctx.arc(6,6,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.fireYellow; ctx.beginPath(); ctx.arc(6,6,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function drawParticles(){
    for(const p of particles){
      const sx=(p.x-cameraX)|0, sy=p.y|0;
      if (p.type==="frag"){ ctx.fillStyle=p.color; ctx.fillRect(sx,sy,p.w,p.h); }
      else if (p.type==="score"){ ctx.fillStyle=p.color; ctx.font="bold 12px 'Courier New'"; ctx.textAlign="center"; ctx.fillText(p.text,sx,sy); }
      else if (p.type==="spark"){ rrect(sx,sy,p.w,p.h,p.color); }
    }
  }

  function render(){
    ctx.save();
    if (shake>0.3) ctx.translate((Math.random()*shake-shake/2)|0,(Math.random()*shake-shake/2)|0);
    drawBackground();
    drawTiles();
    drawFlag();
    for(const it of items){
      if (it.type==="mushroom") drawMushroomItem(it);
      else if (it.type==="flower") drawFlowerItem(it);
      else if (it.type==="coinpop") drawCoinPop(it);
    }
    for(const e of enemies){
      const sx=e.x-cameraX; if (sx>VIEW_W+64||sx<-64) continue;
      if (e.type==="goomba") drawGoomba(e);
      else if (e.type==="koopa") drawKoopa(e);
    }
    for(const f of fireballs) drawFireball(f);
    drawMario(player);
    drawParticles();
    ctx.restore();
  }

  function updateHud(){
    elScore.textContent=pad(score,6);
    elCoins.textContent="\u00D7"+pad(coinCount,2);
    elWorld.textContent="1-1";
    elTime.textContent=""+timeLeft;
    elLives.textContent="\u00D7"+lives;
  }

  // ============================== LOOP ==============================
  function loop(ts){
    if (!lastTime) lastTime=ts;
    let dt=ts-lastTime; lastTime=ts;
    if (dt>100) dt=100;
    acc+=dt;
    while (acc>=STEP){ step(); frameCounter++; acc-=STEP; }
    if (state==="play"||state==="dead") render();
    requestAnimationFrame(loop);
  }

  // ============================== OVERLAYS ==============================
  function showOverlay(title,sub,msg){
    elOverlayTitle.textContent=title;
    elOverlaySub.textContent=sub||"";
    elOverlayMsg.innerHTML=msg||"";
    elOverlay.classList.remove("hidden");
  }
  function hideOverlay(){ elOverlay.classList.add("hidden"); }

  elStartBtn.addEventListener("click", function(){
    Sound.resume();
    if (state==="gameover"||state==="win"){ score=0; coinCount=0; lives=3; }
    startGame();
  });

  function requestRestart(){
    Sound.resume();
    if (state==="menu"||state==="gameover"||state==="win"){ score=0;coinCount=0;lives=3; startGame(); }
    else if (state==="play"||state==="dead"||state==="paused"){ initLevel(true); state="play"; hideOverlay(); }
  }
  let pausedFrom="play";
  function togglePause(){
    if (state==="play"){ pausedFrom=state; state="paused"; showOverlay("PAUSED","Press P to resume",""); }
    else if (state==="paused"){ state=pausedFrom; hideOverlay(); }
  }

  // ============================== INIT ==============================
  function initLevel(keepScore){
    resetLevelGrid();
    enemies=[]; items=[]; particles=[]; fireballs=[];
    for(const s of LevelData.enemies) spawnEnemy(s);
    player = makePlayer(); sizeFor(player);
    player.y = 13*TILE - player.h;
    flag = { x: LevelData.flagCol*TILE, flagY:4*TILE, descended:false, celebrated:false };
    cameraX=0; timeLeft=400; timeAcc=0;
    levelClearFlag=false; winTimer=0; shake=0;
    if (!keepScore){ score=0; coinCount=0; }
    updateHud();
  }
  function startGame(){
    if (state==="gameover"||state==="win"||state==="menu"){ score=0; coinCount=0; if(lives<=0)lives=3; lives=3; }
    initLevel(false);
    state="play"; hideOverlay(); updateHud();
  }

  window.addEventListener("blur", function(){ if (state==="play") togglePause(); });

  // boot
  state="menu";
  showOverlay("SUPER MARIO","Web Edition",
    "Eat mushrooms to grow \u00B7 Stomp goombas &amp; koopas<br>Big Mario smashes bricks \u00B7 Reach the flag!");
  updateHud();
  requestAnimationFrame(loop);
})();
