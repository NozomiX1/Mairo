/* =============================================================================
 * levels.js - level definitions.
 *
 * Coordinates are in tiles (16x16 px). y=0 is the top of the level, y=14 is the
 * bottom row. Tile legend used by the builder in game.js:
 *   'brick'      breakable brick (big mario), bumpable when small
 *   'brickhard'  unbreakable brick
 *   'question'   ? block            (content: 'coin' | 'mushroom' | 'flower'
 *                                    | 'star' | 'oneup' | 'coins')
 *   'hidden'     invisible until bumped
 *   'used'       spent ? block
 *   'solid'      ground / staircase block
 *   'coin'       free-standing collectable coin
 * ========================================================================== */
(function (global) {
  'use strict';

  const T = {
    BRICK: 'brick',
    BRICK_HARD: 'brickhard',
    QUESTION: 'question',
    HIDDEN: 'hidden',
    SOLID: 'solid',
    COIN: 'coin',
    PIPE: 'pipe',
    PIPE_TOP: 'pipetop',
    PIPE_BODY: 'pipebody',
    WATER: 'water',
    AXE: 'axe'
  };

  // helper: n bricks in a row
  const brickRow = (x, y, n) => ({ kind: T.BRICK, x, y, n });
  const solidRow = (x, y, n) => ({ kind: T.SOLID, x, y, n });
  const coinRow = (x, y, n) => ({ kind: T.COIN, x, y, n });

  const LEVELS = [
    /* =====================================================================
     * WORLD 1-1  -  the classic
     * ================================================================== */
    {
      name: '1-1',
      width: 212,
      timeLimit: 400,
      music: 'overworld',
      bg: '#5c94fc',
      groundY: 13,
      ground: [[0, 69], [71, 86], [89, 153], [155, 212]],
      decor: [
        { type: 'hill', x: 0, size: 2 },
        { type: 'bush', x: 11, size: 3 },
        { type: 'cloud', x: 8, y: 2, size: 3 },
        { type: 'hill', x: 16, size: 1 },
        { type: 'bush', x: 23, size: 1 },
        { type: 'cloud', x: 19, y: 3, size: 2 },
        { type: 'cloud', x: 27, y: 2, size: 3 },
        { type: 'hill', x: 47, size: 2 },
        { type: 'cloud', x: 36, y: 3, size: 1 },
        { type: 'bush', x: 59, size: 3 },
        { type: 'cloud', x: 56, y: 2, size: 3 },
        { type: 'cloud', x: 67, y: 3, size: 1 },
        { type: 'hill', x: 64, size: 1 },
        { type: 'cloud', x: 76, y: 2, size: 2 },
        { type: 'bush', x: 88, size: 3 },
        { type: 'cloud', x: 96, y: 3, size: 3 },
        { type: 'hill', x: 96, size: 2 },
        { type: 'cloud', x: 108, y: 2, size: 1 },
        { type: 'bush', x: 112, size: 1 },
        { type: 'cloud', x: 118, y: 3, size: 2 },
        { type: 'hill', x: 128, size: 1 },
        { type: 'bush', x: 136, size: 3 },
        { type: 'cloud', x: 128, y: 2, size: 3 },
        { type: 'cloud', x: 147, y: 3, size: 1 },
        { type: 'cloud', x: 158, y: 2, size: 2 },
        { type: 'hill', x: 160, size: 2 },
        { type: 'bush', x: 168, size: 1 },
        { type: 'cloud', x: 172, y: 3, size: 3 },
        { type: 'cloud', x: 190, y: 2, size: 1 },
        { type: 'hill', x: 192, size: 1 },
        { type: 'bush', x: 180, size: 3 }
      ],
      blocks: [
        { kind: T.QUESTION, x: 16, y: 9, content: 'coin' },
        brickRow(20, 9, 1),
        { kind: T.QUESTION, x: 21, y: 9, content: 'mushroom' },
        brickRow(22, 9, 1),
        { kind: T.QUESTION, x: 23, y: 9, content: 'coin' },
        brickRow(24, 9, 1),
        { kind: T.QUESTION, x: 22, y: 5, content: 'coin' },

        brickRow(77, 9, 1),
        { kind: T.QUESTION, x: 78, y: 9, content: 'coin' },
        brickRow(79, 9, 1),

        brickRow(80, 5, 8),
        brickRow(91, 5, 3),
        brickRow(94, 5, 1),
        { kind: T.QUESTION, x: 94, y: 5, content: 'coins' },
        brickRow(95, 5, 1),
        brickRow(100, 9, 1),
        { kind: T.QUESTION, x: 101, y: 9, content: 'coin' },
        brickRow(102, 9, 1),
        { kind: T.QUESTION, x: 106, y: 5, content: 'coin' },
        { kind: T.QUESTION, x: 109, y: 9, content: 'coin' },
        { kind: T.QUESTION, x: 112, y: 5, content: 'coin' },
        { kind: T.QUESTION, x: 109, y: 5, content: 'star' },

        { kind: T.QUESTION, x: 118, y: 9, content: 'coin' },
        brickRow(121, 9, 1),
        brickRow(122, 9, 1),
        { kind: T.QUESTION, x: 123, y: 9, content: 'mushroom' },
        brickRow(124, 9, 1),
        brickRow(125, 9, 1),
        { kind: T.QUESTION, x: 129, y: 9, content: 'coin' },
        brickRow(130, 9, 1),
        { kind: T.QUESTION, x: 131, y: 9, content: 'coin' },
        brickRow(129, 5, 3),
        { kind: T.QUESTION, x: 129, y: 5, content: 'oneup' },

        // invisible 1-up just before the staircase
        { kind: T.HIDDEN, x: 63, y: 5, content: 'oneup' },

        // pyramid staircase up (7 steps) at x=134
        solidRow(134, 12, 1), solidRow(135, 11, 2), solidRow(136, 10, 3),
        solidRow(137, 9, 4), solidRow(138, 8, 5), solidRow(139, 7, 6),
        solidRow(140, 6, 7), solidRow(141, 5, 8), solidRow(142, 4, 9),
        // ... and the 8-step staircase before it at x=181
        solidRow(181, 12, 1), solidRow(182, 11, 2), solidRow(183, 10, 3),
        solidRow(184, 9, 4), solidRow(185, 8, 5), solidRow(186, 7, 6),
        solidRow(187, 6, 7), solidRow(188, 5, 8), solidRow(189, 4, 9)
      ],
      pipes: [
        { x: 28, y: 12, h: 2 },
        { x: 38, y: 11, h: 3 },
        { x: 46, y: 10, h: 4, warp: { level: 1, x: 3, y: 3 } },
        { x: 57, y: 10, h: 4 }
      ],
      enemies: [
        { type: 'goomba', x: 22, y: 12 },
        { type: 'goomba', x: 40, y: 12 },
        { type: 'goomba', x: 51, y: 12 },
        { type: 'goomba', x: 52, y: 12 },
        { type: 'goomba', x: 80, y: 12 },
        { type: 'goomba', x: 82, y: 12 },
        { type: 'koopa', x: 107, y: 12 },
        { type: 'goomba', x: 110, y: 12 },
        { type: 'goomba', x: 111, y: 12 },
        { type: 'goomba', x: 114, y: 12 },
        { type: 'goomba', x: 115, y: 12 },
        { type: 'goomba', x: 124, y: 7 },
        { type: 'goomba', x: 125, y: 12 },
        { type: 'koopa', x: 142, y: 12 },
        { type: 'goomba', x: 152, y: 12 },
        { type: 'goomba', x: 160, y: 12 },
        { type: 'goomba', x: 161, y: 12 }
      ],
      flag: { x: 198, y: 3, height: 10 },
      castle: { x: 202, y: 13 }
    },

    /* =====================================================================
     * WORLD 1-2  -  underground
     * ================================================================== */
    {
      name: '1-2',
      width: 112,
      timeLimit: 400,
      music: 'underground',
      bg: '#000000',
      underground: true,
      groundY: 13,
      ground: [[0, 36], [36, 112]],
      ceilingRows: 1,
      decor: [],
      blocks: [
        coinRow(4, 9, 3),
        coinRow(9, 9, 3),
        coinRow(9, 5, 3),
        coinRow(14, 9, 3),
        coinRow(14, 5, 3),
        coinRow(20, 9, 3),
        coinRow(20, 5, 3),
        brickRow(26, 9, 4),
        brickRow(30, 9, 4),
        brickRow(34, 9, 4),
        brickRow(38, 9, 3),
        coinRow(44, 9, 5),
        brickRow(50, 5, 5),
        brickRow(50, 9, 5),
        coinRow(56, 9, 4),
        { kind: T.QUESTION, x: 62, y: 9, content: 'mushroom' },
        coinRow(66, 9, 4),
        coinRow(66, 5, 4),
        brickRow(72, 9, 6),
        coinRow(80, 9, 5),
        brickRow(86, 5, 4),
        { kind: T.QUESTION, x: 88, y: 5, content: 'star' },
        brickRow(86, 9, 4),
        coinRow(92, 9, 4),
        brickRow(96, 9, 8),
        { kind: T.QUESTION, x: 98, y: 5, content: 'coin' },
        { kind: T.QUESTION, x: 101, y: 5, content: 'coin' },
        { kind: T.QUESTION, x: 104, y: 5, content: 'oneup' }
      ],
      pipes: [
        { x: 16, y: 11, h: 3 },
        { x: 64, y: 11, h: 3, warp: { level: 0, x: 109, y: 4 } }
      ],
      enemies: [
        { type: 'goomba', x: 12, y: 12 },
        { type: 'goomba', x: 24, y: 12 },
        { type: 'goomba', x: 25, y: 12 },
        { type: 'koopa', x: 40, y: 12 },
        { type: 'goomba', x: 52, y: 12 },
        { type: 'goomba', x: 53, y: 12 },
        { type: 'goomba', x: 74, y: 12 },
        { type: 'goomba', x: 75, y: 12 },
        { type: 'koopa', x: 82, y: 12 },
        { type: 'goomba', x: 90, y: 12 },
        { type: 'goomba', x: 100, y: 12 },
        { type: 'goomba', x: 101, y: 12 }
      ],
      flag: { x: 108, y: 3, height: 10 },
      castle: { x: 108, y: 13, hidden: true }
    },

    /* =====================================================================
     * WORLD 1-3  -  water platform level
     * ================================================================== */
    {
      name: '1-3',
      width: 150,
      timeLimit: 300,
      music: 'overworld',
      bg: '#0000a8',
      water: true,
      groundY: 13,
      ground: [[0, 16], [66, 74], [140, 150]],
      decor: [
        { type: 'cloud', x: 10, y: 2, size: 3 },
        { type: 'cloud', x: 30, y: 3, size: 2 },
        { type: 'cloud', x: 52, y: 2, size: 3 },
        { type: 'cloud', x: 78, y: 3, size: 1 },
        { type: 'cloud', x: 100, y: 2, size: 2 },
        { type: 'cloud', x: 124, y: 3, size: 3 }
      ],
      // standing platforms (islands)
      blocks: [
        solidRow(20, 11, 3),
        solidRow(28, 10, 4),
        solidRow(38, 8, 4),
        solidRow(48, 10, 3),
        solidRow(56, 11, 3),
        solidRow(80, 9, 3),
        solidRow(88, 7, 4),
        solidRow(98, 10, 3),
        solidRow(106, 8, 4),
        solidRow(116, 10, 3),
        solidRow(124, 11, 4),
        solidRow(132, 9, 4),
        coinRow(21, 10, 3),
        coinRow(29, 9, 4),
        coinRow(39, 7, 4),
        coinRow(49, 9, 3),
        coinRow(89, 6, 4),
        coinRow(107, 7, 4),
        coinRow(133, 8, 4),
        brickRow(64, 6, 1),
        { kind: T.QUESTION, x: 65, y: 6, content: 'mushroom' },
        brickRow(66, 6, 1),
        coinRow(70, 9, 4),
        coinRow(71, 5, 4),
        { kind: T.QUESTION, x: 137, y: 6, content: 'star' },
        brickRow(136, 6, 1),
        brickRow(138, 6, 1)
      ],
      pipes: [],
      // water: rows below y=13 in the empty regions
      waterRows: true,
      platforms: [
        { type: 'float', x: 24, y: 8, w: 3, range: 3.5, axis: 'x', speed: 0.55 },
        { type: 'float', x: 33, y: 12, w: 3, range: 3, axis: 'y', speed: 0.5 },
        { type: 'float', x: 43, y: 11, w: 3, range: 4, axis: 'x', speed: 0.6 },
        { type: 'float', x: 52, y: 6, w: 2, range: 3, axis: 'y', speed: 0.45 },
        { type: 'float', x: 60, y: 9, w: 3, range: 4, axis: 'x', speed: 0.6 },
        { type: 'float', x: 84, y: 12, w: 3, range: 3.5, axis: 'x', speed: 0.7 },
        { type: 'float', x: 94, y: 6, w: 2, range: 3, axis: 'y', speed: 0.5 },
        { type: 'float', x: 102, y: 12, w: 3, range: 4, axis: 'x', speed: 0.65 },
        { type: 'float', x: 112, y: 7, w: 3, range: 3, axis: 'y', speed: 0.45 },
        { type: 'float', x: 120, y: 12, w: 3, range: 4, axis: 'x', speed: 0.7 },
        { type: 'float', x: 129, y: 6, w: 2, range: 3, axis: 'y', speed: 0.5 },
        { type: 'float', x: 144, y: 10, w: 3, range: 0, axis: 'x', speed: 0 }
      ],
      enemies: [
        { type: 'goomba', x: 28, y: 9 },
        { type: 'koopa', x: 39, y: 7 },
        { type: 'goomba', x: 48, y: 9 },
        { type: 'koopa', x: 66, y: 12 },
        { type: 'goomba', x: 70, y: 12 },
        { type: 'koopa', x: 88, y: 6 },
        { type: 'goomba', x: 98, y: 9 },
        { type: 'koopa', x: 107, y: 7 },
        { type: 'goomba', x: 124, y: 10 },
        { type: 'koopa', x: 142, y: 12 }
      ],
      flag: { x: 146, y: 3, height: 10 },
      castle: { x: 146, y: 13, hidden: true }
    }
  ];

  global.MarioLevels = { LEVELS: LEVELS, T: T };
})(typeof window !== 'undefined' ? window : globalThis);
