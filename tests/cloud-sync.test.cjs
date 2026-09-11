const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
const root = path.join(__dirname, '..');
const records = new Map();
let failRead = false;
const user = { id: 'test-user' };

function element() {
    return {
        dataset: {}, style: { setProperty() {} }, parentElement: { appendChild() {} },
        classList: { toggle() {}, contains() { return false; }, remove() {} },
        addEventListener() {}, setAttribute() {}, appendChild() {}, remove() {},
        querySelector() { return null; }, querySelectorAll() { return []; }
    };
}

function browser() {
    const storage = new Map();
    const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
    const listeners = {};
    const document = {
        getElementById: element, querySelector: () => null, querySelectorAll: () => [],
        createElement: element, createDocumentFragment: element, body: element(), documentElement: element(),
        addEventListener: (name, callback) => (listeners[name] ??= []).push(callback),
        dispatchEvent: event => (listeners[event.type] || []).forEach(callback => callback(event))
    };
    const client = {
        auth: {
            getUser: async () => ({ data: { user } }),
            getSession: async () => ({ data: { session: null } })
        },
        from() {
            let filters = [];
            let operation = null;
            let payload = null;
            const matches = row => filters.every(([key, value]) =>
                (key === 'data->>visualmindDocumentId' ? row.data.visualmindDocumentId : row[key]) === value);
            return {
                select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
                async limit(count) { return { data: [...records.values()].filter(matches).slice(0, count), error: null }; },
                order() {
                    return Promise.resolve(failRead ? { error: new Error('Offline') } : {
                        data: [...records.values()].filter(matches)
                    });
                },
                insert(row) { operation = 'insert'; payload = row; filters = []; return this; },
                update(row) { operation = 'update'; payload = row; filters = []; return this; },
                async single() {
                    assert.equal('id' in payload, false, 'Client must not supply an ID for the bigint identity column');
                    const id = operation === 'insert' ? records.size + 1 : [...records.values()].find(matches)?.id;
                    if (!id) return { error: new Error('No matching record') };
                    records.set(id, JSON.parse(JSON.stringify({ ...payload, id })));
                    return { data: { id }, error: null };
                }
            };
        }
    };
    const context = vm.createContext({
        document, localStorage, sessionStorage: localStorage, crypto: webcrypto, TextEncoder,
        window: { supabase: { createClient: () => client }, addEventListener() {} },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        console: { error() {}, warn() {} }, setTimeout
    });
    const cloudSource = fs.readFileSync(path.join(root, 'js/supabase-client.js'), 'utf8');
    vm.runInContext(cloudSource.slice(0, cloudSource.indexOf('function showAuthModal')), context);
    const homeSource = fs.readFileSync(path.join(root, 'js/homepage.js'), 'utf8');
    vm.runInContext(homeSource.replace(/\}\)\(\);\s*$/, 'window.testSync = renderCloudMindmaps; })();'), context);
    return {
        set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
        get: key => JSON.parse(localStorage.getItem(key)),
        save: (...args) => context.saveMindmapToCloud(...args),
        sync: async () => { await Promise.resolve(); return context.window.testSync(user); },
        strictRead: () => context.loadMindmapsFromCloud(true)
    };
}

(async () => {
    const normal = browser();
    const first = { center: 1, nodes: { 1: { text: 'First map' } } };
    const second = { center: 1, nodes: { 1: { text: 'Second map' } } };
    normal.set('visualmind-library', [
        { id: 'map-a', name: 'Same title', kind: 'mindmap', children: [] },
        { id: 'map-b', name: 'Same title', kind: 'mindmap', children: [] }
    ]);
    normal.set('visualmind-local-mindmaps', { 'map-a': first, 'map-b': second });
    normal.set('visualmind-dirty-mindmaps', { 'map-a': true, 'map-b': true });
    await normal.sync();
    assert.equal(records.size, 2, 'Local drafts migrate as distinct documents despite equal titles');
    assert.equal(normal.get('visualmind-library').every(node => node.cloudId), true);
    assert.deepEqual(normal.get('visualmind-dirty-mindmaps'), {});

    const incognito = browser();
    await incognito.sync();
    const restored = incognito.get('visualmind-library');
    assert.equal(restored.length, 2, 'Empty browser restores account mindmaps');
    assert.equal(restored.every(node => node.cloudId), true, 'Restored entries link to cloud documents');
    assert.equal(records.get(restored.find(node => node.id === 'map-a').cloudId).data.nodes[1].text, 'First map');

    const changed = { center: 1, nodes: { 1: { text: 'Updated first map' } } };
    await normal.save('Same title', changed, 'map-a');
    assert.equal(records.size, 2, 'Repeated saves update by ID rather than creating duplicates');
    assert.equal([...records.keys()].every(Number.isInteger), true, 'Cloud IDs are generated integers');
    assert.equal([...records.values()].find(row => row.data.visualmindDocumentId === 'map-b').data.nodes[1].text, 'Second map');

    normal.set('visualmind-local-mindmaps', { 'map-a': changed, 'map-b': second });
    normal.set('visualmind-dirty-mindmaps', { 'map-a': true });
    await normal.sync();
    assert.deepEqual(normal.get('visualmind-dirty-mindmaps'), {}, 'Pending changes are retried');

    // A slow save must not acknowledge a newer local revision.
    normal.set('visualmind-local-mindmaps', { 'map-a': changed });
    normal.set('visualmind-dirty-mindmaps', { 'map-a': true });
    await normal.save('Same title', first, 'map-a');
    assert.equal(normal.get('visualmind-dirty-mindmaps')['map-a'], true);

    await Promise.all([normal.save('Concurrent', first, 'map-c'), normal.save('Concurrent', second, 'map-c')]);
    assert.equal([...records.values()].filter(row => row.data.visualmindDocumentId === 'map-c').length, 1, 'Concurrent migration and autosave share one record');

    failRead = true;
    await assert.rejects(incognito.strictRead());
    await incognito.sync();
    assert.equal(incognito.get('visualmind-library').length, 2, 'Network failure preserves existing library');
    console.log('PASS: separate browser restore, legacy draft migration, equal titles, stable IDs, pending retries, revision acknowledgement and network failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
