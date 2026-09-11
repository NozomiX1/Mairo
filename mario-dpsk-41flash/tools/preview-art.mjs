/* tools/preview-art.mjs - validate + print ASCII previews of the sprite data.
 * usage: node tools/preview-art.mjs [nameFilter] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'js', 'sprites.js'), 'utf8');
// Evaluate the module with a fake window so we can inspect MarioArt.
const win = {};
new Function('window', 'globalThis', src + '\n;return window.MarioArt;')(win, win);
const Art = win.MarioArt;

const problems = Art.validate();
console.log('frames:', Art.frameNames.length);
console.log('validation problems:', problems.length);
for (const p of problems.slice(0, 40)) console.log('  !', p);

const filter = process.argv[2];
const names = Art.frameNames.filter((n) => !n.startsWith('#') && (!filter || n.includes(filter)));

function preview(name) {
  const { frame } = Art.SHEET[name];
  const w = frame[0].length;
  const h = frame.length;
  // bounding box of non-transparent pixels
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (frame[y][x] !== '.') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`\n--- ${name}  ${w}x${h}  bbox x[${minX}..${maxX}] y[${minY}..${maxY}]`);
  for (let y = 0; y < h; y += 2) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const a = frame[y][x];
      const b = y + 1 < h ? frame[y + 1][x] : '.';
      if (a === '.' && b === '.') line += '  ';
      else if (a !== '.' && b !== '.') line += a + b;
      else if (a !== '.') line += a + ' ';
      else line += ' ' + b;
    }
    console.log(line.replace(/\s+$/, ''));
  }
}

if (!filter) {
  // ---------------------------------------------------------------- structural
  const bbox = (name) => {
    const { frame } = Art.SHEET[name];
    let minX = 99, maxX = -1, minY = 99, maxY = -1, count = 0;
    for (let y = 0; y < frame.length; y++) {
      for (let x = 0; x < frame[y].length; x++) {
        if (frame[y][x] !== '.') {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, maxX, minY, maxY, count, w: frame[0].length, h: frame.length };
  };
  const at = (name, x, y) => Art.SHEET[name].frame[y][x];
  const bad = [];
  const need = (cond, msg) => { if (!cond) bad.push(msg); };

  // every actor sized as expected
  for (const n of ['mario.small.idle', 'mario.small.walk0', 'mario.small.walk1', 'mario.small.jump', 'mario.small.skid', 'mario.small.dead']) {
    const b = bbox(n);
    need(b.w === 16 && b.h === 16, n + ' should be 16x16, got ' + b.w + 'x' + b.h);
    need(b.maxY === 15, n + ' feet should touch bottom row (maxY=' + b.maxY + ')');
    need(b.minX >= 0 && b.maxX <= 15, n + ' overflows horizontally');
    need(at(n, 6, 1) === 'R' || at(n, 7, 1) === 'R', n + ' should have red cap near the top');
    need(b.count > 90 && b.count < 210, n + ' pixel count ' + b.count + ' outside sane range');
  }
  for (const n of ['mario.big.idle', 'mario.big.walk0', 'mario.big.walk1', 'mario.big.jump', 'mario.big.skid', 'mario.big.crouch']) {
    const b = bbox(n);
    need(b.w === 16 && b.h === 32, n + ' should be 16x32, got ' + b.w + 'x' + b.h);
    need(b.maxY === 31, n + ' feet should touch bottom row (maxY=' + b.maxY + ')');
    need(b.count > 200 && b.count < 420, n + ' pixel count ' + b.count + ' outside sane range');
  }
  for (const n of ['goomba.walk0', 'goomba.walk1', 'goomba.flat']) {
    const b = bbox(n);
    need(b.w === 16 && b.h === 16, n + ' size ' + b.w + 'x' + b.h);
    need(b.maxY === 15, n + ' should sit on the bottom row');
  }
  for (const n of ['koopa.walk0', 'koopa.walk1', 'koopa.shell', 'koopa.shellSpin', 'koopa.flip']) {
    const b = bbox(n);
    need(b.w === 16 && b.h === 24, n + ' size ' + b.w + 'x' + b.h);
  }
  need(bbox('koopa.walk0').minY === 0, 'koopa.walk0 head should reach the top row');
  need(bbox('koopa.walk0').maxY === 23, 'koopa.walk0 should sit on the bottom row');
  need(bbox('koopa.shell').minY > 4, 'koopa.shell should have no head area');

  // left-facing check: cap brim (brown) extends further left than right on the head row
  const capRow = Art.SHEET['mario.small.idle'].frame[2];
  const brown = [];
  for (let x = 0; x < capRow.length; x++) if (capRow[x] === 'T') brown.push(x);
  need(brown.length && brown[0] < 5, 'small mario cap brim should extend left (brown at ' + brown.join(',') + ')');

  // items
  for (const n of ['item.mushroom', 'item.oneup']) {
    const { frame } = Art.SHEET[n];
    for (let y = 0; y < 16; y++) {
      need(frame[y] === frame[y].split('').reverse().join(''), n + ' should be left/right symmetric on row ' + y);
    }
  }
  for (const n of ['coin.a', 'coin.b', 'coin.c', 'coin.d', 'item.flower.a', 'item.flower.b', 'item.star.a', 'item.star.b', 'fireball']) {
    const b = bbox(n);
    need(b.count > 20 && b.w === 16 && b.h === 16, n + ' looks empty or mis-sized');
  }
  // coin animation should get narrower then wider
  const cw = ['coin.a', 'coin.b', 'coin.c', 'coin.d'].map((n) => bbox(n).maxX - bbox(n).minX + 1);
  need(cw[0] > cw[1] && cw[1] > cw[2] && cw[2] > cw[3], 'coin spin should narrow monotonically, got ' + cw.join(','));

  // mirrored pairs must be exact mirrors
  for (const n of Art.frameNames) {
    if (!n.startsWith('#')) continue;
    const a = Art.SHEET[n].frame;
    const b = Art.SHEET[n.slice(1)].frame;
    for (let y = 0; y < a.length; y++) {
      const mirrored = a[y].split('').reverse().join('');
      if (mirrored !== b[y]) { bad.push(n + ' row ' + y + ' is not a clean mirror'); break; }
    }
  }

  console.log('\nstructural problems:', bad.length);
  for (const b of bad) console.log('  !', b);
}
