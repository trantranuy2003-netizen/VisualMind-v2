(() => {
    const key = 'visualmind-weekly-planner';
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const parseDate = (value) => new Date(`${value}T12:00:00`);
    const weekOf = (value) => {
        const date = parseDate(value);
        date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        return dateKey(date);
    };
    const occursOn = (task, date) => {
        if (date < task.start) return false;
        const day = parseDate(date), start = parseDate(task.start);
        return task.repeat === 'daily'
            || (task.repeat === 'weekdays' && day.getDay() > 0 && day.getDay() < 6)
            || (task.repeat === 'weekly' && day.getDay() === start.getDay())
            || (task.repeat === 'monthly' && day.getDate() === Math.min(start.getDate(), new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()));
    };

    window.setupWeeklyPlanner = (dashboard) => {
        const read = () => {
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                if (saved && Array.isArray(saved.items) && Array.isArray(saved.recurring)) return saved;
            } catch { /* Start with an empty planner if storage is unavailable. */ }
            return { items: [], recurring: [] };
        };
        let state = read();
        let selectedDate = dateKey(new Date());
        let week = weekOf(selectedDate);
        let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const id = () => `plan-${crypto.randomUUID()}`;
        const save = () => {
            localStorage.setItem(key, JSON.stringify(state));
            document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));
            render();
        };
        const el = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };
        const button = (text, action, title = text) => {
            const node = el('button', 'planner-button', text);
            node.type = 'button'; node.title = title; node.setAttribute('aria-label', title);
            node.addEventListener('click', action);
            return node;
        };
        const formatDate = (value) => parseDate(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        const daily = el('div', 'planner-daily');
        daily.innerHTML = '<section><h3>Scheduled <span data-selected-date></span></h3><div data-scheduled></div></section><section><h3>Recurring task</h3><div data-recurring></div><button type="button" class="planner-button" data-add-recurring>＋ Thêm việc lặp lại</button></section>';
        dashboard.querySelector('.todo-panel').appendChild(daily);
        const divider = el('div', 'planner-divider');
        divider.setAttribute('role', 'separator');
        dashboard.appendChild(divider);
        const weekly = el('section', 'todo-panel weekly-panel');
        weekly.innerHTML = '<div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Kế hoạch tuần</p><h2>To-do list tuần</h2></div><button type="button" class="planner-button" data-add-plan>＋ Thêm</button></div><div class="planner-navigation" data-week-nav></div><p class="todo-drop-hint">◎ Goal · □ Task — kéo vào một ngày để lên lịch.</p><div class="weekly-tree" data-weekly-tree></div>';
        const calendar = el('section', 'eisenhower-panel calendar-panel');
        calendar.innerHTML = '<div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Lên lịch</p><h2>Calendar</h2></div></div><div class="planner-navigation" data-month-nav></div><div class="calendar-weekdays" aria-hidden="true"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div><div class="calendar-grid" data-calendar></div><p class="todo-drop-hint">Chọn ngày để xem Scheduled và Recurring task phía trên.</p>';
        dashboard.append(weekly, calendar);

        const openEditor = (parent = null, recurring = false) => {
            const overlay = el('div', 'library-dialog-overlay');
            overlay.innerHTML = `<form class="library-dialog planner-dialog" role="dialog" aria-modal="true" aria-label="Thêm công việc"><h3>${recurring ? 'Thêm recurring task' : parent ? 'Thêm mục con' : 'Thêm kế hoạch tuần'}</h3><label>Tên<input name="title" maxlength="160" required autofocus></label>${recurring ? '<label>Lặp lại<select name="repeat"><option value="daily">Hằng ngày</option><option value="weekdays">Thứ 2 – Thứ 6</option><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option></select></label><label>Bắt đầu<input name="start" type="date" required></label>' : '<label>Loại<select name="kind"><option value="goal">◎ Goal</option><option value="task">□ Task</option></select></label>'}<div class="library-dialog-actions"><button type="button" data-cancel>Hủy</button><button type="submit" class="is-primary">Thêm</button></div></form>`;
            const previousFocus = document.activeElement;
            const close = () => { overlay.remove(); previousFocus?.focus(); };
            overlay.querySelector('[data-cancel]').onclick = close;
            overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
            overlay.addEventListener('keydown', e => {
                if (e.key === 'Escape') close();
                if (e.key === 'Tab') {
                    const fields = [...overlay.querySelectorAll('input, select, button')];
                    if (e.shiftKey && document.activeElement === fields[0]) { e.preventDefault(); fields.at(-1).focus(); }
                    else if (!e.shiftKey && document.activeElement === fields.at(-1)) { e.preventDefault(); fields[0].focus(); }
                }
            });
            const form = overlay.querySelector('form');
            if (recurring) form.elements.start.value = selectedDate;
            form.addEventListener('submit', e => {
                e.preventDefault();
                const title = form.elements.title.value.trim();
                if (!title) return;
                if (recurring) state.recurring.push({ id: id(), title, repeat: form.elements.repeat.value, start: form.elements.start.value, completedDates: [] });
                else state.items.push({ id: id(), title, kind: form.elements.kind.value, parentId: parent?.id || null, week: parent?.week || week, dates: [], completedDates: [] });
                close(); save();
            });
            document.body.appendChild(overlay);
            form.elements.title.focus();
        };
        weekly.querySelector('[data-add-plan]').onclick = () => openEditor();
        daily.querySelector('[data-add-recurring]').onclick = () => openEditor(null, true);

        const schedule = (item, date) => {
            item.dates = [...new Set([...(item.dates || []), date])].sort();
            selectedDate = date;
            save();
        };
        const removeItem = (item) => {
            if (!window.confirm(`Xóa “${item.title}” và các mục con, bao gồm lịch đã đặt?`)) return;
            const removed = new Set([item.id]);
            let changed = true;
            while (changed) {
                changed = false;
                state.items.forEach(entry => {
                    if (removed.has(entry.parentId) && !removed.has(entry.id)) { removed.add(entry.id); changed = true; }
                });
            }
            state.items = state.items.filter(entry => !removed.has(entry.id));
            save();
        };
        const renderWeekly = () => {
            const nav = weekly.querySelector('[data-week-nav]'); nav.replaceChildren();
            const shift = amount => { const date = parseDate(week); date.setDate(date.getDate() + amount); week = dateKey(date); renderWeekly(); };
            const end = parseDate(week); end.setDate(end.getDate() + 6);
            nav.append(button('‹', () => shift(-7), 'Tuần trước'), el('span', '', `${formatDate(week)} – ${formatDate(dateKey(end))}`), button('›', () => shift(7), 'Tuần sau'), button('Tuần này', () => { week = weekOf(dateKey(new Date())); renderWeekly(); }));
            const tree = weekly.querySelector('[data-weekly-tree]'); tree.replaceChildren();
            const draw = (parentId, depth = 0) => {
                state.items.filter(item => item.week === week && item.parentId === parentId).forEach(item => {
                    const row = el('article', 'weekly-item'); row.style.setProperty('--depth', Math.min(depth, 6));
                    row.draggable = true;
                    row.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-hodi-plan', item.id); e.dataTransfer.effectAllowed = 'copy'; row.classList.add('is-dragging'); });
                    row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); calendar.querySelectorAll('.is-drag-over').forEach(cell => cell.classList.remove('is-drag-over')); });
                    const heading = el('div', 'weekly-item-heading');
                    const icon = el('span', `plan-icon plan-icon-${item.kind}`, item.kind === 'goal' ? '◎' : '□'); icon.title = item.kind === 'goal' ? 'Goal' : 'Task';
                    heading.append(icon, el('span', 'weekly-item-title', item.title)); row.appendChild(heading);
                    if (item.dates?.length) row.appendChild(el('span', 'schedule-badge', `Đã lên lịch · ${item.dates.map(formatDate).join(', ')}`));
                    const actions = el('div', 'weekly-item-actions');
                    actions.append(button('＋ Con', () => openEditor(item)), button('×', () => removeItem(item), 'Xóa mục'));
                    const date = el('input', 'planner-date-input'); date.type = 'date'; date.title = 'Chọn ngày để lên lịch'; date.setAttribute('aria-label', `Lên lịch: ${item.title}`);
                    date.addEventListener('change', () => { if (date.value) schedule(item, date.value); });
                    actions.appendChild(date); row.appendChild(actions); tree.appendChild(row); draw(item.id, depth + 1);
                });
            };
            draw(null);
            if (!tree.children.length) tree.appendChild(el('p', 'planner-empty', 'Chưa có kế hoạch. Thêm goal hoặc task cho tuần này.'));
        };
        const renderDaily = () => {
            daily.querySelector('[data-selected-date]').textContent = parseDate(selectedDate).toLocaleDateString('vi-VN');
            const renderList = (selector, items, recurring) => {
                const list = daily.querySelector(selector); list.replaceChildren();
                items.forEach(item => {
                    const row = el('div', 'planner-day-task');
                    const check = el('input'); check.type = 'checkbox'; check.checked = (item.completedDates || []).includes(selectedDate); check.setAttribute('aria-label', `Hoàn thành: ${item.title}`);
                    row.classList.toggle('is-completed', check.checked);
                    check.onchange = () => { item.completedDates = (item.completedDates || []).filter(date => date !== selectedDate); if (check.checked) item.completedDates.push(selectedDate); save(); };
                    row.append(check, el('span', 'planner-task-title', `${recurring ? '↻' : item.kind === 'goal' ? '◎' : '□'} ${item.title}`));
                    row.appendChild(button('×', () => {
                        if (recurring) {
                            if (!window.confirm(`Dừng lặp lại “${item.title}”?`)) return;
                            state.recurring = state.recurring.filter(entry => entry.id !== item.id);
                        } else {
                            item.dates = item.dates.filter(date => date !== selectedDate);
                            item.completedDates = (item.completedDates || []).filter(date => date !== selectedDate);
                        }
                        save();
                    }, recurring ? 'Dừng công việc lặp lại' : 'Bỏ lịch ngày này'));
                    list.appendChild(row);
                });
                if (!items.length) list.appendChild(el('p', 'planner-empty', recurring ? 'Không có việc lặp lại trong ngày này.' : 'Chưa có lịch cho ngày này. Kéo kế hoạch vào lịch bên dưới.'));
            };
            renderList('[data-scheduled]', state.items.filter(item => item.dates?.includes(selectedDate)), false);
            renderList('[data-recurring]', state.recurring.filter(item => occursOn(item, selectedDate)), true);
        };
        const renderCalendar = () => {
            const nav = calendar.querySelector('[data-month-nav]'); nav.replaceChildren();
            const shift = amount => { month = new Date(month.getFullYear(), month.getMonth() + amount, 1); renderCalendar(); };
            nav.append(button('‹', () => shift(-1), 'Tháng trước'), el('span', '', month.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })), button('›', () => shift(1), 'Tháng sau'), button('Hôm nay', () => { selectedDate = dateKey(new Date()); month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); }));
            const grid = calendar.querySelector('[data-calendar]'); grid.replaceChildren();
            const first = new Date(month.getFullYear(), month.getMonth(), 1);
            const offset = (first.getDay() + 6) % 7;
            const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const cells = Math.ceil((offset + count) / 7) * 7;
            for (let index = 0; index < cells; index++) {
                const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1);
                const value = dateKey(date);
                const cell = el('button', 'calendar-day'); cell.type = 'button'; cell.dataset.date = value;
                cell.classList.toggle('is-outside', date.getMonth() !== month.getMonth());
                cell.classList.toggle('is-today', value === dateKey(new Date()));
                cell.classList.toggle('is-selected', value === selectedDate); cell.setAttribute('aria-pressed', String(value === selectedDate));
                cell.appendChild(el('span', 'calendar-day-number', String(date.getDate())));
                const items = [...state.items.filter(item => item.dates?.includes(value)), ...state.recurring.filter(item => occursOn(item, value))];
                cell.setAttribute('aria-label', `${date.toLocaleDateString('vi-VN')}, ${items.length} công việc`);
                items.slice(0, 2).forEach(item => { const label = el('span', 'calendar-event', `${item.repeat ? '↻' : item.kind === 'goal' ? '◎' : '□'} ${item.title}`); label.title = item.title; cell.appendChild(label); });
                if (items.length > 2) cell.appendChild(el('span', 'calendar-more', `+${items.length - 2} mục`));
                cell.onclick = event => {
                    selectedDate = value; renderDaily(); renderCalendar();
                    if (event.target.closest('.calendar-more') || (event.detail === 0 && items.length > 2)) showDayItems(value, items);
                };
                cell.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('application/x-hodi-plan')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; cell.classList.add('is-drag-over'); } });
                cell.addEventListener('dragleave', e => { if (!cell.contains(e.relatedTarget)) cell.classList.remove('is-drag-over'); });
                cell.addEventListener('drop', e => { e.preventDefault(); cell.classList.remove('is-drag-over'); const item = state.items.find(entry => entry.id === e.dataTransfer.getData('application/x-hodi-plan')); if (item) schedule(item, value); });
                grid.appendChild(cell);
            }
        };
        function render() { renderWeekly(); renderDaily(); renderCalendar(); }
        function showDayItems(value, items) {
            const overlay = el('div', 'library-dialog-overlay');
            const panel = el('section', 'library-dialog calendar-day-dialog');
            panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-label', `Công việc ngày ${formatDate(value)}`);
            const heading = el('div', 'dashboard-panel-heading');
            heading.appendChild(el('h3', '', `Ngày ${parseDate(value).toLocaleDateString('vi-VN')} · ${items.length} mục`));
            const close = () => { overlay.remove(); calendar.querySelector(`[data-date="${value}"]`)?.focus(); };
            const closeButton = button('×', close, 'Đóng danh sách'); heading.appendChild(closeButton);
            panel.appendChild(heading);
            const list = el('div', 'calendar-all-items');
            items.forEach(item => {
                const row = el('div', 'planner-day-task');
                const check = el('input'); check.type = 'checkbox'; check.checked = (item.completedDates || []).includes(value);
                check.setAttribute('aria-label', `Hoàn thành: ${item.title}`);
                row.classList.toggle('is-completed', check.checked);
                check.onchange = () => {
                    item.completedDates = (item.completedDates || []).filter(date => date !== value);
                    if (check.checked) item.completedDates.push(value);
                    row.classList.toggle('is-completed', check.checked); save();
                };
                row.append(check, el('span', 'planner-task-title', `${item.repeat ? '↻' : item.kind === 'goal' ? '◎' : '□'} ${item.title}`));
                list.appendChild(row);
            });
            panel.appendChild(list); overlay.appendChild(panel); document.body.appendChild(overlay);
            overlay.onclick = event => { if (event.target === overlay) close(); };
            overlay.onkeydown = event => {
                if (event.key === 'Escape') close();
                if (event.key === 'Tab') {
                    const fields = [...panel.querySelectorAll('button, input')];
                    if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1).focus(); }
                    else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0].focus(); }
                }
            };
            closeButton.focus();
        }
        const sync = () => { state = read(); render(); };
        document.addEventListener('visualmind-dashboard-restored', sync);
        window.addEventListener('storage', e => { if (e.storageArea === localStorage && (e.key === key || e.key === null)) sync(); });
        window.addEventListener('pageshow', sync);
        window.addEventListener('focus', sync);
        render();
    };
})();
