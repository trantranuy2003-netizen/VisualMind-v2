const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
const remote = new Map();
function browser() {
    const values = new Map(), listeners = {};
    let account = null;
    const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const document = { addEventListener: (key, fn) => (listeners[key] ??= []).push(fn), dispatchEvent: event => (listeners[event.type] || []).forEach(fn => fn(event)) };
    const context = vm.createContext({ localStorage, document, crypto: webcrypto, setTimeout, clearTimeout,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        window: { addEventListener() {} },
        supabaseClient: {
            auth: { getSession: async () => ({ data: { session: null } }) },
            from() { let user; return { select() { return this; }, eq(key, value) { if (key === 'user_id') user = value; return this; }, async limit() { return { data: remote.has(user) ? [{ id: 7, data: remote.get(user) }] : [], error: null }; } }; }
        },
        saveMindmapToCloud: async (title, data, id) => { assert.equal(id, 'hodi-dashboard-v1'); remote.set(account, JSON.parse(JSON.stringify(data))); return true; }
    });
    const source = fs.readFileSync(path.join(__dirname, '../js/dashboard-sync.js'), 'utf8').replace('    reconnect();', '    window.connectTest = connect;');
    vm.runInContext(source, context);
    return {
        async connect(user) { account = user; await context.window.connectTest(user ? { id: user } : null); },
        set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
        get(key) { return JSON.parse(localStorage.getItem(key)); },
        async change() { document.dispatchEvent({ type: 'visualmind-dashboard-change' }); await context.window.saveDashboardToCloud(); }
    };
}
(async () => {
    const regular = browser();
    const tasks = [{ id: 'task-1', title: 'Priority task', status: 'do', completed: true }];
    const planner = { items: [{ id: 'goal-1', kind: 'goal', dates: ['2026-09-11'] }, { id: 'child', parentId: 'goal-1', kind: 'task' }], recurring: [{ id: 'repeat', repeat: 'weekly', completedDates: ['2026-09-11'] }] };
    regular.set('visualmind-eisenhower-tasks', tasks); regular.set('visualmind-weekly-planner', planner);
    await regular.connect('account-a');
    assert.deepEqual(remote.get('account-a').tasks, tasks);
    assert.deepEqual(remote.get('account-a').planner, planner);
    const incognito = browser(); await incognito.connect('account-a');
    assert.deepEqual(incognito.get('visualmind-eisenhower-tasks'), tasks);
    assert.deepEqual(incognito.get('visualmind-weekly-planner'), planner);
    await incognito.connect('account-b');
    assert.deepEqual(incognito.get('visualmind-eisenhower-tasks'), []);
    assert.deepEqual(remote.get('account-a').tasks, tasks, 'Switching account must not overwrite previous data');
    await incognito.connect('account-a');
    assert.deepEqual(incognito.get('visualmind-eisenhower-tasks'), tasks);
    incognito.set('visualmind-eisenhower-tasks', []); incognito.set('visualmind-weekly-planner', { items: [], recurring: [] }); await incognito.change();
    const fresh = browser(); await fresh.connect('account-a');
    assert.deepEqual(fresh.get('visualmind-eisenhower-tasks'), [], 'Intentional deletion remains empty after restore');
    console.log('PASS: full dashboard migration, empty-browser restoration, account isolation and intentional deletions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
