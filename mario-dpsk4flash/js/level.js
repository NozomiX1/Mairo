'use strict';
/* ============================================================
 * 关卡数据 —— 复刻 Super Mario Bros. World 1-1 布局（近似）
 * 瓦片常量 + 程序化搭图
 * ============================================================ */
const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, Q: 3, USED: 4, HIDDEN: 5,
  PIPE_TL: 6, PIPE_TR: 7, PIPE_BL: 8, PIPE_BR: 9,
};

function buildLevel() {
  const COLS = 224, ROWS = 15;
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(T.EMPTY));
  const qContents = new Map();   // "c,r" -> 'coin' | 'mushroom' | '1up'
  const entities = [];           // {type,x,y,dir}
  const coins = [];              // {x,y}
  const clouds = [], hills = [], bushes = [];

  function set(c, r, t) {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r][c] = t;
  }
  function ground(c0, c1) {
    for (let c = c0; c <= c1; c++) { set(c, 12, T.GROUND); set(c, 13, T.GROUND); set(c, 14, T.GROUND); }
  }
  function pit(c0, c1) { /* 什么都不放，即坑 */ }
  function brick(c, r) { set(c, r, T.BRICK); }
  function block(c, r, kind) { set(c, r, T.Q); qContents.set(c + ',' + r, kind); }
  function hidden(c, r, kind) { set(c, r, T.HIDDEN); qContents.set(c + ',' + r, kind); }
  function pipe(c, h) {
    for (let i = 0; i < h; i++) {
      const rr = 12 - h + i;
      set(c, rr, i === 0 ? T.PIPE_TL : T.PIPE_BL);
      set(c + 1, rr, i === 0 ? T.PIPE_TR : T.PIPE_BR);
    }
  }
  function goomba(c) { entities.push({ type: 'goomba', x: c * 16, y: 11 * 16, dir: -1 }); }
  function koopa(c)  { entities.push({ type: 'koopa', x: c * 16, y: 11 * 16, dir: -1 }); }
  function coinAt(c, r) { coins.push({ x: c * 16 + 4, y: r * 16 + 1 }); }

  /* ================= 地图 ================= */
  ground(0, COLS - 1);

  // 起点附近：蘑菇问号砖 + 砖块/问号组合 + 板栗仔
  block(16, 9, 'mushroom');
  brick(20, 9); brick(21, 9); block(22, 9, 'coin'); brick(23, 9);
  goomba(18); goomba(24); goomba(26);

  // 第一根水管(高2) 与 第二根水管(高3)，中间一只板栗仔
  pipe(33, 2);
  pipe(40, 3);
  goomba(37);

  // 坑1（宽2），坑上方两枚金币
  pit(63, 64);
  coinAt(63, 9); coinAt(64, 9);

  // 砖块 + 问号 + 三只板栗仔
  brick(68, 9); block(69, 9, 'coin'); brick(70, 9);
  goomba(73); goomba(75); goomba(77);

  // 坑2（宽3）
  pit(96, 98);

  // 砖块楼梯（4-3-2-1）
  for (let i = 0; i < 4; i++) for (let k = 0; k <= i; k++) brick(108 + i, 11 - k);
  block(109, 6, 'coin');
  // 隐藏 1UP 蘑菇（经典位置）
  hidden(114, 7, '1up');

  // 楼梯后三只板栗仔 + 一只乌龟
  goomba(117); goomba(119); goomba(121);
  koopa(125);

  // 两根矮水管，中间板栗仔
  pipe(130, 1);
  pipe(135, 2);
  goomba(132);

  // 坑3（宽4），上方金币引导
  pit(144, 147);
  for (let c = 144; c <= 147; c++) coinAt(c, 8);

  // 三连递增水管
  pipe(152, 1);
  pipe(156, 2);
  pipe(160, 3);
  goomba(154); goomba(158); koopa(163);

  // 坑4（宽4）
  pit(170, 173);
  for (let c = 170; c <= 173; c++) coinAt(c, 9);

  // 终点前：砖块 + 板栗仔
  brick(180, 9); brick(181, 9);
  goomba(177); goomba(179); goomba(183); goomba(185);

  // 旗杆前 8 级楼梯（1..8 高）
  for (let i = 0; i < 8; i++) for (let k = 0; k <= i; k++) brick(189 + i, 11 - k);

  /* ================= 装饰 ================= */
  [9, 38, 75, 103, 138, 168, 201].forEach(c => clouds.push(c));
  [4, 31, 71, 113, 149, 187].forEach(c => hills.push(c));
  [14, 27, 48, 66, 87, 121, 143, 175, 193, 205].forEach(c => bushes.push(c));

  return {
    grid, cols: COLS, rows: ROWS, qContents,
    entities, coins,
    clouds, hills, bushes,
    playerX: 2 * 16 + 2, playerY: 11 * 16,
    flagX: 197, flagTopRow: 3,
    castleX: 209 * 16,
  };
}

/* 供其它脚本 / 测试使用 */
if (typeof window !== 'undefined') {
  window.T = T;
  window.buildLevel = buildLevel;
}
