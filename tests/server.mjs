import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4173;
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4']
]);

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${host}:${port}`).pathname);
    const candidate = path.resolve(root, `.${pathname}`);
    if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== root) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(candidate);
    const file = info.isDirectory() ? path.join(candidate, 'index.html') : candidate;
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime.get(path.extname(file)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, host, () => console.log(`cinematic test server: http://${host}:${port}`));
