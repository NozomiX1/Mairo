// 无头冒烟测试：用桩对象模拟浏览器环境，运行游戏逻辑数千帧
const fs = require('fs');
const path = require('path');

function makeCtx(){
  const noop = ()=>{};
  return new Proxy({ measureText: ()=>({width:10}), imageSmoothingEnabled:false }, {
    get(t,p){ if(p in t) return t[p]; return noop; },
    set(){ return true; }
  });
}
function makeCanvas(){ return { width:0, height:0, getContext(){ return makeCtx(); }, addEventListener(){} }; }
const mainCanvas = Object.assign(makeCanvas(), { width:400, height:240 });
global.document = {
  getElementById(id){ return id==='game' ? mainCanvas : { addEventListener(){} }; },
  createElement(){ return makeCanvas(); }
};
global.window = global;
global.addEventListener = ()=>{};
global.requestAnimationFrame = cb=>{ return 1; };

const base = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = base.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error('no script');
let code = m[1];

// 追加测试代码（与脚本共享作用域）
code += `
;(function(){
  function log(...a){ console.log.apply(console, a); }
  function replay(){ loadLevel(); state='playing'; paused=false; lives=3; }
  // ---- 1. 新游戏 + 长时间运行（向右跑 + 周期性跳跃）----
  newGame();
  keys['ArrowRight'] = true;
  for(let i=0;i<3600;i++){
    if(i%50===0) jumpBuf = 0.12;
    step(1/60);
    if(state!=='playing') break;
  }
  log('[run] state='+state+' mode='+mode+' x='+player.x.toFixed(1)+' camX='+camX.toFixed(1)+' score='+score+' coins='+coins+' lives='+lives);
  // ---- 2. 问号砖 / 道具砖 / 碎砖 ----
  replay();
  player.inv = 999;             // 测试期间不被怪撞死
  bumpTile(21,9);               // '?' → 金币
  log('[?] map=' + map[9][21] + ' coins=' + coins);
  bumpTile(23,9);               // 'M' → 蘑菇
  for(let i=0;i<240;i++) step(1/60);
  log('[M] powerups=' + powerups.length + ' kind=' + (powerups[0]?powerups[0].kind:'-') +
      ' x=' + (powerups[0]?powerups[0].x.toFixed(1):'-') + ' state=' + state + ' mode=' + mode);
  if(powerups[0]){ player.x = powerups[0].x; player.y = powerups[0].y - (player.h - powerups[0].h); }
  step(1/60);
  log('[M-eat] power='+player.power+' h='+player.h+' score='+score+' powerups='+powerups.length);
  player.power = 1;              // 变大后顶砖 → 碎
  bumpTile(20,9);
  log('[break] map=' + JSON.stringify(map[9][20]) + ' particles=' + particles.length);
  // ---- 3. 受伤 / 死亡 / 重生 ----
  player.inv = 0; hurt();
  log('[hurt] power='+player.power+' h='+player.h);
  player.inv = 0; hurt();
  log('[dying] mode='+mode+' lives='+lives);
  for(let i=0;i<300 && mode==='dying';i++) step(1/60);
  log('[respawn] state='+state+' mode='+mode+' lives='+lives+' x='+player.x);
  // ---- 4. 踩怪 & 龟壳 ----
  replay();
  const g = enemies[0];
  player.x = g.x; player.y = g.y - player.h + 4; player.vy = 100;
  collideEnemies(g.y - player.h - 8);   // prevY 在上方 → 判定为踩踏
  log('[stomp] goomba alive='+g.alive+' squash='+g.squash+' score='+score);
  const k = enemies.find(e=>e.type==='koopa');
  player.x = k.x; player.y = k.y - player.h + 4; player.vy = 100;
  collideEnemies(k.y - player.h - 8);
  log('[koopa->shell] type='+k.type+' vx='+k.vx);
  player.y = k.y - player.h + 4; player.vy = 100;
  collideEnemies(k.y - player.h - 8);    // 踩移动/静止龟壳
  log('[shell-stomp/kick] vx='+k.vx);
  // ---- 5. 火球 ----
  replay();
  player.power = 2; setPlayerSize(2);
  player.dir = 1; firePressed = true; step(1/60);
  log('[fire] fireballs='+fireballs.length+' power='+player.power);
  // ---- 6. 旗杆 → 城堡 → 胜利 ----
  replay();
  player.x = flagX*16 - 10; player.y = 13*16 - player.h;
  step(1/60);
  log('[flag] mode='+mode);
  for(let i=0;i<600 && state==='playing';i++) step(1/60);
  log('[win] state='+state+' bonusT='+bonusT+' timeBonus='+timeBonus);
  for(let i=0;i<1200 && state==='win';i++) step(1/60);
  log('[win-done] state='+state+' score='+score+' timeBonus='+timeBonus);
  // ---- 7. 跳跃高度验证（必须能跳过最高的 4 格水管 = 64px）----
  replay();
  player.inv=999; keys['ArrowRight']=false; keys['ArrowLeft']=false;
  player.x=7*16; player.y=13*16-player.h; player.vy=0;
  keys['ArrowUp']=true; jumpBuf=0.12;
  let maxH=0;
  for(let i=0;i<140;i++){
    step(1/60);
    const hgt=13*16-(player.y+player.h);
    if(hgt>maxH) maxH=hgt;
  }
  keys['ArrowUp']=false;
  log('[jump] apex='+maxH.toFixed(1)+'px  (tall pipe=64px, high bricks top=80px)  clearPipe='+(maxH>64));
  // ---- 8. 渲染路径扫描（各画面）----
  render();                          // 胜利画面
  state='title'; render();           // 标题屏（启动崩溃高发点）
  newGame(); render();               // 游戏内 + HUD
  for(let i=0;i<30;i++){ step(1/60); render(); }
  log('[render] OK');
  log('ALL OK');
})();
`;

try {
  (0, eval)(code);   // 直接 eval 以共享顶层作用域
} catch(e) {
  // 顶层 const/let 在间接 eval 中是全局脚本作用域；改用直接 eval
  eval(code);
}
