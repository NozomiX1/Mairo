/* tools/serve.mjs - tiny static file server for local play.
 * usage: node tools/serve.mjs [port]   (default 8123) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8123);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const full = path.join(root, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!full.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + rel); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('serving ' + root + ' at http://127.0.0.1:' + port + '/');
});
