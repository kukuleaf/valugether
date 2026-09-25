import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 3102);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  const requested = resolve(root, relative);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end('Bad request');
    return;
  }

  const candidates = [
    requested,
    `${requested}.html`,
    join(requested, 'index.html'),
    join(root, 'index.html'),
  ];
  const file = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('content-type', contentTypes[extname(file)] ?? 'application/octet-stream');
  response.setHeader('cache-control', 'no-store');
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
