'use strict';
/* ============================================================
 * level.js — 关卡数据（还原 SMB World 1-1 + 地下奖励房）
 *
 * 字符含义：
 *   ' ' 空    'X' 地面  'B' 砖块(可顶碎)  'C' 连打金币砖
 *   '?' 金币问号砖  'M' 蘑菇/花问号砖  'W' 藏星星砖  'H' 隐藏1UP
 *   'U' 已用砖  'D' 实心阶梯块  'o' 金币(可直接吃)
 *   '[' ']' 水管顶 左/右   '{' '}' 水管身 左/右
 * ============================================================ */
const Level = (() => {

  const TH = 15;   // 15 行（240/16）
  const SOLID = new Set(['X', 'B', 'C', '?', 'M', 'W', 'U', 'D', '[', ']', '{', '}']);

  function makeRoom(w) {
    const tiles = [];
    for (let y = 0; y < TH; y++) tiles.push(new Array(w).fill(' '));
    return { w, h: TH, tiles, spawns: [], decor: null };
  }
  const T = (r, x, y, c) => { if (y >= 0 && y < r.h && x >= 0 && x < r.w) r.tiles[y][x] = c; };
  const G = (r, x, y) => (y < 0 || y >= r.h) ? ' ' : (x < 0 || x >= r.w ? ' ' : r.tiles[y][x]);

  function pipe(r, x, h) {
    const top = r.h - 2 - h;          // 水管顶行（底下是 2 行地面）
    T(r, x, top, '['); T(r, x + 1, top, ']');
    for (let y = top + 1; y < r.h - 2; y++) { T(r, x, y, '{'); T(r, x + 1, y, '}'); }
  }
  function stairsUp(r, x, n) { for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) T(r, x + i, r.h - 3 - j, 'D'); }
  function stairsDown(r, x, n) { for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) T(r, x + i, r.h - 3 - j, 'D'); }

  // ---------------- 主关卡：World 1-1 ----------------
  function buildMain() {
    const W = 212;
    const r = makeRoom(W);
    // 地面（3 处断崖）
    const gaps = [[69, 70], [88, 90], [152, 153]];
    for (let x = 0; x < W; x++) {
      if (gaps.some(([a, b]) => x >= a && x <= b)) continue;
      T(r, x, 13, 'X'); T(r, x, 14, 'X');
    }
    // ---- 开场问号砖 ----
    T(r, 16, 9, '?');
    T(r, 20, 9, 'B'); T(r, 21, 9, 'M'); T(r, 22, 9, 'B'); T(r, 23, 9, '?'); T(r, 24, 9, 'B');
    T(r, 22, 5, '?');
    // ---- 水管 ----
    pipe(r, 28, 2); pipe(r, 38, 3); pipe(r, 46, 4); pipe(r, 57, 4);
    T(r, 64, 9, 'H');                       // 隐藏 1UP
    // ---- 断崖1 后 ----
    T(r, 77, 9, 'B'); T(r, 78, 9, 'M'); T(r, 79, 9, 'B');
    for (let x = 80; x <= 87; x++) T(r, x, 5, 'B');   // 高处 8 砖
    // ---- 断崖2 后 ----
    T(r, 94, 5, 'B'); T(r, 95, 5, '?'); T(r, 96, 5, 'B');
    T(r, 95, 9, 'C');                       // 连打金币砖
    T(r, 100, 9, 'M');                      // 独立能量点问号砖
    T(r, 106, 9, '?');
    T(r, 109, 5, 'W'); T(r, 110, 5, '?'); T(r, 111, 5, 'B');  // 星星砖
    T(r, 118, 5, 'B'); T(r, 119, 5, 'B');
    T(r, 121, 9, 'B'); T(r, 122, 9, '?'); T(r, 123, 9, 'B');
    // ---- 阶梯 ----
    stairsUp(r, 134, 4); stairsDown(r, 138, 4);
    stairsUp(r, 148, 4); stairsDown(r, 154, 4);       // 中间隔着断崖3
    // ---- 后段水管与砖 ----
    pipe(r, 163, 2);
    T(r, 168, 9, 'B'); T(r, 169, 9, '?'); T(r, 170, 9, 'B');
    pipe(r, 179, 2);
    stairsUp(r, 181, 8);                              // 终点大阶梯
    T(r, 198, 12, 'D');                               // 旗杆底座
    // ---- 敌人 ----
    const go = x => r.spawns.push({ type: 'goomba', x: x * 16 });
    go(22.5); go(40.5);
    go(51); go(52.5);
    go(64); go(65.5);
    go(82); go(83.5);
    go(97); go(98.5);
    r.spawns.push({ type: 'koopa', x: 105 * 16 });
    go(114); go(115.5);
    go(124); go(125.5); go(128); go(129.5);
    go(172); go(173.5);
    // ---- 装饰 ----
    const decor = { hills: [], clouds: [], bushes: [], castle: 202 * 16, flagX: 198 * 16 };
    for (let i = 0; i < 5; i++) {
      decor.hills.push({ big: true, x: i * 48 * 16 });
      decor.hills.push({ big: false, x: (i * 48 + 16) * 16 });
      decor.bushes.push({ n: 3, x: (i * 48 + 11) * 16 });
      decor.bushes.push({ n: 1, x: (i * 48 + 23) * 16 });
      decor.bushes.push({ n: 2, x: (i * 48 + 41) * 16 });
      decor.clouds.push({ n: 1, x: (i * 48 + 8) * 16, y: 3 * 16 });
      decor.clouds.push({ n: 1, x: (i * 48 + 19) * 16, y: 2 * 16 });
      decor.clouds.push({ n: 2, x: (i * 48 + 27) * 16, y: 3 * 16 });
      decor.clouds.push({ n: 1, x: (i * 48 + 36) * 16, y: 2 * 16 });
    }
    r.decor = decor;
    // ---- 水管传送 ----
    r.warps = [
      { x: 57, h: 4, type: 'down', to: 'bonus' },       // 第 4 根水管按下进入
    ];
    return r;
  }

  // ---------------- 地下奖励房 ----------------
  function buildBonus() {
    const W = 30;
    const r = makeRoom(W);
    for (let x = 0; x < W; x++) { T(r, x, 13, 'X'); T(r, x, 14, 'X'); }
    // 天花板（入口处留洞）
    for (let x = 4; x < W; x++) { T(r, x, 0, 'B'); T(r, x, 1, 'B'); }
    // 左墙
    for (let y = 0; y < 13; y++) T(r, 0, y, 'B');
    // 右墙（11~12 行是出口）
    for (let y = 0; y < 13; y++) if (y !== 11 && y !== 12) T(r, W - 1, y, 'B');
    // 砖平台 + 金币
    for (let x = 5; x <= 12; x++) { T(r, x, 7, 'B'); T(r, x, 11, 'B'); T(r, x, 6, 'o'); T(r, x, 10, 'o'); }
    for (let x = 16; x <= 19; x++) T(r, x, 12, 'o');
    r.decor = null;
    r.exitPipe = { x: 27 * 16, rows: [11, 12] };
    r.dark = true;
    return r;
  }

  const rooms = { main: buildMain(), bonus: buildBonus() };

  return {
    rooms,
    SOLID,
    tile: (room, x, y) => G(rooms[room], x, y),
    setTile: (room, x, y, c) => T(rooms[room], x, y, c),
    isSolid: c => SOLID.has(c),
    reset() { rooms.main = buildMain(); rooms.bonus = buildBonus(); },
  };
})();
