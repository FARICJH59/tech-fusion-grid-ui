import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformCore } from '../platform/core/index.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const core = createPlatformCore();
const port = Number(process.env.PORT || 3000);

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/health') return send(res, 200, core.health());
    if (url.pathname === '/api/platform') return send(res, 200, core.identity());
    if (url.pathname === '/api/tenants' && req.method === 'GET') return send(res, 200, { tenants: core.listTenants() });
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

    let file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    if (file.includes('..')) return send(res, 400, { error: 'Invalid path' });
    const ext = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
    try {
      const body = await fs.readFile(path.join(publicDir, file));
      return send(res, 200, body, types[ext] || 'application/octet-stream');
    } catch {
      const body = await fs.readFile(path.join(publicDir, 'index.html'));
      return send(res, 200, body, 'text/html; charset=utf-8');
    }
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`[TechFusion Web Runtime] listening on :${port}`));
