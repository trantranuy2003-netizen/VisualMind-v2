const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--remote-debugging-port=9223', '--user-data-dir=' + path.resolve(__dirname, '../.tmp-mindmap-cdp'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let socket;
    try {
        let page;
        for (let n = 0; n < 60; n++) { try { page = (await (await fetch('http://127.0.0.1:9223/json')).json()).find(page => page.type === 'page'); if (page) break; } catch {} await delay(200); }
        if (!page) throw Error('Browser did not start');
        socket = new WebSocket(page.webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
        let id = 0; const pending = new Map();
        socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(Error(message.error.message)) : resolve(message.result); } });
        const send = (method, params = {}) => new Promise((resolve, reject) => { const request = ++id; pending.set(request, { resolve, reject }); socket.send(JSON.stringify({ id: request, method, params })); });
        await send('Page.enable'); await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: process.argv[2] || 'http://127.0.0.1:8765/tests/mindmap-features-browser.html' });
        let result = 'RUNNING';
        for (let n = 0; n < 150; n++) {
            await delay(200);
            const response = await send('Runtime.evaluate', { expression: 'document.querySelector("#result")?.textContent', returnByValue: true });
            result = response.result?.value || 'RUNNING'; if (/^(PASS|FAIL):/.test(result)) break;
        }
        console.log(result);
        if (!result.startsWith('PASS:')) {
            const diagnostic = await send('Runtime.evaluate', { expression: 'JSON.stringify({frame:document.querySelector("iframe")?.contentDocument?.readyState,errors:document.querySelector("iframe")?.contentWindow?.testErrors,body:document.querySelector("iframe")?.contentDocument?.body?.innerText.slice(-1000)})', returnByValue: true });
            console.log(diagnostic.result?.value); process.exitCode = 1;
        }
        if (process.argv[3]) { const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.argv[3], Buffer.from(shot.data, 'base64')); }
        await send('Browser.close');
    } finally { socket?.close(); browser.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
