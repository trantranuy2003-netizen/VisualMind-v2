(() => {
    const tr = (vi, en) => localStorage.getItem('visualmind-language') === 'en' ? en : vi;
    const button = (vi, en, action) => {
        const node = document.createElement('button'); node.type = 'button'; node.className = 'control-btn';
        node.dataset.mmVi = vi; node.dataset.mmEn = en; node.textContent = tr(vi, en); node.onclick = action; return node;
    };
    const dialog = (vi, en) => {
        const previous = document.activeElement, overlay = document.createElement('div'); overlay.className = 'mm-overlay';
        const panel = document.createElement('section'); panel.className = 'mm-dialog'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', tr(vi, en));
        const heading = document.createElement('header'), title = document.createElement('h2'); title.textContent = tr(vi, en);
        const close = () => { overlay.remove(); if (previous?.isConnected) previous.focus(); };
        heading.append(title, button('Đóng', 'Close', close)); panel.append(heading); overlay.append(panel); document.body.append(overlay);
        overlay.onclick = event => { if (event.target === overlay) close(); };
        overlay.onkeydown = event => {
            if (event.key === 'Escape') { event.stopPropagation(); close(); }
            if (event.key === 'Tab') {
                const nodes = [...panel.querySelectorAll('button,input,select,textarea,a[href]')].filter(node => !node.disabled && node.getClientRects().length);
                if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
                else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
            }
        };
        heading.querySelector('button').focus(); return { panel, close };
    };
    const bounds = (visible = false) => {
        const nodes = Object.values(mindmap.nodes).filter(node => !visible || !isNodeHidden(node.id));
        if (!nodes.length) return null;
        const left = Math.min(...nodes.map(n => n.x)) - 40, top = Math.min(...nodes.map(n => n.y)) - 40;
        return { x: left, y: top, width: Math.max(...nodes.map(n => n.x + n.width)) - left + 40, height: Math.max(...nodes.map(n => n.y + n.height)) - top + 40 };
    };
    const focusNode = id => {
        const node = mindmap.nodes[id]; if (!node || !canvas) return;
        let parent = mindmap.nodes[node.parent], changed = false;
        const visited = new Set();
        while (parent && !visited.has(parent.id)) { visited.add(parent.id); changed ||= parent.collapsed; parent.collapsed = false; parent = mindmap.nodes[parent.parent]; }
        selection.nodeId = node.id; selection.selectedIds = [node.id];
        selection.selectedLink = null; selection.selectedConnector = null; selection.selectedConnectors = [];
        viewport.x = -(node.x + node.width / 2) * viewport.zoom; viewport.y = -(node.y + node.height / 2) * viewport.zoom;
        if (changed) saveHistory(); render();
    };
    const fit = () => {
        const box = bounds(true); if (!box) return;
        viewport.zoom = Math.max(.03, Math.min(2, (canvas.width - 40) / box.width, (canvas.height - 120) / box.height));
        viewport.x = -(box.x + box.width / 2) * viewport.zoom; viewport.y = -(box.y + box.height / 2) * viewport.zoom;
        updateZoomDisplay(); render();
    };
    window.MM = { tr, button, dialog, bounds, focusNode, fit };
    let searchInput, results, focusedLink = false;
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const searchable = node => normalize(node.text + ' ' + (node.comment || '') + ' ' + (node.tableData || []).flat().join(' '));
    const search = () => {
        results.replaceChildren(); const query = normalize(searchInput.value.trim());
        if (!query) { results.hidden = true; render(); return; }
        const matches = Object.values(mindmap.nodes).filter(node => searchable(node).includes(query));
        results.hidden = false;
        const count = document.createElement('p'); count.setAttribute('role', 'status'); count.textContent = matches.length + tr(' kết quả', ' results'); results.append(count);
        matches.forEach(node => { const result = button(node.text, node.text, () => focusNode(node.id)); result.dataset.searchNode = node.id; results.append(result); });
        render();
    };
    window.onMindmapRender = () => {
        if (window.mmExporting) return;
        const query = searchInput && normalize(searchInput.value.trim());
        if (query) {
            ctx.save(); ctx.translate(canvas.width / 2 + viewport.x, canvas.height / 2 + viewport.y); ctx.scale(viewport.zoom, viewport.zoom);
            ctx.strokeStyle = '#ff7411'; ctx.lineWidth = 3 / viewport.zoom;
            Object.values(mindmap.nodes).filter(node => !isNodeHidden(node.id) && searchable(node).includes(query)).forEach(node => ctx.strokeRect(node.x - 3, node.y - 3, node.width + 6, node.height + 6)); ctx.restore();
        }
        const nodeId = new URLSearchParams(location.search).get('nodeId');
        if (nodeId && mindmap.nodes[nodeId] && !focusedLink) { focusedLink = true; requestAnimationFrame(() => focusNode(nodeId)); }
    };
    function keyboard(event) {
        const target = event.target;
        if (target.closest('input,textarea,select,[contenteditable="true"],.mm-overlay,.library-dialog-overlay')) return;
        const node = mindmap.nodes[selection.nodeId || mindmap.center];
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopImmediatePropagation(); searchInput.focus(); return; }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === 'Tab' && event.shiftKey) return;
        if (target.closest('button,a') && ['Enter', ' '].includes(event.key)) return;
        if (event.key === 'F2' && node) { event.preventDefault(); startInlineEdit(node.id); }
        else if ((event.key === 'Tab' && target === canvas) || (event.key === 'Enter' && target === canvas)) {
            if (!node) return; event.preventDefault();
            const parent = event.key === 'Tab' ? node : mindmap.nodes[node.parent] || node;
            parent.collapsed = false; addChildNode(parent.id); selection.selectedIds = [selection.nodeId]; focusNode(selection.nodeId); startInlineEdit(selection.nodeId);
        } else if (event.key.startsWith('Arrow') && node && target === canvas) {
            event.preventDefault(); const siblings = mindmap.nodes[node.parent]?.children || [node.id];
            const index = siblings.indexOf(node.id);
            const next = event.key === 'ArrowLeft' ? node.parent : event.key === 'ArrowRight' ? node.children?.[0] : siblings[(index + (event.key === 'ArrowDown' ? 1 : -1) + siblings.length) % siblings.length];
            if (next != null) focusNode(next);
        } else if (event.key.toLowerCase() === 'f' && target === canvas) { event.preventDefault(); fit(); }
        else if (event.key === '0' && target === canvas) { viewport.zoom = 1; focusNode(mindmap.center); updateZoomDisplay(); }
    }
    function touchControls() {
        const pointers = new Map(); let gesture = null, previousTap = null;
        const point = event => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
        const reset = () => {
            const values = [...pointers.values()];
            if (values.length >= 2) {
                const [a, b] = values, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                gesture = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewport.zoom, worldX: (mid.x - canvas.width / 2 - viewport.x) / viewport.zoom, worldY: (mid.y - canvas.height / 2 - viewport.y) / viewport.zoom };
            } else if (values.length) gesture = { type: 'pan', start: values[0], x: viewport.x, y: viewport.y };
        };
        canvas.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            event.preventDefault(); canvas.focus(); canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, point(event));
            if (pointers.size === 1) {
                const p = point(event), x = (p.x - canvas.width / 2 - viewport.x) / viewport.zoom, y = (p.y - canvas.height / 2 - viewport.y) / viewport.zoom;
                const node = Object.values(mindmap.nodes).reverse().find(n => !isNodeHidden(n.id) && x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height);
                if (node) {
                    selection.nodeId = node.id; selection.selectedIds = [node.id];
                    gesture = { type: 'node', node, start: p, positions: Object.values(mindmap.nodes).filter(n => n.id === node.id || isDescendantOf(n.id, node.id)).map(n => ({ node: n, x: n.x, y: n.y })), moved: false };
                    render();
                } else reset();
            } else {
                if (gesture?.type === 'node' && gesture.moved) saveHistory(); reset();
            }
        });
        canvas.addEventListener('pointermove', event => {
            if (!pointers.has(event.pointerId)) return; event.preventDefault(); pointers.set(event.pointerId, point(event));
            if (gesture?.type === 'pinch' && pointers.size >= 2) {
                const [a, b] = [...pointers.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                viewport.zoom = Math.max(.05, Math.min(5, gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gesture.distance)));
                viewport.x = mid.x - canvas.width / 2 - gesture.worldX * viewport.zoom; viewport.y = mid.y - canvas.height / 2 - gesture.worldY * viewport.zoom;
            } else if (gesture?.type === 'pan') {
                const p = point(event); viewport.x = gesture.x + p.x - gesture.start.x; viewport.y = gesture.y + p.y - gesture.start.y;
            } else if (gesture?.type === 'node') {
                const p = point(event), dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
                if (Math.hypot(dx, dy) > 5) gesture.moved = true;
                if (gesture.moved) gesture.positions.forEach(item => { item.node.x = item.x + dx / viewport.zoom; item.node.y = item.y + dy / viewport.zoom; });
            }
            updateZoomDisplay(); render();
        });
        const end = event => {
            if (!pointers.has(event.pointerId)) return;
            if (gesture?.type === 'node') {
                if (event.type === 'pointercancel') gesture.positions.forEach(item => { item.node.x = item.x; item.node.y = item.y; });
                else if (gesture.moved) saveHistory();
                else if (previousTap?.id === gesture.node.id && Date.now() - previousTap.time < 400) { startInlineEdit(gesture.node.id); previousTap = null; }
                else previousTap = { id: gesture.node.id, time: Date.now() };
            }
            pointers.delete(event.pointerId); gesture = null; if (pointers.size) reset(); render();
        };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    }
    window.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('canvas')) return;
        canvas.tabIndex = 0; canvas.setAttribute('aria-label', tr('Sơ đồ tư duy. Tab thêm nhánh con, Enter thêm nhánh cùng cấp, F2 sửa.', 'Mindmap. Tab adds a child, Enter adds a sibling, F2 edits.'));
        canvas.addEventListener('mousedown', () => canvas.focus());
        const tools = document.createElement('div'); tools.className = 'mm-tools';
        searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = tr('Tìm trong sơ đồ…', 'Search mindmap…'); searchInput.setAttribute('aria-label', searchInput.placeholder); searchInput.oninput = search;
        results = document.createElement('div'); results.className = 'mm-search-results'; results.hidden = true;
        searchInput.onkeydown = event => { if (event.key === 'Escape') { searchInput.value = ''; search(); canvas.focus(); } if (event.key === 'Enter') { results.querySelector('button')?.click(); } };
        const fitButton = button('Vừa màn hình', 'Fit to screen', fit);
        document.querySelector('.create-node-btn').after(fitButton);
        tools.append(searchInput, button('Phím tắt', 'Shortcuts', () => {
            const { panel } = dialog('Phím tắt', 'Shortcuts'); const p = document.createElement('p'); p.textContent = tr('Chọn vùng sơ đồ rồi dùng: Tab — nhánh con; Enter — nhánh cùng cấp; F2 — sửa; ← — nhánh cha; → — nhánh con; ↑↓ — nhánh cùng cấp; F — vừa màn hình; 0 — zoom 100%; Ctrl/Cmd+F — tìm kiếm; Ctrl/Cmd+Z — hoàn tác; Ctrl/Cmd+Shift+Z — làm lại. Cảm ứng: kéo nền để di chuyển, kéo node để đổi vị trí, chụm hai ngón để zoom, chạm đúp để sửa.', 'Focus the canvas: Tab — child; Enter — sibling; F2 — edit; arrows — navigate; F — fit; 0 — 100%; Ctrl/Cmd+F — search; Ctrl/Cmd+Z — undo; Ctrl/Cmd+Shift+Z — redo. Touch: drag background to pan, drag nodes to move, pinch to zoom, double-tap to edit.'); panel.append(p);
        }));
        tools.append(results); document.getElementById('canvasArea').append(tools);
        document.addEventListener('keydown', keyboard, true); touchControls();
        document.addEventListener('visualmind-preferences', () => { document.querySelectorAll('[data-mm-vi]').forEach(node => { node.textContent = tr(node.dataset.mmVi, node.dataset.mmEn); }); searchInput.placeholder = tr('Tìm trong sơ đồ…', 'Search mindmap…'); });
    });
})();
