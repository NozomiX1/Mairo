/* =============================================================================
 * sprites.js  -  hand-authored pixel art for the whole game.
 *
 * Every sprite is a list of equal-length strings. Each character is either '.'
 * (fully transparent) or an index into the sprite's palette. All frames are
 * authored facing LEFT and registered together with an automatic
 * horizontally-mirrored copy named '#<name>'.
 *
 * Small Mario is 16x16, big Mario 16x32, both anchored bottom-centre.
 * ========================================================================== */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- palette
  const P = {
    K: '#3a1400', // outline / near black
    R: '#d82800', // mario red
    F: '#fc9838', // fire mario orange
    S: '#fcbcb0', // skin
    T: '#a44c00', // hair / shoes brown
    B: '#0058f8', // overalls blue
    W: '#fcfcfc', // white
    Y: '#fcd800', // yellow
    O: '#c84c0c', // brick / goomba brown
    D: '#5c2c10', // dark brown
    G: '#00a800', // green
    L: '#58d854', // light green
    E: '#d8d8d8', // light gray
    C: '#9c6b3f', // goomba body
    V: '#883000', // brick shadow
    H: '#f83800', // bright red / orange
    Z: '#a8a8a8'  // stone gray
  };

  // ------------------------------------------------------------------ helpers
  function mirror(frame) {
    return frame.map((r) => r.split('').reverse().join(''));
  }

  /* =========================================================================
   * SMALL MARIO (16x16) - HEAD rows 0..8, BODY rows 9..15
   * ====================================================================== */

  const SM_HEAD = [
    '....RRRRR.......',
    '...RRRRRRRRR....',
    '..TTTSSSKKSS....',
    '..TTSSSSKKSSS...',
    '.TTSSSSSKKSSS...',
    '..TSSSSSSSSS....',
    '...SSSSSSSS.....',
    '....TTTTT.......'
  ];

  const SM = {};

  SM.idle = SM_HEAD.concat([
    '...RRBRRRBRR....',
    '..RRRBRRRBRRR...',
    '..SSRBBBBBBRSS..',
    '..SSBBBBBBBSS...',
    '....BBB.BBB.....',
    '...TTT...TTT....',
    '...TTTT.TTTT....',
    '...KKK...KKK....'
  ]);

  // walk step A - feet planted, about to push off
  SM.walk0 = SM_HEAD.concat([
    '...RRBRRRBRR....',
    '..RRRBRRRBRRR...',
    '..SSRBBBBBBRSS..',
    '...SBBBBBBBS....',
    '....BBB.BBB.....',
    '...TTT..BBBB....',
    '..TTTT..TTTT....',
    '..KKK....KKK....'
  ]);

  // walk step B - rear foot lifted
  SM.walk1 = SM_HEAD.concat([
    '...RRBRRRBRR....',
    '..RRRBRRRBRRR...',
    '..SSRBBBBBBRSS..',
    '...SBBBBBBBS....',
    '....BBB.BBB.....',
    '....BTB.BBB.....',
    '...TTTT.TTTT....',
    '....KK...TTT....'
  ]);

  SM.jump = SM_HEAD.concat([
    '.SSRRBRRRBRR....',
    '.SSRRBRRRBRRR...',
    'SSSRRBBBBBBRSS..',
    '..SSBBBBBBBSS...',
    '....BBB..BBB....',
    '...TTT...BBBB...',
    '..TTTT...TTTT...',
    '..KKK.....KKK...'
  ]);

  SM.skid = SM_HEAD.concat([
    '..SSRRBRRRBRR...',
    '..SSRRBRRRBRRR..',
    '...SBBBBBBBBRSS.',
    '....BBBBBBBBSS..',
    '....BBB.BBB.....',
    '...TTTT.BBBB....',
    '..TTTTT.TTTT....',
    '..KKKK...KKK....'
  ]);

  // dead - arms thrown up
  SM.dead = SM_HEAD.concat([
    '.SSRRBRRRBRRSS..',
    'SSSRRBRRRBRRSSS.',
    'SSSSBBBBBBBSSS..',
    '..SS.BBBBBBB.SS.',
    '.....BBB.BBB....',
    '....TTT...TTT...',
    '...TTTT...TTTT..',
    '...KKK.....KKK..'
  ]);

  /* =========================================================================
   * BIG MARIO (16x32) - HEAD rows 0..13, BODY rows 14..31
   * ====================================================================== */

  const BIG_HEAD = [
    '....RRRRR.......',
    '...RRRRRRRRR....',
    '..TTTSSSKKSS....',
    '..TTSSSSKKSSS...',
    '.TTSSSSSKKSSS...',
    '.TTSSSSSSSSSS...',
    '..TSSSSSSSSS....',
    '...SSSSSSSS.....',
    '..SSSSSSSSSS....',
    '.SSSSSSSSSSSS...',
    'SSSSSSSSSSSSSS..',
    '.SSSSSSSSSSSS...',
    '..SSSSSSSSSS....',
    '...SSSSSSSS.....'
  ];

  const BIG_BODY = {
    idle: [
      '..TTTTTRRTTTT...',
      '..RRRRRRRRRRR...',
      '..RRRRRRRRRRR...',
      '.SSRRRRRRRRRSS..',
      '.SSRBBBBBBBRSS..',
      '.SSRBBBBBBBRSS..',
      '..SBBBBBBBBB....',
      '...BBBBBBBBB....',
      '...BBBB.BBBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '..BBBB...BBBB...',
      '..BBBB...BBBB...',
      '..TTTT...TTTT...',
      '.TTTTT...TTTTT..',
      '.KKKKK...KKKKK..'
    ],
    walk0: [
      '..TTTTTRRTTTT...',
      '..RRRRRRRRRRR...',
      '..RRRRRRRRRRR...',
      '.SSRRRRRRRRRSS..',
      '.SSRBBBBBBBRSS..',
      '.SSRBBBBBBBRSS..',
      '..SBBBBBBBBB....',
      '...BBBBBBBBB....',
      '...BBB..BBBB....',
      '..BBB....BBB....',
      '..BBB....BBB....',
      '..BBB....BBB....',
      '.BBB.....BBB....',
      '.BBB.....BBBB...',
      'BBBB.....BBBB...',
      'TTTT.....TTTT...',
      'TTTTT....TTTTT..',
      'KKKK......KKK...'
    ],
    walk1: [
      '..TTTTTRRTTTT...',
      '..RRRRRRRRRRR...',
      '..RRRRRRRRRRR...',
      '.SSRRRRRRRRRSS..',
      '.SSRBBBBBBBRSS..',
      '.SSRBBBBBBBRSS..',
      '..SBBBBBBBBB....',
      '...BBBBBBBBB....',
      '...BBBB.BBBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '...BBB...BBB....',
      '..BBBB...BBBB...',
      '..BBB.....BBB...',
      '..TTTT...TTTT...',
      '.TTTTT...TTTT...',
      '.KKKK....KKKK...'
    ],
    jump: [
      '..TTTTTRRTTTT...',
      '..RRRRRRRRRRR...',
      '..RRRRRRRRRRR...',
      '.SSRRRRRRRRRSS..',
      '.SSRBBBBBBBRSS..',
      '.SSRBBBBBBBRSS..',
      '..SBBBBBBBBB....',
      '...BBBBBBBBB....',
      '...BBB...BBB....',
      '..BBB.....BBB...',
      '..BBB.....BBB...',
      '..BBB.....BBB...',
      '.BBBB.....BBBB..',
      '.BBB......BBBB..',
      'BBBB......TTTT..',
      'TTTT......TTTTT.',
      'TTTT.......KKK..',
      '.KKK............'
    ],
    skid: [
      '..TTTTTRRTTTT...',
      '..RRRRRRRRRRR...',
      '.SRRRRRRRRRRRS..',
      'SSRRRRRRRRRRRSS.',
      'SSRBBBBBBBBBSS..',
      '.SRBBBBBBBBB....',
      '..BBBBBBBBBB....',
      '..BBBBBBBBBB....',
      '..BBBB.BBBBB....',
      '..BBBB.BBBBB....',
      '..BBBB.BBBB.....',
      '..BBBB.BBBB.....',
      '..BBBB.BBBB.....',
      '..BBBB..BBBB....',
      '..BBBB..BBBB....',
      '..TTTT..TTTT....',
      '.TTTTT..TTTTT...',
      '.KKKKK...KKKK...'
    ]
  };

  // Big mario crouching. The 22 art rows sit on the bottom of the 16x32
  // frame so the sprite bottom matches the 22px-tall crouch hitbox.
  const BIG_CROUCH = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....RRRRR.......',
    '...RRRRRRRRR....',
    '..TTTSSSKKSS....',
    '..TTSSSSKKSSS...',
    '.TTSSSSSKKSSS...',
    '.TTSSSSSSSSSS...',
    '..TSSSSSSSSS....',
    '...SSSSSSSS.....',
    '..SSSSSSSSSS....',
    '.SSSSSSSSSSSS...',
    'SSSSSSSSSSSSSS..',
    '.SSSSSSSSSSSS...',
    '..TTTTTRRTTTT...',
    '..RRRRRRRRRRR...',
    '.SSRRRRRRRRRSS..',
    '.SSRBBBBBBBRSS..',
    '..SBBBBBBBBBB...',
    '...BBBBBBBBBB...',
    '...BBBBBBBBBB...',
    '..BBBBB..BBBBB..',
    '..TTTTT..TTTTT..',
    '..KKKKK..KKKKK..'
  ];

  /* =========================================================================
   * GOOMBA (16x16)
   * ====================================================================== */

  const GOOMBA_BODY = [
    '.....OOOOOO.....',
    '...OOOOOOOOOO...',
    '..OOOOOOOOOOOO..',
    '.OOCCCOOOOCCCOO.',
    'OOOCCCCOOCCCCCOO',
    'OOOCCKCOOCCKCCOO',
    'OOOCCKCOOCCKCCOO',
    'OOOCCCCCCCCCCCOO',
    'OOOCCCCCCCCCCCOO',
    'OOOCCCCCCCCCCCOO',
    '.OOCCCCCCCCCCCO.',
    '..OOCCCCCCCCCO..',
    '..DDDDDDDDDDDD..'
  ];

  const GOOMBA = {
    walk0: GOOMBA_BODY.concat([
      '.DDDDDDDDDDDDDD.',
      'DDDDD......DDDDD',
      'EEEE........EEEE'
    ]),
    walk1: GOOMBA_BODY.concat([
      'DDDDDDDDDDDDDDDD',
      'DDDD........DDDD',
      'EEEE........EEEE'
    ]),
    flat: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..OOOOOOOOOOOO..',
      '.OOCCCCCCCCCCOO.',
      'OOOCCKCOOCCKCCOO',
      'DDDDDDDDDDDDDDDD',
      'EEEEEEEEEEEEEEEE'
    ]
  };

  /* =========================================================================
   * KOOPA TROOPA (16x24)
   * ====================================================================== */

  const KOOPA_SHELL = [
    '.....GGGGGG.....',
    '...GGGGGGGGGG...',
    '..GGLLGGGGLLGG..',
    '.GGLLLGGGGLLLGG.',
    'GGLLYLLGGLLYLLGG',
    'GGLLYLLGGLLYLLGG',
    'GGGLLLGGGGLLLGGG',
    'GGGGLLGGGGLLGGGG',
    '.GGGGGGGGGGGGGG.',
    '..GGGGGGGGGGGG..',
    '...WWWWWWWWWW...',
    '..WWWWWWWWWWWW..',
    '..YYYYYYYYYYYY..',
    '..KKKKKKKKKKKK..'
  ];

  const KOOPA_FEET_A = ['..WWWW....WWWW..', '..YYYY....YYYY..', '..KKKK....KKKK..'];
  const KOOPA_FEET_B = ['..WWWWWWWWWWWW..', '..YYYYYYYYYYYY..', '..KKKKKKKKKKKK..'];

  const KOOPA_HEAD = [
    '......GGGG......',
    '.....GGGGGG.....',
    '....GGWWGGGG....',
    '....GGWKGGGG....',
    '....GGGGGGGGG...',
    '....YYGGGGGG....',
    '.....GGGGGG.....'
  ];

  const PAD_ROWS = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push('................');
    return out;
  };

  const SHELL_ONLY = PAD_ROWS(8).concat(KOOPA_SHELL, PAD_ROWS(2)); // 24 rows
  const SPIN_SHELL = [
    '...GGLLGGLLGG...',
    '..GLLLGGGGLLLG..',
    '.GGLLYLLYYLLLGG.',
    'GGLLYYLLLLYYLLGG',
    'GGLYYLLLLLLYYLGG',
    'GGGLLYYLLYYLLGGG',
    'GGGGLLGGGGLLGGGG',
    '.GGGGGGGGGGGGGG.',
    '..GGGGGGGGGGGG..',
    '...WWWWWWWWWW...',
    '..WWWWWWWWWWWW..',
    '..YYYYYYYYYYYY..',
    '..KKKKKKKKKKKK..'
  ];

  const KOOPA = {
    walk0: KOOPA_HEAD.concat(KOOPA_SHELL, KOOPA_FEET_A),
    walk1: KOOPA_HEAD.concat(KOOPA_SHELL, KOOPA_FEET_B),
    shell: SHELL_ONLY,
    shellSpin: PAD_ROWS(8).concat(SPIN_SHELL, PAD_ROWS(3)),
    flip: [
      '..KKKK....KKKK..',
      '..YYYY....YYYY..',
      '..WWWW....WWWW..',
      '................',
      KOOPA_SHELL[13],
      KOOPA_SHELL[12],
      KOOPA_SHELL[11],
      KOOPA_SHELL[10],
      KOOPA_SHELL[9],
      KOOPA_SHELL[8],
      KOOPA_SHELL[7],
      KOOPA_SHELL[6],
      KOOPA_SHELL[5],
      KOOPA_SHELL[4],
      KOOPA_SHELL[3],
      KOOPA_SHELL[2],
      KOOPA_SHELL[1],
      KOOPA_SHELL[0],
      '......GGGG......',
      '.....GGGGGG.....',
      '.....GGWKGGGG...',
      '.....GGWWGGGG...',
      '......GGGGGG....',
      '.......GGGG.....'
    ]
  };

  /* =========================================================================
   * ITEMS
   * ====================================================================== */

  const MUSHROOM = [
    '.....KKKKKK.....',
    '...KKRRRRRRKK...',
    '..KRRWWWWWWRRK..',
    '.KRRWWWWWWWWRRK.',
    '.KRWWWWWWWWWWRK.',
    'KRRWWWWWWWWWWRRK',
    'KRWWWWWWWWWWWWRK',
    'KRWWWWWWWWWWWWRK',
    'KRRWWWWWWWWWWRRK',
    '.KKRRWWWWWWRRKK.',
    '..KKKRRRRRRKKK..',
    '...KSSSSSSSSK...',
    '...KSSKSSKSSK...',
    '...KSSKSSKSSK...',
    '...KSSSSSSSSK...',
    '....KKKKKKKK....'
  ];

  const ONEUP = MUSHROOM.map((r) => r.replace(/R/g, 'G'));

  const FLOWER_HEAD = (petal, inner) => [
    '.....KKKKKK.....',
    '...KK' + petal.repeat(6) + 'KK...',
    '..K' + petal.repeat(10) + 'K..',
    '..K' + petal.repeat(2) + inner.repeat(6) + petal.repeat(2) + 'K..',
    '..K' + petal.repeat(2) + inner.repeat(6) + petal.repeat(2) + 'K..',
    '..K' + petal.repeat(10) + 'K..',
    '...KK' + petal.repeat(6) + 'KK...',
    '.....KKKKKK.....'
  ];

  const FLOWER_STEM = [
    '....GGGGGGGG....',
    '...GGLLGGLLGG...',
    '..GGLLGGGGLLGG..',
    '..GGGGGGGGGGGG..',
    '...GGGGGGGGGG...',
    '....GGGGGGGG....',
    '.....GGGGGG.....',
    '................'
  ];

  const FIREFLOWER = {
    a: FLOWER_HEAD('W', 'H').concat(FLOWER_STEM),
    b: FLOWER_HEAD('H', 'W').concat(FLOWER_STEM)
  };

  const STAR = {
    a: [
      '.......YY.......',
      '......YYYY......',
      '......YYYY......',
      '.....YYYYYY.....',
      'YYYYYYYYYYYYYYYY',
      '.YYYYYYYYYYYYYY.',
      '..YYYYYYYYYYYY..',
      '...YYKKYYKKYY...',
      '...YYKKYYKKYY...',
      '..YYYYYYYYYYYY..',
      '..YYYYYYYYYYYY..',
      '.YYYYYYYYYYYYYY.',
      '.YYYYY.YY.YYYYY.',
      'YYYY.......YYYY.',
      'YY...........YY.',
      '................'
    ],
    b: [
      '.......YY.......',
      '......YYYY......',
      '.....YYYYYY.....',
      '.....YYYYYY.....',
      'YYYYYYYYYYYYYYYY',
      '.YYYYYYYYYYYYYY.',
      '..YYYYYYYYYYYY..',
      '...YYKKYYKKYY...',
      '...YYKKYYKKYY...',
      '..YYYYYYYYYYYY..',
      '..YYYYYYYYYYYY..',
      '.YYYYYYYYYYYYYY.',
      '.YYYYY.YY.YYYYY.',
      'YYYY.......YYYY.',
      '..YY.........YY.',
      '................'
    ]
  };

  const COIN = {
    a: [
      '.....YYYYYY.....',
      '...YYOOOOOOYY...',
      '..YOOOOOOOOOOY..',
      '..YOOYYYYYYOOY..',
      '.YOOYYOOOOYYOOY.',
      '.YOOYOOOOOOYOOY.',
      '.YOOYOOOOOOYOOY.',
      '.YOOYOOOOOOYOOY.',
      '.YOOYOOOOOOYOOY.',
      '.YOOYOOOOOOYOOY.',
      '.YOOYYOOOOYYOOY.',
      '..YOOYYYYYYOOY..',
      '..YOOOOOOOOOOY..',
      '...YYOOOOOOYY...',
      '.....YYYYYY.....',
      '................'
    ],
    b: [
      '......YYYY......',
      '.....YOOOOY.....',
      '.....YOOOOY.....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '....YOOYYOOY....',
      '.....YOOOOY.....',
      '.....YOOOOY.....',
      '......YYYY......',
      '................',
      '................'
    ],
    c: [
      '.......YY.......',
      '.......YY.......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '......YOOY......',
      '.......YY.......',
      '.......YY.......',
      '................',
      '................'
    ],
    d: [
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '.......YY.......',
      '................',
      '................'
    ]
  };

  const FIREBALL = [
    '................',
    '................',
    '................',
    '.....HHHHHH.....',
    '...HHYYYYYYHH...',
    '..HYYYYYYYYYYH..',
    '..HYYWWWWWWYYH..',
    '.HYYWWWWWWWWYYH.',
    '.HYWWWWWWWWWWYH.',
    '.HYWWWWWWWWWWYH.',
    '..HYYWWWWWWYYH..',
    '..HYYYYYYYYYYH..',
    '...HHYYYYYYHH...',
    '.....HHHHHH.....',
    '................',
    '................'
  ];

  /* =========================================================================
   * TILE PIECES & PROPS
   * ====================================================================== */

  const BRICK = [
    'KKKKKKKKKKKKKKKK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KKKKKKKKKKKKKKKK',
    'KVVVKVVVVVVVKVVV',
    'KVVVKVVVVVVVKVVV',
    'KVVVKVVVVVVVKVVV',
    'KVVVKVVVVVVVKVVV',
    'KKKKKKKKKKKKKKKK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KVVVVVVVKVVVVVVK',
    'KKKKKKKKKKKKKKKK'
  ];

  const BRICK_UNDERGROUND = BRICK.map((r) => r
    .replace(/V/g, 'B')
    .replace(/K/g, 'O'));

  const QUESTION = [
    'KKKKKKKKKKKKKKKK',
    'KOOOOOOOOOOOOOOK',
    'KOYYYYYYYYYYYYOK',
    'KOYYKKKKKKKKYYOK',
    'KOYKKOOOOOOKKYYOK'.slice(0, 16),
    'KOYKOYYYYYOKYYOK',
    'KOYKOYYYYYOKYYOK',
    'KOYKKOYYYOKKYYOK',
    'KOYYYYKYKKYYYYOK',
    'KOYYYYKKKYYYYYOK',
    'KOYYYYYKKYYYYYOK',
    'KOYYYYKKKKYYYYOK',
    'KOYYYYYKKYYYYYOK',
    'KOYYYYYYYYYYYYOK',
    'KOOOOOOOOOOOOOOK',
    'KKKKKKKKKKKKKKKK'
  ];

  const USED_BLOCK = [
    'KKKKKKKKKKKKKKKK',
    'KOOOOOOOOOOOOOOK',
    'KOVVVVVVVVVVVVOK',
    'KOVKKVVVVVVKKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKVVVVVVVVKVOK',
    'KOVKKVVVVVVKKVOK',
    'KOVVVVVVVVVVVVOK',
    'KOOOOOOOOOOOOOOK',
    'KKKKKKKKKKKKKKKK'
  ];

  const SOLID = [
    'OOOOOOOOOOOOOOOO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OVVVVVVVVVVVVVVO',
    'OOOOOOOOOOOOOOOO'
  ];

  // a 2x2 chunk of a shattered brick
  const DEBRIS = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..VVVVVVVVVVVV..',
    '..VOOOOOOOOOOV..',
    '..VOOOOOOOOOOV..',
    '..VOOOOOOOOOOV..',
    '..VOOOOOOOOOOV..',
    '..VVVVVVVVVVVV..',
    '................',
    '................'
  ];

  const AXE = [
    '................',
    '................',
    '.....KKKK.......',
    '....KZZZZK......',
    '...KZZZZZZK.....',
    '...KZZZZZZK.....',
    '....KZZZZK......',
    '.....KKKK.......',
    '......TT........',
    '......TT........',
    '......TT........',
    '......TT........',
    '......TT........',
    '......TT........',
    '......TT........',
    '................'
  ];

  const FLAG_CLOTH = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    'GGGGGGGGGGGGG...',
    'GEEEEEEEEEEEG...',
    'GEGGGGGGGGGEG...',
    'GEGEEEEEEEGEG...',
    'GEGEGGGGGEGEG...',
    'GEGEEEEEEEGEG...',
    'GEGGGGGGGEGEG...',
    'GEEEEEEEEEGEG...',
    'GGGGGGGGGGGEG...',
    '...........EE...'
  ];

  /* =========================================================================
   * Registration
   * ====================================================================== */

  const SHEET = {};
  function def(name, frame, palette) { SHEET[name] = { frame: frame, palette: palette || P }; }
  function defPair(name, frame, palette) { def(name, frame, palette); def('#' + name, mirror(frame), palette); }

  defPair('mario.small.idle', SM.idle);
  defPair('mario.small.walk0', SM.walk0);
  defPair('mario.small.walk1', SM.walk1);
  defPair('mario.small.jump', SM.jump);
  defPair('mario.small.skid', SM.skid);
  def('mario.small.dead', SM.dead);

  for (const key of Object.keys(BIG_BODY)) defPair('mario.big.' + key, BIG_HEAD.concat(BIG_BODY[key]));
  defPair('mario.big.crouch', BIG_CROUCH);

  for (const key of Object.keys(GOOMBA)) defPair('goomba.' + key, GOOMBA[key]);
  for (const key of Object.keys(KOOPA)) {
    if (key === 'flip') { def('koopa.flip', KOOPA[key]); continue; }
    defPair('koopa.' + key, KOOPA[key]);
  }

  def('item.mushroom', MUSHROOM);
  def('item.oneup', ONEUP);
  def('item.flower.a', FIREFLOWER.a);
  def('item.flower.b', FIREFLOWER.b);
  def('item.star.a', STAR.a);
  def('item.star.b', STAR.b);
  def('coin.a', COIN.a);
  def('coin.b', COIN.b);
  def('coin.c', COIN.c);
  def('coin.d', COIN.d);
  def('fireball', FIREBALL);
  def('fireball.small', FIREBALL);

  def('tile.brick', BRICK);
  def('tile.brick.under', BRICK_UNDERGROUND);
  def('tile.question', QUESTION);
  def('tile.used', USED_BLOCK);
  def('tile.solid', SOLID);
  def('tile.debris', DEBRIS);
  def('prop.axe', AXE);
  def('prop.flag', FLAG_CLOTH);

  /* =========================================================================
   * Atlas + paint API
   * ====================================================================== */

  const ATLAS = {};
  const COLS = 16;
  const CELL_W = 32;
  const CELL_H = 40;

  const api = {
    P: P,
    mirror: mirror,
    SHEET: SHEET,
    ATLAS: ATLAS,
    frameNames: Object.keys(SHEET),
    width(name) { const s = SHEET[name]; return s ? s.frame[0].length : 0; },
    height(name) { const s = SHEET[name]; return s ? s.frame.length : 0; },

    validate() {
      const problems = [];
      for (const name of Object.keys(SHEET)) {
        const f = SHEET[name].frame;
        if (!f.length) { problems.push(name + ': empty frame'); continue; }
        const w = f[0].length;
        if (w > CELL_W) problems.push(name + ': too wide (' + w + ')');
        if (f.length > CELL_H) problems.push(name + ': too tall (' + f.length + ')');
        const pal = SHEET[name].palette;
        for (let y = 0; y < f.length; y++) {
          if (f[y].length !== w) problems.push(name + ': row ' + y + ' width ' + f[y].length + ' != ' + w);
          for (const ch of f[y]) {
            if (ch !== '.' && !pal[ch]) problems.push(name + ': unknown colour "' + ch + '" on row ' + y);
          }
        }
      }
      return problems;
    },

    build() {
      const count = api.frameNames.length;
      const rowsCount = Math.ceil(count / COLS);
      const canvas = document.createElement('canvas');
      canvas.width = COLS * CELL_W;
      canvas.height = rowsCount * CELL_H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      api.frameNames.forEach((name, i) => {
        const cx = (i % COLS) * CELL_W;
        const cy = Math.floor(i / COLS) * CELL_H;
        const entry = SHEET[name];
        const f = entry.frame;
        const pal = entry.palette;
        for (let y = 0; y < f.length; y++) {
          for (let x = 0; x < f[y].length; x++) {
            const ch = f[y][x];
            if (ch === '.') continue;
            ctx.fillStyle = pal[ch];
            ctx.fillRect(cx + x, cy + y, 1, 1);
          }
        }
        ATLAS[name] = { x: cx, y: cy, w: f[0].length, h: f.length };
      });
      api.canvas = canvas;
      return canvas;
    },

    /** Blit a frame with its top-left at (x, y) in logical pixels. */
    paint(ctx, name, x, y) {
      const a = ATLAS[name];
      if (!a) return;
      ctx.drawImage(api.canvas, a.x, a.y, a.w, a.h, Math.round(x), Math.round(y), a.w, a.h);
    },

    /** Blit a frame so its bottom-centre sits on (cx, by). */
    paintAnchor(ctx, name, cx, by) {
      const a = ATLAS[name];
      if (!a) return;
      api.paint(ctx, name, cx - a.w / 2, by - a.h);
    }
  };

  global.MarioArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
