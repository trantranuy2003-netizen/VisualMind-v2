(() => {
    const key = 'visualmind-weekly-planner';
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const parseDate = (value) => new Date(`${value}T12:00:00`);
    const weekOf = (value) => {
        const date = parseDate(value);
        date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        return dateKey(date);
    };
    const occursOn = (task, date) => window.CalendarModel.occurs(task, date);

    const scheduledOn = (item, date) => !item.trashedAt && !item.excludedDates?.includes(date) && (item.extraDates?.includes(date) || (item.fromDate && item.toDate ? date >= item.fromDate && date <= item.toDate : item.dates?.includes(date)));

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
        let calendarView = 'month';
        let visibility = {};
        try { visibility = JSON.parse(localStorage.getItem('visualmind-calendar-visibility')) || {}; } catch {}
        const zoomLevels = [32, 48, 64, 96, 128];
        let hourHeight = Number(localStorage.getItem('visualmind-week-hour-height')) || 64;
        if (!zoomLevels.includes(hourHeight)) hourHeight = 64;
        const calendarText = (vi, en) => window.I18n.pair(vi, en);
        let draggingPlan = null;
        let scrollToNow = false;
        const M = window.CalendarModel;
        const id = () => `plan-${crypto.randomUUID()}`;
        const save = () => {
            localStorage.setItem(key, JSON.stringify(state));
            document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));
            render();
        };
        const calendarEditor = window.setupCalendarEditor(() => state, save);
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
        const formatDate = (value) => parseDate(value).toLocaleDateString(window.I18n.locale(), { day: '2-digit', month: '2-digit' });
        const daily = el('div', 'planner-daily');
        daily.innerHTML = '<section class="todo-group"><div class="todo-group-heading"><h3 data-dashboard-i18n="scheduled">Đã lên lịch</h3><button type="button" class="todo-group-add" data-add-scheduled aria-label="Thêm việc có lịch">+</button></div><div class="todo-group-list" data-scheduled></div></section><section class="todo-group"><div class="todo-group-heading"><h3 data-dashboard-i18n="recurring">Việc lặp lại</h3><button type="button" class="todo-group-add" data-add-recurring aria-label="Thêm việc lặp lại">+</button></div><div class="todo-group-list" data-recurring></div></section>';
        dashboard.querySelector('.todo-panel').appendChild(daily);
        const divider = el('div', 'planner-divider');
        divider.setAttribute('role', 'separator');
        dashboard.appendChild(divider);
        const weekly = el('section', 'todo-panel weekly-panel');
        weekly.innerHTML = '<div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Kế hoạch tuần</p><h2 data-dashboard-i18n="weeklyTasks">Công việc trong tuần</h2></div><button type="button" class="planner-button" data-add-plan>＋ Thêm</button></div><div class="planner-navigation" data-week-nav></div><div class="weekly-tree" data-weekly-tree></div>';
        const calendar = el('section', 'eisenhower-panel calendar-panel');
        calendar.innerHTML = '<div class="dashboard-panel-heading"><div><p class="dashboard-kicker">Lên lịch</p><h2 data-dashboard-i18n="calendar">Lịch</h2></div><div class="calendar-view-toggle" role="group" aria-label="Chế độ xem lịch"><button type="button" class="planner-button" data-calendar-view="month">Tháng</button><button type="button" class="planner-button" data-calendar-view="week">Tuần</button></div></div><div class="planner-navigation" data-month-nav></div><div class="calendar-weekdays" aria-hidden="true"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div><div class="calendar-grid" data-calendar></div>';
        dashboard.append(weekly, calendar);
        const controls = calendar.querySelector('.calendar-view-toggle');
        const preferences = el('div', 'calendar-visibility'); preferences.hidden = true;
        preferences.innerHTML = '<label><input type="checkbox" name="hideRecurring"> Ẩn việc lặp lại</label><label><input type="checkbox" name="hideDone"> Ẩn việc đã xong</label><label><input type="checkbox" name="sleep"> Bôi chéo giờ ngủ</label><label>Đi ngủ <input type="time" name="sleepStart" value="23:00"></label><label>Thức dậy <input type="time" name="sleepEnd" value="07:00"></label>';
        preferences.querySelectorAll('input').forEach(input => {
            if (input.type === 'checkbox') input.checked = Boolean(visibility[input.name]);
            else input.value = visibility[input.name] || input.value;
            input.onchange = () => { visibility[input.name] = input.type === 'checkbox' ? input.checked : input.value; localStorage.setItem('visualmind-calendar-visibility', JSON.stringify(visibility)); renderCalendar(); };
        });
        const eye = button('👁', () => { preferences.hidden = !preferences.hidden; eye.setAttribute('aria-expanded', String(!preferences.hidden)); }, 'Tùy chọn hiển thị lịch');
        eye.setAttribute('aria-expanded', 'false'); controls.appendChild(eye);
        calendar.querySelector('.dashboard-panel-heading').after(preferences);
        const expand = button('⛶', () => {
            const previous = document.activeElement;
            const marker = document.createComment('calendar'); calendar.before(marker);
            const overlay = el('div', 'library-dialog-overlay calendar-board-overlay');
            const panel = el('section', 'calendar-board'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Lịch dạng bảng');
            const close = () => { marker.replaceWith(calendar); overlay.remove(); expand.disabled = false; renderCalendar(); previous?.focus(); };
            const closeButton = button('×', close, 'Đóng lịch mở rộng');
            expand.disabled = true;
            panel.append(closeButton, calendar); overlay.appendChild(panel); document.body.appendChild(overlay);
            overlay.onclick = event => { if (event.target === overlay) close(); };
            overlay.onkeydown = event => {
                if (event.key === 'Escape') { event.stopPropagation(); close(); }
                if (event.key === 'Tab') { const fields = [...panel.querySelectorAll('button,input,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length); if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0].focus(); } }
            };
            renderCalendar(); closeButton.focus();
        }, 'Mở rộng lịch dạng bảng'); controls.appendChild(expand);

        const openEditor = (parent = null, recurring = false, scheduled = false) => {
            const overlay = el('div', 'library-dialog-overlay');
            overlay.innerHTML = `<form class="library-dialog planner-dialog" role="dialog" aria-modal="true" aria-label="Thêm công việc"><h3>${recurring ? window.dashboardText('addRecurring') : scheduled ? 'Thêm việc có lịch' : parent ? 'Thêm mục con' : 'Thêm kế hoạch tuần'}</h3><label>Tên<input name="title" maxlength="160" required autofocus></label>${recurring ? '<label>Lặp lại<select name="repeat"><option value="daily">Hằng ngày</option><option value="weekdays">Thứ 2 – Thứ 6</option><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option></select></label><label>Bắt đầu<input name="start" type="date" required></label>' : '<label>Loại<select name="kind"><option value="goal" data-dashboard-i18n="goal">Mục tiêu</option><option value="task" data-dashboard-i18n="task">Công việc</option></select></label>'}${scheduled ? '<label>Ngày<input name="date" type="date" required></label>' : ''}<div class="library-dialog-actions"><button type="button" data-cancel>Hủy</button><button type="submit" class="is-primary">Thêm</button></div></form>`;
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
            if (scheduled) form.elements.date.value = selectedDate;
            form.addEventListener('submit', e => {
                e.preventDefault();
                const title = form.elements.title.value.trim();
                if (!title) return;
                if (recurring) state.recurring.push({ id: id(), title, repeat: form.elements.repeat.value, start: form.elements.start.value, completedDates: [] });
                else state.items.push({ id: id(), title, kind: form.elements.kind.value, parentId: parent?.id || null, week: scheduled ? weekOf(form.elements.date.value) : parent?.week || week, dates: scheduled ? [form.elements.date.value] : [], completedDates: [] });
                if (scheduled) selectedDate = form.elements.date.value;
                close(); save();
            });
            document.body.appendChild(overlay);
            window.translateDashboard(overlay);
            form.elements.title.focus();
        };
        weekly.querySelector('[data-add-plan]').onclick = () => openEditor();
        daily.querySelector('[data-add-scheduled]').onclick = () => openEditor(null, false, true);
        daily.querySelector('[data-add-recurring]').onclick = () => calendarEditor.edit(null, selectedDate, null, 60, true);

        const schedule = (item, date) => {
            item.dates = [...new Set([...(item.dates || []), date])].sort();
            selectedDate = date;
            save();
        };
        const reparent = (itemId, parentId) => {
            const item = state.items.find(entry => entry.id === itemId && !entry.trashedAt);
            const parent = state.items.find(entry => entry.id === parentId && !entry.trashedAt);
            if (!item || itemId === parentId || (parentId && !parent)) return;
            const visited = new Set([itemId]);
            let ancestor = parent;
            while (ancestor) {
                if (visited.has(ancestor.id)) return;
                visited.add(ancestor.id);
                ancestor = state.items.find(entry => entry.id === ancestor.parentId);
            }
            item.parentId = parentId;
            const targetWeek = parent?.week || week;
            const moveBranch = node => {
                node.week = targetWeek;
                state.items.filter(entry => entry.parentId === node.id).forEach(moveBranch);
            };
            moveBranch(item); save();
        };
        const acceptParentDrop = (target, parentId) => {
            target.addEventListener('dragover', event => {
                if (!draggingPlan || draggingPlan === parentId) return;
                event.preventDefault(); event.stopPropagation();
                event.dataTransfer.dropEffect = 'move'; target.classList.add('is-parent-target');
            });
            target.addEventListener('dragleave', event => { if (!target.contains(event.relatedTarget)) target.classList.remove('is-parent-target'); });
            target.addEventListener('drop', event => {
                if (!draggingPlan) return;
                event.preventDefault(); event.stopPropagation();
                const itemId = draggingPlan; draggingPlan = null;
                weekly.classList.remove('is-reparenting'); target.classList.remove('is-parent-target');
                reparent(itemId, parentId);
            });
        };
        calendar.querySelectorAll('[data-calendar-view]').forEach(control => {
            control.onclick = () => { scrollToNow = control.dataset.calendarView === 'week' && calendarView !== 'week'; calendarView = control.dataset.calendarView; month = new Date(parseDate(selectedDate).getFullYear(), parseDate(selectedDate).getMonth(), 1); renderCalendar(); };
        });
        const renderWeekly = () => {
            if (window.setupChecklist) return;
            const nav = weekly.querySelector('[data-week-nav]'); nav.replaceChildren();
            const shift = amount => { const date = parseDate(week); date.setDate(date.getDate() + amount); week = dateKey(date); renderWeekly(); };
            const end = parseDate(week); end.setDate(end.getDate() + 6);
            nav.append(button('‹', () => shift(-7), 'Tuần trước'), el('span', '', `${formatDate(week)} – ${formatDate(dateKey(end))}`), button('›', () => shift(7), 'Tuần sau'), button('Tuần này', () => { week = weekOf(dateKey(new Date())); renderWeekly(); }));
            const tree = weekly.querySelector('[data-weekly-tree]'); tree.replaceChildren();
            const draw = (parentId, depth = 0) => {
                state.items.filter(item => !item.trashedAt && item.week === week && item.parentId === parentId).forEach(item => {
                    const row = el('article', 'weekly-item todo-item'); row.style.setProperty('--depth', Math.min(depth, 6));
                    row.dataset.weeklyId = item.id;
                    acceptParentDrop(row, item.id);
                    row.draggable = true;
                    row.addEventListener('dragstart', e => { draggingPlan = item.id; weekly.classList.add('is-reparenting'); e.dataTransfer.setData('application/x-hodi-plan', item.id); e.dataTransfer.effectAllowed = 'copyMove'; row.classList.add('is-dragging'); });
                    row.addEventListener('dragend', () => { draggingPlan = null; weekly.classList.remove('is-reparenting'); weekly.querySelectorAll('.is-parent-target').forEach(node => node.classList.remove('is-parent-target')); row.classList.remove('is-dragging'); calendar.querySelectorAll('.is-drag-over').forEach(cell => cell.classList.remove('is-drag-over')); });
                    const grip = el('span', 'todo-grip', '⠿');
                    grip.setAttribute('aria-hidden', 'true');
                    const checkbox = el('label', 'todo-check');
                    const check = el('input'); check.type = 'checkbox';
                    check.checked = (item.completedDates || []).includes(selectedDate);
                    check.setAttribute('aria-label', window.I18n.t('completeTask', {title:item.title}));
                    const box = el('span'); box.setAttribute('aria-hidden', 'true');
                    checkbox.append(check, box);
                    if (item.kind === 'goal') { checkbox.classList.add('goal-check'); box.innerHTML = window.goalIcon; }
                    row.classList.toggle('is-completed', check.checked);
                    check.onchange = () => {
                        item.completedDates = (item.completedDates || []).filter(date => date !== selectedDate);
                        if (check.checked) item.completedDates.push(selectedDate);
                        save();
                    };
                    const title = window.taskDisplay?.(item, save) || el('span', 'todo-item-title', item.title);
                    title.title = window.dashboardText(item.kind === 'goal' ? 'goal' : 'task');
                    row.append(grip, checkbox, title,
                        button('🖊', () => window.editDashboardTask(item, save), 'Sửa công việc'),
                        button('🗑', () => { item.trashedAt = new Date().toISOString(); save(); }, 'Chuyển vào thùng rác'),
                        button('+', () => openEditor(item), 'Thêm mục con'));
                    tree.appendChild(row); draw(item.id, depth + 1);
                });
            };
            draw(null);
            const rootDrop = el('div', 'weekly-root-drop', 'Đưa ra cấp ngoài cùng');
            acceptParentDrop(rootDrop, null); tree.appendChild(rootDrop);
            if (!tree.querySelector('.weekly-item')) tree.appendChild(el('p', 'planner-empty', window.dashboardText('emptyWeek')));
        };
        const itemLabel = (className, item, recurring = Boolean(item.repeat)) => {
            const label = el('span', className);
            const icon = el('span', recurring ? 'plan-icon' : 'plan-icon plan-icon-' + item.kind, recurring ? '↻' : item.kind === 'goal' ? '' : '□');
            if (!recurring && item.kind === 'goal') icon.innerHTML = window.goalIcon;
            icon.setAttribute('aria-hidden', 'true');
            label.append(icon, document.createTextNode(' ' + item.title));
            return label;
        };
        const renderDaily = () => {
            if (window.setupChecklist) return;
            const renderList = (selector, items, recurring) => {
                const list = typeof selector === 'string' ? daily.querySelector(selector) : selector;
                if (typeof selector === 'string') list.replaceChildren();
                items.forEach(item => {
                    const occurrenceDate = M.segments([item], selectedDate)[0]?.origin || selectedDate;
                    const row = el('div', 'planner-day-task todo-item');
                    row.dataset.planRow = item.id;
                    row.draggable = true;
                    row.addEventListener('dragstart', event => {
                        event.dataTransfer.setData('application/x-hodi-matrix-plan', item.id);
                        event.dataTransfer.effectAllowed = 'copyMove';
                        row.classList.add('is-dragging');
                    });
                    const check = el('input'); check.type = 'checkbox'; check.checked = (item.completedDates || []).includes(occurrenceDate); check.setAttribute('aria-label', window.I18n.t('completeTask', {title:item.title}));
                    row.classList.toggle('is-completed', check.checked);
                    check.onchange = () => { item.completedDates = (item.completedDates || []).filter(date => date !== occurrenceDate); if (check.checked) item.completedDates.push(occurrenceDate); save(); };
                    const grip = el('span', 'todo-grip', '⠿');
                    grip.setAttribute('aria-hidden', 'true');
                    const checkbox = el('label', 'todo-check');
                    const box = el('span'); box.setAttribute('aria-hidden', 'true');
                    checkbox.append(check, box);
                    if (item.kind === 'goal') { checkbox.classList.add('goal-check'); box.innerHTML = window.goalIcon; }
                    row.append(grip, checkbox, window.taskDisplay?.(item, save) || el('span', 'todo-item-title', item.title));
                    row.appendChild(button('🖊', () => item.repeat ? calendarEditor.edit(item, occurrenceDate) : window.editDashboardTask(item, save), 'Sửa công việc'));
                    row.appendChild(button('🗑', () => { item.trashedAt = new Date().toISOString(); save(); }, 'Chuyển vào thùng rác'));
                    if (list.classList.contains('matrix-dropzone')) {
                        row.appendChild(button('🗑', () => { item.matrixStatus = null; save(); }, 'Bỏ khỏi ma trận'));
                    }
                    list.appendChild(row);
                });
            };
            window.renderPlannerMatrix = () => {
                dashboard.querySelectorAll('.matrix-dropzone [data-plan-row]').forEach(row => row.remove());
                dashboard.querySelectorAll('.matrix-dropzone').forEach(list => {
                    const status = list.dataset.taskList;
                    renderList(list, state.items.filter(item => !item.trashedAt && item.matrixStatus === status), false);
                    renderList(list, state.recurring.filter(item => occursOn(item, selectedDate) && item.matrixStatus === status), true);
                });
            };
            window.renderPlannerMatrix();
            renderList('[data-scheduled]', state.items.filter(item => !item.matrixStatus && M.segments([item], selectedDate).length), false);
            renderList('[data-recurring]', state.recurring.filter(item => !item.matrixStatus && M.segments([item], selectedDate).length), true);
        };
        const pointerMinute = (timeline, y) => Math.max(0, Math.min(1425, Math.round((y - timeline.getBoundingClientRect().top) / hourHeight * 60 / 15) * 15));
        const pointerGesture = (event, node, move, finish, cancel) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            node.setPointerCapture?.(event.pointerId);
            const cleanup = () => {
                node.removeEventListener('pointermove', onMove); node.removeEventListener('pointerup', onUp);
                node.removeEventListener('pointercancel', onCancel); document.removeEventListener('keydown', onKey);
                if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
            };
            const onMove = next => {
                const grid = calendar.querySelector('[data-calendar]'), rect = grid.getBoundingClientRect();
                if (next.clientY > rect.bottom - 28) grid.scrollTop += 24;
                if (next.clientY < rect.top + 48) grid.scrollTop -= 24;
                move(next);
            };
            const onUp = next => { cleanup(); finish(next); };
            const onCancel = () => { cleanup(); cancel(); };
            const onKey = next => { if (next.key === 'Escape') { next.preventDefault(); onCancel(); } };
            node.addEventListener('pointermove', onMove); node.addEventListener('pointerup', onUp);
            node.addEventListener('pointercancel', onCancel); document.addEventListener('keydown', onKey);
        };
        const bindTimeline = (timeline, value) => {
            timeline.tabIndex = 0; timeline.setAttribute('role', 'group');
            timeline.setAttribute('aria-label', calendarText('Tạo công việc ngày ', 'Create task on ') + value);
            timeline.onclick = event => { if (!event.target.closest('.calendar-event')) event.stopPropagation(); };
            timeline.onkeydown = event => {
                if (event.target === timeline && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); calendarEditor.edit(null, value); }
            };
            timeline.onpointerdown = event => {
                if (event.target !== timeline || event.button !== 0) return;
                const start = pointerMinute(timeline, event.clientY);
                let first = start, end = Math.min(1440, start + 60);
                const preview = el('div', 'calendar-selection'); preview.style.pointerEvents = 'none';
                const draw = () => { preview.style.top = first / 60 * hourHeight + 'px'; preview.style.height = (end - first) / 60 * hourHeight + 'px'; preview.textContent = M.time(first) + '–' + (end === 1440 ? '24:00' : M.time(end)); };
                draw(); timeline.appendChild(preview);
                pointerGesture(event, timeline, next => {
                    const minute = Math.max(0, Math.min(1440, Math.round((next.clientY - timeline.getBoundingClientRect().top) / hourHeight * 4) * 15));
                    first = Math.min(start, minute); end = Math.max(start, minute, first + 15); draw();
                }, () => { preview.remove(); calendarEditor.edit(null, value, first, end - first); }, () => preview.remove());
            };
        };
        const bindResize = (handle, row, entry) => {
            handle.onpointerdown = event => {
                if (event.button !== 0) return;
                row.draggable = false;
                const originalHeight = row.style.height;
                const start = M.minutes(entry.item.fromTime);
                let length = M.duration(entry.item);
                pointerGesture(event, handle, next => {
                    const target = document.elementFromPoint(next.clientX, next.clientY)?.closest('[data-timeline-date]') || row.parentElement;
                    const date = target.dataset.timelineDate;
                    const minute = Math.max(15, Math.min(1440, Math.round((next.clientY - target.getBoundingClientRect().top) / hourHeight * 4) * 15));
                    length = Math.max(15, M.daysBetween(entry.origin, date) * 1440 + minute - start);
                    row.style.height = Math.max(18, (Math.min(1440, start + length - M.daysBetween(entry.origin, row.parentElement.dataset.timelineDate) * 1440) - entry.start) / 60 * hourHeight) + 'px';
                    handle.title = calendarText('Thời lượng: ', 'Duration: ') + length + calendarText(' phút', ' minutes');
                }, () => { row.draggable = true; row.style.height = originalHeight; calendarEditor.changeTime(entry.item, entry.origin, entry.origin, start, length); }, () => { row.draggable = true; row.style.height = originalHeight; });
            };
        };
        const updateNowLine = () => {
            calendar.querySelectorAll('.calendar-now-line').forEach(node => node.remove());
            if (calendarView !== 'week') return;
            const now = new Date();
            const timeline = calendar.querySelector(`[data-timeline-date="${dateKey(now)}"]`);
            if (!timeline) return;
            const line = el('div', 'calendar-now-line');
            line.style.top = (now.getHours() + now.getMinutes() / 60) * hourHeight + 'px';
            line.setAttribute('aria-label', calendarText('Giờ hiện tại: ', 'Current time: ') + M.time(now.getHours() * 60 + now.getMinutes()));
            timeline.appendChild(line);
        };
        const nowTimer = setInterval(() => { if (!dashboard.isConnected) { clearInterval(nowTimer); return; } updateNowLine(); }, 30000);
        const renderCalendar = () => {
            const oldGrid = calendar.querySelector('[data-calendar]');
            const scrollTop = oldGrid.scrollTop;
            const scrollLeft = oldGrid.scrollLeft;
            const nav = calendar.querySelector('[data-month-nav]'); nav.replaceChildren();
            const isWeek = calendarView === 'week';
            calendar.classList.toggle('is-week-view', isWeek);
            calendar.querySelectorAll('[data-calendar-view]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.calendarView === calendarView)));
            const shift = amount => {
                if (isWeek) { const date = parseDate(selectedDate); date.setDate(date.getDate() + amount * 7); selectedDate = dateKey(date); month = new Date(date.getFullYear(), date.getMonth(), 1); render(); }
                else { month = new Date(month.getFullYear(), month.getMonth() + amount, 1); renderCalendar(); }
            };
            const first = isWeek ? parseDate(weekOf(selectedDate)) : new Date(month.getFullYear(), month.getMonth(), 1);
            const last = new Date(first); last.setDate(last.getDate() + 6);
            const caption = isWeek ? formatDate(dateKey(first)) + ' – ' + formatDate(dateKey(last)) + ' · ' + last.getFullYear() : month.toLocaleDateString(window.I18n.locale(), { month: 'long', year: 'numeric' });
            nav.append(button('‹', () => shift(-1), isWeek ? 'Tuần trước' : 'Tháng trước'), el('span', '', caption), button('›', () => shift(1), isWeek ? 'Tuần sau' : 'Tháng sau'), button('Hôm nay', () => { scrollToNow = true; selectedDate = dateKey(new Date()); month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); }));
            const grid = calendar.querySelector('[data-calendar]'); grid.replaceChildren();
            if (isWeek) {
                const zoom = el('div', 'calendar-zoom');
                zoom.setAttribute('role', 'group');
                zoom.setAttribute('aria-label', calendarText('Thu phóng trục giờ', 'Time scale zoom'));
                const changeZoom = direction => {
                    const next = zoomLevels[zoomLevels.indexOf(hourHeight) + direction];
                    if (!next) return;
                    const headerHeight = 36 + Number.parseFloat(grid.style.getPropertyValue('--all-day-height') || '44');
                    const position = Math.max(0, grid.scrollTop - headerHeight) / hourHeight;
                    const wasAtTop = grid.scrollTop < headerHeight;
                    hourHeight = next;
                    localStorage.setItem('visualmind-week-hour-height', String(hourHeight));
                    renderCalendar();
                    grid.scrollTop = wasAtTop ? 0 : headerHeight + position * hourHeight;
                    calendar.querySelector(direction > 0 ? '[data-zoom-in]' : '[data-zoom-out]')?.focus();
                };
                const out = button('−', () => changeZoom(-1), calendarText('Thu nhỏ', 'Zoom out'));
                out.dataset.zoomOut = ''; out.disabled = hourHeight === zoomLevels[0];
                const into = button('+', () => changeZoom(1), calendarText('Phóng to', 'Zoom in'));
                into.dataset.zoomIn = ''; into.disabled = hourHeight === zoomLevels.at(-1);
                const scale = el('span', 'calendar-zoom-value', Math.round(hourHeight / 64 * 100) + '%');
                scale.setAttribute('role', 'status');
                zoom.append(out, scale, into); nav.appendChild(zoom);
                grid.style.setProperty('--hour-height', hourHeight + 'px');
                grid.style.setProperty('--all-day-height', '44px');
                const axis = el('div', 'week-time-axis');
                axis.appendChild(el('div', 'week-day-heading', calendarText('Giờ', 'Time')));
                axis.appendChild(el('div', 'week-all-day', calendarText('Chưa lên lịch', 'Unscheduled')));
                const hours = el('div', 'week-hours');
                for (let hour = 0; hour < 24; hour++) {
                    const tick = el('span', 'week-hour-label', String(hour).padStart(2, '0') + ':00');
                    tick.style.top = (hour * hourHeight) + 'px'; hours.appendChild(tick);
                }
                axis.appendChild(hours); grid.appendChild(axis);
            } else grid.style.removeProperty('--hour-height');
            const offset = isWeek ? 0 : (first.getDay() + 6) % 7;
            const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const cells = isWeek ? 7 : Math.ceil((offset + count) / 7) * 7;
            for (let index = 0; index < cells; index++) {
                const date = new Date(first); date.setDate(first.getDate() + index - offset);
                const value = dateKey(date);
                const cell = el('div', 'calendar-day'); cell.tabIndex = 0; cell.setAttribute('role', 'group'); cell.dataset.date = value;
                cell.classList.toggle('is-outside', !isWeek && date.getMonth() !== month.getMonth());
                cell.classList.toggle('is-today', value === dateKey(new Date()));
                cell.classList.toggle('is-selected', value === selectedDate); cell.setAttribute('aria-pressed', String(value === selectedDate));
                cell.appendChild(el('span', 'calendar-day-number', String(date.getDate())));
                const entries = M.layout(M.segments([...state.items, ...state.recurring], value).filter(entry => !(visibility.hideRecurring && entry.item.repeat) && !(visibility.hideDone && (entry.item.completed || entry.item.completedDates?.includes(entry.origin)))));
                const items = entries.map(entry => entry.item);
                let allDay, timeline;
                const positions = new Map();
                if (isWeek) {
                    cell.querySelector('.calendar-day-number').classList.add('week-day-heading');
                    cell.querySelector('.calendar-day-number').textContent = date.toLocaleDateString(calendarText('vi-VN', 'en-GB'), { weekday: 'short', day: 'numeric', month: 'numeric' });
                    allDay = el('div', 'week-all-day'); timeline = el('div', 'week-hours');
                    cell.append(allDay, timeline);
                    timeline.dataset.timelineDate = value;
                    bindTimeline(timeline, value);
                    if (visibility.sleep) {
                        const start = M.minutes(visibility.sleepStart || '23:00'), end = M.minutes(visibility.sleepEnd || '07:00');
                        const ranges = start < end ? [[start, end]] : [[0, end], [start, 1440]];
                        ranges.forEach(([from, to]) => { const shade = el('div', 'calendar-sleep'); shade.style.top = from / 60 * hourHeight + 'px'; shade.style.height = (to - from) / 60 * hourHeight + 'px'; shade.title = 'Giờ ngủ'; timeline.appendChild(shade); });
                    }
                    entries.forEach(entry => { if (entry.start !== null) positions.set(entry, entry); });
                }
                cell.setAttribute('aria-label', window.I18n.t('calendarCount', {date:date.toLocaleDateString(window.I18n.locale()), count:items.length}));
                (isWeek ? entries : entries.slice(0, 2)).forEach(entry => {
                    const item = entry.item;
                    const occurrenceDate = entry.origin;
                    const eventRow = el('div', 'calendar-event'); eventRow.dataset.calendarItem = item.id; eventRow.draggable = true;
                    const W = window.WheelModel, wheel = W?.load();
                    const goal = [...(wheel?.goals || []), ...(wheel?.archivedGoals || [])].find(goal => goal.id === item.wheelGoalId);
                    const category = [...(wheel?.categories || []), ...(wheel?.archivedCategories || [])].find(category => category.id === (item.wheelCategoryId || goal?.categoryId));
                    const categoryColor = category ? W.categoryColor(category) : item.categoryColor;
                    if (/^#[0-9a-f]{6}$/i.test(categoryColor || '')) {
                        eventRow.style.backgroundColor = categoryColor;
                        eventRow.style.borderColor = categoryColor;
                        eventRow.style.color = W ? W.textColor(categoryColor) : '#000000';
                    }
                    eventRow.addEventListener('dragstart', event => { event.stopPropagation(); event.dataTransfer.setData('application/x-hodi-calendar', JSON.stringify({ id: item.id, date: occurrenceDate, offset: isWeek && entry.start !== null && event.clientY ? (event.clientY - eventRow.getBoundingClientRect().top) / hourHeight * 60 : 0 })); event.dataTransfer.effectAllowed = 'move'; });
                    eventRow.addEventListener('click', event => { event.stopPropagation(); if (!event.target.closest('button,input,label')) window.editChecklistTask(item); });
                    const checkLabel = el('label', 'todo-check');
                    const check = el('input'); check.type = 'checkbox'; check.checked = (item.completedDates || []).includes(occurrenceDate); check.setAttribute('aria-label', window.I18n.t('completeTask', {title:item.title}));
                    const box = el('span'); box.setAttribute('aria-hidden', 'true');
                    if (item.kind === 'goal') { checkLabel.classList.add('goal-check'); box.innerHTML = window.goalIcon; }
                    checkLabel.append(check, box); eventRow.classList.toggle('is-completed', check.checked);
                    check.onchange = () => { item.completedDates = (item.completedDates || []).filter(date => date !== occurrenceDate); if (check.checked) item.completedDates.push(occurrenceDate); save(); };
                    const title = button(item.title, () => window.editChecklistTask(item), window.I18n.t('editNamedTask', {title:item.title})); title.className = 'calendar-event-title';
                    const remove = button('🗑', () => { item.excludedDates = [...new Set([...(item.excludedDates || []), occurrenceDate])]; save(); }, 'Bỏ khỏi ngày này'); remove.className = 'calendar-event-remove';
                    eventRow.append(checkLabel, title, remove);
                    if (isWeek && (item.fromTime || item.endToTime)) eventRow.appendChild(el('span', 'calendar-event-time', [item.fromTime, item.endToTime].filter(Boolean).join('–')));
                    if (isWeek) {
                        const position = positions.get(entry);
                        if (position) {
                            eventRow.classList.add('week-timed-event');
                            eventRow.style.top = (position.start / 60 * hourHeight) + 'px';
                            eventRow.style.height = ((position.end - position.start) / 60 * hourHeight) + 'px';
                            eventRow.style.left = (position.lane / position.columns * 100) + '%';
                            eventRow.style.width = (100 / position.columns) + '%';
                            eventRow.dataset.originDate = occurrenceDate;
                            eventRow.tabIndex = 0;
                            eventRow.addEventListener('keydown', event => {
                                if (event.target !== eventRow) return;
                                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.editChecklistTask(item); }
                                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                    event.preventDefault(); event.stopPropagation();
                                    calendarEditor.changeTime(item, occurrenceDate, occurrenceDate, Math.max(0, Math.min(1425, M.minutes(item.fromTime) + (event.key === 'ArrowDown' ? 15 : -15))), M.duration(item) || 60);
                                }
                            });
                            eventRow.title = item.title + ' · ' + (item.fromTime || '') + '–' + (item.endToTime || '') + (entry.continuesBefore ? ' · ' + calendarText('Tiếp từ hôm trước', 'Continued from previous day') : '') + (entry.continuesAfter ? ' · ' + calendarText('Tiếp sang hôm sau', 'Continues next day') : '');
                            const resize = button('↕', () => {}, calendarText('Kéo đổi thời lượng; dùng phím mũi tên để chỉnh 15 phút', 'Drag to resize; arrow keys adjust by 15 minutes'));
                            resize.className = 'calendar-resize-handle'; resize.draggable = false;
                            resize.onkeydown = event => { if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); calendarEditor.changeTime(item, occurrenceDate, occurrenceDate, M.minutes(item.fromTime), Math.max(15, M.duration(item) + (event.key === 'ArrowDown' ? 15 : -15))); } };
                            if (!entry.continuesAfter) eventRow.appendChild(resize);
                            bindResize(resize, eventRow, entry);
                            timeline.appendChild(eventRow);
                        } else allDay.appendChild(eventRow);
                    } else cell.appendChild(eventRow);
                });
                if (!isWeek && items.length > 2) { const more = button(window.I18n.t('moreItems', {count:items.length - 2}), () => {}, 'Xem tất cả công việc'); more.className = 'calendar-more'; cell.appendChild(more); }
                if (!isWeek) {
                    const inspect = button('', event => {}, calendarText('Xem chi tiết ngày ', 'View day details: ') + value);
                    inspect.className = 'calendar-day-inspect';
                    inspect.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>';
                    inspect.onclick = event => { event.stopPropagation(); showDayItems(value, entries); };
                    cell.appendChild(inspect);
                }
                cell.onkeydown = event => { if (event.target === cell && ['Enter', ' '].includes(event.key)) { event.preventDefault(); cell.click(); } };
                cell.onclick = event => {
                    selectedDate = value; renderWeekly(); renderDaily(); renderCalendar();
                    if (event.target.closest('.calendar-more') || (event.detail === 0 && items.length > 2)) showDayItems(value, entries);
                };
                cell.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).some(type => ['application/x-hodi-plan', 'application/x-hodi-calendar', 'application/x-hodi-matrix-plan'].includes(type))) { e.preventDefault(); e.dataTransfer.dropEffect = Array.from(e.dataTransfer.types).includes('application/x-hodi-calendar') ? 'move' : 'copy'; cell.classList.add('is-drag-over'); } });
                cell.addEventListener('dragleave', e => { if (!cell.contains(e.relatedTarget)) cell.classList.remove('is-drag-over'); });
                cell.addEventListener('drop', e => {
                    e.preventDefault(); cell.classList.remove('is-drag-over');
                    const dropTimeline = e.target.closest('[data-timeline-date]');
                    const dropMinute = dropTimeline ? pointerMinute(dropTimeline, e.clientY) : null;
                    const payload = e.dataTransfer.getData('application/x-hodi-calendar');
                    if (payload) {
                        let moved; try { moved = JSON.parse(payload); } catch { return; }
                        const item = [...state.items, ...state.recurring].find(item => item.id === moved.id && !item.trashedAt);
                        if (!item) return;
                        if (dropMinute !== null) { const raw = (e.clientY - dropTimeline.getBoundingClientRect().top) / hourHeight * 60; calendarEditor.changeTime(item, moved.date, value, Math.max(0, Math.min(1425, Math.round((raw - (moved.offset || 0)) / 15) * 15)), M.duration(item) || 60); return; }
                        if (value === moved.date) return;
                        item.excludedDates = [...new Set([...(item.excludedDates || []), moved.date])].filter(date => date !== value);
                        item.extraDates = [...new Set([...(item.extraDates || []), value])].filter(date => date !== moved.date);
                        if (item.completedDates?.includes(moved.date)) item.completedDates = [...new Set([...item.completedDates.filter(date => date !== moved.date), value])];
                        selectedDate = value; save(); return;
                    }
                    const id = e.dataTransfer.getData('application/x-hodi-plan') || e.dataTransfer.getData('application/x-hodi-matrix-plan');
                    const item = [...state.items, ...state.recurring].find(entry => entry.id === id && !entry.trashedAt);
                    if (item && dropMinute !== null) { calendarEditor.changeTime(item, selectedDate, value, dropMinute, M.duration(item) || 60); return; }
                    if (item) { item.excludedDates = (item.excludedDates || []).filter(date => date !== value); if (item.repeat || (item.fromDate && item.toDate)) item.extraDates = [...new Set([...(item.extraDates || []), value])]; schedule(item, value); }
                });
                grid.appendChild(cell);
            }
            if (isWeek) {
                const rows = [...grid.querySelectorAll('.week-all-day')];
                const height = Math.max(44, ...rows.map(row => row.scrollHeight));
                grid.style.setProperty('--all-day-height', height + 'px');
            }
            grid.scrollTop = scrollTop; grid.scrollLeft = scrollLeft;
            updateNowLine();
            if (isWeek && scrollToNow) {
                const now = new Date();
                grid.scrollTop = Math.max(0, (now.getHours() + now.getMinutes() / 60 - 1) * hourHeight);
                scrollToNow = false;
            }
        };
        function render() { renderWeekly(); renderDaily(); renderCalendar(); window.translateDashboard(dashboard); }
        function showDayItems(value, entries) {
            const overlay = el('div', 'library-dialog-overlay');
            const panel = el('section', 'library-dialog calendar-day-dialog');
            panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-label', window.I18n.t('tasksOn', {date:formatDate(value)}));
            const heading = el('div', 'dashboard-panel-heading');
            const dayTitle = el('h3'); heading.appendChild(dayTitle);
            const close = () => { overlay.remove(); calendar.querySelector(`[data-date="${value}"]`)?.focus(); };
            const closeButton = button('×', close, 'Đóng danh sách'); heading.appendChild(closeButton);
            panel.appendChild(heading);
            const list = el('div', 'calendar-all-items');
            const renderDetails = () => {
                entries = M.segments([...state.items, ...state.recurring], value).sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
                dayTitle.textContent = parseDate(value).toLocaleDateString(calendarText('vi-VN', 'en-GB'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + entries.length + calendarText(' công việc', ' tasks');
                list.replaceChildren();
                if (!entries.length) list.appendChild(el('p', 'planner-empty', calendarText('Ngày này chưa có công việc nào.', 'No tasks scheduled for this day.')));
                entries.forEach(entry => {
                const item = entry.item, occurrenceDate = entry.origin;
                const row = el('div', 'planner-day-task');
                const check = el('input'); check.type = 'checkbox'; check.checked = (item.completedDates || []).includes(occurrenceDate);
                check.setAttribute('aria-label', window.I18n.t('completeTask', {title:item.title}));
                row.classList.toggle('is-completed', check.checked);
                check.onchange = () => {
                    item.completedDates = (item.completedDates || []).filter(date => date !== occurrenceDate);
                    if (check.checked) item.completedDates.push(occurrenceDate);
                    row.classList.toggle('is-completed', check.checked); save(); renderDetails();
                };
                const checkbox = el('label', 'todo-check');
                const box = el('span'); box.setAttribute('aria-hidden', 'true');
                checkbox.append(check, box);
                if (item.kind === 'goal') { checkbox.classList.add('goal-check'); box.innerHTML = window.goalIcon; }
                const time = el('div', 'day-detail-time', entry.start === null ? calendarText('Cả ngày', 'All day') : M.time(entry.start) + '–' + (entry.end === 1440 ? '24:00' : M.time(entry.end)));
                if (entry.continuesBefore || entry.continuesAfter) time.appendChild(el('small', '', entry.continuesBefore ? calendarText('Từ hôm trước', 'From previous day') : calendarText('Sang hôm sau', 'Until next day')));
                row.append(time, checkbox, window.taskDisplay?.(item, () => { save(); renderDetails(); }) || itemLabel('planner-task-title', item));
                const actions = el('div', 'day-detail-actions');
                actions.appendChild(button(calendarText('Sửa', 'Edit'), () => { close(); window.editChecklistTask(item); }, calendarText('Sửa công việc', 'Edit task')));
                actions.appendChild(button('🗑', () => { item.excludedDates = [...new Set([...(item.excludedDates || []), occurrenceDate])]; save(); renderDetails(); }, 'Bỏ khỏi ngày này'));
                row.appendChild(actions);
                list.appendChild(row);
                });
            };
            renderDetails();
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
        window.movePlannerToMatrix = (id, status) => {
            if (!['inbox', 'do', 'schedule', 'delegate', 'eliminate'].includes(status)) return;
            const item = [...state.items, ...state.recurring].find(item => item.id === id && !item.trashedAt);
            if (!item) return;
            item.matrixStatus = status === 'inbox' ? null : status;
            save();
        };
        const sync = () => { state = read(); render(); };
        document.addEventListener('visualmind-preferences', event => { if (event.detail?.language) render(); });
        document.addEventListener('visualmind-dashboard-restored', sync);
        document.addEventListener('visualmind-dashboard-change', sync);
        window.addEventListener('storage', e => { if (e.storageArea === localStorage && (e.key === key || e.key === null)) sync(); });
        window.addEventListener('pageshow', sync);
        window.addEventListener('focus', sync);
        render();
    };
})();
