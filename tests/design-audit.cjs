const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--remote-debugging-port=9224', '--user-data-dir=' + path.resolve(__dirname, '../.tmp-design-audit'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let socket;
    try {
        let page;
        for (let n = 0; n < 60; n++) { try { page = (await (await fetch('http://127.0.0.1:9224/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await delay(200); }
        if (!page) throw Error('Browser did not start');
        console.log('Connecting browser', page.id);
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
        let id = 0; const pending = new Map();
        socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
        const send = (method, params = {}) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Timeout: ' + method)), 10000); pending.set(++id, result => { clearTimeout(timer); resolve(result); }); socket.send(JSON.stringify({ id, method, params })); });
        await send('Page.enable');
        const out = path.join(process.env.TEMP, 'hodi-design-shots'); fs.mkdirSync(out, { recursive: true });
        for (const width of [1440, 768, 390, 320]) for (const name of ['index', 'mindmap', 'flashcard']) {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
            await send('Page.navigate', { url: `http://127.0.0.1:8765/${name}.html?test=1` });
            await delay(1600);
            for (let n = 0; n < 60; n++) {
                const ready = await send('Runtime.evaluate', { expression: `document.readyState === 'complete'`, returnByValue: true });
                if (ready.result.value) break;
                await delay(200);
            }
            const result = await send('Runtime.evaluate', { expression: `JSON.stringify({errors:window.testErrors,overflow:document.documentElement.scrollWidth>innerWidth,body:document.body.innerText.slice(0,300),outside:[...document.querySelectorAll('button,input,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.id||e.title||e.textContent.slice(0,30))})`, returnByValue: true });
            console.log(name, width, result.result.value);
            const metrics = JSON.parse(result.result.value);
            assert.deepEqual(metrics.errors, [], `${name}: runtime errors`);
            assert.equal(metrics.overflow, false, `${name} at ${width}: page overflow`);
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(out, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));
            if (width <= 390) {
                const nav = await send('Runtime.evaluate', { expression: `document.getElementById('appNavToggle').click(); JSON.stringify({open:document.body.classList.contains('app-nav-mobile-open'),settings:getComputedStyle(document.querySelector('.settings-panel')).display,expanded:document.getElementById('appNavToggle').getAttribute('aria-expanded')})`, returnByValue: true });
                console.log('mobile navigation', nav.result.value);
                assert.deepEqual(JSON.parse(nav.result.value), { open: true, settings: 'block', expanded: 'true' });
                await send('Runtime.evaluate', { expression: `document.querySelector('.app-nav-backdrop').click()` });
            }
            await send('Runtime.evaluate', { expression: `document.querySelector('[data-theme-choice="light"]').click()` });
            await delay(350);
            const light = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(out, `${name}-${width}-light.png`), Buffer.from(light.data, 'base64'));
            await send('Runtime.evaluate', { expression: `document.querySelector('[data-theme-choice="dark"]').click()` });
            if (name === 'flashcard' && width === 390) {
                const study = await send('Runtime.evaluate', { expression: `(() => { document.getElementById('flashcardTextInput').value = 'Q: Design audit question?\\nA: Design audit answer'; generateFlashcardsFromText(); const question = document.getElementById('fcCardText').textContent; fcReveal(); return {question, answer:document.getElementById('fcCardText').textContent, visible:document.getElementById('fcCard').getBoundingClientRect().width > 0}; })()`, returnByValue: true });
                assert.deepEqual(study.result.value, { question: 'Design audit question?', answer: 'Design audit answer', visible: true });
                console.log('PASS: flashcard creation and answer reveal');
            }
        }
        console.log(out);
        await send('Browser.close');
    } finally { socket?.close(); browser.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
