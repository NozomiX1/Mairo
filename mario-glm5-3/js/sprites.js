'use strict';
/* ============================================================
 * sprites.js — 像素画精灵数据与烘焙（全部程序生成，无外部资源）
 * ============================================================ */
const Sprites = (() => {

  // ---------------- 调色板 ----------------
  const PAL = {
    mario:  { R: '#d82800', S: '#fca044', B: '#883000' },
    fire:   { R: '#fcfcfc', S: '#fca044', B: '#d82800' },
    starA:  { R: '#fc9838', S: '#fcfcfc', B: '#00a800' },
    starB:  { R: '#00a800', S: '#fcfcfc', B: '#d82800' },

    goomba: { G: '#a04800', C: '#fcd8a8', K: '#100800', W: '#fcfcfc' },
    koopa:  { G: '#00a800', L: '#80d010', C: '#ffd898', W: '#fcfcfc', K: '#002800' },

    item:   { R: '#d82800', W: '#fcfcfc', C: '#ffd898', K: '#100800' },
    oneup:  { R: '#00b800', W: '#fcfcfc', C: '#ffd898', K: '#100800' },
    flower: { P: '#e45c10', W: '#fcfcfc', G: '#00a800', L: '#80d010' },
    flower2:{ P: '#fc9838', W: '#fcfcfc', G: '#00a800', L: '#80d010' },
    star:   { Y: '#fcb830', W: '#fcfcfc', K: '#100800' },
    star2:  { Y: '#fcfcfc', W: '#fcb830', K: '#100800' },
    coin:   { O: '#c84c0c', Y: '#fcb830', W: '#fcfcfc' },

    block:  { A: '#c84c0c', L: '#fc9838', B: '#000000' },
    blockUG:{ A: '#0058f8', L: '#3cbcfc', B: '#000000' },
    q1:     { A: '#fc9838', B: '#000000', W: '#fcfcfc' },
    q2:     { A: '#ffc868', B: '#000000', W: '#fcfcfc' },
    q3:     { A: '#d87018', B: '#000000', W: '#fcfcfc' },
    used:   { A: '#a04800', B: '#000000' },
    usedUG: { A: '#0048b8', B: '#000000' },
    pipe:   { G: '#00a800', L: '#98e858', D: '#005800', B: '#000000' },
    pole:   { G: '#00a800', L: '#98e858' },
  };

  // ---------------- 精灵像素数据 ----------------
  const D = {

    // ---- 小马里奥 ----
    smStand: { pal: 'mario', rows: [
      "................",
      ".....RRRRR......",
      "....RRRRRRRRR...",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "....BBRRBB......",
      "...BBBRRBBB.....",
      "..BBBBRRRRBBBB..",
      "..SSBRRRRRRBSS..",
      "..SSRRRRRRRRSS..",
      "....RRR..RRR....",
      "...BBB....BBB...",
      "..BBBB....BBBB..",
    ]},
    smWalk1: { pal: 'mario', rows: [
      "................",
      ".....RRRRR......",
      "....RRRRRRRRR...",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "....BBRRBBBSS...",
      "...BBBRRBBBSS...",
      "..BBBBRRRRBBSS..",
      "..SSBRRRRRRBB...",
      "..SSRRRRRRRR....",
      "...RRRR.RRRR....",
      "..BBB....BBBB...",
      ".BBBB.....BBB...",
    ]},
    smWalk2: { pal: 'mario', rows: [
      "................",
      ".....RRRRR......",
      "....RRRRRRRRR...",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "....BBRRBB......",
      "...BBBRRBBB.....",
      "...BBBRRRRBB....",
      "...SSRRRRRRSS...",
      "...SSRRRRRRSS...",
      "....RRRRRR......",
      "....BBBB........",
      "...BBBB.........",
    ]},
    smWalk3: { pal: 'mario', rows: [
      "................",
      ".....RRRRR......",
      "....RRRRRRRRR...",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "....BBRRBB......",
      "...BBBRRBBB.....",
      "..BBBBRRRRBB....",
      "..SSBRRRRRRR....",
      "..SSRRRRRRRR....",
      ".....RRRRRR.....",
      "......BBBB......",
      ".....BBBBB......",
    ]},
    smJump: { pal: 'mario', rows: [
      "..........SSS...",
      ".....RRRRRSS....",
      "....RRRRRRRR....",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "..BBBBRRBBB.....",
      ".BBBBBRRRBBBB...",
      ".SSBBRRRRRBBB...",
      ".SSBRRRRRRRRR...",
      "..RRRRRRRRRR....",
      ".RRRRR..RRRR....",
      ".BBB.....BBBB...",
      "BBBB......BBB...",
    ]},
    smSkid: { pal: 'mario', rows: [
      "................",
      ".....RRRRR......",
      "....RRRRRRRRR...",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "...SSBBRRBB.....",
      "..SSBBBRRBBB....",
      "..SSBBRRRRBBBB..",
      "...BBRRRRRRBSS..",
      "....RRRRRRRRSS..",
      "....RRR..RRR....",
      "...BBB...BBBB...",
      "..BBBB....BBB...",
    ]},
    smDie: { pal: 'mario', rows: [
      "................",
      "....RRRRRR......",
      "...RRRRRRRR.....",
      "...BBSSSSBB.....",
      "..BSBSSSSBSB....",
      "..BSBSSSSBSB....",
      "..BBSSSSSSBB....",
      "...SBBBBBBS.....",
      ".SS..RRRR..SS...",
      ".SSBRRRRRRBSS...",
      ".SSBRRRRRRBSS...",
      "..BBRRRRRRBB....",
      "....RRRRRR......",
      "...RRR..RRR.....",
      "...BBB..BBB.....",
      "..BBBB..BBBB....",
    ]},
    smClimb: { pal: 'mario', rows: [
      "..........SS....",
      ".....RRRRRSS....",
      "....RRRRRRRR....",
      "....BBBSSBS.....",
      "...BSBSSSBSSS...",
      "...BSBBSSSBSSS..",
      "...BBSSSSBBBB...",
      ".....SSSSSSS....",
      "....BBRRBBSS....",
      "...BBBRRBBSS....",
      "...BBRRRRBB.....",
      "...BRRRRRRB.....",
      "....RRRRRR......",
      "....RRR.RRR.....",
      "...BBB..BBBB....",
      "..BBBB..........",
    ]},

    // ---- 大马里奥（16x32）----
    bgStand: { pal: 'mario', rows: [
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "....BBBRRBBB....",
      "...BBBBRRBBBB...",
      "..BBBBRRRRBBBB..",
      "..BBBBRRRRBBBB..",
      "..BBBRRRRRRBBB..",
      "..BBBRRRRRRBBB..",
      "..SSBRRRRRRBSS..",
      "..SSRRRRRRRRSS..",
      "..SSRRRRRRRRSS..",
      "...SRRRRRRRRS...",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRR..RRR....",
      "....RRR..RRR....",
      "....RRR..RRR....",
      "....RRR..RRR....",
      "....RRR..RRR....",
      "...BBBB..BBBB...",
      "..BBBBB..BBBBB..",
      "...BBB....BBB...",
    ]},
    bgWalk1: { pal: 'mario', rows: [
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "....BBBRRBBBSS..",
      "...BBBBRRBBBSS..",
      "..BBBBRRRRBBSS..",
      "..BBBBRRRRBBBSS.",
      "..BBBRRRRRRBBSS.",
      "..BBBRRRRRRBBB..",
      "..SSBRRRRRRBBB..",
      "..SSRRRRRRRR....",
      "...SRRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "...RRRR.RRRR....",
      "...RRRR..RRRR...",
      "..RRRR...RRRR...",
      "..RRR.....RRR...",
      "..RRR.....RRR...",
      ".RRRR.....RRR...",
      ".BBBB.....BBBB..",
      "BBBBB.....BBBBB.",
      "BBBB.......BBB..",
    ]},
    bgWalk2: { pal: 'mario', rows: [
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "....BBBRRBBB....",
      "...BBBBRRBBBB...",
      "...BBBBRRBBBB...",
      "...BBBRRRRBBB...",
      "...BBBRRRRBBB...",
      "...SSBRRRRBSS...",
      "...SSRRRRRRSS...",
      "...SSRRRRRRSS...",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRR.....",
      "....RRRRRRR.....",
      "....RRRRRR......",
      "....RRRRRR......",
      "....RRRRR.......",
      "....RRRRR.......",
      "....BBBB........",
      "....BBBB........",
      "...BBBBB........",
      "..BBBBBB........",
      "..BBBBB.........",
    ]},
    bgWalk3: { pal: 'mario', rows: [
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "....BBBRRBBB....",
      "...BBBBRRBBBB...",
      "..BBBBRRRRBBBB..",
      "..BBBBRRRRBBBB..",
      "..BBBRRRRRRBBB..",
      "..BBBRRRRRRBBB..",
      "..SSBRRRRRRBSS..",
      "..SSRRRRRRRRSS..",
      "...SRRRRRRRRS...",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRR.....",
      "....RRRRRRR.....",
      "....RRRRRR......",
      "....RRRRRR......",
      "....RRRRR.......",
      "....RRRRR.......",
      "....BBBBB.......",
      "...BBBBBBB......",
      "...BBBBBB.......",
    ]},
    bgJump: { pal: 'mario', rows: [
      "..........SSS...",
      ".....RRRRRSSS...",
      "....RRRRRRRRSS..",
      "....RRRRRRRRR...",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "...BBBBRRBBB....",
      "..BBBBBRRBBBB...",
      ".BBBBBBRRRRBB...",
      ".SSBBBRRRRRRB...",
      ".SSBBRRRRRRRRR..",
      ".SSBRRRRRRRRRR..",
      "..BBRRRRRRRRR...",
      "...RRRRRRRRRR...",
      "...RRRRRRRRR....",
      "...RRRRRRRRR....",
      "..RRRRRR.RRRR...",
      "..RRRRR..RRRR...",
      "..RRRR...RRRR...",
      ".RRRR.....RRR...",
      ".RRR......RRRR..",
      ".RRR......RRRR..",
      ".BBBB......RRR..",
      "BBBBB.....BBBB..",
      "BBBB......BBBBB.",
      "..........BBBB..",
      "..........BBB...",
    ]},
    bgSkid: { pal: 'mario', rows: [
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "...SSBBBRRBBB...",
      "..SSBBBBRRBBBB..",
      ".SSBBBBRRRRBBBB.",
      ".SSBBBBRRRRBBBB.",
      "..BBBRRRRRRBBB..",
      "..BBBRRRRRRBBB..",
      "..BBBRRRRRRBSS..",
      "...RRRRRRRRRSS..",
      "...RRRRRRRRSS...",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRR.RRRR...",
      "...RRRR...RRR...",
      "...RRR....RRRR..",
      "...RRR....RRRR..",
      "..BBBB.....RRR..",
      ".BBBBB....BBBB..",
      "BBBBB....BBBBB..",
      "BBBB......BBBBB.",
      "...........BBB..",
    ]},
    bgCrouch: { pal: 'mario', rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".....RRRRRR.....",
      "....RRRRRRRRRR..",
      "....RRRRRRRRRR..",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "...BBBBRRBBBB...",
      "..BBBBRRRRBBBB..",
      "..BBBRRRRRRBBB..",
      "..SSBRRRRRRBSS..",
      "..SSRRRRRRRRSS..",
      "...RRRRRRRRRR...",
      "...RRRRRRRRRR...",
      "...RRRR..RRRR...",
      "..BBBBB..BBBBB..",
      "..BBBBB..BBBBB..",
      "...BBB....BBB...",
    ]},
    bgClimb: { pal: 'mario', rows: [
      "...........SS...",
      "...........SS...",
      ".....RRRRRRSS...",
      "....RRRRRRRRR...",
      "....RRRRRRRRR...",
      ".....BBBSSBS....",
      "....BBSSSSBSSS..",
      "....BSBSSSBSSS..",
      "....BSBBSSSBSSS.",
      "....BSBBSSSSBSS.",
      "....BBSSSSSBBBB.",
      "......SSSSSSSS..",
      "....BBBRRBBSS...",
      "...BBBBRRBBSS...",
      "..BBBBRRRRBBS...",
      "..BBBRRRRRRBS...",
      "..BBBRRRRRRBB...",
      "..SSBRRRRRRB....",
      "..SSRRRRRRRR....",
      "...SRRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRRR....",
      "....RRRRRRR.....",
      "....RRRRRRR.....",
      "....RRRRRR......",
      "....RRRRRR......",
      "....RRRR.RR.....",
      "...BBBB..RR.....",
      "..BBBBB..BBB....",
      "..BBBB...BBBB...",
      "..........BBB...",
    ]},

    // ---- 敌人 ----
    goomba: { pal: 'goomba', rows: [
      "................",
      "......GGGG......",
      "....GGGGGGGG....",
      "...GGGGGGGGGG...",
      "..GGWWGGGGWWGG..",
      ".GKWWWGGGGWWWKG.",
      ".GKWWWGGGGWWWKG.",
      "GGKWWWGGGGWWWKGG",
      "GGGGGGGGGGGGGGGG",
      "GGGGGGGGGGGGGGGG",
      ".GGGGGGGGGGGGGG.",
      "..CCCCCCCCCCCC..",
      "..CCCCCCCCCCCC..",
      ".KKKKKC..CKKKKK.",
      ".KKKKK....KKKKK.",
      "..KKK......KKK..",
    ]},
    goombaFlat: { pal: 'goomba', rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "..GGGGGGGGGGGG..",
      ".GGWWGGGGGGWWGG.",
      "GGKWWGGGGGGWWKGG",
      "GGGGGGGGGGGGGGGG",
      ".KCCCCCCCCCCCCK.",
      ".KKKKKKKKKKKKKK.",
    ]},
    koopa1: { pal: 'koopa', rows: [
      "..........CCC...",
      ".........CCCCC..",
      ".........CWKCC..",
      ".........CCCCC..",
      "..........CCC...",
      "...GGGGGG.CC....",
      "..GGGGGGGGCC....",
      ".GGLGGLGGLGG....",
      ".GLLGGLLGGLG....",
      ".GLGGLLGGLLG....",
      ".GGLGGLLGGLG....",
      ".GLLGGLLGGLG....",
      ".GGLGGLLGGLG....",
      ".GLLGGLLGGLG....",
      ".GGLGGLLGGLG....",
      "..GGLLGGLLGG....",
      "..GGGGGGGGGG....",
      ".WWWWWWWWWWWW...",
      "..CCC....CCC....",
      "..CCC....CCC....",
      "..CCC....CCC....",
      ".CCCC....CCCC...",
      ".CCC......CCC...",
      "................",
    ]},
    koopa2: { pal: 'koopa', rows: [
      "..........CCC...",
      ".........CCCCC..",
      ".........CWKCC..",
      ".........CCCCC..",
      "..........CCC...",
      "...GGGGGG.CC....",
      "..GGGGGGGGCC....",
      ".GGLGGLGGLGG....",
      ".GLLGGLLGGLG....",
      ".GLGGLLGGLLG....",
      ".GGLGGLLGGLG....",
      ".GLLGGLLGGLG....",
      ".GGLGGLLGGLG....",
      ".GLLGGLLGGLG....",
      ".GGLGGLLGGLG....",
      "..GGLLGGLLGG....",
      "..GGGGGGGGGG....",
      ".WWWWWWWWWWWW...",
      "...CCC..CCC.....",
      "...CCC...CCC....",
      "..CCCC...CCC....",
      "..CCC....CCCC...",
      "..CCC.....CCC...",
      "................",
    ]},
    shell: { pal: 'koopa', rows: [
      "................",
      "................",
      "....GGGGGGGG....",
      "..GGGGGGGGGGGG..",
      ".GGLGGLGGLGGLGG.",
      ".GLLGGLLGGLLGG..",
      ".GLGGLLGGLLGGL..",
      ".GGLGGLLGGLLGG..",
      ".GLLGGLLGGLLGG..",
      ".GGLGGLLGGLLGG..",
      "..GGGGGGGGGGGG..",
      ".WWWWWWWWWWWWWW.",
      "..WWWWWWWWWWWW..",
      "..WWWWWWWWWWWW..",
      "................",
      "................",
    ]},
    shellWake: { pal: 'koopa', rows: [
      "................",
      "................",
      "....GGGGGGGG....",
      "..GGGGGGGGGGGG..",
      ".GGLGGLGGLGGLGG.",
      ".GLLGGLLGGLLGG..",
      ".GLGGLLGGLLGGL..",
      ".GGLGGLLGGLLGG..",
      ".GLLGGLLGGLLGG..",
      ".GGLGGLLGGLLGG..",
      "..GGGGGGGGGGGG..",
      ".WWWWWWWWWWWWWW.",
      "..WWWWWWWWWWWW..",
      "...CC..CC..CC...",
      "...CC..CC..CC...",
      "................",
    ]},

    // ---- 道具 ----
    mushroom: { pal: 'item', rows: [
      "................",
      "................",
      ".....RRRRRR.....",
      "...RRRWWWWRRR...",
      "..RRRWWWWWWRRR..",
      ".RRRRWWWWWWRRRR.",
      ".WWRRWWWWWWRRWW.",
      "WWWWRRWWWWRRWWWW",
      "WWWWRRRRRRRRWWWW",
      ".WWRRRRRRRRRRWW.",
      "..CCCCCCCCCCCC..",
      "..CCKCCCCCCKCC..",
      "..CCKCCCCCCKCC..",
      "..CCCCCCCCCCCC..",
      "...CCCCCCCCCC...",
      "....CCCCCCCC....",
    ]},
    flower: { pal: 'flower', rows: [
      "................",
      "....PPPPPPPP....",
      "...PPPWWWWPPP...",
      "...PPWWWWWWPP...",
      "...PPWWWWWWPP...",
      "...PPPWWWWPPP...",
      "....PPPPPPPP....",
      ".......GG.......",
      "..LLL..GG..LLL..",
      ".LLLLL.GG.LLLLL.",
      ".LLLLL.GG.LLLLL.",
      "..LLLL.GG.LLLL..",
      "....LL.GG.LL....",
      ".......GG.......",
      ".......GG.......",
      ".......GG.......",
    ]},
    starItem: { pal: 'star', rows: [
      "................",
      ".......YY.......",
      ".......YY.......",
      "..YYYYYYYYYYYY..",
      "...YYYYYYYYYY...",
      "....YYYYYYYY....",
      "....YYKYYKYY....",
      ".....YYYYYY.....",
      ".....YYYYYY.....",
      "....YYYYYYYY....",
      "...YYYY..YYYY...",
      "..YYY......YYY..",
      "..YY........YY..",
      "................",
      "................",
      "................",
    ]},
    coin1: { pal: 'coin', rows: [
      "................",
      "......OOOO......",
      ".....OYYYYO.....",
      "....OYYYYYYO....",
      "....OYYOOYYO....",
      "....OYYOOYYO....",
      "....OYYOOYYO....",
      "....OYYOOYYO....",
      "....OYYOOYYO....",
      "....OYYOOYYO....",
      "....OYYYYYYO....",
      ".....OYYYYO.....",
      "......OOOO......",
      "................",
      "................",
      "................",
    ]},
    coin2: { pal: 'coin', rows: [
      "................",
      ".......OO.......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      "......OYYO......",
      ".......OO.......",
      "................",
      "................",
      "................",
    ]},
    coin3: { pal: 'coin', rows: [
      "................",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      "................",
      "................",
      "................",
    ]},

    // ---- 方块 ----
    brick: { pal: 'block', rows: [
      "LLLLLLLBLLLLLLLB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "AAABAAAAAAAABAAA",
      "BBBBBBBBBBBBBBBB",
    ]},
    ground: { pal: 'block', rows: [
      "LLLLLLLBLLLLLLLB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "AAAAAAABAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
    ]},
    solid: { pal: 'block', rows: [
      "LLLLLLLLLLLLLLLB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "LAAAAAAAAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
    ]},
    used: { pal: 'used', rows: [
      "BBBBBBBBBBBBBBBB",
      "BAAAAAAAAAAAAAAB",
      "BABAAAAAAAAAABAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BABAAAAAAAAAABAB",
      "BAAAAAAAAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
    ]},
    qblock: { pal: 'q1', rows: [
      "BBBBBBBBBBBBBBBB",
      "BAAAAAAAAAAAAAAB",
      "BABAAAAAAAAAABAB",
      "BAAAAWWWWAAAAAAB",
      "BAAAWWWWWWWAAAAB",
      "BAAAWWAAWWWAAAAB",
      "BAAAAAAAWWWAAAAB",
      "BAAAAAAAWWAAAAAB",
      "BAAAAAAWWAAAAAAB",
      "BAAAAAAWWAAAAAAB",
      "BAAAAAAAAAAAAAAB",
      "BAAAAAAWWAAAAAAB",
      "BAAAAAAWWAAAAAAB",
      "BABAAAAAAAAAABAB",
      "BAAAAAAAAAAAAAAB",
      "BBBBBBBBBBBBBBBB",
    ]},

  };

  // fireball（8x8）
  D.fireball = { pal: 'fireball', rows: [
    "..OOO...",
    ".OOWWO..",
    "OOWWWRO.",
    "OWWWRRO.",
    "OWRRRRO.",
    ".ORRRO..",
    "..OOO...",
    "........",
  ]};
  PAL.fireball = { O: '#fc9838', W: '#fcfcfc', R: '#d82800' };

  D.frag = { pal: 'block', rows: [
    "AAAAA...",
    "AAAAAA..",
    "AAAAAL..",
    ".AAAA...",
    "..AA....",
    "........",
    "........",
    "........",
  ]};

  D.poof1 = { pal: 'fireball', rows: [
    "..OO....",
    ".OOOO...",
    "OOWWOO..",
    "OOWWOO..",
    ".OOOO...",
    "..OO....",
    "........",
    "........",
  ]};
  D.poof2 = { pal: 'fireball', rows: [
    "O..O..O.",
    ".O.O.O..",
    "..OOO...",
    ".OOOOO..",
    "..OOO...",
    ".O.O.O..",
    "O..O..O.",
    "........",
  ]};

  // ---------------- 烘焙 ----------------
  const C = {};   // name -> { variant -> {n: canvas, f: canvas} }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  function bakeRows(rows, palName) {
    const pal = PAL[palName] || {};
    const w = rows[0].length, h = rows.length;
    const [c, x] = makeCanvas(w, h);
    for (let r = 0; r < h; r++) {
      const row = rows[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i, r, 1, 1);
      }
    }
    return c;
  }

  function flipH(c) {
    const [f, x] = makeCanvas(c.width, c.height);
    x.translate(c.width, 0);
    x.scale(-1, 1);
    x.drawImage(c, 0, 0);
    return f;
  }

  function register(name, canvas, variants, flips) {
    C[name] = C[name] || {};
    C[name][canvas.variantKey || ''] = { n: canvas, f: flips ? flipH(canvas) : null };
  }

  // 带变体注册：variantMap: { variantName: palName }
  function bakeDef(name, def, variantMap, flips) {
    C[name] = {};
    for (const vk in variantMap) {
      const c = bakeRows(def.rows, variantMap[vk]);
      C[name][vk] = { n: c, f: flips ? flipH(c) : null };
    }
  }

  // ---- 马里奥（普通/火焰/无敌闪烁）----
  const MARIO_SMALL = ['smStand','smWalk1','smWalk2','smWalk3','smJump','smSkid','smDie','smClimb'];
  const MARIO_BIG   = ['bgStand','bgWalk1','bgWalk2','bgWalk3','bgJump','bgSkid','bgCrouch','bgClimb'];
  const MVAR = { '': 'mario', fire: 'fire', starA: 'starA', starB: 'starB' };
  MARIO_SMALL.concat(MARIO_BIG).forEach(n => bakeDef(n, D[n], MVAR, true));

  // ---- 敌人 ----
  bakeDef('goomba', D.goomba, { '': 'goomba' }, true);
  bakeDef('goombaFlat', D.goombaFlat, { '': 'goomba' }, false);
  bakeDef('koopa1', D.koopa1, { '': 'koopa' }, true);
  bakeDef('koopa2', D.koopa2, { '': 'koopa' }, true);
  bakeDef('shell', D.shell, { '': 'koopa' }, false);
  bakeDef('shellWake', D.shellWake, { '': 'koopa' }, false);

  // ---- 道具 ----
  bakeDef('mushroom', D.mushroom, { '': 'item', oneup: 'oneup' }, false);
  bakeDef('flower', D.flower, { '': 'flower', alt: 'flower2' }, false);
  bakeDef('starItem', D.starItem, { '': 'star', alt: 'star2' }, false);
  bakeDef('coin1', D.coin1, { '': 'coin' }, false);
  bakeDef('coin2', D.coin2, { '': 'coin' }, false);
  bakeDef('coin3', D.coin3, { '': 'coin' }, false);

  // ---- 方块（含地下蓝色变体）----
  bakeDef('brick', D.brick, { '': 'block', ug: 'blockUG' }, false);
  bakeDef('ground', D.ground, { '': 'block', ug: 'blockUG' }, false);
  bakeDef('solid', D.solid, { '': 'block', ug: 'blockUG' }, false);
  bakeDef('used', D.used, { '': 'used', ug: 'usedUG' }, false);
  bakeDef('qblock', D.qblock, { '1': 'q1', '2': 'q2', '3': 'q3' }, false);

  // ---- 杂项 ----
  bakeDef('fireball', D.fireball, { '': 'fireball' }, false);
  bakeDef('frag', D.frag, { '': 'block', ug: 'blockUG' }, false);
  bakeDef('poof1', D.poof1, { '': 'fireball' }, false);
  bakeDef('poof2', D.poof2, { '': 'fireball' }, false);

  // ---------------- 程序化图形 ----------------
  const P = PAL.pipe;

  function pipeTiles() {
    // 顶盖 32x16，管身 28x16（左右各内缩 2px）
    const [top, tx] = makeCanvas(32, 16);
    // 顶盖
    tx.fillStyle = P.B; tx.fillRect(0, 0, 32, 16);
    tx.fillStyle = P.L; tx.fillRect(1, 1, 3, 14);
    tx.fillStyle = P.G; tx.fillRect(4, 1, 22, 14);
    tx.fillStyle = P.D; tx.fillRect(26, 1, 4, 14);
    tx.fillStyle = P.B; tx.fillRect(30, 1, 1, 14);
    tx.fillStyle = P.B; tx.fillRect(0, 14, 32, 2);
    const [tl, tlx] = makeCanvas(16, 16); tlx.drawImage(top, 0, 0);
    const [tr, trx] = makeCanvas(16, 16); trx.drawImage(top, -16, 0);
    const [body, bx] = makeCanvas(32, 16);
    bx.fillStyle = P.B; bx.fillRect(0, 0, 32, 16);
    bx.fillStyle = P.L; bx.fillRect(3, 0, 3, 16);
    bx.fillStyle = P.G; bx.fillRect(6, 0, 20, 16);
    bx.fillStyle = P.D; bx.fillRect(26, 0, 3, 16);
    const [bl, blx] = makeCanvas(16, 16); blx.drawImage(body, -2, 0);
    const [br, brx] = makeCanvas(16, 16); brx.drawImage(body, -18, 0);
    return { tl, tr, bl, br };
  }

  function poleTile() {
    const [c, x] = makeCanvas(16, 16);
    x.fillStyle = PAL.pole.L; x.fillRect(7, 0, 1, 16);
    x.fillStyle = PAL.pole.G; x.fillRect(8, 0, 1, 16);
    return c;
  }
  function poleBall() {
    const [c, x] = makeCanvas(16, 16);
    x.fillStyle = PAL.pole.G;
    x.beginPath(); x.arc(8, 10, 5, 0, Math.PI * 2); x.fill();
    x.fillStyle = PAL.pole.L;
    x.beginPath(); x.arc(7, 9, 3, 0, Math.PI * 2); x.fill();
    return c;
  }
  function flagSprite() {
    const [c, x] = makeCanvas(16, 16);
    x.fillStyle = '#00a800';
    for (let r = 0; r < 16; r++) {
      const extent = Math.max(0, 15 - Math.abs(2 * r - 15));
      x.fillRect(15 - extent, r, extent, 1);
    }
    return c;
  }

  function cloudSprite(w, h, fill, line) {
    const [c, x] = makeCanvas(w, h);
    const cx = w / 2, cy = h / 2 + 2;
    function blob(col, pad) {
      x.fillStyle = col;
      const r = h / 2 - 1 - pad;
      x.beginPath();
      x.arc(cx - w * 0.28, cy + 2, r * 0.72, 0, 7);
      x.arc(cx + w * 0.28, cy + 2, r * 0.72, 0, 7);
      x.arc(cx, cy - 2, r, 0, 7);
      x.fill();
      x.fillRect(cx - w * 0.4, cy, w * 0.8, r);
    }
    blob(line, 0);
    blob(fill, 1.5);
    return c;
  }

  function hillSprite(w, h) {
    const [c, x] = makeCanvas(w, h);
    x.fillStyle = '#00a800';
    x.beginPath();
    x.moveTo(0, h);
    x.quadraticCurveTo(w / 2, -h * 0.7, w, h);
    x.closePath(); x.fill();
    // 深色斑点
    x.fillStyle = '#005800';
    [[0.3, 0.55], [0.7, 0.55], [0.5, 0.8]].forEach(([fx, fy]) => {
      const px = w * fx, py = h * fy;
      x.fillRect(px - 2, py, 2, 2); x.fillRect(px + 1, py - 2, 2, 2);
      x.fillRect(px - 2, py - 3, 1, 2); x.fillRect(px + 2, py + 1, 1, 2);
    });
    return c;
  }

  function castleSprite() {
    const [c, x] = makeCanvas(80, 80);
    const A = '#c84c0c', L = '#fc9838', B = '#000000';
    function bricks(px, py, w, h) {
      x.fillStyle = A; x.fillRect(px, py, w, h);
      x.fillStyle = B;
      for (let yy = py + 7; yy < py + h; yy += 8) x.fillRect(px, yy, w, 1);
      for (let yy = py, row = 0; yy < py + h; yy += 8, row++) {
        for (let xx = px + (row % 2 ? 3 : 7); xx < px + w; xx += 8) x.fillRect(xx, yy, 1, 7);
      }
      x.fillStyle = L; x.fillRect(px, py, w, 1);
    }
    function merlons(px, py, w) {
      for (let xx = px; xx < px + w; xx += 16) bricks(xx, py, 8, 8);
    }
    // 上塔
    merlons(24, 8, 32);
    bricks(24, 16, 32, 24);
    // 主体
    merlons(0, 40, 80);
    bricks(0, 48, 80, 32);
    // 窗
    x.fillStyle = B;
    x.fillRect(36, 20, 8, 12);           // 塔窗
    x.fillRect(8, 56, 8, 10); x.fillRect(64, 56, 8, 10);
    // 门
    x.fillRect(32, 62, 16, 18);
    x.beginPath(); x.arc(40, 62, 8, Math.PI, 0); x.fill();
    return c;
  }

  function hudCoin() {
    const [c, x] = makeCanvas(8, 8);
    x.fillStyle = '#c84c0c'; x.fillRect(2, 0, 4, 8); x.fillRect(1, 1, 6, 6);
    x.fillStyle = '#fcb830'; x.fillRect(2, 1, 4, 6); x.fillRect(3, 0, 2, 8);
    return c;
  }

  const pipes = pipeTiles();
  const proc = {
    pipeTL: pipes.tl, pipeTR: pipes.tr, pipeBL: pipes.bl, pipeBR: pipes.br,
    pole: poleTile(), poleBall: poleBall(), flag: flagSprite(),
    cloud1: cloudSprite(32, 24, '#fcfcfc', '#3cbcfc'),
    cloud2: cloudSprite(48, 24, '#fcfcfc', '#3cbcfc'),
    bush3: cloudSprite(48, 16, '#80d010', '#005800'),
    bush2: cloudSprite(32, 16, '#80d010', '#005800'),
    bush1: cloudSprite(24, 16, '#80d010', '#005800'),
    hillBig: hillSprite(80, 34),
    hillSmall: hillSprite(48, 18),
    castle: castleSprite(),
    hudCoin: hudCoin(),
  };
  for (const k in proc) {
    C[k] = { '': { n: proc[k], f: null } };
  }

  // 旋转火球（4 帧）
  {
    const base = C.fireball[''].n;
    C.fireballRot = [];
    for (let i = 0; i < 4; i++) {
      const [c, x] = makeCanvas(8, 8);
      x.translate(4, 4); x.rotate(i * Math.PI / 2); x.translate(-4, -4);
      x.drawImage(base, 0, 0);
      C.fireballRot.push(c);
    }
  }

  // ---------------- API ----------------
  function get(name, variant, flip) {
    const e = C[name];
    if (!e) return null;
    const v = e[variant || ''] || e[''];
    return flip ? (v.f || v.n) : v.n;
  }

  function all() {
    const out = [];
    for (const n in C) {
      for (const v in C[n]) out.push({ name: n + (v ? ':' + v : ''), canvas: C[n][v].n });
    }
    return out;
  }

  return { get, all, PAL, fireballRot: C.fireballRot };
})();
