        // ============ FLASHCARD FEATURE ============
        function switchAppMode(mode) {
            appMode = mode;
            document.getElementById('mindmapPage').style.display = mode === 'mindmap' ? 'flex' : 'none';
            document.getElementById('flashcardPage').style.display = mode === 'flashcard' ? 'flex' : 'none';
            document.getElementById('appTabMindmap').classList.toggle('active', mode === 'mindmap');
            document.getElementById('appTabFlashcard').classList.toggle('active', mode === 'flashcard');
            closeContextMenu();
            closeInlineEdit();
            if (mode === 'flashcard') {
                if (fcOrder.length !== mindmap.flashcards.length || !fcOrder.every(id => mindmap.flashcards.some(c =>
                        c.id === id))) {
                    fcOrder = mindmap.flashcards.map(c => c.id);
                }
                if (fcIndex >= fcOrder.length) fcIndex = 0;
                renderFlashcardStudy();
            } else {
                render();
            }
        }

        function parseFlashcardText(text) {
            const cards = [];
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            let current = null;
            let mode = null;

            function pushCurrent() {
                if (current && current.question.length) {
                    const q = current.question.join('\n').trim();
                    const a = current.answer.join('\n').trim();
                    if (q) cards.push({ question: q, answer: a });
                }
            }
            for (const raw of lines) {
                const trimmed = raw.trim();
                const qMatch = trimmed.match(/^Q\s*[:.\-)]\s*(.*)$/i);
                const aMatch = trimmed.match(/^A\s*[:.\-)]\s*(.*)$/i);
                if (qMatch) {
                    pushCurrent();
                    current = { question: [qMatch[1]], answer: [] };
                    mode = 'q';
                } else if (aMatch && current) {
                    current.answer.push(aMatch[1]);
                    mode = 'a';
                } else if (trimmed === '') {
                    continue;
                } else if (current) {
                    if (mode === 'q') current.question.push(raw);
                    else if (mode === 'a') current.answer.push(raw);
                }
            }
            pushCurrent();
            return cards;
        }

        function generateFlashcardsFromText() {
            const textarea = document.getElementById('flashcardTextInput');
            const text = textarea.value;
            const parsed = parseFlashcardText(text);
            const preview = document.getElementById('fcParsePreview');
            if (parsed.length === 0) {
                preview.style.color = '#EF4444';
                preview.textContent = '⚠️ Không tìm thấy cặp Q:/A: nào hợp lệ. Kiểm tra lại định dạng (mỗi thẻ có 1 dòng Q: và 1 dòng A:).';
                return;
            }
            parsed.forEach(p => {
                mindmap.flashcards.push({
                    id: mindmap.nextFlashcardId++,
                    question: p.question,
                    answer: p.answer,
                    linkedNodeId: null,
                    attempts: []
                });
            });
            saveHistory();
            textarea.value = '';
            preview.style.color = '#16A34A';
            preview.textContent = `✅ Đã tạo ${parsed.length} flashcard mới. Tổng cộng ${mindmap.flashcards.length} flashcard.`;
            fcOrder = mindmap.flashcards.map(c => c.id);
            fcIndex = Math.max(0, fcOrder.length - parsed.length);
            fcRevealed = false;
            renderFlashcardStudy();
            renderFlashcardList();
        }

        function getCurrentFlashcard() {
            if (fcOrder.length === 0) return null;
            const id = fcOrder[fcIndex];
            return mindmap.flashcards.find(c => c.id === id) || null;
        }

        function renderFlashcardStudy() {
            const empty = document.getElementById('fcEmptyState');
            const cardEl = document.getElementById('fcCard');
            const navEl = document.getElementById('fcNav');
            const progressEl = document.getElementById('fcProgress');
            const inputArea = document.getElementById('fcAnswerInputArea');
            const userAnswer = document.getElementById('fcUserAnswer');
            const historyEl = document.getElementById('fcAnswerHistory');

            if (mindmap.flashcards.length === 0) {
                empty.style.display = 'block';
                cardEl.style.display = 'none';
                navEl.style.display = 'none';
                progressEl.textContent = '0 / 0';
                if (inputArea) inputArea.style.display = 'none';
                return;
            }
            empty.style.display = 'none';
            cardEl.style.display = 'flex';
            navEl.style.display = 'flex';
            if (inputArea) inputArea.style.display = 'flex';

            const card = getCurrentFlashcard();
            progressEl.textContent = (fcIndex + 1) + ' / ' + fcOrder.length;
            if (!card) return;

            const labelEl = document.getElementById('fcCardLabel');
            const textEl = document.getElementById('fcCardText');
            const hintEl = document.getElementById('fcCardHint');
            const badgeEl = document.getElementById('fcLinkedBadge');

            if (fcRevealed) {
                labelEl.textContent = '📖 ĐÁP ÁN';
                labelEl.classList.add('fc-label-answer');
                textEl.textContent = card.answer || '(chưa có đáp án)';
                hintEl.textContent = '👁️ Nhấn để xem câu hỏi';
            } else {
                labelEl.textContent = '❓ CÂU HỎI';
                labelEl.classList.remove('fc-label-answer');
                textEl.textContent = card.question;
                hintEl.textContent = '✍️ Nhập câu trả lời của bạn';
            }

            badgeEl.style.display = (card.linkedNodeId != null && mindmap.nodes[card.linkedNodeId]) ? 'inline-block' :
                'none';

            if (historyEl && card.attempts && card.attempts.length > 0) {
                const historyHtml = card.attempts.slice().reverse().map(a => {
                    const time = new Date(a.timestamp).toLocaleTimeString('vi-VN');
                    const status = a.correct ? '✅ Đúng' : '❌ Sai';
                    const statusClass = a.correct ? 'h-correct' : 'h-wrong';
                    return `<div class="history-item">
                            <span class="h-time">${time}</span>
                            <span class="h-answer">${escapeHtml(a.answer || '(trống)')}</span>
                            <span class="${statusClass}">${status}</span>
                        </div>`;
                }).join('');
                historyEl.innerHTML = `<div style="font-size:11px;font-weight:600;color:var(--ink-soft);margin-bottom:4px;">📝 Lịch sử trả lời (${card.attempts.length} lần)</div>` +
                    historyHtml;
                historyEl.style.display = 'block';
            } else if (historyEl) {
                historyEl.innerHTML = '';
                historyEl.style.display = 'none';
            }

            if (userAnswer) userAnswer.value = '';
            userAnswer.focus();
        }

        function fcSubmitAnswer() {
            const card = getCurrentFlashcard();
            if (!card) return;
            const userAnswer = document.getElementById('fcUserAnswer');
            const answer = userAnswer.value.trim();
            if (!answer) {
                alert('Vui lòng nhập câu trả lời của bạn.');
                return;
            }

            const correct = card.answer || '';
            const normalizedCorrect = correct.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const normalizedUser = answer.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

            const correctWords = normalizedCorrect.split(/\s+/).filter(w => w.length > 2);
            const userWords = normalizedUser.split(/\s+/).filter(w => w.length > 2);

            let isCorrect = false;
            if (correctWords.length === 0) {
                isCorrect = normalizedUser === normalizedCorrect;
            } else {
                const matchCount = correctWords.filter(w => userWords.includes(w)).length;
                isCorrect = matchCount >= Math.min(correctWords.length, 3) || (correctWords.length <= 3 && matchCount ===
                    correctWords.length);
                if (!isCorrect && normalizedUser.length > 5) {
                    const similarity = normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(
                    normalizedUser);
                    if (similarity) isCorrect = true;
                }
            }

            if (!card.attempts) card.attempts = [];
            card.attempts.push({
                timestamp: Date.now(),
                answer: answer,
                correct: isCorrect
            });

            saveHistory();
            renderFlashcardStudy();
            renderFlashcardList();

            const hintEl = document.getElementById('fcCardHint');
            if (isCorrect) {
                hintEl.textContent = '🎉 Đúng! Chuyển sang thẻ tiếp theo...';
                hintEl.style.color = '#16A34A';
                setTimeout(() => {
                    hintEl.style.color = '';
                    fcNext();
                }, 1000);
            } else {
                hintEl.textContent = '❌ Chưa đúng. Xem đáp án để biết câu trả lời chính xác.';
                hintEl.style.color = '#EF4444';
                setTimeout(() => {
                    hintEl.style.color = '';
                    fcReveal();
                }, 800);
            }
        }

        function fcSkipAnswer() {
            const card = getCurrentFlashcard();
            if (!card) return;
            if (!card.attempts) card.attempts = [];
            card.attempts.push({
                timestamp: Date.now(),
                answer: '(bỏ qua)',
                correct: false
            });
            saveHistory();
            renderFlashcardStudy();
            renderFlashcardList();
            fcNext();
        }

        function fcCardClick() {
            fcReveal();
        }

        function fcReveal() {
            if (fcOrder.length === 0) return;
            fcRevealed = !fcRevealed;
            renderFlashcardStudy();
        }

        function fcNext() {
            if (fcOrder.length === 0) return;
            fcIndex = (fcIndex + 1) % fcOrder.length;
            fcRevealed = false;
            renderFlashcardStudy();
        }

        function fcPrev() {
            if (fcOrder.length === 0) return;
            fcIndex = (fcIndex - 1 + fcOrder.length) % fcOrder.length;
            fcRevealed = false;
            renderFlashcardStudy();
        }

        function fcShuffle() {
            for (let i = fcOrder.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [fcOrder[i], fcOrder[j]] = [fcOrder[j], fcOrder[i]];
            }
            fcIndex = 0;
            fcRevealed = false;
            renderFlashcardStudy();
        }

        function fcResetOrder() {
            fcOrder = mindmap.flashcards.map(c => c.id);
            fcIndex = 0;
            fcRevealed = false;
            renderFlashcardStudy();
        }

        function fcShowStats() {
            const total = mindmap.flashcards.length;
            const attempted = mindmap.flashcards.filter(c => c.attempts && c.attempts.length > 0).length;
            const correct = mindmap.flashcards.reduce((sum, c) => {
                if (!c.attempts) return sum;
                return sum + c.attempts.filter(a => a.correct).length;
            }, 0);
            const totalAttempts = mindmap.flashcards.reduce((sum, c) => sum + (c.attempts ? c.attempts.length : 0), 0);
            const rate = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;

            alert(`📊 Thống kê flashcard\n\n` +
                `📄 Tổng số thẻ: ${total}\n` +
                `✍️ Đã trả lời: ${attempted}\n` +
                `📝 Tổng lượt trả lời: ${totalAttempts}\n` +
                `✅ Đúng: ${correct}\n` +
                `📈 Tỷ lệ đúng: ${rate}%`);
        }

        function fcDeleteCurrent() {
            const card = getCurrentFlashcard();
            if (!card) return;
            fcDeleteById(card.id);
        }

        function fcDeleteById(cardId) {
            if (!confirm('Xoá flashcard này?')) return;
            mindmap.flashcards = mindmap.flashcards.filter(c => c.id !== cardId);
            fcOrder = fcOrder.filter(id => id !== cardId);
            if (fcIndex >= fcOrder.length) fcIndex = Math.max(0, fcOrder.length - 1);
            fcRevealed = false;
            saveHistory();
            renderFlashcardStudy();
            renderFlashcardList();
        }

        function fcEditCurrent() {
            const card = getCurrentFlashcard();
            if (!card) return;
            fcOpenEditModal(card.id);
        }

        function fcOpenEditModal(cardId) {
            const card = mindmap.flashcards.find(c => c.id === cardId);
            if (!card) return;
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'fcEditModal';
            overlay.innerHTML = `
                    <div class="modal-box">
                        <h3>✏️ Sửa flashcard</h3>
                        <p style="margin-top:8px; font-size:12px; font-weight:600;">Câu hỏi</p>
                        <textarea id="fcEditQuestion" style="width:100%; min-height:70px; margin-top:4px;">${escapeHtml(card.question)}</textarea>
                        <p style="margin-top:10px; font-size:12px; font-weight:600;">Đáp án</p>
                        <textarea id="fcEditAnswer" style="width:100%; min-height:90px; margin-top:4px;">${escapeHtml(card.answer)}</textarea>
                        <div class="modal-actions">
                            <button class="btn-cancel" onclick="closeFcEditModal()">Huỷ</button>
                            <button class="btn-confirm" onclick="confirmFcEdit(${cardId})">Lưu</button>
                        </div>
                    </div>
                `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFcEditModal(); });
        }

        function closeFcEditModal() {
            const modal = document.getElementById('fcEditModal');
            if (modal) modal.remove();
        }

        async function confirmFcEdit(cardId) {
            const card = mindmap.flashcards.find(c => c.id === cardId);
            if (!card) return;
            const q = document.getElementById('fcEditQuestion').value.trim();
            const a = document.getElementById('fcEditAnswer').value.trim();
            if (!q) { alert('Câu hỏi không được để trống');
                return; }
            const payload = { type: 'flashcard', cardId, question: q, answer: a };
            if (!await requireAuthForSave(payload)) return;
            saveFlashcardEdit(payload);
        }

        function saveFlashcardEdit(payload) {
            const card = mindmap.flashcards.find(c => c.id === payload.cardId);
            if (!card) return;
            card.question = payload.question;
            card.answer = payload.answer;
            console.log('[VisualMind] Dữ liệu flashcard lẽ ra được lưu:', mindmap.flashcards);
            saveHistory();
            closeFcEditModal();
            renderFlashcardStudy();
            renderFlashcardList();
        }

        consumePendingSave((payload) => {
            if (payload.type === 'flashcard') saveFlashcardEdit(payload);
        });

        function renderFlashcardList() {
            const container = document.getElementById('fcListContainer');
            const countEl = document.getElementById('fcCount');
            if (!container || !countEl) return;
            countEl.textContent = mindmap.flashcards.length;
            if (mindmap.flashcards.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--ink-soft); font-size:12.5px; padding:8px 0;">Chưa có flashcard nào.</div>';
                return;
            }
            container.innerHTML = mindmap.flashcards.map(card => {
                const linked = card.linkedNodeId != null && mindmap.nodes[card.linkedNodeId];
                const preview = card.question.length > 60 ? card.question.slice(0, 60) + '…' : card.question;
                const attempts = card.attempts ? card.attempts.length : 0;
                const correct = card.attempts ? card.attempts.filter(a => a.correct).length : 0;
                const stat = attempts > 0 ? `${correct}/${attempts}` : 'Chưa học';
                return `<div class="fc-list-row" onclick="fcListRowClick(${card.id})" oncontextmenu="fcListRowContextMenu(event, ${card.id})">
                    ${linked ? '<span class="fc-list-link-icon" title="Đã link với node">🔗</span>' : ''}
                    <span class="fc-list-q">${escapeHtml(preview)}</span>
                    <span class="fc-list-stat">📊 ${stat}</span>
                    <span class="fc-list-del" title="Xoá" onclick="event.stopPropagation(); fcDeleteById(${card.id})">🗑️</span>
                </div>`;
            }).join('');
        }

        function fcListRowClick(cardId) {
            if (pendingLink && pendingLink.type === 'node') {
                const nodeId = pendingLink.id;
                linkFlashcardToNode(cardId, nodeId);
                cancelPendingLink();
                switchAppMode('mindmap');
                centerOnNode(nodeId);
                return;
            }
            const idx = fcOrder.indexOf(cardId);
            if (idx >= 0) { fcIndex = idx; } else {
                fcOrder = mindmap.flashcards.map(c => c.id);
                fcIndex = Math.max(0, fcOrder.indexOf(cardId));
            }
            fcRevealed = false;
            renderFlashcardStudy();
        }

        function fcCardContextMenu(event) {
            event.preventDefault();
            const card = getCurrentFlashcard();
            if (!card) return;
            fcShowLinkContextMenu(event, card.id);
        }

        function fcListRowContextMenu(event, cardId) {
            event.preventDefault();
            event.stopPropagation();
            fcShowLinkContextMenu(event, cardId);
        }

        function fcShowLinkContextMenu(event, cardId) {
            closeContextMenu();
            const card = mindmap.flashcards.find(c => c.id === cardId);
            if (!card) return;
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';
            contextMenu = menu;
            const items = [];
            if (card.linkedNodeId != null && mindmap.nodes[card.linkedNodeId]) {
                items.push({
                    label: '📍 Nhảy tới node liên kết',
                    action: () => {
                        const nodeId = card.linkedNodeId;
                        closeContextMenu();
                        switchAppMode('mindmap');
                        centerOnNode(nodeId);
                    }
                });
                items.push({
                    label: '❌ Bỏ link',
                    action: () => {
                        card.linkedNodeId = null;
                        saveHistory();
                        closeContextMenu();
                        renderFlashcardStudy();
                        renderFlashcardList();
                    },
                    danger: true
                });
            } else {
                items.push({
                    label: '🔗 Chọn node trên mindmap để link',
                    action: () => { closeContextMenu();
                        startLinkPickForFlashcard(cardId); }
                });
            }
            items.push({ divider: true });
            items.push({
                label: '✏️ Sửa',
                action: () => { closeContextMenu();
                    fcOpenEditModal(cardId); }
            });
            items.push({
                label: '🗑️ Xoá',
                action: () => { closeContextMenu();
                    fcDeleteById(cardId); },
                danger: true
            });
            buildContextMenuItems(menu, items);
            document.body.appendChild(menu);
        }

        function startLinkPickForFlashcard(cardId) {
            pendingLink = { type: 'flashcard', id: cardId };
            switchAppMode('mindmap');
            document.getElementById('linkPickText').textContent = '🔗 Click vào 1 node để liên kết với flashcard này';
            document.getElementById('linkPickBanner').style.display = 'flex';
        }

        function startLinkPickForNode(nodeId) {
            pendingLink = { type: 'node', id: nodeId };
            switchAppMode('flashcard');
            document.querySelectorAll('#fcSidebarIcons .sidebar-icon-btn').forEach(b => b.classList.remove('active'));
            const listBtn = document.querySelector('#fcSidebarIcons [data-fctab="list"]');
            if (listBtn) listBtn.classList.add('active');
            document.querySelectorAll('#fcSidebar .tab-content').forEach(el => el.style.display = 'none');
            const listTab = document.getElementById('fctab-list');
            if (listTab) listTab.style.display = 'block';
            renderFlashcardList();
            document.getElementById('linkPickText').textContent =
                '🔗 Click vào 1 flashcard trong danh sách để liên kết với node này';
            document.getElementById('linkPickBanner').style.display = 'flex';
        }

        function cancelPendingLink() {
            pendingLink = null;
            const banner = document.getElementById('linkPickBanner');
            if (banner) banner.style.display = 'none';
        }

        function linkFlashcardToNode(cardId, nodeId) {
            const card = mindmap.flashcards.find(c => c.id === cardId);
            if (!card) return;
            card.linkedNodeId = nodeId;
            saveHistory();
            renderFlashcardStudy();
            renderFlashcardList();
        }

        function centerOnNode(nodeId) {
            const node = mindmap.nodes[nodeId];
            if (!node) return;
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            viewport.x = -cx * viewport.zoom;
            viewport.y = -cy * viewport.zoom;
            selection.nodeId = node.id;
            selection.selectedIds = [node.id];
            selection.selectedConnector = null;
            selection.selectedConnectors = [];
            selection.selectedLink = null;
            showRightPanel(node.id);
            updateZoomDisplay();
            render();
        }

