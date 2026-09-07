'use strict';
/* ============================================================
 * sprites.js — 手绘像素精灵 + 3x5 像素字体
 * 每个精灵由字符矩阵定义，启动时预渲染到离屏 canvas。
 * ============================================================ */

const PAL = {
  R: '#e73c2e', // 红（帽/衫）
  r: '#a82014', // 暗红
  S: '#ffc59a', // 肤色
  s: '#d98a52', // 肤暗
  N: '#77401a', // 棕（发/鞋）
  n: '#4c260c', // 深棕
  B: '#2a52c9', // 蓝背带裤
  b: '#1b357f', // 暗蓝
  Y: '#ffd94a', // 黄（纽扣/金）
  y: '#c68a00', // 暗金
  W: '#ffffff', // 白
  K: '#151515', // 近黑
  G: '#3cb832', // 绿
  g: '#1d7a25', // 暗绿
  D: '#8fe060', // 亮绿
  O: '#b06a24', // Goomba 棕
  o: '#7a4514', // Goomba 暗棕
  C: '#ffe2a8', // 奶油（Goomba 下部 / Koopa 皮肤）
  P: '#f8b800', // 金币亮
  p: '#b56a00', // 金币暗
};

/* 字符矩阵 -> 离屏 canvas */
function buildSprite(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = PAL[rows[y][x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

/* 绘制精灵（支持水平翻转）；sx 模拟金币旋转等缩放 */
function drawSprite(ctx, img, x, y, flip, sx) {
  const sc = sx === undefined ? 1 : sx;
  if (Math.abs(sc) < 0.08) return;
  ctx.save();
  ctx.translate(Math.round(x) + (flip ? img.width : 0), Math.round(y));
  ctx.scale(flip ? -sc : sc, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/* ---------------- 小 Mario（12x16，面朝右） ---------------- */
const SM_IDLE = [
  '...RRRRRR...',
  '..RRRRRRRRRR',
  '..NNNSSKS...',
  '.NSNSSSKSSS.',
  '.NSNNSSSSSS.',
  '.NNSSSSNNNN.',
  '..SSSSSSSS..',
  '..RRRRRRR...',
  '.RRBBBBBRR..',
  'RRRBYBBYBRRR',
  'SSBBBBBBBBSS',
  'SS.BBBBBB.SS',
  '...BBBBBB...',
  '..BBB..BBB..',
  '..NNN..NNN..',
  '.NNNN..NNNN.',
];
const SM_WALK1 = [
  '...RRRRRR...',
  '..RRRRRRRRRR',
  '..NNNSSKS...',
  '.NSNSSSKSSS.',
  '.NSNNSSSSSS.',
  '.NNSSSSNNNN.',
  '..SSSSSSSS..',
  '..RRRRRRRS..',
  '.RRBBBBBRRS.',
  'RRRBYBBYBRR.',
  'SSBBBBBBBB..',
  'S.BBBBBBB...',
  '...BBBBBB...',
  '..BBBB.BBB..',
  '.NNNN...NNN.',
  'NNNN.....NNN',
];
const SM_WALK2 = [
  '...RRRRRR...',
  '..RRRRRRRRRR',
  '..NNNSSKS...',
  '.NSNSSSKSSS.',
  '.NSNNSSSSSS.',
  '.NNSSSSNNNN.',
  '..SSSSSSSS..',
  '...RRRRRR...',
  '..RRBBBBRR..',
  '..RBYBBYBR..',
  '..SBBBBBBS..',
  '...BBBBBB...',
  '...BBBBB....',
  '...BBBB.....',
  '..NNNNN.....',
  '..NNNNNN....',
];
const SM_JUMP = [
  '...RRRRRR...',
  '..RRRRRRRRRR',
  '..NNNSSKS...',
  '.NSNSSSKSSS.',
  '.NSNNSSSSSS.',
  '.NNSSSSNNNN.',
  '..SSSSSSSS..',
  'SSRRRRRRR.SS',
  'SSRBBBBBRRSS',
  'S.RBYBBYBR.S',
  '..BBBBBBBB..',
  '..BBBBBBBB..',
  '.BBBB..BBBB.',
  '.NNN....NNN.',
  'NNN......NNN',
  '............',
];
const SM_DEAD = [
  '...RRRRRR...',
  '..RRRRRRRR..',
  '..NSSSSSSN..',
  '.NSKSSSSKSN.',
  '.NSSSSSSSSN.',
  '..NSSSSSSN..',
  '...SSSSSS...',
  'S..RRRRRR..S',
  'SS.RBBBBR.SS',
  '.SSBBBBBBSS.',
  '..BBBBBBBB..',
  '..BBBBBBBB..',
  '...BBBBBB...',
  '..NNN..NNN..',
  '.NNN....NNN.',
  '............',
];

/* ---------------- 大 Mario（16x32，面朝右） ---------------- */
const BG_HEAD = [
  '......RRRRRR....',
  '.....RRRRRRRRRR.',
  '.....NNNSSKS....',
  '....NSNSSSKSSS..',
  '....NSNSSSSKSSS.',
  '....NSNNSSSSSSS.',
  '....NNSSSSNNNNN.',
  '......SSSSSSSS..',
];
const BG_IDLE = BG_HEAD.concat([
  '.....RRRRRRRR...',
  '....RRRRRRRRRR..',
  '...RRRRRRRRRRRR.',
  '..RRRBBBBBBRRRR.',
  '..RRBBBBBBBBRRR.',
  '.RRBBYBBBBYBBRR.',
  '.RRBBYBBBBYBBRR.',
  '.SSBBBBBBBBBBSS.',
  '.SSBBBBBBBBBBSS.',
  '.SSSBBBBBBBBSSS.',
  '..SS.BBBBBB.SS..',
  '.....BBBBBB.....',
  '....BBBBBBBB....',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '...BBBB..BBBB...',
  '...BBB....BBB...',
  '...BBB....BBB...',
  '..NNNN....NNNN..',
  '..NNNN....NNNN..',
  '.NNNNN....NNNNN.',
  '.NNNNN....NNNNN.',
  'NNNNNN....NNNNNN',
  '................',
]);
const BG_WALK1 = BG_HEAD.concat([
  '.....RRRRRRRR...',
  '....RRRRRRRRRR..',
  '...RRRRRRRRRRRS.',
  '..RRRBBBBBBRRSS.',
  '..RRBBBBBBBBRSS.',
  '.RRBBYBBBBYBBR..',
  '.RRBBYBBBBYBB...',
  '.SSBBBBBBBBB....',
  '.SSBBBBBBBBB....',
  '.SSSBBBBBBBB....',
  '..SS.BBBBBB.....',
  '.....BBBBBB.....',
  '....BBBBBBBB....',
  '...BBBBBBBBBB...',
  '..BBBBB..BBBB...',
  '..BBBB...BBBB...',
  '..BBB.....BBB...',
  '..BBB.....BBBB..',
  '.NNNN......NNNN.',
  '.NNNN......NNNNN',
  'NNNNN.......NNNN',
  'NNNN........NNNN',
  '................',
  '................',
]);
const BG_WALK2 = BG_HEAD.concat([
  '.....RRRRRRRR...',
  '....RRRRRRRRRR..',
  '...RRRRRRRRRRR..',
  '..RRRBBBBBBRRR..',
  '..RRBBBBBBBBRR..',
  '.RRBBYBBBBYBBRR.',
  '.RRBBYBBBBYBBRR.',
  '.SSBBBBBBBBBBSS.',
  '.SSBBBBBBBBBBSS.',
  '..SSBBBBBBBBSS..',
  '...S.BBBBBB.S...',
  '.....BBBBBB.....',
  '....BBBBBBB.....',
  '....BBBBBBBB....',
  '...BBBBBBBB.....',
  '...BBBBBBB......',
  '...BBBBBB.......',
  '...BBBBBB.......',
  '...NNNNNN.......',
  '..NNNNNNN.......',
  '..NNNNNN........',
  '..NNNNN.........',
  '................',
  '................',
]);
const BG_JUMP = BG_HEAD.concat([
  '.SS..RRRRRRR.SS.',
  'SSS.RRRRRRRR.SSS',
  'SS.RRRRRRRRRR.SS',
  'S.RRRBBBBBBRR.S.',
  '..RRBBBBBBBBR...',
  '.RRBBYBBBBYBBR..',
  '.RRBBYBBBBYBBR..',
  '.SBBBBBBBBBBBBS.',
  '.SBBBBBBBBBBBBS.',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '.....BBBBBB.....',
  '....BBBBBBBB....',
  '...BBBBBBBBBB...',
  '..BBBBB..BBBB...',
  '..BBBB...BBBBB..',
  '..BBB.....BBB...',
  '.BBBB.....BBB...',
  '.NNNN.....BBBB..',
  '.NNNN....NNNNN..',
  'NNNNN....NNNNN..',
  'NNNN.....NNNNN..',
  '................',
  '................',
]);
/* 蹲下（16x22，贴底） */
const BG_CROUCH = BG_HEAD.concat([
  '..RRRRRRRRRRR...',
  '.RRBBBBBBBBBRR..',
  '.RBBYBBBBBYBBR..',
  'SSBBBBBBBBBBBSS.',
  'SS.BBBBBBBBB.SS.',
  '..BBBBBBBBBBB...',
  '.BBBBB...BBBBB..',
  '.BBBB.....BBBB..',
  '.NNNN.....NNNN..',
  'NNNNN.....NNNNN.',
  'NNNNN.....NNNNN.',
  'NNNNN.....NNNNN.',
  '................',
  '................',
]);

/* ---------------- Goomba（16x13，贴底） ---------------- */
const GOOMBA_WALK = [
  '.....OOOOOO.....',
  '....OOOOOOOO....',
  '...OOOOOOOOOO...',
  '..OOOWWOOWWOOO..',
  '..OOWWKOOKWWOO..',
  '.OOOWWKOOKWWOOO.',
  '.OOOOOOOOOOOOOO.',
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  '.OOCCCCCCCCCCOO.',
  '..CCCCCCCCCCCC..',
  '..KKKK....KKKK..',
  '.KKKKK....KKKKK.',
];
const GOOMBA_FLAT = [
  '...OOOOOOOOOO...',
  '.OOOOOOOOOOOOOO.',
  'OOWWKOOOOOKWWOOO',
  'OOOOOOOOOOOOOOOO',
  '.KKKKKKKKKKKKKK.',
];

/* ---------------- Koopa（16x15，贴底，面朝右） ---------------- */
const KOOPA_WALK1 = [
  '.........CCCC...',
  '........CCCCCC..',
  '........CWKCC...',
  '........CCCCCC..',
  '........CCCC....',
  '..GGGGG.CCC.....',
  '.GGGGGGGCC......',
  'GGDGGGGGCC......',
  'GDDGGGGGGC......',
  'GDGGGGGGGC......',
  'GGGGGGGGG.......',
  '.GGGGGGGG.......',
  '..GGGGGG........',
  '...CC..CCC......',
  '..CCC...CCC.....',
];
const KOOPA_WALK2 = [
  '.........CCCC...',
  '........CCCCCC..',
  '........CWKCC...',
  '........CCCCCC..',
  '........CCCC....',
  '..GGGGG.CCC.....',
  '.GGGGGGGCC......',
  'GGDGGGGGCC......',
  'GDDGGGGGGC......',
  'GDGGGGGGGC......',
  'GGGGGGGGG.......',
  '.GGGGGGGG.......',
  '..GGGGGG........',
  '....CCC.CC......',
  '....CCC.CCC.....',
];
const KOOPA_SHELL = [
  '....GGGGGGGG....',
  '..GGGGGGGGGGGG..',
  '.GDGGDGGDGGDGGG.',
  'GGGGGGGGGGGGGGGG',
  'GDGGDGGDGGDGGDGG',
  'GGGGGGGGGGGGGGGG',
  '.WWWWWWWWWWWWWW.',
  '..WWWWWWWWWWWW..',
];

/* ---------------- 蘑菇（16x14，贴底） ---------------- */
const MUSHROOM = [
  '.....KKKKKK.....',
  '...KKRWWWWRRK...',
  '..KRRWWWWWWRRK..',
  '.KRRWWWWWWWWRRK.',
  '.KRWWRRRRRRWWRK.',
  'KRWWRRRRRRRRWWRK',
  'KRWWRRRRRRRRWWRK',
  'KRRRRRRRRRRRRRRK',
  '.KKKKKKKKKKKKKK.',
  '..KCCCCCCCCCCK..',
  '..KCCKCCCCKCCK..',
  '..KCCKCCCCKCCK..',
  '..KCCCCCCCCCCK..',
  '...KKKKKKKKKK...',
];

/* ---------------- 金币（10x12）与旗子 ---------------- */
const COIN = [
  '...YYYY...',
  '..YWWYYY..',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '.YYWWYYYY.',
  '..YWWYYY..',
  '...YYYY...',
];
const FLAG = [
  'GGGGGGGGGG..',
  'GDDGGGGGGG..',
  'GGGGGGGGG...',
  '.GGGGGGGG...',
  '.GGGGGGG....',
  '..GGGGGG....',
  '..GGGGG.....',
  '...GGGG.....',
  '...GGG......',
  '....GG......',
];

/* ---------------- 3x5 像素字体 ---------------- */
const FONT3X5 = {
  '0': '111101101101111', '1': '110010010010111', '2': '111001111100111',
  '3': '111001011001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001001010010', '8': '111101111101111',
  '9': '111101111001111',
  'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011',
  'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100',
  'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111',
  'J': '001001001101010', 'K': '101101110101101', 'L': '100100100100111',
  'M': '101111101101101', 'N': '110101101101101', 'O': '010101101101010',
  'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110110101',
  'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111',
  'V': '101101101101010', 'W': '101101101111101', 'X': '101101010101101',
  'Y': '101101010010010', 'Z': '111001010100111',
  '-': '000000111000000', 'x': '000101010101000', '!': '010010010000010',
  '.': '000000000000010', ':': '000010000010000', "'": '010010000000000',
  '>': '100010001010100', '?': '111001011000010', ',': '000000000010100',
};

/* 像素文本绘制（带 1px 间距），返回文本宽度 */
function drawText(ctx, text, x, y, color, scale) {
  scale = scale || 1;
  ctx.fillStyle = color || '#ffffff';
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) {
    if (ch === ' ') { cx += 4 * scale; continue; }
    const bits = FONT3X5[ch];
    if (!bits) { cx += 4 * scale; continue; }
    for (let i = 0; i < 15; i++) {
      if (bits[i] === '1') {
        ctx.fillRect(cx + (i % 3) * scale, cy + Math.floor(i / 3) * scale, scale, scale);
      }
    }
    cx += 4 * scale;
  }
  return cx - x;
}
function textWidth(text, scale) {
  return text.length * 4 * (scale || 1);
}
function drawTextCentered(ctx, text, cx, y, color, scale) {
  drawText(ctx, text, cx - textWidth(text, scale) / 2, y, color, scale);
}

/* 预构建全部精灵 */
const Sprites = {
  small: {
    idle: buildSprite(SM_IDLE),
    walk1: buildSprite(SM_WALK1),
    walk2: buildSprite(SM_WALK2),
    jump: buildSprite(SM_JUMP),
    dead: buildSprite(SM_DEAD),
  },
  big: {
    idle: buildSprite(BG_IDLE),
    walk1: buildSprite(BG_WALK1),
    walk2: buildSprite(BG_WALK2),
    jump: buildSprite(BG_JUMP),
    crouch: buildSprite(BG_CROUCH),
  },
  goomba: { walk: buildSprite(GOOMBA_WALK), flat: buildSprite(GOOMBA_FLAT) },
  koopa: {
    walk1: buildSprite(KOOPA_WALK1),
    walk2: buildSprite(KOOPA_WALK2),
    shell: buildSprite(KOOPA_SHELL),
  },
  mushroom: buildSprite(MUSHROOM),
  coin: buildSprite(COIN),
  flag: buildSprite(FLAG),
};
