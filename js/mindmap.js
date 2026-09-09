        // ============ INLINE EDIT ============
        function startInlineEdit(nodeId) {
            closeInlineEdit();
            if (tableCellEdit) { tableCellEdit.remove();
                tableCellEdit = null; }
            const node = mindmap.nodes[nodeId];
            if (!node || node.isTable) return;
            const rect = canvas.getBoundingClientRect();
            const screenX = (node.x + canvas.width / 2 + viewport.x) * viewport.zoom + rect.left;
            const screenY = (node.y + canvas.height / 2 + viewport.y) * viewport.zoom + rect.top;
            const screenW = node.width * viewport.zoom;
            const screenH = node.height * viewport.zoom;
            const textarea = document.createElement('textarea');
            textarea.className = 'inline-edit';
            textarea.value = node.text;
            const align = node.textAlign || 'center';
            textarea.style.cssText =
                `position:fixed; left:${screenX}px; top:${screenY}px; width:${screenW}px; height:${screenH}px; z-index:1000; border:2px solid var(--accent); border-radius:${node.id === mindmap.center ? '18px' : '13px'}; padding:4px 12px; font-size:${node.fontSize}px; font-family:'Inter',sans-serif; font-weight:${node.id === mindmap.center ? '800' : '500'}; text-align:${align}; box-shadow:0 4px 20px rgba(31,37,68,0.2); background:var(--panel-bg); color:var(--ink); resize:none; overflow:hidden; white-space:pre-wrap; line-height:1.3;`;
            document.body.appendChild(textarea);
            inlineEdit = textarea;
            textarea.focus();
            textarea.select();
            let done = false;

            function commit() {
                if (done) return;
                done = true;
                node.text = textarea.value;
                node.height = measureNodeHeight(node);
                textarea.remove();
                inlineEdit = null;
                saveHistory();
                render();
                if (selection.nodeId === nodeId) showRightPanel(nodeId);
            }
            textarea.addEventListener('keydown', e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault();
                    commit(); } else if (e.key === 'Escape') { done = true;
                    textarea.remove();
                    inlineEdit = null;
                    render(); }
            });
            textarea.addEventListener('blur', commit);
        }

        function closeInlineEdit() {
            if (inlineEdit) { inlineEdit.remove();
                inlineEdit = null; }
            if (tableCellEdit) { tableCellEdit.remove();
                tableCellEdit = null; }
        }

        let autoScrollInterval = null;
        const SCROLL_THRESHOLD = 60;
        const SCROLL_SPEED = 20;

        function startAutoScroll(e) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            let dx = 0,
                dy = 0;
            if (canvasX < SCROLL_THRESHOLD) dx = SCROLL_SPEED / viewport.zoom;
            else if (canvasX > canvas.width - SCROLL_THRESHOLD) dx = -SCROLL_SPEED / viewport.zoom;
            if (canvasY < SCROLL_THRESHOLD) dy = SCROLL_SPEED / viewport.zoom;
            else if (canvasY > canvas.height - SCROLL_THRESHOLD) dy = -SCROLL_SPEED / viewport.zoom;
            if (dx !== 0 || dy !== 0) {
                viewport.x += dx;
                viewport.y += dy;
                render();
                return true;
            }
            return false;
        }

        function stopAutoScroll() {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        }

        function handleMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const worldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
            const worldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;

            if (selection.dragging || selection.multiDragStart) {
                const scrolled = startAutoScroll(e);
                if (scrolled) {
                    if (selection.dragging && selection.nodeId) {
                        const node = mindmap.nodes[selection.nodeId];
                        if (node && node.id !== mindmap.center) {
                            const newWorldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
                            const newWorldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;
                            node.x = newWorldX - selection.dragOffset.x;
                            node.y = newWorldY - selection.dragOffset.y;
                            const cx = node.x + node.width / 2;
                            const cy = node.y + node.height / 2;
                            dragDropTargetId = findReparentTargetAt(cx, cy, node.id);
                        }
                    } else if (selection.multiDragStart) {
                        const dx = worldX - selection.multiDragStart.x;
                        const dy = worldY - selection.multiDragStart.y;
                        let sumX = 0,
                            sumY = 0,
                            count = 0;
                        selection.selectedIds.forEach((id, idx) => {
                            const node = mindmap.nodes[id];
                            if (node && node.id !== mindmap.center) {
                                const offset = selection.multiDragOffsets[idx] || { startX: 0,
                                    startY: 0 };
                                node.x = offset.startX + dx;
                                node.y = offset.startY + dy;
                                sumX += node.x + node.width / 2;
                                sumY += node.y + node.height / 2;
                                count++;
                            }
                        });
                        if (count > 0) {
                            dragDropTargetId = findReparentTargetForGroup(sumX / count, sumY / count, selection
                                .selectedIds);
                        }
                    }
                    render();
                    return;
                } else {
                    stopAutoScroll();
                }
            } else {
                stopAutoScroll();
            }

            if (selection.isBoxSelecting && selection.shiftDown && selection.boxStart) {
                selection.boxEnd = { x: canvasX, y: canvasY };
                render();
                return;
            }

            if (selection.multiDragStart) {
                const dx = worldX - selection.multiDragStart.x;
                const dy = worldY - selection.multiDragStart.y;
                let sumX = 0,
                    sumY = 0,
                    count = 0;
                selection.selectedIds.forEach((id, idx) => {
                    const node = mindmap.nodes[id];
                    if (node && node.id !== mindmap.center) {
                        const offset = selection.multiDragOffsets[idx] || { startX: 0, startY: 0 };
                        node.x = offset.startX + dx;
                        node.y = offset.startY + dy;
                        sumX += node.x + node.width / 2;
                        sumY += node.y + node.height / 2;
                        count++;
                    }
                });
                if (count > 0) {
                    dragDropTargetId = findReparentTargetForGroup(sumX / count, sumY / count, selection.selectedIds);
                }
                render();
                return;
            }

            let hoveredNode = null;
            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (!isNodeHidden(nodeId) && worldX >= node.x && worldX <= node.x + node.width &&
                    worldY >= node.y && worldY <= node.y + node.height) {
                    hoveredNode = node;
                    break;
                }
            }
            if (hoveredNode && hoveredNode.id !== selection.nodeId) {
                if (hoveredNodeId !== hoveredNode.id) {
                    hoveredNodeId = hoveredNode.id;
                    if (tooltipTimer) clearTimeout(tooltipTimer);
                    tooltipTimer = setTimeout(() => showNodeTooltip(hoveredNodeId, e), 500);
                }
            } else {
                if (tooltipTimer) { clearTimeout(tooltipTimer);
                    tooltipTimer = null; }
                if (hoveredNodeId) hideNodeTooltip();
            }

            if (selection.panStart) {
                const dx = canvasX - selection.panStart.x;
                const dy = canvasY - selection.panStart.y;
                viewport.x += dx;
                viewport.y += dy;
                selection.panStart = { x: canvasX, y: canvasY };
                render();
            } else if (selection.resizing && selection.nodeId) {
                const node = mindmap.nodes[selection.nodeId];
                if (node && node.id !== mindmap.center) {
                    if (selection.resizeHandle === 'right') {
                        node.width = Math.max(60, worldX - node.x);
                    } else if (selection.resizeHandle === 'bottom') {
                        node.height = Math.max(40, worldY - node.y);
                    } else if (selection.resizeHandle === 'both') {
                        node.width = Math.max(60, worldX - node.x);
                        node.height = Math.max(40, worldY - node.y);
                    }
                    render();
                }
            } else if (selection.dragging && selection.nodeId) {
                const node = mindmap.nodes[selection.nodeId];
                if (node && node.id !== mindmap.center) {
                    node.x = worldX - selection.dragOffset.x;
                    node.y = worldY - selection.dragOffset.y;
                    const cx = node.x + node.width / 2;
                    const cy = node.y + node.height / 2;
                    dragDropTargetId = findReparentTargetAt(cx, cy, node.id);
                    render();
                }
            }

            let onCollapseIndicator = false;
            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (node.children && node.children.length > 0 && node.id !== mindmap.center && !isNodeHidden(nodeId)) {
                    const size = 14 / viewport.zoom;
                    const indicatorArea = { x: node.x + node.width - size - 8, y: node.y + 2, w: size + 4, h: size + 4 };
                    if (worldX >= indicatorArea.x && worldX <= indicatorArea.x + indicatorArea.w &&
                        worldY >= indicatorArea.y && worldY <= indicatorArea.y + indicatorArea.h) {
                        onCollapseIndicator = true;
                        break;
                    }
                }
            }
            const connector = findConnectorAt(worldX, worldY);
            if (connector) { canvas.style.cursor = 'pointer'; } else if (onCollapseIndicator) { canvas.style.cursor =
                    'pointer'; } else if (selection.nodeId && !selection.dragging && !selection.resizing && !selection
                .multiDragStart) {
                const node = mindmap.nodes[selection.nodeId];
                if (node) {
                    const handleSize = 10 / viewport.zoom;
                    const onRight = worldX > node.x + node.width - handleSize && worldX < node.x + node.width;
                    const onBottom = worldY > node.y + node.height - handleSize && worldY < node.y + node.height;
                    const onCorner = onRight && onBottom;
                    const onRightEdge = onRight && worldY > node.y + node.height / 2 - handleSize && worldY < node.y +
                        node.height / 2 + handleSize;
                    const onBottomEdge = onBottom && worldX > node.x + node.width / 2 - handleSize && worldX < node.x +
                        node.width / 2 + handleSize;
                    if (onCorner) canvas.style.cursor = 'nwse-resize';
                    else if (onRightEdge) canvas.style.cursor = 'ew-resize';
                    else if (onBottomEdge) canvas.style.cursor = 'ns-resize';
                    else canvas.style.cursor = 'grab';
                }
            } else if (!selection.nodeId) { canvas.style.cursor = 'grab'; }
        }

        function handleMouseDown(e) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const worldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
            const worldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;

            closeInlineEdit();
            closeContextMenu();

            if (pendingLink && pendingLink.type === 'flashcard') {
                let target = null;
                for (const nodeId in mindmap.nodes) {
                    const node = mindmap.nodes[nodeId];
                    if (!isNodeHidden(nodeId) && worldX >= node.x && worldX <= node.x + node.width &&
                        worldY >= node.y && worldY <= node.y + node.height) {
                        target = node;
                        break;
                    }
                }
                if (target) {
                    linkFlashcardToNode(pendingLink.id, target.id);
                    const fcId = pendingLink.id;
                    cancelPendingLink();
                    switchAppMode('flashcard');
                    const idx = fcOrder.indexOf(fcId);
                    if (idx >= 0) fcIndex = idx;
                    renderFlashcardStudy();
                    renderFlashcardList();
                }
                render();
                return;
            }

            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (node.children && node.children.length > 0 && node.id !== mindmap.center && !isNodeHidden(nodeId)) {
                    const size = 14 / viewport.zoom;
                    const indicatorArea = { x: node.x + node.width - size - 8, y: node.y + 2, w: size + 4, h: size + 4 };
                    if (worldX >= indicatorArea.x && worldX <= indicatorArea.x + indicatorArea.w &&
                        worldY >= indicatorArea.y && worldY <= indicatorArea.y + indicatorArea.h) {
                        node.collapsed = !node.collapsed;
                        let allCollapsedCheck = true;
                        Object.values(mindmap.nodes).forEach(n => {
                            if (n.id !== mindmap.center && !n.collapsed) allCollapsedCheck = false;
                        });
                        allCollapsed = allCollapsedCheck;
                        updateCollapseButtonLabel();
                        saveHistory();
                        render();
                        return;
                    }
                }
            }

            const connector = findConnectorAt(worldX, worldY);
            if (connector) {
                if (e.shiftKey) {
                    const idx = selection.selectedConnectors.findIndex(c => c.childId === connector.childId);
                    if (idx >= 0) {
                        selection.selectedConnectors.splice(idx, 1);
                    } else {
                        selection.selectedConnectors.push(connector);
                    }
                } else if (!selection.selectedConnectors.some(c => c.childId === connector.childId) ||
                    selection.selectedConnectors.length <= 1) {
                    selection.selectedConnectors = [connector];
                }
                selection.selectedConnector = connector;
                selection.selectedLink = null;
                selection.selectedIds = [];
                selection.nodeId = null;
                showConnectorPanel(connector.parentId, connector.childId);
                render();
                return;
            }

            const customLink = findCustomLinkAt(worldX, worldY);
            if (customLink) {
                selection.selectedLink = { linkId: customLink.id };
                selection.selectedConnector = null;
                selection.selectedConnectors = [];
                selection.selectedIds = [];
                selection.nodeId = null;
                showLinkPanel(customLink);
                render();
                return;
            }

            let clickedNode = null;
            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (!isNodeHidden(nodeId) && worldX >= node.x && worldX <= node.x + node.width &&
                    worldY >= node.y && worldY <= node.y + node.height) {
                    clickedNode = node;
                    break;
                }
            }

            if (clickedNode) {
                const isInSelection = selection.selectedIds.includes(clickedNode.id);
                if (e.shiftKey) {
                    if (isInSelection) {
                        selection.selectedIds = selection.selectedIds.filter(id => id !== clickedNode.id);
                    } else {
                        selection.selectedIds.push(clickedNode.id);
                    }
                    selection.nodeId = clickedNode.id;
                    selection.selectedConnector = null;
                    selection.selectedConnectors = [];
                    selection.selectedLink = null;
                    showRightPanel(clickedNode.id);
                    render();
                    return;
                } else {
                    if (!isInSelection) selection.selectedIds = [];
                    if (isInSelection && selection.selectedIds.length > 1) {
                        selection.multiDragStart = { x: worldX, y: worldY };
                        selection.multiDragOffsets = selection.selectedIds.map(id => {
                            const node = mindmap.nodes[id];
                            return { startX: node.x, startY: node.y };
                        });
                        canvas.style.cursor = 'grabbing';
                        return;
                    }
                    if (!isInSelection) selection.selectedIds = [clickedNode.id];
                    selection.nodeId = clickedNode.id;
                    selection.selectedConnector = null;
                    selection.selectedConnectors = [];
                    selection.selectedLink = null;
                    showRightPanel(clickedNode.id);
                    if (clickedNode.id !== mindmap.center) {
                        const handleSize = 10 / viewport.zoom;
                        const onRight = worldX > clickedNode.x + clickedNode.width - handleSize && worldX < clickedNode.x +
                            clickedNode.width;
                        const onBottom = worldY > clickedNode.y + clickedNode.height - handleSize && worldY < clickedNode.y +
                            clickedNode.height;
                        const onCorner = onRight && onBottom;
                        const onRightEdge = onRight && worldY > clickedNode.y + clickedNode.height / 2 - handleSize &&
                            worldY < clickedNode.y + clickedNode.height / 2 + handleSize;
                        const onBottomEdge = onBottom && worldX > clickedNode.x + clickedNode.width / 2 - handleSize &&
                            worldX < clickedNode.x + clickedNode.width / 2 + handleSize;
                        if (onCorner) { selection.resizing = true;
                            selection.resizeHandle = 'both'; } else if (onRightEdge) { selection.resizing = true;
                            selection.resizeHandle = 'right'; } else if (onBottomEdge) { selection.resizing = true;
                            selection.resizeHandle = 'bottom'; } else {
                            selection.dragging = true;
                            selection.dragOffset = { x: worldX - clickedNode.x, y: worldY - clickedNode.y };
                        }
                    }
                }
                canvas.classList.add('grabbing');
            } else {
                if (selection.shiftDown) {
                    selection.isBoxSelecting = true;
                    selection.boxStart = { x: canvasX, y: canvasY };
                    selection.boxEnd = { x: canvasX, y: canvasY };
                } else {
                    selection.selectedIds = [];
                    selection.nodeId = null;
                    selection.selectedConnector = null;
                    selection.selectedLink = null;
                    closeRightPanel();
                    hideNodeTooltip();
                    selection.panStart = { x: canvasX, y: canvasY };
                }
                render();
            }
        }

        function handleMouseUp(e) {
            stopAutoScroll();

            if (selection.multiDragStart) {
                if (dragDropTargetId != null) {
                    const roots = getSelectionRoots(selection.selectedIds);
                    roots.forEach(id => {
                        if (Number(id) !== Number(dragDropTargetId)) reparentNode(id, dragDropTargetId);
                    });
                }
                selection.multiDragStart = null;
                selection.multiDragOffsets = [];
                dragDropTargetId = null;
                saveHistory();
                canvas.style.cursor = 'grab';
                render();
                return;
            }

            if (selection.isBoxSelecting && selection.shiftDown && selection.boxStart && selection.boxEnd) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x1 = (selection.boxStart.x / scaleX - canvas.width / 2 - viewport.x) / viewport.zoom;
                const y1 = (selection.boxStart.y / scaleY - canvas.height / 2 - viewport.y) / viewport.zoom;
                const x2 = (selection.boxEnd.x / scaleX - canvas.width / 2 - viewport.x) / viewport.zoom;
                const y2 = (selection.boxEnd.y / scaleY - canvas.height / 2 - viewport.y) / viewport.zoom;
                const nodeIds = getNodesInRect(x1, y1, x2, y2);
                if (nodeIds.length > 0) {
                    selection.selectedIds = nodeIds;
                    selection.nodeId = nodeIds[nodeIds.length - 1];
                    showRightPanel(selection.nodeId);
                }
                selection.isBoxSelecting = false;
                selection.boxStart = null;
                selection.boxEnd = null;
                document.getElementById('selectionBox').style.display = 'none';
                render();
            }

            if (selection.dragging && selection.nodeId && dragDropTargetId != null) {
                reparentNode(selection.nodeId, dragDropTargetId);
            }
            if (selection.dragging || selection.resizing) saveHistory();
            selection.dragging = false;
            selection.resizing = false;
            selection.resizeHandle = null;
            selection.panStart = null;
            dragDropTargetId = null;
            canvas.classList.remove('grabbing');
            render();
        }

        function handleWheel(e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = viewport.zoom * zoomFactor;
            if (newZoom >= 0.1 && newZoom <= 5) {
                const worldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
                const worldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;
                viewport.zoom = newZoom;
                viewport.x = canvasX - (canvas.width / 2 + worldX * viewport.zoom);
                viewport.y = canvasY - (canvas.height / 2 + worldY * viewport.zoom);
                updateZoomDisplay();
                render();
            }
        }

        function handleDoubleClick(e) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const worldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
            const worldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;

            const connector = findConnectorAt(worldX, worldY);
            if (connector) {
                if (!selection.selectedConnectors.some(c => c.childId === connector.childId)) {
                    selection.selectedConnectors = [connector];
                }
                selection.selectedConnector = connector;
                selection.selectedLink = null;
                showConnectorPanel(connector.parentId, connector.childId);
                render();
                return;
            }

            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (!isNodeHidden(nodeId) && worldX >= node.x && worldX <= node.x + node.width &&
                    worldY >= node.y && worldY <= node.y + node.height) {
                    if (node.isTable) {
                        const cell = getTableCellAt(node, worldX, worldY);
                        if (cell) { editTableCell(node.id, cell.row, cell.col); return; }
                        startInlineEdit(nodeId);
                        return;
                    }
                    if (node.children && node.children.length > 0) {
                        const size = 14 / viewport.zoom;
                        const indicatorArea = { x: node.x + node.width - size - 8, y: node.y + 2, w: size + 4, h: size + 4 };
                        if (worldX >= indicatorArea.x && worldX <= indicatorArea.x + indicatorArea.w &&
                            worldY >= indicatorArea.y && worldY <= indicatorArea.y + indicatorArea.h) {
                            return;
                        }
                    }
                    startInlineEdit(nodeId);
                    return;
                }
            }
        }

        function handleKeyDown(e) {
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag === 'TEXTAREA' || tag === 'INPUT') return;

            if (e.key === 'Shift') selection.shiftDown = true;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault();
                    undo(); } else if (e.key === 'y') { e.preventDefault();
                    redo(); } else if (e.key === 'g') { e.preventDefault();
                    groupSelected(); } else if (e.key === 'c') { e.preventDefault();
                    copySelected(); } else if (e.key === 'x') { e.preventDefault();
                    cutSelected(); } else if (e.key === 'v') { e.preventDefault();
                    pasteSelected(); } else if (e.key === 'd') { e.preventDefault();
                    duplicateSelected(); } else if (e.key === 'l') {
                    e.preventDefault();
                    if (selection.selectedIds.length === 2) {
                        createLinkBetweenNodes(selection.selectedIds[0], selection.selectedIds[1]);
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selection.nodeId && !inlineEdit) deleteNode(selection.nodeId);
                else if (selection.selectedLink) deleteLink(selection.selectedLink.linkId);
            } else if (e.key === 'Escape') {
                if (pendingLink) cancelPendingLink();
                if (inlineEdit) closeInlineEdit();
                if (tableCellEdit) { tableCellEdit.remove();
                    tableCellEdit = null; }
            }
        }

        function handleKeyUp(e) {
            if (e.key === 'Shift') {
                selection.shiftDown = false;
                if (selection.isBoxSelecting) {
                    selection.isBoxSelecting = false;
                    selection.boxStart = null;
                    selection.boxEnd = null;
                    document.getElementById('selectionBox').style.display = 'none';
                    render();
                }
            }
        }

        function handleContextMenu(e) {
            e.preventDefault();
            closeContextMenu();
            closeInlineEdit();

            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const worldX = (canvasX - canvas.width / 2 - viewport.x) / viewport.zoom;
            const worldY = (canvasY - canvas.height / 2 - viewport.y) / viewport.zoom;

            const connector = findConnectorAt(worldX, worldY);
            if (connector) {
                if (!selection.selectedConnectors.some(c => c.childId === connector.childId)) {
                    selection.selectedConnectors = [connector];
                }
                selection.selectedConnector = connector;
                selection.selectedLink = null;
                showConnectorPanel(connector.parentId, connector.childId);
                render();
                return;
            }

            let clickedNode = null;
            for (const nodeId in mindmap.nodes) {
                const node = mindmap.nodes[nodeId];
                if (!isNodeHidden(nodeId) && worldX >= node.x && worldX <= node.x + node.width &&
                    worldY >= node.y && worldY <= node.y + node.height) {
                    clickedNode = node;
                    break;
                }
            }

            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            contextMenu = menu;

            const maxLevel = getMaxLevel();
            const levels = [];
            for (let i = 1; i <= Math.min(maxLevel, 5); i++) levels.push(i);
            if (maxLevel > 5) levels.push('...');
            if (maxLevel > 0) levels.push('All');

            if (clickedNode) {
                selection.nodeId = clickedNode.id;
                if (!e.shiftKey) selection.selectedIds = [clickedNode.id];
                render();

                const isGroup = clickedNode.isGroup;
                const selectedCount = selection.selectedIds.length;

                let items = [];

                items.push({ label: t('context-copy'), action: () => { copySelected();
                        closeContextMenu(); } });
                items.push({ label: t('context-cut'), action: () => { cutSelected();
                        closeContextMenu(); }, danger: true });
                if (clipboard && clipboard.nodes && Object.keys(clipboard.nodes).length > 0) {
                    items.push({ label: t('context-paste'), action: () => { pasteSelected();
                            closeContextMenu(); } });
                }
                items.push({ label: t('context-duplicate'), action: () => { duplicateSelected();
                        closeContextMenu(); } });
                items.push({ divider: true });

                items.push({ label: t('context-add-child'), action: () => { addChildNode(clickedNode.id);
                        closeContextMenu(); } });
                items.push({ divider: true });

                if (clickedNode.children && clickedNode.children.length > 0) {
                    items.push({
                        label: clickedNode.collapsed ? t('context-expand') : t('context-collapse'),
                        action: () => { toggleCollapseNode(clickedNode.id);
                            closeContextMenu(); }
                    });
                    items.push({ divider: true });
                }

                if (!isGroup) {
                    items.push({ label: t('context-group'), action: () => { groupSelected();
                            closeContextMenu(); } });
                } else {
                    items.push({ label: t('context-ungroup'), action: () => { ungroupSelected();
                            closeContextMenu(); } });
                }
                items.push({ divider: true });

                const showLevelItems = levels.map(lv => ({
                    label: lv === 'All' ? '📊 All' : `📊 Level ${lv}`,
                    action: () => { if (lv === 'All') collapseToLevel(99);
                        else if (lv === '...') return;
                        else collapseToLevel(lv);
                        closeContextMenu(); }
                }));
                items.push({ label: t('context-show-level'), sub: showLevelItems });
                items.push({ divider: true });

                const linkedCards = mindmap.flashcards.filter(c => c.linkedNodeId === clickedNode.id);
                if (linkedCards.length > 0) {
                    items.push({
                        label: `📇 Xem flashcard liên kết (${linkedCards.length})`,
                        action: () => {
                            closeContextMenu();
                            switchAppMode('flashcard');
                            const idx = fcOrder.indexOf(linkedCards[0].id);
                            if (idx >= 0) fcIndex = idx;
                            fcRevealed = false;
                            renderFlashcardStudy();
                        }
                    });
                }
                items.push({
                    label: '🔗 Link flashcard tới node này',
                    action: () => { closeContextMenu();
                        startLinkPickForNode(clickedNode.id); }
                });
                items.push({ divider: true });

                items.push({ label: t('context-delete'), action: () => { deleteNode(clickedNode.id);
                        closeContextMenu(); }, danger: true });

                buildContextMenuItems(menu, items);
            } else {
                const items = [];
                items.push({ label: t('context-add-free'), action: () => { addFreeNode();
                        closeContextMenu(); } });
                items.push({ label: t('context-insert-table'), action: () => { insertTableNode();
                        closeContextMenu(); } });
                items.push({ divider: true });

                if (clipboard && clipboard.nodes && Object.keys(clipboard.nodes).length > 0) {
                    items.push({ label: t('context-paste'), action: () => { pasteSelected();
                            closeContextMenu(); } });
                    items.push({ divider: true });
                }

                const showLevelItems = levels.map(lv => ({
                    label: lv === 'All' ? '📊 All' : `📊 Level ${lv}`,
                    action: () => { if (lv === 'All') collapseToLevel(99);
                        else if (lv === '...') return;
                        else collapseToLevel(lv);
                        closeContextMenu(); }
                }));
                items.push({ label: t('context-show-level'), sub: showLevelItems });

                buildContextMenuItems(menu, items);
            }

            document.body.appendChild(menu);
        }

        function buildContextMenuItems(menu, items) {
            items.forEach(item => {
                if (item.divider) {
                    const div = document.createElement('div');
                    div.className = 'context-menu-divider';
                    menu.appendChild(div);
                    return;
                }
                if (item.sub) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'context-menu-sub';
                    const parent = document.createElement('div');
                    parent.className = 'context-menu-item';
                    parent.textContent = item.label + ' ▶';
                    wrapper.appendChild(parent);
                    const subMenu = document.createElement('div');
                    subMenu.className = 'sub-menu';
                    item.sub.forEach(subItem => {
                        const el = document.createElement('div');
                        el.className = 'context-menu-item';
                        el.textContent = subItem.label;
                        el.onclick = subItem.action;
                        subMenu.appendChild(el);
                    });
                    wrapper.appendChild(subMenu);
                    menu.appendChild(wrapper);
                    return;
                }
                const el = document.createElement('div');
                el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
                el.textContent = item.label;
                el.onclick = item.action;
                menu.appendChild(el);
            });
        }

        function closeContextMenu() {
            if (contextMenu) { contextMenu.remove();
                contextMenu = null; }
        }

        function showNodeTooltip(nodeId, event) {
            const node = mindmap.nodes[nodeId];
            if (!node) return;
            let imageUrl = null;
            let tooltipText = '';
            const imgMatch = node.text.match(/\[img:([^\]]+)\]/);
            if (imgMatch) {
                imageUrl = imgMatch[1];
                tooltipText = node.text.replace(/\[img:[^\]]+\]/, '').trim() || 'Image';
            }
            if (!imageUrl && node.icon && (node.icon.startsWith('http') || node.icon.startsWith('data:image'))) {
                imageUrl = node.icon;
                tooltipText = node.text || 'Image';
            }
            if (!imageUrl) return;
            const tooltip = document.getElementById('nodeTooltip');
            const img = document.getElementById('tooltipImage');
            const text = document.getElementById('tooltipText');
            img.src = imageUrl;
            text.textContent = tooltipText || node.text || '';
            let x = event.clientX + 15;
            let y = event.clientY + 15;
            if (x + 300 > window.innerWidth) x = event.clientX - 310;
            if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
            tooltip.style.display = 'block';
        }

        function hideNodeTooltip() {
            document.getElementById('nodeTooltip').style.display = 'none';
            hoveredNodeId = null;
            if (tooltipTimer) { clearTimeout(tooltipTimer);
                tooltipTimer = null; }
        }

        function printSelection() {
            startSnippingTool('image');
        }
