const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PREVIEW_PORT || 8080);
const HOST = process.env.PREVIEW_HOST || '127.0.0.1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    const rawPath = (req.url || '/').split('?')[0];
    if (rawPath.startsWith('/api')) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'UI preview server — backend API disabled' }));
        return;
    }

    const relPath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
    console.log(`UI Preview (no backend) listening at http://${HOST}:${PORT}/`);
});
