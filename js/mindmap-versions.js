(() => {
    const VERSION_LIMIT = 2;
    let database, timer, pending, lastJson = new Map();
    const open = () => database ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('hodi-mindmap-versions', 2);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('versions')) {
                const store = request.result.createObjectStore('versions', { keyPath: 'id' }); store.createIndex('documentId', 'documentId');
            }
            const store = request.transaction.objectStore('versions');
            const records = store.getAll();
            records.onsuccess = () => {
                const counts = new Map();
                records.result.sort((a, b) => b.time - a.time).forEach(version => {
                    const count = (counts.get(version.documentId) || 0) + 1;
                    counts.set(version.documentId, count);
                    if (count > VERSION_LIMIT) store.delete(version.id);
                });
            };
        };
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); }; request.onerror = () => reject(request.error);
    });
    const list = async documentId => {
        const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction('versions').objectStore('versions').index('documentId').getAll(documentId); request.onsuccess = () => resolve(request.result.sort((a, b) => b.time - a.time)); request.onerror = () => reject(request.error); });
    };
    const write = async (documentId, data, force = false) => {
        const json = JSON.stringify(data); if (!force && lastJson.get(documentId) === json) return;
        const db = await open();
        await new Promise((resolve, reject) => {
            const transaction = db.transaction('versions', 'readwrite'), store = transaction.objectStore('versions');
            const request = store.index('documentId').getAll(documentId);
            request.onsuccess = () => {
                const versions = request.result.sort((a, b) => b.time - a.time);
                if (!force && versions[0] && JSON.stringify(versions[0].data) === json) return;
                store.put({ id: crypto.randomUUID(), documentId, time: Math.max(Date.now(), (versions[0]?.time || 0) + 1), data: JSON.parse(json) });
                versions.slice(VERSION_LIMIT - 1).forEach(version => store.delete(version.id));
            };
            transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
        }); lastJson.set(documentId, json);
    };
    const flush = async () => {
        clearTimeout(timer); const value = pending; pending = null;
        if (value) await write(value.documentId, value.data);
    };
    window.recordMindmapVersion = (documentId, data) => {
        if (!data.center || !documentId) return;
        pending = { documentId, data: JSON.parse(JSON.stringify(data)) }; clearTimeout(timer);
        timer = setTimeout(() => flush().catch(() => showToast(MM.tr('Không lưu được lịch sử phiên bản trên thiết bị.', 'Could not save version history on this device.'), 'error')), 1000);
    };
    window.MindmapVersions = { list, write, flush };
    window.addEventListener('pagehide', () => { flush().catch(() => {}); });
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelector('.mm-tools').append(MM.button('Phiên bản', 'Versions', async () => {
            const { panel, close } = MM.dialog('Lịch sử phiên bản', 'Version history');
            const note = document.createElement('p'); note.textContent = MM.tr('Giữ 2 phiên bản gần nhất trên thiết bị này. Khôi phục vẫn có thể hoàn tác.', 'Keeps the latest 2 versions on this device. Restoring can be undone.'); panel.append(note);
            try {
                await flush(); const versions = await list(localMindmapId);
                if (!versions.length) { note.textContent = MM.tr('Chưa có phiên bản đã lưu.', 'No saved versions yet.'); return; }
                for (const version of versions) {
                    const row = document.createElement('div'); row.className = 'mm-version-row';
                    const label = document.createElement('span'); label.textContent = new Date(version.time).toLocaleString(document.documentElement.lang) + ' · ' + Object.keys(version.data.nodes).length + ' node';
                    row.append(label, MM.button('Khôi phục', 'Restore', async () => {
                        try {
                            await write(localMindmapId, mindmap, true);
                            mindmap = JSON.parse(JSON.stringify(version.data)); selection.nodeId = null; selection.selectedIds = []; saveHistory(); MM.fit(); close();
                        } catch { note.textContent = MM.tr('Không thể lưu bản dự phòng để khôi phục. Nội dung hiện tại vẫn được giữ.', 'Could not save a recovery copy. Your current content is unchanged.'); }
                    })); panel.append(row);
                }
            } catch { note.textContent = MM.tr('Không thể mở lịch sử phiên bản.', 'Unable to open version history.'); }
        }));
    });
})();
