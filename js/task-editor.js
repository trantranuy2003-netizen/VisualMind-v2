(() => {
    window.taskTrashIcon = '<svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 15h10l1-15"/><path class="trash-recycle" d="m10 12 2-3 2 3m0-2v2h-2m3 2 1 3h-3m1 1-1-1 1-1m-4 1H8l1-3m-1 1 1-1 1 1"/></svg>';
    window.taskDisplay = (task, onChange) => {
        const content = document.createElement('span'); content.className = 'task-content';
        const title = document.createElement('span'); title.className = 'todo-item-title'; title.textContent = task.title;
        const heading = document.createElement('span'); heading.className = 'task-title-row';
        content.appendChild(heading);
        const meta = document.createElement('span'); meta.className = 'task-meta';
        const flags = { red: 'Ưu tiên cao', orange: 'Ưu tiên trung bình', blue: 'Ưu tiên thấp' };
        if (flags[task.flag]) {
            const flag = document.createElement('span'); flag.className = 'task-flag task-flag-' + task.flag;
            flag.textContent = '🚩';
            flag.setAttribute('role', 'img'); flag.setAttribute('aria-label', flags[task.flag]); flag.title = flags[task.flag];
            heading.appendChild(flag);
        }
        heading.appendChild(title);
        if (task.mindmapSource?.mapId && task.mindmapSource.nodeId != null) {
            const link = document.createElement('a'); link.className = 'task-source-link';
            link.href = 'mindmap.html?mapId=' + encodeURIComponent(task.mindmapSource.mapId) + '&nodeId=' + encodeURIComponent(task.mindmapSource.nodeId);
            link.textContent = localStorage.getItem('visualmind-language') === 'en' ? 'Source branch ↗' : 'Nhánh nguồn ↗';
            link.onclick = event => event.stopPropagation(); meta.appendChild(link);
        }
        const shortDate = value => {
            if (!value) return '';
            const [year, month, day] = value.split('-');
            return month + '/' + day + (year === String(new Date().getFullYear()) ? '' : '/' + year);
        };
        const start = task.fromDate || task.start || task.dates?.[0] || '';
        const end = task.toDate || '';
        const startTime = task.fromTime || '';
        const endTime = task.endToTime || task.endFromTime || task.toTime || '';
        let schedule = [shortDate(start), startTime].filter(Boolean).join(' ');
        if (end || endTime) {
            const finish = [end !== start ? shortDate(end) : '', endTime].filter(Boolean).join(' ');
            if (finish) schedule += (schedule ? (startTime || (end && end !== start) ? '–' : ' · ') : '') + finish;
        }
        if (!task.fromDate && task.dates?.length > 1) schedule += ' +' + (task.dates.length - 1);
        if (schedule) {
            const date = document.createElement('span'); date.className = 'task-meta-date'; date.textContent = schedule;
            date.title = [start, startTime, (end || endTime) ? '→' : '', end, endTime].filter(Boolean).join(' ');
            meta.appendChild(date);
        }
        const wheel=window.WheelModel?.load();
        const linkedGoal=[...(wheel?.goals||[]),...(wheel?.archivedGoals||[])].find(goal=>goal.id===task.wheelGoalId);
        const linkedCategory=[...(wheel?.categories||[]),...(wheel?.archivedCategories||[])].find(category=>category.id===(task.wheelCategoryId||linkedGoal?.categoryId));
        const categoryName=linkedCategory?window.WheelModel.categoryName(linkedCategory):task.category;
        if (categoryName) {
            const category = document.createElement('span'); category.className = 'task-meta-category'; category.title = categoryName;
            const background=linkedCategory?window.WheelModel.categoryColor(linkedCategory):(/^#[0-9a-f]{6}$/i.test(task.categoryColor || '')?task.categoryColor:'#d3edbd');
            category.style.setProperty('--category-color',background);if(window.WheelModel)category.style.color=window.WheelModel.textColor(background);
            const name = document.createElement('span'); name.textContent = categoryName; name.dataset.userContent='';category.appendChild(name);
            if (onChange) {
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '🗑'; remove.setAttribute('aria-label', 'Gỡ danh mục');
                remove.onclick = event => { event.stopPropagation(); task.category = '';task.wheelCategoryId='';task.wheelGoalId='';task.wheelWeight=0; onChange(); };
                category.appendChild(remove);
            }
            heading.appendChild(category);
        }
        if (meta.children.length) content.appendChild(meta);
        return content;
    };
    const setupPickers = form => {
        let active = null;
        const pad = value => String(value).padStart(2, '0');
        const close = (focus = false) => {
            if (!active) return;
            const { input, panel } = active;
            panel.remove(); input.setAttribute('aria-expanded', 'false'); active = null;
            if (focus) input.focus();
        };
        const button = (text, label, action) => {
            const node = document.createElement('button'); node.type = 'button';
            node.textContent = text; node.setAttribute('aria-label', label); node.onclick = action;
            return node;
        };
        for (const name of ['fromTime', 'endToTime', 'fromDate', 'toDate']) {
            const input = form.elements[name];
            input.readOnly = true;
            input.setAttribute('aria-haspopup', 'dialog'); input.setAttribute('aria-expanded', 'false');
            const open = () => {
                if (active?.input === input) { close(); return; }
                close();
                const panel = document.createElement('div'); panel.className = 'task-picker';
                panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', name.includes('Time') ? 'Chọn giờ 24h' : 'Chọn ngày');
                input.closest('fieldset').appendChild(panel);
                active = { input, panel }; input.setAttribute('aria-expanded', 'true');
                if (name.includes('Time')) {
                    let [hour, minute] = (input.value || '00:00').split(':').map(Number);
                    panel.innerHTML = '<div class="digital-clock"><div data-hours></div><span>:</span><div data-minutes></div></div>';
                    const commit = () => { input.value = pad(hour) + ':' + pad(minute); };
                    for (const [part, limit, label] of [['hours', 24, 'Giờ'], ['minutes', 60, 'Phút']]) {
                        const column = panel.querySelector('[data-' + part + ']');
                        const select = document.createElement('select'); select.setAttribute('aria-label', label);
                        for (let value = 0; value < limit; value++) {
                            const option = document.createElement('option'); option.value = String(value); option.textContent = pad(value); select.appendChild(option);
                        }
                        select.value = String(part === 'hours' ? hour : minute);
                        select.onchange = () => { if (part === 'hours') hour = Number(select.value); else minute = Number(select.value); commit(); };
                        const adjust = delta => { select.value = String((Number(select.value) + delta + limit) % limit); select.onchange(); };
                        column.append(button('▴', 'Tăng ' + label.toLowerCase(), () => adjust(1)), select, button('▼', 'Giảm ' + label.toLowerCase(), () => adjust(-1)));
                    }
                    panel.appendChild(button('Xong', 'Xác nhận giờ', () => { commit(); close(true); }));
                } else {
                    const parts = input.value.split('/').map(Number);
                    let month = input.value ? new Date(parts[2], parts[0] - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                    const draw = () => {
                        panel.replaceChildren();
                        const nav = document.createElement('div'); nav.className = 'task-picker-month';
                        const title = document.createElement('span'); title.textContent = month.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
                        const shift = delta => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1); draw(); panel.querySelector(delta < 0 ? '[aria-label="Tháng trước"]' : '[aria-label="Tháng sau"]').focus(); };
                        nav.append(button('‹', 'Tháng trước', () => shift(-1)), title, button('›', 'Tháng sau', () => shift(1)));
                        const grid = document.createElement('div'); grid.className = 'task-picker-calendar';
                        ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].forEach(day => { const label = document.createElement('span'); label.textContent = day; grid.appendChild(label); });
                        for (let blank = 0; blank < (month.getDay() + 6) % 7; blank++) grid.appendChild(document.createElement('span'));
                        const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                        for (let day = 1; day <= count; day++) {
                            const value = pad(month.getMonth() + 1) + '/' + pad(day) + '/' + month.getFullYear();
                            const dayButton = button(String(day), value, () => { input.value = value; close(true); });
                            dayButton.setAttribute('aria-pressed', String(value === input.value)); grid.appendChild(dayButton);
                        }
                        panel.append(nav, grid, button('Hôm nay', 'Chọn hôm nay', () => { const date = new Date(); input.value = pad(date.getMonth() + 1) + '/' + pad(date.getDate()) + '/' + date.getFullYear(); close(true); }));
                        panel.appendChild(button('Xóa', 'Xóa giá trị', () => { input.value = ''; close(true); }));
                    };
                    draw();
                }
                panel.appendChild(button('Xóa', 'Xóa giá trị', () => { input.value = ''; close(true); }));
                panel.querySelector('select, button').focus();
            };
            input.onclick = open;
            input.onkeydown = event => { if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); open(); } };
        }
        form.addEventListener('click', event => { if (active && event.target !== active.input && !active.panel.contains(event.target)) close(); }, true);
        form.addEventListener('keydown', event => { if (event.key === 'Escape' && active) { event.stopPropagation(); close(true); } });
    };
    window.showTaskTrash = () => {
        const overlay = document.createElement('div');
        overlay.className = 'library-dialog-overlay';
        overlay.innerHTML = `<section class="library-dialog task-editor trash-dialog" role="dialog" aria-modal="true" aria-label="Thùng rác"><header class="trash-heading"><span class="trash-heading-icon">${window.taskTrashIcon}</span><div><h3>Thùng rác</h3><p>Khôi phục công việc khi bạn cần.</p></div><button type="button" class="trash-close" data-close aria-label="Đóng thùng rác">🗑</button></header><div class="trash-list" data-trash-list></div></section>`;
        const previous = document.activeElement;
        const close = () => { overlay.remove(); previous?.focus(); };
        const render = () => {
            const list = overlay.querySelector('[data-trash-list]'); list.replaceChildren();
            const tasks = JSON.parse(localStorage.getItem('visualmind-eisenhower-tasks') || '[]');
            const planner = JSON.parse(localStorage.getItem('visualmind-weekly-planner') || '{"items":[],"recurring":[]}');
            [...tasks, ...planner.items, ...planner.recurring].filter(task => task.trashedAt).forEach(task => {
                const row = document.createElement('article'); row.className = 'trash-row';
                const title = document.createElement('div'); title.className = 'trash-row-content';
                title.appendChild(window.taskDisplay(task));
                const removed = document.createElement('small'); removed.className = 'trash-removed-date';
                removed.textContent = 'Đã xóa · ' + new Date(task.trashedAt).toLocaleDateString('vi-VN'); title.appendChild(removed);
                const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'trash-restore'; restore.textContent = '↶ Khôi phục'; restore.setAttribute('aria-label', 'Khôi phục ' + task.title);
                restore.onclick = () => {
                    delete task.trashedAt;
                    localStorage.setItem('visualmind-eisenhower-tasks', JSON.stringify(tasks));
                    localStorage.setItem('visualmind-weekly-planner', JSON.stringify(planner));
                    document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
                    document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));
                    render(); overlay.querySelector('[data-close]').focus();
                };
                const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'trash-delete';
                const translate = key => window.DashboardUI?.t(key) || window.I18n?.t(key) || key;
                remove.textContent = translate('Xóa vĩnh viễn');
                remove.setAttribute('aria-label', translate('Xóa vĩnh viễn') + ': ' + task.title);
                remove.onclick = () => {
                    if (!window.confirm(translate('confirmPermanentDelete') + '\n\n' + task.title)) return;
                    const currentTasks = JSON.parse(localStorage.getItem('visualmind-eisenhower-tasks') || '[]');
                    const currentPlanner = JSON.parse(localStorage.getItem('visualmind-weekly-planner') || '{}');
                    const keep = item => !(item.id === task.id && item.trashedAt);
                    localStorage.setItem('visualmind-eisenhower-tasks', JSON.stringify(currentTasks.filter(keep)));
                    currentPlanner.items = (currentPlanner.items || []).filter(keep);
                    currentPlanner.recurring = (currentPlanner.recurring || []).filter(keep);
                    localStorage.setItem('visualmind-weekly-planner', JSON.stringify(currentPlanner));
                    document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
                    document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));
                    render(); overlay.querySelector('[data-close]').focus();
                };
                row.append(title, restore, remove); list.appendChild(row);
            });
            if (!list.children.length) list.innerHTML = '<div class="trash-empty"><span>' + window.taskTrashIcon + '</span><h4>Thùng rác trống</h4><p>Công việc đã xóa sẽ xuất hiện ở đây.</p></div>';
        };
        overlay.querySelector('[data-close]').onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        overlay.onkeydown = event => {
            if (event.key === 'Escape') close();
            if (event.key === 'Tab') {
                const buttons = [...overlay.querySelectorAll('button')];
                if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
            }
        };
        render(); document.body.appendChild(overlay); overlay.querySelector('[data-close]').focus();
    };
    window.editDashboardTask = (task, save) => {
        const overlay = document.createElement('div');
        overlay.className = 'library-dialog-overlay';
        overlay.innerHTML = `<form class="library-dialog planner-dialog task-editor" role="dialog" aria-modal="true" aria-label="Sửa công việc">
            <h3 data-dashboard-i18n="editTask">Sửa công việc</h3>
            <label><span data-dashboard-i18n="taskName">Tên công việc</span><input name="title" maxlength="160" required></label>
            <label><span data-dashboard-i18n="priority">Mức ưu tiên</span><select name="flag"><option value="">⚐ Không gắn cờ</option><option value="red">🚩 Cao</option><option value="orange">⚑ Trung bình</option><option value="blue">⚑ Thấp</option></select></label>
            <label>Loại<select name="kind"><option value="task" data-dashboard-i18n="task">Công việc</option><option value="goal" data-dashboard-i18n="goal">Mục tiêu</option></select></label>
            <label data-dashboard-i18n="categories">Danh mục</label><div class="category-editor"><div class="category-pill-input"><input name="category" maxlength="80" placeholder="Chọn hoặc nhập danh mục mới" aria-label="Danh mục"><button type="button" data-category-menu aria-label="Chọn danh mục" aria-expanded="false">▼</button><button type="button" data-clear-category aria-label="Gỡ danh mục">🗑</button></div><input type="color" name="categoryColor" value="#d3edbd" aria-label="Màu danh mục"><button type="button" data-new-category>+ Thêm mới</button></div><div class="category-options" hidden></div>
            <fieldset><legend>Bắt đầu</legend><div class="task-time-fields"><label>Giờ<input type="text" name="fromTime" placeholder="hh:mm"></label><label>Ngày<input type="text" name="fromDate" placeholder="mm/dd/yyyy" maxlength="10" inputmode="numeric" aria-label="Ngày bắt đầu, mm/dd/yyyy"></label></div></fieldset>
            <fieldset><legend>Kết thúc</legend><div class="task-time-fields"><label>Giờ<input type="text" name="endToTime" placeholder="hh:mm"></label><label>Ngày<input type="text" name="toDate" placeholder="mm/dd/yyyy" maxlength="10" inputmode="numeric" aria-label="Ngày kết thúc, mm/dd/yyyy"></label></div></fieldset>
            <p class="task-editor-error" role="alert"></p>
            <div class="library-dialog-actions"><button type="button" data-trash>Chuyển vào thùng rác</button><button type="button" data-cancel>Hủy</button><button type="submit" class="is-primary">Lưu</button></div>
        </form>`;
        const form = overlay.querySelector('form');
        const fields = ['title', 'flag', 'kind', 'category', 'categoryColor', 'fromTime', 'fromDate', 'endToTime', 'toDate'];
        fields.forEach(name => { form.elements[name].value = task[name] || ''; });
        form.elements.categoryColor.value = task.categoryColor || '#d3edbd';
        form.elements.kind.value = task.kind === 'goal' ? 'goal' : 'task';
        const flagColors = { red: '#d94b4b', orange: '#c17c25', blue: '#487fc7' };
        const previewFlag = () => { form.elements.flag.style.color = flagColors[form.elements.flag.value] || ''; };
        [...form.elements.flag.options].forEach(option => { option.style.color = flagColors[option.value] || ''; });
        form.elements.flag.onchange = previewFlag; previewFlag();
        form.elements.fromTime.setAttribute('aria-label', 'Giờ bắt đầu (không bắt buộc)');
        form.elements.fromDate.value ||= task.start || task.dates?.[0] || '';
        form.elements.endToTime.value ||= task.endFromTime || task.toTime || '';
        for (const name of ['fromDate', 'toDate']) {
            const parts = form.elements[name].value.split('-');
            if (parts.length === 3) form.elements[name].value = parts[1] + '/' + parts[2] + '/' + parts[0];
        }
        const categories = new Set(['Công việc', 'Học tập', 'Cá nhân', 'Sức khỏe', 'Gia đình', 'Tài chính', 'Dự án', 'Khác']);
        try {
            const tasks = JSON.parse(localStorage.getItem('visualmind-eisenhower-tasks')) || [];
            const planner = JSON.parse(localStorage.getItem('visualmind-weekly-planner')) || {};
            [...tasks, ...(planner.items || []), ...(planner.recurring || [])].forEach(item => { if (item.category) categories.add(item.category); });
        } catch { /* Default categories remain available. */ }
        const options = form.querySelector('.category-options');
        const palette = ['#f8d5d0', '#d9e5fa', '#eadcf4', '#d6eddc', '#fbe5c7', '#f7edbf', '#d2eceb', '#e5e3e0'];
        let colors = {};
        try { colors = JSON.parse(localStorage.getItem('visualmind-category-colors')) || {}; } catch {}
        Object.keys(colors).forEach(value => categories.add(value));
        [...categories].forEach((value, index) => { colors[value] ||= palette[index % palette.length]; });
        if (task.category) colors[task.category] = task.categoryColor || colors[task.category];
        const newCategory = form.querySelector('[data-new-category]');
        const separator = document.createElement('hr');
        form.elements.category.readOnly = true;
        const preview = () => form.querySelector('.category-pill-input').style.setProperty('--category-color', form.elements.categoryColor.value);
        preview(); form.elements.categoryColor.oninput = () => { preview(); const value = form.elements.category.value; if (value) { colors[value] = form.elements.categoryColor.value; [...options.querySelectorAll('[data-category]')].find(node => node.dataset.category === value)?.style.setProperty('background', colors[value]); } };
        const hideOptions = () => { options.hidden = true; form.querySelector('[data-category-menu]').setAttribute('aria-expanded', 'false'); };
        categories.forEach(value => { const option = document.createElement('button'); option.type = 'button'; option.textContent = value; option.dataset.category = value; option.style.background = colors[value]; option.onclick = () => { form.elements.category.value = value; form.elements.category.readOnly = true; form.elements.categoryColor.value = colors[value]; preview(); hideOptions(); }; options.appendChild(option); });
        options.append(separator, newCategory);
        form.elements.category.onclick = () => { if (form.elements.category.readOnly) form.querySelector('[data-category-menu]').click(); };
        form.querySelector('[data-category-menu]').onclick = () => { options.hidden = !options.hidden; form.querySelector('[data-category-menu]').setAttribute('aria-expanded', String(!options.hidden)); };
        form.querySelector('[data-clear-category]').onclick = () => { form.elements.category.value = ''; hideOptions(); };
        form.querySelector('[data-new-category]').onclick = () => { hideOptions(); form.elements.category.readOnly = false; form.elements.category.value = ''; form.elements.categoryColor.value = palette[categories.size % palette.length]; preview(); form.elements.category.focus(); };
        const previous = document.activeElement;
        const close = () => { overlay.remove(); if (previous?.isConnected) previous.focus(); };
        form.querySelector('[data-cancel]').onclick = close;
        form.querySelector('[data-trash]').onclick = () => { task.trashedAt = new Date().toISOString(); save(); close(); };
        form.onsubmit = event => {
            event.preventDefault();
            const values = Object.fromEntries(fields.map(name => [name, form.elements[name].value.trim()]));
            const error = form.querySelector('[role="alert"]');
            if (!values.title) { error.textContent = 'Vui lòng nhập tên công việc.'; return; }
            for (const name of ['fromDate', 'toDate']) {
                if (!values[name]) continue;
                const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(values[name]);
                const date = match && new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
                if (!match || date.getFullYear() !== Number(match[3]) || date.getMonth() + 1 !== Number(match[1]) || date.getDate() !== Number(match[2])) {
                    error.textContent = 'Nhập ngày hợp lệ theo định dạng mm/dd/yyyy.'; return;
                }
                values[name] = match[3] + '-' + match[1] + '-' + match[2];
            }
            if ((values.toDate && (!values.fromDate || values.toDate < values.fromDate)) ||
                (values.fromTime && !values.fromDate) || (values.endToTime && !values.toDate) ||
                (values.fromDate && values.fromDate === values.toDate && values.fromTime && values.endToTime && values.endToTime < values.fromTime)) {
                error.textContent = 'Vui lòng chọn ngày cho giờ đã nhập và đặt thời gian kết thúc sau thời gian bắt đầu.'; return;
            }
            delete task.toTime;
            delete task.endFromTime;
            Object.assign(task, values);
            if (values.category) colors[values.category] = values.categoryColor;
            localStorage.setItem('visualmind-category-colors', JSON.stringify(colors));
            if (Object.hasOwn(task, 'durationMinutes') && window.CalendarModel) {
                const model = window.CalendarModel;
                task.durationMinutes = values.fromTime && values.endToTime
                    ? model.daysBetween(values.fromDate, values.toDate) * 1440 + model.minutes(values.endToTime) - model.minutes(values.fromTime)
                    : 0;
            }
            if (task.repeat && values.fromDate) task.start = values.fromDate;
            if (task.dates && values.fromDate) task.dates = [...new Set([values.fromDate, ...task.dates.slice(1)])].sort();
            save(); close();
        };
        overlay.onclick = event => { if (event.target === overlay) close(); };
        overlay.onkeydown = event => {
            if (event.key === 'Escape') close();
            if (event.key === 'Tab') {
                const controls = [...form.querySelectorAll('input, select, button')].filter(control => control.getClientRects().length);
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        };
        document.body.appendChild(overlay);
        window.translateDashboard(overlay);
        setupPickers(form);
        form.elements.title.focus();
    };
})();
