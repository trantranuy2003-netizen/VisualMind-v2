(() => {
    const storageKey = 'visualmind-library';
    // These preferences are shared by Home, Mindmap and Flashcard.
    const themeKey = 'visualmind-theme';
    const languageKey = 'visualmind-language';
    const treeElement = document.getElementById('libraryTree');

    const translations = {
        vi: {
            home: 'Trang chủ',
            mindmap: 'Mindmap',
            flashcard: 'Flashcard',
            library: 'Thư viện',
            settings: 'Cài đặt',
            theme: 'Giao diện',
            language: 'Ngôn ngữ',
            addFile: 'Thêm tệp',
            addProject: 'Thêm Project',
            addSubproject: 'Thêm Sub-project',
            addMindmap: 'Thêm Mindmap',
            addFlashcard: 'Thêm Flashcard',
            rename: 'Đổi tên',
            remove: 'Xóa tệp',
            moveUp: 'Di chuyển lên',
            moveDown: 'Di chuyển xuống',
            makeChild: 'Đưa vào tệp cha',
            moveParent: 'Đưa lên cấp cha',
            empty: 'Chưa có tệp nào',
            fileName: 'Tên tệp',
            fileType: 'Loại tệp (mindmap/flashcard)',
            confirmDelete: 'Xóa tệp này và toàn bộ tệp con?',
            parentName: 'Tên tệp cha mới'
        },
        en: {
            home: 'Home',
            mindmap: 'Mindmap',
            flashcard: 'Flashcard',
            library: 'Library',
            settings: 'Settings',
            theme: 'Theme',
            language: 'Language',
            addFile: 'Add file',
            addProject: 'Add Project',
            addSubproject: 'Add Sub-project',
            addMindmap: 'Add Mindmap',
            addFlashcard: 'Add Flashcard',
            rename: 'Rename',
            remove: 'Delete file',
            moveUp: 'Move up',
            moveDown: 'Move down',
            makeChild: 'Move into parent',
            moveParent: 'Move to parent level',
            empty: 'No files yet',
            fileName: 'File name',
            fileType: 'File type (mindmap/flashcard)',
            confirmDelete: 'Delete this file and all children?',
            parentName: 'New parent file name'
        }
    };

    const defaultLibrary = [{ id: 'project-1', name: 'Project', kind: 'folder', children: [
        { id: 'sub-project-1', name: 'Sub-project', kind: 'folder', children: [
            { id: 'mindmap-1', name: 'Kế hoạch học tập', kind: 'mindmap', children: [] },
            { id: 'flashcard-1', name: 'Từ vựng tiếng Anh', kind: 'flashcard', children: [] }
        ] }
    ] }];

    // Library normalization needs IDs during the initial getLibrary() call.
    const makeId = () => `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const normalizeNode = (node) => ({
        ...node,
        kind: node.kind || node.type || 'mindmap',
        children: (node.children || []).map(normalizeNode)
    });

    const normalizeLibrary = (nodes) => {
        const normalized = nodes.map(normalizeNode);
        if (normalized.length && normalized.every((node) => node.kind === 'mindmap' || node.kind === 'flashcard')) {
            return [{ id: makeId(), name: 'Project', kind: 'folder', children: [{
                id: makeId(), name: 'Sub-project', kind: 'folder', children: normalized
            }] }];
        }
        return normalized;
    };

    const getLibrary = () => {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey));
            // Remove the old demo-only Project/Sub-project seed without touching
            // user-created folders or documents.
            const withoutDemoSeed = (stored || []).filter((node) => node.id !== 'project-1');
            const restored = normalizeLibrary(withoutDemoSeed);
            // The mindmap document store is the recovery source of truth. Rebuild
            // missing Library entries so navigation can never hide saved work.
            const documents = JSON.parse(localStorage.getItem('visualmind-local-mindmaps') || '{}');
            const hasNode = (nodes, id) => nodes.some((node) => node.id === id || hasNode(node.children || [], id));
            let nextNumber = restored.reduce((count, node) => count + (node.kind === 'mindmap' ? 1 : 0), 0);
            Object.entries(documents).forEach(([id, document]) => {
                if (id === 'flashcard-workspace' || !document?.center || hasNode(restored, id)) return;
                nextNumber += 1;
                restored.push({ id, name: `Mindmap ${nextNumber}`, kind: 'mindmap', children: [] });
            });
            if (JSON.stringify(stored || []) !== JSON.stringify(restored)) {
                localStorage.setItem(storageKey, JSON.stringify(restored));
            }
            return restored;
        } catch {
            return [];
        }
    };

    let library = getLibrary();
    let currentLanguage = localStorage.getItem(languageKey) || 'vi';
    let currentTheme = localStorage.getItem(themeKey) || 'dark';
    let activeDragId = null;
    let activeDropMode = null;
    let dashboardGrid = null;

    const text = (key) => translations[currentLanguage][key] || key;
    const save = () => {
        localStorage.setItem(storageKey, JSON.stringify(library));
        renderDashboardLibrary();
    };
    document.addEventListener('visualmind-library-change', () => {
        library = getLibrary();
        renderTree();
        renderDashboardLibrary();
    });
    const mindmapIcon = '<svg class="library-mindmap-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3.5A3 3 0 0 0 4 5.2a3.2 3.2 0 0 0 .5 5.9A3 3 0 0 0 7 16.5a3 3 0 0 0 2.5-1.3V19M14.5 3.5A3 3 0 0 1 20 5.2a3.2 3.2 0 0 1-.5 5.9 3 3 0 0 1-2.5 5.4 3 3 0 0 1-2.5-1.3V19M9.5 3.5v10M14.5 3.5v10M9.5 8.5h5" /></svg>';
    const flashcardIcon = '<svg class="library-flashcard-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="13" height="15" rx="2" /><path d="M8 8h7M8 11h5M8 14h3" /><path d="M18 7.5h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10" /></svg>';

    const findNode = (nodes, nodeId, parent = null) => {
        for (const node of nodes) {
            if (node.id === nodeId) return { node, parent, siblings: nodes };
            const found = findNode(node.children || [], nodeId, node);
            if (found) return found;
        }
        return null;
    };

    const showInputDialog = (message, initialValue, callback) => {
        const overlay = document.createElement('div');
        overlay.className = 'library-dialog-overlay';
        overlay.innerHTML = `<form class="library-dialog"><h3>${message}</h3><input autofocus value="${initialValue || ''}" required><div class="library-dialog-actions"><button type="button" data-cancel>Hủy</button><button class="is-primary" type="submit">Xác nhận</button></div></form>`;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('input');
        input.focus();
        input.select();
        const close = () => overlay.remove();
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        overlay.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            const value = input.value.trim();
            if (value) { close(); callback(value); }
        });
    };

    const showConfirmDialog = (message, callback) => {
        const overlay = document.createElement('div');
        overlay.className = 'library-dialog-overlay';
        overlay.innerHTML = `<div class="library-dialog"><h3>${message}</h3><div class="library-dialog-actions"><button type="button" data-cancel>Hủy</button><button class="is-danger" type="button" data-confirm>Xác nhận</button></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        overlay.querySelector('[data-confirm]').addEventListener('click', () => { close(); callback(); });
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    };

    const askForNode = (kind, callback) => {
        showInputDialog(text('fileName'), '', (name) => callback({ id: makeId(), name, kind, children: [] }));
    };

    const renderTree = () => {
        treeElement.innerHTML = '';
        if (!library.length) {
            treeElement.innerHTML = `<div class="library-empty">${text('empty')}</div>`;
            return;
        }

        const renderNodes = (nodes, depth = 0) => {
            const fragment = document.createDocumentFragment();
            nodes.forEach((node) => {
                const row = document.createElement('div');
                row.className = 'library-node';
                row.style.setProperty('--tree-depth', depth);
                row.dataset.nodeId = node.id;
                const isFolder = node.kind === 'folder';
                const isMindmap = node.kind === 'mindmap';
                row.draggable = true;
                const hasChildren = node.children && node.children.length > 0;
                row.innerHTML = `
                    <button class="library-chevron ${hasChildren ? '' : 'is-empty'}" data-action="toggle" type="button" aria-label="Toggle"></button>
                    ${isFolder ? '<div class="library-node-link library-folder-link">' : `<a class="library-node-link" href="${node.kind === 'flashcard' ? 'flashcard.html' : `mindmap.html?mapId=${encodeURIComponent(node.id)}`}">`}
                        <span class="library-file-icon ${isFolder ? 'library-folder-icon' : isMindmap ? 'library-mindmap-icon' : 'library-flashcard-icon'}" aria-hidden="true">${isMindmap ? mindmapIcon : isFolder ? '' : flashcardIcon}</span>
                        <span class="library-node-name" title="${node.name}">${node.name}</span>
                    ${isFolder ? '</div>' : '</a>'}
                    ${isFolder ? `<button class="library-add-child" data-action="subproject" type="button" aria-label="${text('addSubproject')}" title="${text('addSubproject')}">＋</button>` : '<span class="library-add-child-placeholder" aria-hidden="true"></span>'}`;
                fragment.appendChild(row);
                if (hasChildren) {
                    const children = document.createElement('div');
                    children.className = 'library-children';
                    children.dataset.parentId = node.id;
                    children.appendChild(renderNodes(node.children, depth + 1));
                    fragment.appendChild(children);
                }
            });
            return fragment;
        };
        treeElement.appendChild(renderNodes(library));
    };

    const updateTranslations = () => {
        document.documentElement.lang = currentLanguage;
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            element.textContent = text(element.dataset.i18n);
        });
        document.querySelectorAll('[data-language-choice]').forEach((button) => {
            button.classList.toggle('active', button.dataset.languageChoice === currentLanguage);
        });
        renderTree();
    };

    const setTheme = (theme) => {
        currentTheme = theme;
        document.body.dataset.homeTheme = theme;
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
        localStorage.setItem(themeKey, theme);
        document.dispatchEvent(new CustomEvent('visualmind-preferences', { detail: { theme } }));
        document.querySelectorAll('[data-theme-choice]').forEach((button) => {
            button.classList.toggle('active', button.dataset.themeChoice === theme);
        });
    };

    const moveNode = (nodeId, direction) => {
        const found = findNode(library, nodeId);
        if (!found) return;
        const index = found.siblings.indexOf(found.node);
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= found.siblings.length) return;
        [found.siblings[index], found.siblings[nextIndex]] = [found.siblings[nextIndex], found.siblings[index]];
        save();
        renderTree();
    };

    const moveIntoParent = (nodeId) => {
        const found = findNode(library, nodeId);
        if (!found || !found.parent) return;
        const possibleParents = [];
        const collectParents = (nodes) => nodes.forEach((node) => {
            if (node.id !== nodeId && node.id !== found.parent.id) possibleParents.push(node);
            collectParents(node.children || []);
        });
        collectParents(library);
        showInputDialog(text('parentName'), possibleParents[0] ? possibleParents[0].name : '', (targetName) => {
            const target = possibleParents.map((node) => findNode(library, node.id)).find((result) => result.node.name === targetName);
            if (!target) return;
            found.siblings.splice(found.siblings.indexOf(found.node), 1);
            target.node.children.push(found.node);
            save();
            renderTree();
        });
    };

    const closeContextMenu = () => {
        document.querySelector('.library-context-menu')?.remove();
    };

    const openContextMenu = (event, nodeId) => {
        closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'library-context-menu';
        menu.style.left = `${Math.min(event.clientX, window.innerWidth - 205)}px`;
        menu.style.top = `${Math.min(event.clientY, window.innerHeight - 260)}px`;
        menu.innerHTML = `
            ${foundNodeIsFolder(nodeId) ? `<button data-action="subproject" type="button">＋ ${text('addSubproject')}</button>
            <button data-action="mindmap" type="button">🟧 ${text('addMindmap')}</button>
            <button data-action="flashcard" type="button">🟧 ${text('addFlashcard')}</button>` : ''}
            <button data-action="rename" type="button">✎ ${text('rename')}</button>
            <button data-action="up" type="button">↑ ${text('moveUp')}</button>
            <button data-action="down" type="button">↓ ${text('moveDown')}</button>
            <button data-action="make-child" type="button">↳ ${text('makeChild')}</button>
            <button data-action="parent" type="button">↰ ${text('moveParent')}</button>
            <button class="is-danger" data-action="delete" type="button">× ${text('remove')}</button>`;
        menu.dataset.nodeId = nodeId;
        document.body.appendChild(menu);
    };

    const foundNodeIsFolder = (nodeId) => {
        const found = findNode(library, nodeId);
        return Boolean(found && found.node.kind === 'folder');
    };

    const containsNode = (parentNode, nodeId) => {
        return parentNode.children?.some((child) => child.id === nodeId || containsNode(child, nodeId)) || false;
    };

    treeElement.addEventListener('dragstart', (event) => {
        const row = event.target.closest('.library-node');
        if (!row?.draggable) return;
        activeDragId = row.dataset.nodeId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.nodeId);
        row.classList.add('is-dragging');
    });

    treeElement.addEventListener('dragend', (event) => {
        event.target.closest('.library-node')?.classList.remove('is-dragging');
        treeElement.querySelectorAll('.is-drop-target, .is-drop-before, .is-drop-after').forEach((node) => {
            node.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
        });
        activeDragId = null;
        activeDropMode = null;
    });

    treeElement.addEventListener('dragover', (event) => {
        const row = event.target.closest('.library-node');
        if (!row) return;
        const draggedId = activeDragId;
        const dragged = draggedId && findNode(library, draggedId);
        if (!dragged || dragged.node.id === row.dataset.nodeId || containsNode(dragged.node, row.dataset.nodeId)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const bounds = row.getBoundingClientRect();
        const offset = event.clientY - bounds.top;
        activeDropMode = offset < bounds.height * 0.28 ? 'before' : offset > bounds.height * 0.72 ? 'after' : 'inside';
        treeElement.querySelectorAll('.is-drop-target, .is-drop-before, .is-drop-after').forEach((node) => {
            node.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
        });
        row.classList.add(activeDropMode === 'inside' ? 'is-drop-target' : `is-drop-${activeDropMode}`);
    });

    treeElement.addEventListener('dragleave', (event) => {
        const row = event.target.closest('.library-node');
        if (row && !row.contains(event.relatedTarget)) {
            row.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
        }
    });

    treeElement.addEventListener('drop', (event) => {
        const targetRow = event.target.closest('.library-node');
        if (!targetRow) return;
        const draggedId = activeDragId || event.dataTransfer.getData('text/plain');
        const dragged = findNode(library, draggedId);
        const target = findNode(library, targetRow.dataset.nodeId);
        if (!dragged || !target || dragged.node.id === target.node.id || containsNode(dragged.node, target.node.id)) return;
        event.preventDefault();
        const dropMode = activeDropMode || 'inside';
        dragged.siblings.splice(dragged.siblings.indexOf(dragged.node), 1);
        if (dropMode === 'inside' && target.node.kind === 'folder') {
            target.node.children.push(dragged.node);
        } else {
            const targetIndex = target.siblings.indexOf(target.node);
            target.siblings.splice(dropMode === 'after' ? targetIndex + 1 : targetIndex, 0, dragged.node);
        }
        save();
        renderTree();
    });

    treeElement.addEventListener('contextmenu', (event) => {
        const row = event.target.closest('.library-node');
        if (!row) return;
        event.preventDefault();
        openContextMenu(event, row.dataset.nodeId);
    });

    document.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-action]');
        const row = event.target.closest('.library-node');
        const menu = event.target.closest('.library-context-menu');
        if ((!row && !menu) || !actionButton) return;
        event.preventDefault();
        const nodeId = row ? row.dataset.nodeId : menu.dataset.nodeId;
        const found = findNode(library, nodeId);
        if (!found) return;
        const action = actionButton.dataset.action;
        if (action === 'toggle') {
            const children = row && row.nextElementSibling;
            if (children && children.classList.contains('library-children')) {
                const isCollapsed = children.toggleAttribute('hidden');
                actionButton.classList.toggle('is-collapsed', isCollapsed);
            }
        } else if (action === 'subproject') {
            askForNode('folder', (child) => { found.node.children.push(child); save(); renderTree(); });
        } else if (action === 'mindmap' || action === 'flashcard') {
            askForNode(action, (child) => { found.node.children.push(child); save(); renderTree(); });
        } else if (action === 'rename') {
            showInputDialog(text('rename'), found.node.name, (name) => { found.node.name = name; save(); renderTree(); });
        } else if (action === 'delete') {
            showConfirmDialog(text('confirmDelete'), () => { found.siblings.splice(found.siblings.indexOf(found.node), 1); save(); renderTree(); });
        } else if (action === 'up') moveNode(nodeId, -1);
        else if (action === 'down') moveNode(nodeId, 1);
        else if (action === 'make-child') moveIntoParent(nodeId);
        else if (action === 'parent' && found.parent) {
            const parentFound = findNode(library, found.parent.id);
            if (parentFound && parentFound.parent) {
                found.siblings.splice(found.siblings.indexOf(found.node), 1);
                parentFound.parent.children.push(found.node);
                save();
                renderTree();
            }
        }
        closeContextMenu();
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.library-context-menu')) closeContextMenu();
    });

    document.getElementById('addRootFile').addEventListener('click', () => {
        askForNode('folder', (project) => { library.push(project); save(); renderTree(); });
    });

    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
    });
    document.querySelectorAll('[data-language-choice]').forEach((button) => {
        button.addEventListener('click', () => {
            currentLanguage = button.dataset.languageChoice;
            localStorage.setItem(languageKey, currentLanguage);
            document.dispatchEvent(new CustomEvent('visualmind-preferences', { detail: { language: currentLanguage } }));
            updateTranslations();
        });
    });

    const cloudGrid = document.querySelector('.home-grid');
    dashboardGrid = cloudGrid;

    function getMindmapDocuments(nodes = library) {
        return nodes.flatMap((node) => [
            ...(node.kind === 'mindmap' ? [node] : []),
            ...getMindmapDocuments(node.children || [])
        ]);
    }

    async function removeMindmapDocument(id) {
        const found = findNode(library, id);
        if (!found) return;
        const title = found.node.name;
        found.siblings.splice(found.siblings.indexOf(found.node), 1);
        try {
            const documents = JSON.parse(localStorage.getItem('visualmind-local-mindmaps') || '{}');
            delete documents[id];
            localStorage.setItem('visualmind-local-mindmaps', JSON.stringify(documents));
        } catch { /* The library entry is still removed if draft data is unavailable. */ }
        save();
        renderTree();
        // Cloud deletion is best-effort: a network/RLS issue must never prevent
        // the user from removing the local document from the interface.
        if (typeof deleteMindmapFromCloud === 'function') {
            await deleteMindmapFromCloud(title);
        }
    }

    function renderDashboardLibrary() {
        if (!dashboardGrid) return;
        const documents = getMindmapDocuments();
        dashboardGrid.innerHTML = '';
        if (!documents.length) {
            dashboardGrid.innerHTML = `<p class="project-meta">${currentLanguage === 'vi' ? 'Chưa có mindmap. Rê chuột vào Mindmap ở thanh bên để tạo sơ đồ đầu tiên.' : 'No mindmaps yet. Hover Mindmap in the sidebar to create your first one.'}</p>`;
            return;
        }
        documents.forEach((document) => {
            const card = document.createElement('article');
            card.className = 'project-card';
            const link = document.createElement('a');
            link.className = 'project-card-link';
            link.href = `mindmap.html?mapId=${encodeURIComponent(document.id)}`;
            link.innerHTML = `<div class="project-thumbnail"><span class="thumbnail-map" aria-hidden="true"></span><span class="thumbnail-label">Mindmap</span></div><div class="project-info"><span class="project-icon" aria-hidden="true">${mindmapIcon}</span><div><h2 class="project-title"></h2><p class="project-meta">Mindmap</p></div></div>`;
            link.querySelector('.project-title').textContent = document.name;
            card.appendChild(link);
            const actions = document.createElement('div');
            actions.className = 'project-card-actions';
            actions.innerHTML = `<button type="button" data-rename>${currentLanguage === 'vi' ? 'Đổi tên' : 'Rename'}</button><button type="button" data-delete>${currentLanguage === 'vi' ? 'Xóa' : 'Delete'}</button>`;
            actions.querySelector('[data-rename]').addEventListener('click', () => {
                showInputDialog(currentLanguage === 'vi' ? 'Đổi tên mindmap' : 'Rename mindmap', document.name, (name) => {
                    const found = findNode(library, document.id);
                    if (!found) return;
                    found.node.name = name;
                    save();
                    renderTree();
                });
            });
            actions.querySelector('[data-delete]').addEventListener('click', () => {
                showConfirmDialog(currentLanguage === 'vi' ? `Xóa mindmap “${document.name}”?` : `Delete “${document.name}”?`, () => removeMindmapDocument(document.id));
            });
            card.appendChild(actions);
            dashboardGrid.appendChild(card);
        });
    }

    const setupDashboard = () => {
        if (!cloudGrid) return;
        const storageKey = 'visualmind-eisenhower-tasks';
        const dashboard = document.createElement('section');
        dashboard.className = 'learning-dashboard';
        dashboard.innerHTML = `
            <section class="todo-panel" aria-labelledby="todoTitle">
                <div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Hôm nay</p><h2 id="todoTitle">To-do list</h2></div><span class="task-count" data-task-count>0 việc</span></div>
                <form class="todo-create-form" data-todo-form><input data-todo-input maxlength="160" placeholder="Thêm việc cần làm..." aria-label="Việc cần làm"><button type="submit">Thêm</button></form>
                <div class="todo-inbox-list" data-task-list="inbox" aria-label="Việc chưa phân loại"></div>
                <p class="todo-drop-hint">Kéo một việc vào ma trận để ưu tiên.</p>
            </section>
            <section class="eisenhower-panel" aria-labelledby="matrixTitle">
                <div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Ưu tiên công việc</p><h2 id="matrixTitle">Ma trận Eisenhower</h2></div><span class="matrix-help">Kéo & thả</span></div>
                <div class="eisenhower-matrix">
                    <div class="matrix-cell matrix-do"><div class="matrix-label"><span>Khẩn + Quan trọng</span><b>Làm ngay</b></div><div class="matrix-dropzone" data-task-list="do"></div></div>
                    <div class="matrix-cell matrix-schedule"><div class="matrix-label"><span>Không khẩn + Quan trọng</span><b>Lên lịch</b></div><div class="matrix-dropzone" data-task-list="schedule"></div></div>
                    <div class="matrix-cell matrix-delegate"><div class="matrix-label"><span>Khẩn + Không quan trọng</span><b>Uỷ quyền</b></div><div class="matrix-dropzone" data-task-list="delegate"></div></div>
                    <div class="matrix-cell matrix-eliminate"><div class="matrix-label"><span>Không khẩn + Không quan trọng</span><b>Loại bỏ</b></div><div class="matrix-dropzone" data-task-list="eliminate"></div></div>
                </div>
            </section>`;
        cloudGrid.parentElement.insertBefore(dashboard, cloudGrid);

        const libraryHeading = document.createElement('div');
        libraryHeading.className = 'dashboard-library-heading';
        libraryHeading.innerHTML = '<div><p class="dashboard-kicker">Thư viện</p><h2>Tất cả mindmap</h2></div><span>Được cập nhật gần đây</span>';
        // Mindmaps are managed from the left Library tree, not duplicated on the dashboard.

        const readTasks = () => {
            try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
        };
        let tasks = readTasks().filter((task) => task && task.id && task.title);
        const saveTasks = () => localStorage.setItem(storageKey, JSON.stringify(tasks));

        const renderTasks = () => {
            dashboard.querySelector('[data-task-count]').textContent = `${tasks.length} việc`;
            dashboard.querySelectorAll('[data-task-list]').forEach((list) => {
                const status = list.dataset.taskList;
                const grouped = tasks.filter((task) => task.status === status);
                list.innerHTML = '';
                if (!grouped.length) {
                    list.innerHTML = '<p class="todo-empty">Thả việc vào đây</p>';
                    return;
                }
                grouped.forEach((task) => {
                    const item = document.createElement('article');
                    item.className = 'todo-item';
                    item.draggable = true;
                    item.dataset.taskId = task.id;
                    item.classList.toggle('is-completed', Boolean(task.completed));
                    item.innerHTML = '<span class="todo-grip" aria-hidden="true">⠿</span><label class="todo-check"><input type="checkbox" data-toggle-task><span aria-hidden="true"></span></label><span class="todo-item-title"></span><button type="button" data-delete-task aria-label="Xóa việc">×</button>';
                    item.querySelector('[data-toggle-task]').checked = Boolean(task.completed);
                    item.querySelector('.todo-item-title').textContent = task.title;
                    list.appendChild(item);
                });
            });
        };

        dashboard.querySelector('[data-todo-form]').addEventListener('submit', (event) => {
            event.preventDefault();
            const input = dashboard.querySelector('[data-todo-input]');
            const title = input.value.trim();
            if (!title) return;
            tasks.unshift({ id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, status: 'inbox' });
            saveTasks();
            renderTasks();
            input.value = '';
            input.focus();
        });

        dashboard.addEventListener('click', (event) => {
            const checkbox = event.target.closest('[data-toggle-task]');
            if (checkbox) {
                const item = checkbox.closest('.todo-item');
                const task = tasks.find((entry) => entry.id === item.dataset.taskId);
                if (!task) return;
                task.completed = checkbox.checked;
                saveTasks();
                renderTasks();
                return;
            }
            const button = event.target.closest('[data-delete-task]');
            if (!button) return;
            const item = button.closest('.todo-item');
            tasks = tasks.filter((task) => task.id !== item.dataset.taskId);
            saveTasks();
            renderTasks();
        });

        dashboard.addEventListener('dragstart', (event) => {
            const item = event.target.closest('.todo-item');
            if (!item) return;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.dataset.taskId);
            item.classList.add('is-dragging');
        });
        dashboard.addEventListener('dragend', (event) => {
            const item = event.target.closest('.todo-item');
            if (item) item.classList.remove('is-dragging');
            dashboard.querySelectorAll('.is-drag-over').forEach((list) => list.classList.remove('is-drag-over'));
        });
        dashboard.addEventListener('dragover', (event) => {
            const list = event.target.closest('[data-task-list]');
            if (!list) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            list.classList.add('is-drag-over');
        });
        dashboard.addEventListener('dragleave', (event) => {
            const list = event.target.closest('[data-task-list]');
            if (list && !list.contains(event.relatedTarget)) list.classList.remove('is-drag-over');
        });
        dashboard.addEventListener('drop', (event) => {
            const list = event.target.closest('[data-task-list]');
            if (!list) return;
            event.preventDefault();
            const task = tasks.find((entry) => entry.id === event.dataTransfer.getData('text/plain'));
            if (!task) return;
            task.status = list.dataset.taskList;
            saveTasks();
            renderTasks();
        });
        renderTasks();
    };

    setupDashboard();
    if (cloudGrid) {
        cloudGrid.remove();
        dashboardGrid = null;
    }

    let cloudRenderVersion = 0;
    const renderCloudMindmaps = async (user) => {
        // The dashboard mirrors the local Library tree, so both always show the same mindmaps.
        renderDashboardLibrary();
        return;
        if (!cloudGrid) return;
        const renderVersion = ++cloudRenderVersion;
        if (!user) {
            cloudGrid.innerHTML = '<p class="project-meta">Đăng nhập để xem các mindmap đã lưu trên cloud.</p>';
            return;
        }

        const mindmaps = await loadMindmapsFromCloud();
        if (renderVersion !== cloudRenderVersion) return;
        if (!mindmaps.length) {
            cloudGrid.innerHTML = '<p class="project-meta">Chưa có mindmap nào trên cloud. Hãy tạo và lưu mindmap đầu tiên của bạn.</p>';
            return;
        }

        cloudGrid.innerHTML = '';
        mindmaps.forEach((mindmap) => {
            const card = document.createElement('article');
            card.className = 'project-card';
            const isFlashcardOnly = !mindmap.data?.center && (mindmap.data?.flashcards || []).length > 0;
            const link = document.createElement('a');
            link.className = 'project-card-link';
            link.href = `${isFlashcardOnly ? 'flashcard.html' : 'mindmap.html'}?cloudId=${encodeURIComponent(mindmap.id)}`;
            const updatedAt = mindmap.updated_at
                ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(mindmap.updated_at))
                : '';
            const contentType = isFlashcardOnly ? 'Flashcard' : 'Mindmap';
            link.innerHTML = `<div class="project-thumbnail"><span class="${isFlashcardOnly ? 'thumbnail-cards' : 'thumbnail-map'}" aria-hidden="true"></span><span class="thumbnail-label">${contentType}</span></div>`;
            const info = document.createElement('div');
            info.className = 'project-info';
            info.innerHTML = `<span class="project-icon" aria-hidden="true">${isFlashcardOnly ? flashcardIcon : mindmapIcon}</span><div><h2 class="project-title"></h2><p class="project-meta"></p></div>`;
            info.querySelector('.project-title').textContent = mindmap.title;
            const nodeCount = Object.keys(mindmap.data?.nodes || {}).length;
            const cardCount = (mindmap.data?.flashcards || []).length;
            const contentSummary = isFlashcardOnly
                ? `${cardCount} thẻ`
                : `${nodeCount} node${cardCount ? ` · ${cardCount} thẻ` : ''}`;
            info.querySelector('.project-meta').textContent = updatedAt
                ? `${contentType} · ${contentSummary} · Cập nhật ${updatedAt}`
                : `${contentType} · ${contentSummary}`;
            link.appendChild(info);
            card.appendChild(link);
            const renameButton = document.createElement('button');
            renameButton.type = 'button';
            renameButton.className = 'project-rename-btn';
            renameButton.textContent = currentLanguage === 'vi' ? 'Đổi tên' : 'Rename';
            renameButton.addEventListener('click', () => {
                showInputDialog(currentLanguage === 'vi' ? 'Đổi tên mindmap' : 'Rename mindmap', mindmap.title, async (title) => {
                    const renamed = await renameMindmapInCloud(mindmap.id, title);
                    if (renamed) renderCloudMindmaps(user);
                    else window.alert(currentLanguage === 'vi' ? 'Không thể đổi tên. Vui lòng thử lại.' : 'Could not rename this mindmap. Please try again.');
                });
            });
            card.appendChild(renameButton);
            cloudGrid.appendChild(card);
        });
    };

    if (cloudGrid) {
        document.addEventListener('visualmind-auth-change', (event) => {
            renderCloudMindmaps(event.detail.user);
        });
        if (supabaseClient) {
            supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
                if (error) {
                    console.error('[VisualMind] Could not restore Supabase session for the home grid:', error);
                }
                renderCloudMindmaps(session?.user || null);
            }).catch((error) => {
                console.error('[VisualMind] Failed while restoring Supabase session for the home grid:', error);
                renderCloudMindmaps(null);
            });
        }
    }

    setTheme(currentTheme);
    updateTranslations();
    renderDashboardLibrary();
})();
