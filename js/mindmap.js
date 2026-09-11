        function getNodeResizeHandle(node, x, y) {
            if (!node || node.id === mindmap.center) return null;
            const size = 10 / viewport.zoom;
            const inside = x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height;
            if (!inside) return null;
            const right = x >= node.x + node.width - size;
            const bottom = y >= node.y + node.height - size;
            if (right && bottom) return 'both';
            if (Math.abs(y - node.y - node.height / 2) <= size) {
                if (x <= node.x + size) return 'left';
                if (right) return 'right';
            }
            if (Math.abs(x - node.x - node.width / 2) <= size) {
                if (y <= node.y + size) return 'top';
                if (bottom) return 'bottom';
            }
            return null;
        }

        // ============ INLINE EDIT ============
        let inlineEditToolbar = null;

        function applySelectedTextFormat(node, textarea, marker) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end) return;
            const styleKey = { '**': 'bold', '__': 'italic', '++': 'underline', '~~': 'strike', '==': 'highlight' }[marker];
            if (!styleKey) return;
            node.textStyles = node.textStyles || [];
            const exact = node.textStyles.findIndex((range) => range.start === start && range.end === end && range[styleKey] === true);
            if (exact >= 0) node.textStyles.splice(exact, 1);
            else node.textStyles.push({ start, end, [styleKey]: true });
            textarea.focus();
        }

        function applySelectedTextColor(node, textarea, color) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end) return;
            node.textStyles = (node.textStyles || []).filter((range) => !(range.start === start && range.end === end && range.textColor));
            node.textStyles.push({ start, end, textColor: color });
            textarea.focus();
        }

        function shiftTextStyleRanges(node, before, after) {
            if (!node.textStyles?.length || before === after) return;
            let prefix = 0;
            while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
            let oldSuffix = before.length, newSuffix = after.length;
            while (oldSuffix > prefix && newSuffix > prefix && before[oldSuffix - 1] === after[newSuffix - 1]) { oldSuffix--; newSuffix--; }
            const delta = after.length - before.length;
            node.textStyles = node.textStyles.map((range) => {
                if (range.end <= prefix) return range;
                if (range.start >= oldSuffix) return { ...range, start: range.start + delta, end: range.end + delta };
                return { ...range, end: Math.max(range.start, range.end + delta) };
            }).filter((range) => range.end > range.start);
        }

        function toggleSelectedBullets(textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end) return;
            const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
            const nextBreak = textarea.value.indexOf('\n', end);
            const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak;
            const lines = textarea.value.slice(lineStart, lineEnd).split('\n');
            const removeBullets = lines.every((line) => /^\s*•\s+/.test(line));
            const updated = lines.map((line) => removeBullets ? line.replace(/^(\s*)•\s+/, '$1') : `${line.match(/^\s*/)[0]}• ${line.trimStart()}`);
            textarea.setRangeText(updated.join('\n'), lineStart, lineEnd, 'select');
            textarea.focus();
        }

        function createMiniEditPropertiesPanel(node, textarea, screenX, screenY, screenW) {
            const panel = document.createElement('div');
            panel.className = 'node-mini-properties-panel';
            panel.style.left = `${Math.min(window.innerWidth - 270, Math.max(8, screenX + screenW + 8))}px`;
            panel.style.top = `${Math.max(8, screenY - 48)}px`;
            panel.innerHTML = `
                <label title="Fill color">Fill<input type="color" data-fill value="${toHex(node.color || '#94A3B8')}"></label>
                <label title="Line color">Line<input type="color" data-line value="${toHex(node.borderColor || '#1F2544')}"></label>
                <span class="node-mini-divider"></span>
                <button type="button" data-font="-" title="Smaller text">A−</button>
                <button type="button" data-font="+" title="Larger text">A+</button>
                <span class="node-mini-divider"></span>
                <button type="button" data-format="**" title="Bold"><b>B</b></button>
                <button type="button" data-format="__" title="Italic"><i>I</i></button>
                <button type="button" data-format="++" title="Underline"><u>U</u></button>
                <button type="button" data-format="~~" title="Strikethrough"><s>S</s></button>
                <button type="button" data-format="==" title="Highlight">H</button>
                <textarea data-comment placeholder="Comment / note…">${escapeHtml(node.comment || '')}</textarea>`;
            const pastelColors = ['#FFB6B9', '#FFC9A9', '#FFF3B0', '#B5EAD7', '#AEE8E4', '#A8D8EA', '#B3D9F2', '#D7BDE2', '#FFD6E0', '#C8F4C8'];
            panel.innerHTML = `
                <button type="button" class="node-mini-swatch" data-palette="fill" style="--swatch:${node.color || '#A8D8EA'}" title="Fill color"></button>
                <button type="button" data-format="**" title="Bold"><b>B</b></button>
                <button type="button" data-format="__" title="Italic"><i>I</i></button>
                <button type="button" data-more title="More properties">•••</button>
                <div class="node-mini-more" hidden>
                    <button type="button" class="node-mini-swatch node-mini-text-swatch" data-palette="text" title="Text color">A</button>
                    <button type="button" data-font="-" title="Smaller text">A−</button>
                    <button type="button" data-font="+" title="Larger text">A+</button>
                    <button type="button" data-align="left" title="Align left">◀</button>
                    <button type="button" data-align="center" title="Align center">▲</button>
                    <button type="button" data-align="right" title="Align right">▶</button>
                    <button type="button" data-format="++" title="Underline"><u>U</u></button>
                    <button type="button" data-format="~~" title="Strikethrough"><s>S</s></button>
                    <button type="button" data-format="==" title="Highlight">H</button>
                    <button type="button" data-bullet title="Bullet points">•</button>
                </div>
                <div class="node-mini-palette" hidden>${pastelColors.map((color) => `<button type="button" data-pastel="${color}" style="background:${color}" title="${color}"></button>`).join('')}</div>`;
            let paletteTarget = 'fill';
            document.body.appendChild(panel);
            panel.addEventListener('input', (event) => {
                const target = event.target;
                if (target.matches('[data-fill]')) { node.color = target.value;  }
                if (target.matches('[data-line]')) node.borderColor = target.value;
                render();
            });
            panel.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (!button) return;
                if (button.dataset.font) {
                    node.fontSize = Math.max(8, Math.min(32, node.fontSize + (button.dataset.font === '+' ? 1 : -1)));
                    textarea.style.fontSize = `${node.fontSize}px`;
                    node.height = measureNodeHeight(node);
                    render();
                }
                if (button.dataset.align) {
                    node.textAlign = button.dataset.align;
                    textarea.style.textAlign = node.textAlign;
                    render();
                }
                if (button.dataset.format) applySelectedTextFormat(node, textarea, button.dataset.format);
                if (button.hasAttribute('data-bullet')) toggleSelectedBullets(textarea);
            });
            panel.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (!button) return;
                const more = panel.querySelector('.node-mini-more');
                const palette = panel.querySelector('.node-mini-palette');
                if (button.hasAttribute('data-more')) {
                    more.hidden = !more.hidden;
                    palette.hidden = true;
                }
                if (button.dataset.palette) {
                    paletteTarget = button.dataset.palette;
                    more.hidden = true;
                    palette.hidden = false;
                }
                if (button.dataset.pastel) {
                    if (paletteTarget === 'fill') {
                        node.color = button.dataset.pastel;

                        panel.querySelector('[data-palette="fill"]').style.setProperty('--swatch', node.color);
                    } else {
                        applySelectedTextColor(node, textarea, button.dataset.pastel);
                        panel.querySelector('[data-palette="text"]').style.color = button.dataset.pastel;
                    }
                    palette.hidden = true;
                    render();
                }
            });
            const closePopups = (event) => {
                if (panel.contains(event.target) || event.target === textarea) return;
                panel.querySelector('.node-mini-more').hidden = true;
                panel.querySelector('.node-mini-palette').hidden = true;
                document.removeEventListener('mousedown', closePopups);
            };
            document.addEventListener('mousedown', closePopups);
            return panel;
        }
        function startInlineEdit(nodeId) {
            closeInlineEdit();
            if (tableCellEdit) { tableCellEdit.remove();
                tableCellEdit = null; }
            const node = mindmap.nodes[nodeId];
            if (!node || node.isTable) return;
            const originalTextStyles = JSON.parse(JSON.stringify(node.textStyles || []));
            const rect = canvas.getBoundingClientRect();
            // Zoom applies to world coordinates only. Canvas centre and pan are
            // already expressed in pixels, so this overlay exactly covers node.
            const screenX = node.x * viewport.zoom + canvas.width / 2 + viewport.x + rect.left;
            const screenY = node.y * viewport.zoom + canvas.height / 2 + viewport.y + rect.top;
            const screenW = node.width * viewport.zoom;
            const screenH = node.height * viewport.zoom;
            const textarea = document.createElement('textarea');
            textarea.className = 'inline-edit';
            textarea.dataset.nodeId = String(nodeId);
            textarea.setAttribute('aria-label', 'N?i dung node');
            textarea.value = node.text;
            const align = node.textAlign || 'center';
            textarea.style.cssText = 'position:fixed; z-index:1000; box-sizing:border-box; border:0; outline:none; border-radius:0; box-shadow:none; background:transparent; resize:none; overflow:auto; white-space:pre-wrap; line-height:1.3; transform-origin:top left;';
            document.body.appendChild(textarea);
            inlineEdit = textarea;
            render();
            const toolbar = createMiniEditPropertiesPanel(node, textarea, screenX, screenY, screenW);
            if (false) { // legacy toolbar retained below temporarily for compatibility
            const toolbar = document.createElement('div');
            toolbar.className = 'node-inline-toolbar';
            toolbar.style.left = `${Math.max(8, screenX)}px`;
            toolbar.style.top = `${Math.max(8, screenY - 40)}px`;
            toolbar.innerHTML = `
                <button type="button" data-style="bold" class="${node.bold ? 'is-active' : ''}" title="Bold"><b>B</b></button>
                <button type="button" data-style="italic" class="${node.italic ? 'is-active' : ''}" title="Italic"><i>I</i></button>
                <button type="button" data-color="#1F2544" class="node-color-black" title="Black"></button>
                <button type="button" data-color="#2563EB" class="node-color-blue" title="Blue"></button>
                <button type="button" data-color="#EF4444" class="node-color-red" title="Red"></button>
                <span></span><button type="button" data-add title="Add child">+</button>
                ${node.id !== mindmap.center ? '<button type="button" data-delete title="Delete node">×</button>' : ''}`;
            document.body.appendChild(toolbar);
            }
            inlineEditToolbar = toolbar;
            textarea.focus();
            textarea.select();
            let done = false;
            let previousText = textarea.value;
            textarea.addEventListener('input', () => {
                shiftTextStyleRanges(node, previousText, textarea.value);
                previousText = textarea.value;
                render();
            });

            function commit() {
                if (done) return;
                done = true;
                node.text = textarea.value;
                node.height = measureNodeHeight(node);
                textarea.remove();
                inlineEdit = null;
                toolbar.remove();
                inlineEditToolbar = null;
                saveHistory();
                render();
                if (selection.nodeId === nodeId) showRightPanel(nodeId);
            }
            textarea.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault();
                    commit(); } else if (e.key === 'Escape') { done = true;
                    textarea.remove();
                    inlineEdit = null;
                    toolbar.remove();
                    inlineEditToolbar = null;
                    node.textStyles = originalTextStyles;
                    render(); }
            });
            if (false) {
            toolbar.addEventListener('mousedown', (event) => event.preventDefault());
            toolbar.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (!button) return;
                if (button.dataset.style) {
                    node[button.dataset.style] = !node[button.dataset.style];
                    button.classList.toggle('is-active', node[button.dataset.style]);
                } else if (button.dataset.color) {
                    node.textColor = button.dataset.color;
                    toolbar.querySelectorAll('[data-color]').forEach((item) => item.classList.toggle('is-active', item === button));
                } else if (button.hasAttribute('data-add')) {
                    commit();
                    addChildNode(nodeId);
                } else if (button.hasAttribute('data-delete')) {
                    done = true;
                    textarea.remove();
                    toolbar.remove();
                    inlineEdit = null;
                    inlineEditToolbar = null;
                    deleteNode(nodeId);
                }
                render();
            });
            }
            textarea.addEventListener('blur', () => setTimeout(() => {
                if (!toolbar.contains(document.activeElement)) commit();
            }, 0));
            toolbar.addEventListener('focusout', () => setTimeout(() => {
                if (!toolbar.contains(document.activeElement) && document.activeElement !== textarea) commit();
            }, 0));
        }

        function closeInlineEdit() {
            if (inlineEdit) { inlineEdit.remove();
                inlineEdit = null; }
            if (inlineEditToolbar) { inlineEditToolbar.remove();
                inlineEditToolbar = null; }
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
                    if (selection.resizeHandle === 'left') {
                        const right = node.x + node.width;
                        node.x = Math.min(worldX, right - 60);
                        node.width = right - node.x;
                    } else if (selection.resizeHandle === 'top') {
                        const bottom = node.y + node.height;
                        node.y = Math.min(worldY, bottom - 40);
                        node.height = bottom - node.y;
                    } else if (selection.resizeHandle === 'right') {
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
                    const handle = getNodeResizeHandle(node, worldX, worldY);
                    canvas.style.cursor = handle === 'both' ? 'nwse-resize'
                        : handle === 'left' || handle === 'right' ? 'ew-resize'
                        : handle === 'top' || handle === 'bottom' ? 'ns-resize' : 'grab';
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
                        const handle = getNodeResizeHandle(clickedNode, worldX, worldY);
                        if (handle) {
                            selection.resizing = true;
                            selection.resizeHandle = handle;
                        } else {
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
