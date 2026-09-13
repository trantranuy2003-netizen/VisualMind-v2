// Local browser-test server. test=1 skips the external auth SDK so fixtures do
// not contact user accounts; all application scripts remain unmodified.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404); res.end(); return; }
        const type = path.extname(file);
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[type] || 'application/octet-stream');
        if (type === '.html' && url.searchParams.has('test')) data = data.toString().replace(/<script src="https:[^"]+"><\/script>/g, '').replace('<head>', '<head><script>window.testErrors=[];window.addEventListener("error",e=>testErrors.push(e.message));window.addEventListener("unhandledrejection",e=>testErrors.push(String(e.reason)));</script>');
        res.end(data);
    });
}).listen(8765, '127.0.0.1', () => console.log('Browser tests: http://127.0.0.1:8765'));
