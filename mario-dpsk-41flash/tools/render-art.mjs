/* tools/render-art.mjs - render every sprite frame into a PNG contact sheet.
 * usage: node tools/render-art.mjs out.png [scale] [filter] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, hex2rgb } from './png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'js', 'sprites.js'), 'utf8');
const win = {};
new Function('window', 'globalThis', src + '\n;return window.MarioArt;')(win, win);
const Art = win.MarioArt;

const out = process.argv[2] || 'art-sheet.png';
const scale = Number(process.argv[3] || 4);
const filter = process.argv[4] || '';

const CELL_W = 32, CELL_H = 40, COLS = 16, PAD = 1;
const names = Art.frameNames.filter((n) => !filter || n.includes(filter));
const rowsCount = Math.ceil(names.length / COLS);

const CW = (CELL_W + PAD) * scale;
const CH = (CELL_H + PAD) * scale;
const W = COLS * CW;
const H = rowsCount * CH;

// Pre-flatten frames into a lookup: [x][y] -> rgba
const cells = names.map((name) => {
  const { frame, palette } = Art.SHEET[name];
  const px = [];
  for (let y = 0; y < frame.length; y++) {
    px[y] = [];
    for (let x = 0; x < frame[y].length; x++) {
      const ch = frame[y][x];
      px[y][x] = ch === '.' ? null : hex2rgb(palette[ch]);
    }
  }
  return px;
});

const buf = encodePNG(W, H, (X, Y) => {
  const col = Math.floor(X / CW);
  const row = Math.floor(Y / CH);
  const idx = row * COLS + col;
  if (idx >= cells.length) return [24, 24, 32, 255];
  const px = cells[idx];
  const lx = Math.floor((X % CW) / scale);
  const ly = Math.floor((Y % CH) / scale);
  const check = ((Math.floor(lx / 2) + Math.floor(ly / 2)) % 2) ? [40, 40, 48, 255] : [28, 28, 34, 255];
  const p = px[ly] && px[ly][lx];
  if (!p) return check;
  return [p[0], p[1], p[2], 255];
});

fs.writeFileSync(out, buf);
console.log('wrote', out, W + 'x' + H, 'frames:', names.length);
