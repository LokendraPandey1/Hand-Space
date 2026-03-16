import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
    const out = { port: 8000 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--port') out.port = Number(argv[++i] || out.port);
    }
    return out;
}

const MIME = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.mjs', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.csv', 'text/csv; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.wasm', 'application/wasm'],
    ['.glb', 'model/gltf-binary'],
    ['.gltf', 'model/gltf+json; charset=utf-8'],
    ['.bin', 'application/octet-stream'],
    ['.tflite', 'application/octet-stream'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.gif', 'image/gif'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon']
]);

function send(res, status, headers, body) {
    res.writeHead(status, headers);
    res.end(body);
}

function safePathFromUrl(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
    const rel = decoded === '/' ? '/index.html' : decoded;
    const joined = path.join(rootDir, rel);
    const resolved = path.resolve(joined);
    if (!resolved.startsWith(rootDir)) return null;
    return resolved;
}

const { port } = parseArgs(process.argv.slice(2));

const server = http.createServer(async (req, res) => {
    try {
        const filePath = safePathFromUrl(req.url || '/');
        if (!filePath) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad request');

        const stat = await fs.stat(filePath).catch(() => null);
        if (!stat || !stat.isFile()) {
            return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const type = MIME.get(ext) || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': type,
            'Cache-Control': 'no-store',        });

        createReadStream(filePath).pipe(res);
    } catch (e) {
        send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, `Server error: ${e?.message || e}`);
    }
});

server.listen(port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(`HandSpace server running on http://localhost:${port}`);
});


