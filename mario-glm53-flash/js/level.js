'use strict';
/* ============================================================
 * level.js — tile 常量、tile 像素美术、1-1 风格关卡
 * ============================================================ */

const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QMUSH: 4, USED: 5, STONE: 6,
  PIPE_TL: 7, PIPE_TR: 8, PIPE_L: 9, PIPE_R: 10, COIN: 11, POLE: 12, POLE_TOP: 13,
};
const TILE_SOLID = new Set([T.GROUND, T.BRICK, T.QCOIN, T.QMUSH, T.USED, T.STONE,
  T.PIPE_TL, T.PIPE_TR, T.PIPE_L, T.PIPE_R]);
const TILE_SIZE = 16;
const LEVEL_H = 15;      // 场景高（tiles）
const VIEW_W = 256;      // 视口宽（像素，原版分辨率）
const VIEW_H = 240;      // 视口高

/* ---------------- tile 美术预渲染 ---------------- */
const TileArt = (() => {
  function cv(draw) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    draw(c.getContext('2d'));
    return c;
  }
  const art = {};

  /* 地面砖：橙底 + 高光 + 错缝 */
  art[T.GROUND] = cv(g => {
    g.fillStyle = '#d0722c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#f8a860'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 1, 1, 15);
    g.fillStyle = '#3c1800'; g.fillRect(15, 1, 1, 15); g.fillRect(1, 15, 15, 1);
    g.fillStyle = '#000000';
    g.fillRect(0, 8, 16, 1);
    g.fillRect(8, 1, 1, 7);
    g.fillRect(15, 9, 1, 6);
    g.fillStyle = '#a85018'; g.fillRect(3, 3, 2, 1); g.fillRect(11, 11, 2, 1);
  });

  /* 砖块：偏红砖排 */
  art[T.BRICK] = cv(g => {
    g.fillStyle = '#c15020'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#e89050'; g.fillRect(0, 0, 16, 1);
    g.fillStyle = '#000000';
    g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1);
    g.fillRect(7, 1, 1, 6); g.fillRect(15, 8, 1, 7);
  });

  /* 问号块（3 帧闪烁） */
  function qBlock(bg, hi, dark) {
    return cv(g => {
      g.fillStyle = bg; g.fillRect(0, 0, 16, 16);
      g.fillStyle = hi; g.fillRect(1, 1, 14, 1); g.fillRect(1, 1, 1, 14);
      g.fillStyle = dark; g.fillRect(14, 2, 1, 12); g.fillRect(2, 14, 12, 1);
      g.fillStyle = '#000000';
      g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
      g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
      g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1);
      g.fillRect(2, 13, 1, 1); g.fillRect(13, 13, 1, 1);
      drawText(g, '?', 5, 4, dark, 2);
    });
  }
  art[T.QCOIN + '_0'] = qBlock('#f8b800', '#fcd870', '#a05000');
  art[T.QCOIN + '_1'] = qBlock('#eaa400', '#f8c840', '#904800');
  art[T.QCOIN + '_2'] = qBlock('#c88800', '#e8a820', '#7c4000');
  art[T.QMUSH + '_0'] = art[T.QCOIN + '_0'];
  art[T.QMUSH + '_1'] = art[T.QCOIN + '_1'];
  art[T.QMUSH + '_2'] = art[T.QCOIN + '_2'];

  /* 用过的块 */
  art[T.USED] = cv(g => {
    g.fillStyle = '#9c5a1c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
    g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1);
    g.fillRect(2, 13, 1, 1); g.fillRect(13, 13, 1, 1);
  });

  /* 硬块（阶梯） */
  art[T.STONE] = cv(g => {
    g.fillStyle = '#c84c0c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#f8b878'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 0, 2, 16);
    g.fillStyle = '#3c1800'; g.fillRect(14, 2, 2, 14); g.fillRect(2, 14, 14, 2);
    g.fillStyle = '#f8b878'; g.fillRect(4, 4, 2, 2); g.fillRect(10, 4, 2, 2);
    g.fillRect(4, 10, 2, 2); g.fillRect(10, 10, 2, 2);
  });

  /* 管道（4 块拼合） */
  const PM = '#30a020', PL = '#88d860', PD = '#0c5a10', PK = '#000000';
  art[T.PIPE_TL] = cv(g => {
    g.fillStyle = PM; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PL; g.fillRect(2, 1, 3, 15); g.fillRect(2, 1, 13, 1);
    g.fillStyle = PK; g.fillRect(0, 0, 1, 16); g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 1);
  });
  art[T.PIPE_TR] = cv(g => {
    g.fillStyle = PM; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PD; g.fillRect(11, 2, 3, 14); g.fillRect(0, 1, 14, 1);
    g.fillStyle = PK; g.fillRect(15, 0, 1, 16); g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 15, 16, 1);
  });
  art[T.PIPE_L] = cv(g => {
    g.fillStyle = PM; g.fillRect(2, 0, 14, 16);
    g.fillStyle = PL; g.fillRect(4, 0, 3, 16);
    g.fillStyle = PK; g.fillRect(2, 0, 1, 16);
  });
  art[T.PIPE_R] = cv(g => {
    g.fillStyle = PM; g.fillRect(0, 0, 14, 16);
    g.fillStyle = PD; g.fillRect(10, 0, 3, 16);
    g.fillStyle = PK; g.fillRect(13, 0, 1, 16);
  });

  /* 旗杆 */
  art[T.POLE] = cv(g => {
    g.fillStyle = '#8fd860'; g.fillRect(7, 0, 2, 16);
    g.fillStyle = '#e8ffd8'; g.fillRect(7, 0, 1, 16);
  });
  art[T.POLE_TOP] = cv(g => {
    g.fillStyle = '#8fd860'; g.fillRect(7, 6, 2, 10);
    g.fillStyle = '#e8ffd8'; g.fillRect(7, 6, 1, 10);
    g.fillStyle = '#30a020'; g.fillRect(5, 1, 6, 6);
    g.fillStyle = '#88d860'; g.fillRect(6, 2, 2, 2);
  });

  return art;
})();

/* ---------------- 1-1 风格关卡 ---------------- */
function buildLevel1() {
  const W = 224;
  const map = new Uint8Array(W * LEVEL_H);
  const spawns = [];
  const set = (x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < LEVEL_H) map[y * W + x] = t; };

  const ground = (x0, x1) => { for (let x = x0; x <= x1; x++) { set(x, 13, T.GROUND); set(x, 14, T.GROUND); } };
  const brick = (x, y) => set(x, y, T.BRICK);
  const q = (x, y, kind) => set(x, y, kind === 'mush' ? T.QMUSH : T.QCOIN);
  const pipe = (x, h) => {
    const top = 13 - h;
    set(x, top, T.PIPE_TL); set(x + 1, top, T.PIPE_TR);
    for (let y = top + 1; y < 13; y++) { set(x, y, T.PIPE_L); set(x + 1, y, T.PIPE_R); }
  };
  const coinRow = (x, y, n) => { for (let i = 0; i < n; i++) set(x + i, y, T.COIN); };
  const goomba = x => spawns.push({ type: 'goomba', x: x * 16 });
  const koopa = x => spawns.push({ type: 'koopa', x: x * 16 });
  const stairsUp = (x, n) => { for (let i = 0; i < n; i++) for (let h2 = 0; h2 <= i; h2++) set(x + i, 12 - h2, T.STONE); };
  const stairsDown = (x, n) => { for (let i = 0; i < n; i++) for (let h2 = 0; h2 < n - i; h2++) set(x + i, 12 - h2, T.STONE); };

  /* —— 第一段 —— */
  ground(0, 68);
  q(16, 9, 'coin');
  brick(20, 9); q(21, 9, 'coin'); brick(22, 9); q(23, 9, 'mush'); brick(24, 9);
  q(22, 5, 'coin');
  coinRow(33, 9, 3);
  pipe(28, 2); pipe(38, 3); pipe(46, 4); pipe(57, 4);
  coinRow(60, 8, 4);
  goomba(22); goomba(40); goomba(51); goomba(53);

  /* —— 坑1 (69-70) —— */
  ground(71, 85);
  brick(77, 9); brick(78, 9); q(79, 9, 'mush'); brick(80, 9);
  goomba(74); koopa(82);

  /* —— 坑2 (86-88) —— */
  ground(89, 152);
  brick(91, 5); brick(92, 5); brick(93, 5); brick(94, 5);
  q(94, 9, 'coin');
  coinRow(96, 4, 2);
  koopa(100);
  brick(104, 5); q(105, 5, 'mush'); brick(106, 5);
  brick(104, 9); brick(105, 9); brick(106, 9); brick(107, 9);
  goomba(110); goomba(112);
  coinRow(118, 8, 4);
  brick(121, 9); q(122, 9, 'coin'); brick(123, 9);
  goomba(126); goomba(128); goomba(130);
  stairsUp(134, 4);
  stairsDown(139, 4);
  pipe(146, 2);
  goomba(150);

  /* —— 坑3 (153-155) —— */
  ground(156, 223);
  q(160, 9, 'coin');
  coinRow(159, 8, 3);
  brick(163, 9); brick(164, 9);
  goomba(158);

  /* 终点大阶梯 */
  for (let i = 0; i < 8; i++) for (let h2 = 0; h2 <= i; h2++) set(172 + i, 12 - h2, T.STONE);
  /* 旗杆 */
  const poleCol = 186;
  set(poleCol, 2, T.POLE_TOP);
  for (let y = 3; y <= 12; y++) set(poleCol, y, T.POLE);
  set(poleCol, 12, T.USED); // 底座

  return {
    w: W, h: LEVEL_H, map, spawns,
    poleX: poleCol * TILE_SIZE + 7,   // 杆中心
    castleX: 194 * TILE_SIZE,         // 城堡左缘
    doorX: 196 * TILE_SIZE + 8,       // 城堡门中心
    start: { x: 40, y: 11 * TILE_SIZE },
    timeLimit: 300,
    get(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= LEVEL_H) return T.EMPTY;
      return map[y * W + x];
    },
    set(x, y, t) {
      if (x >= 0 && x < W && y >= 0 && y < LEVEL_H) map[y * W + x] = t;
    },
  };
}

const LEVEL1 = buildLevel1();
