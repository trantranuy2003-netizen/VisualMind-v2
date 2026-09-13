(() => {
    const source = nodeId => ({ mapId: localMindmapId, nodeId });
    const selected = () => mindmap.nodes[selection.nodeId || mindmap.center];
    function createTask() {
        closeInlineEdit();
        const node = selected(); if (!node || !localMindmapId) return;
        const { panel, close } = MM.dialog('Tạo công việc từ nhánh', 'Create task from branch');
        const form = document.createElement('form');
        form.innerHTML = `<label>${MM.tr('Tên công việc', 'Task name')}<input name="title" required maxlength="160"></label><label>${MM.tr('Ngày', 'Date')}<input type="date" name="date" required></label><label>${MM.tr('Giờ (không bắt buộc)', 'Time (optional)')}<input type="time" name="time"></label><label>${MM.tr('Thời lượng (phút)', 'Duration (minutes)')}<input type="number" name="duration" value="60" min="15" max="1440" step="15"></label><p role="alert"></p>`;
        form.elements.title.value = node.text;
        const now = new Date(); form.elements.date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const submit = MM.button('Tạo công việc', 'Create task', () => {}); submit.type = 'submit'; form.append(submit); panel.append(form);
        form.onsubmit = event => {
            event.preventDefault();
            try {
                const state = JSON.parse(localStorage.getItem('visualmind-weekly-planner') || '{"items":[],"recurring":[]}');
                const date = form.elements.date.value, start = form.elements.time.value, length = start ? Number(form.elements.duration.value) : 0;
                const day = new Date(date + 'T12:00:00'), monday = new Date(day); monday.setDate(day.getDate() - (day.getDay() + 6) % 7);
                const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const endMinutes = start ? Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + length : 0;
                const end = new Date(day); end.setDate(end.getDate() + Math.floor(endMinutes / 1440));
                const task = { id: 'plan-' + crypto.randomUUID(), kind: 'task', title: form.elements.title.value.trim(), parentId: null, dates: [date], fromDate: date, toDate: dateKey(end), week: dateKey(monday), fromTime: start, endToTime: start ? `${String(Math.floor(endMinutes % 1440 / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}` : '', durationMinutes: length, completedDates: [], mindmapSource: source(node.id) };
                if (!task.title) return;
                state.items.push(task); localStorage.setItem('visualmind-weekly-planner', JSON.stringify(state));
                document.dispatchEvent(new CustomEvent('visualmind-dashboard-change')); close(); showToast(MM.tr('Đã tạo công việc trong lịch, kèm liên kết về nhánh.', 'Task added to calendar with a link back to the branch.'), 'success');
            } catch (error) { form.querySelector('[role="alert"]').textContent = MM.tr('Không lưu được công việc: ', 'Could not save task: ') + error.message; }
        };
    }
    function createCards() {
        closeInlineEdit();
        const node = selected(); if (!node || !localMindmapId) return;
        const nodes = [], visited = new Set();
        const collect = id => { if (visited.has(id)) return; visited.add(id); const n = mindmap.nodes[id]; if (!n) return; nodes.push(n); (n.children || []).forEach(collect); }; collect(node.id);
        const drafts = nodes.filter(n => n.children?.length || n.comment).map(n => ({ question: n.text, answer: n.comment || n.children.map(id => mindmap.nodes[id]?.text || '').join('\n'), source: source(n.id) }));
        if (!drafts.length) drafts.push({ question: node.text, answer: '', source: source(node.id) });
        const { panel, close } = MM.dialog('Tạo bộ flashcard', 'Create flashcard deck');
        const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = MM.tr('Tên bộ thẻ', 'Deck name'); const name = document.createElement('input'); name.required = true; name.value = node.text; label.append(name); form.append(label);
        const note = document.createElement('p'); note.textContent = MM.tr('Xem và sửa câu hỏi/đáp án trước khi tạo. Mỗi thẻ giữ liên kết về nhánh nguồn.', 'Review questions and answers before creating. Every card links to its source branch.'); form.append(note);
        const fields = drafts.map(draft => {
            const group = document.createElement('fieldset'), q = document.createElement('textarea'), a = document.createElement('textarea'); q.required = a.required = true; q.value = draft.question; a.value = draft.answer; q.setAttribute('aria-label', MM.tr('Câu hỏi', 'Question')); a.setAttribute('aria-label', MM.tr('Đáp án', 'Answer')); q.placeholder = q.getAttribute('aria-label'); a.placeholder = a.getAttribute('aria-label'); group.append(q, a); form.append(group); return { q, a, source: draft.source };
        });
        const error = document.createElement('p'); error.setAttribute('role', 'alert'); form.append(error);
        const submit = MM.button('Tạo bộ thẻ', 'Create deck', () => {}); submit.type = 'submit'; form.append(submit); panel.append(form);
        form.onsubmit = event => {
            event.preventDefault();
            try {
                const documents = JSON.parse(localStorage.getItem('visualmind-local-mindmaps') || '{}');
                const workspace = documents['flashcard-workspace'] || { center: null, nodes: {}, nextId: 1, links: [], groups: [], flashcards: [], nextFlashcardId: 1 };
                const deckId = crypto.randomUUID(); workspace.flashcards ||= []; workspace.nextFlashcardId = Math.max(workspace.nextFlashcardId || 1, ...workspace.flashcards.map(card => card.id + 1));
                const cards = fields.map(field => ({ id: workspace.nextFlashcardId++, question: field.q.value.trim(), answer: field.a.value.trim(), deckId, deckName: name.value.trim(), mindmapSource: field.source, linkedNodeId: null, attempts: [] }));
                if (cards.some(card => !card.question || !card.answer)) { error.textContent = MM.tr('Điền đủ câu hỏi và đáp án.', 'Fill in every question and answer.'); return; }
                workspace.flashcards.push(...cards); documents['flashcard-workspace'] = workspace; localStorage.setItem('visualmind-local-mindmaps', JSON.stringify(documents));
                const dirty = JSON.parse(localStorage.getItem('visualmind-dirty-mindmaps') || '{}'); dirty['flashcard-workspace'] = true; localStorage.setItem('visualmind-dirty-mindmaps', JSON.stringify(dirty));
                close(); const done = MM.dialog('Đã tạo bộ thẻ', 'Deck created'); const link = document.createElement('a'); link.href = 'flashcard.html?deckId=' + encodeURIComponent(deckId); link.textContent = MM.tr('Mở bộ thẻ vừa tạo', 'Open new deck'); done.panel.append(link);
            } catch (e) { error.textContent = e.message; }
        };
    }
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelector('.mm-tools').append(MM.button('Tạo công việc', 'Create task', createTask), MM.button('Tạo flashcard', 'Create flashcards', createCards));
    });
})();
