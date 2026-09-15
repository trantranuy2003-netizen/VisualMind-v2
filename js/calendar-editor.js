(() => {
    const t = (vi, en) => window.I18n.pair(vi, en);
    window.setupCalendarEditor = (getState, save) => {
        const M = window.CalendarModel;
        const newId = () => 'plan-' + crypto.randomUUID();
        const dialog = (title, body, submit) => {
            const previous = document.activeElement;
            const overlay = document.createElement('div'); overlay.className = 'library-dialog-overlay';
            overlay.innerHTML = `<form class="library-dialog planner-dialog calendar-editor" role="dialog" aria-modal="true"><h3></h3>${body}<p class="task-editor-error" role="alert"></p><div class="library-dialog-actions"><button type="button" data-cancel>${t('Hủy', 'Cancel')}</button><button type="submit" class="is-primary">${t('Lưu', 'Save')}</button></div></form>`;
            const form = overlay.querySelector('form'); form.querySelector('h3').textContent = title; form.setAttribute('aria-label', title);
            const close = () => { overlay.remove(); if (previous?.isConnected) previous.focus(); };
            form.querySelector('[data-cancel]').onclick = close;
            form.onsubmit = event => { event.preventDefault(); submit(form, close); };
            overlay.onclick = event => { if (event.target === overlay) close(); };
            overlay.onkeydown = event => {
                if (event.key === 'Escape') close();
                if (event.key === 'Tab') {
                    const fields = [...form.querySelectorAll('input,select,button')].filter(node => !node.disabled && node.getClientRects().length);
                    if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1).focus(); }
                    else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0].focus(); }
                }
            };
            document.body.appendChild(overlay); form.querySelector('input,select,button').focus();
            return form;
        };
        const scope = (item, callback) => {
            if (!item.repeat) { callback('one'); return; }
            dialog(t('Áp dụng thay đổi', 'Apply changes'), `<label>${t('Phạm vi', 'Scope')}<select name="scope"><option value="one">${t('Chỉ lần này', 'This occurrence')}</option><option value="all">${t('Toàn bộ chuỗi', 'Entire series')}</option></select></label>`, (form, close) => { const value = form.elements.scope.value; close(); callback(value); });
        };
        const apply = (item, origin, patch, mode) => {
            const state = getState();
            item = [...state.items, ...state.recurring].find(record => record.id === item.id);
            if (!item) return;
            const wasRecurring = Boolean(item.repeat);
            if (item.repeat && mode === 'one') {
                item.excludedDates = [...new Set([...(item.excludedDates || []), origin])];
                const copy = { ...item, ...patch, id: newId(), seriesId: item.id, originalDate: origin, dates: [patch.fromDate || origin], completedDates: item.completedDates?.includes(origin) ? [patch.fromDate || origin] : [] };
                copy.parentId = null; copy.week = M.addDays(copy.fromDate, -((M.day(copy.fromDate).getDay() + 6) % 7));
                for (const field of ['repeat', 'repeatInterval', 'repeatDays', 'repeatUntil', 'repeatAnchor', 'start', 'excludedDates', 'extraDates']) delete copy[field];
                state.items.push(copy);
            } else {
                const oldStart = item.start || item.fromDate || (item.scheduleVersion===2?'':origin);
                const targetDate = patch.fromDate || origin;
                if (item.repeat && patch.repeat !== '') {
                    const delta = M.daysBetween(origin, targetDate);
                    patch.start = oldStart ? M.addDays(oldStart, delta) : ''; patch.fromDate = patch.start;
                    if(item.repeatAnchor)patch.repeatAnchor=M.addDays(item.repeatAnchor,delta);
                    if (delta) {
                        if(item.matrixDate)item.matrixDate=M.addDays(item.matrixDate,delta);
                        for (const field of ['excludedDates', 'extraDates', 'completedDates']) if (item[field]) item[field] = item[field].map(date => M.addDays(date, delta));
                        if (item.repeatUntil && !Object.hasOwn(patch, 'repeatUntil')) patch.repeatUntil = M.addDays(item.repeatUntil, delta);
                        if (!patch.repeatDays && item.repeatDays) patch.repeatDays = item.repeatDays.map(day => (day + delta % 7 + 7) % 7);
                    }
                    // Detached edits keep their own dates and details when the series changes.
                    if(item.scheduleVersion===2)patch.toDate='';
                    else if (patch.toDate) patch.toDate = M.addDays(patch.start, Math.floor(((M.minutes(patch.fromTime) || 0) + (patch.durationMinutes || 0)) / 1440));
                } else {
                    patch.dates = [...new Set([...(item.dates || []).filter(date => date !== origin), targetDate])];
                    patch.week = M.addDays(targetDate, -((M.day(targetDate).getDay() + 6) % 7));
                    if (item.completedDates?.includes(origin)) item.completedDates = [...item.completedDates.filter(date => date !== origin), targetDate];
                    item.excludedDates = (item.excludedDates || []).filter(date => date !== targetDate);
                }
                Object.assign(item, patch);
                if (Boolean(item.repeat) !== wasRecurring) {
                    const from = wasRecurring ? state.recurring : state.items;
                    const to = wasRecurring ? state.items : state.recurring;
                    from.splice(from.indexOf(item), 1); to.push(item);
                    if (item.repeat) item.start = item.fromDate;
                    else { delete item.start; item.dates = [item.fromDate]; item.parentId = null; }
                }
            }
            save();
        };
        const timing = (date, start, length) => ({ fromDate: date, fromTime: M.time(start), toDate: M.addDays(date, Math.floor((start + length) / 1440)), endToTime: M.time(start + length), durationMinutes: length });
        const changeTime = (item, origin, date, start, length) => scope(item, mode => apply(item, origin, timing(date, start, length), mode));
        const edit = (item = null, origin, start = 540, length = 60, recurring = false) => {
            const open = mode => {
                const source = item || {};
                const initialStart = item ? M.occurrenceStart(item) : start;
                const initialLength = item ? M.duration(item) || 60 : length;
                const form = dialog(item ? t('Sửa lịch', 'Edit schedule') : t('Thêm công việc', 'Add task'), `
                    <label>${t('Tên công việc', 'Task name')}<input name="title" maxlength="160" required></label>
                    <label class="calendar-inline-check"><input type="checkbox" name="allDay">${t('Cả ngày', 'All day')}</label>
                    <div class="calendar-editor-dates"><label>${t('Ngày bắt đầu', 'Start date')}<input type="date" name="fromDate" required></label><label>${t('Giờ bắt đầu', 'Start time')}<input type="time" name="fromTime" step="60"></label><label>${t('Ngày kết thúc', 'End date')}<input type="date" name="toDate" required></label><label>${t('Giờ kết thúc', 'End time')}<input type="time" name="endToTime" step="60"></label></div>
                    <fieldset data-repeat-fields><legend>${t('Lặp lại', 'Repeat')}</legend><label>${t('Chu kỳ', 'Frequency')}<select name="repeat"><option value="">${t('Không lặp', 'Does not repeat')}</option><option value="daily">${t('Ngày', 'Daily')}</option><option value="weekdays">${t('Thứ 2–Thứ 6', 'Weekdays')}</option><option value="weekly">${t('Tuần', 'Weekly')}</option><option value="monthly">${t('Tháng', 'Monthly')}</option></select></label><label>${t('Mỗi … chu kỳ', 'Every … intervals')}<input type="number" name="repeatInterval" min="1" max="365" value="1"></label><div class="calendar-repeat-days">${[1,2,3,4,5,6,0].map((day, i) => `<label><input type="checkbox" name="repeatDay" value="${day}">${t(['T2','T3','T4','T5','T6','T7','CN'][i], ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i])}</label>`).join('')}</div><label>${t('Lặp đến ngày (không bắt buộc)', 'Repeat until (optional)')}<input type="date" name="repeatUntil"></label></fieldset>`, (form, close) => {
                    const f = form.elements, from = f.fromDate.value, to = f.toDate.value;
                    const first = f.allDay.checked ? null : M.minutes(f.fromTime.value), last = f.allDay.checked ? null : M.minutes(f.endToTime.value);
                    const duration = first === null ? 0 : M.daysBetween(from, to) * 1440 + last - first;
                    const error = form.querySelector('[role="alert"]');
                    if (!f.title.value.trim()) { error.textContent = t('Vui lòng nhập tên công việc.', 'Enter a task name.'); return; }
                    if (to < from || (!f.allDay.checked && (first === null || last === null || duration <= 0))) { error.textContent = t('Thời gian kết thúc phải sau bắt đầu. Với việc qua đêm, chọn ngày kết thúc là ngày hôm sau.', 'End must follow start. For overnight events, choose the next end date.'); return; }
                    if (f.repeatUntil.value && f.repeatUntil.value < from) { error.textContent = t('Ngày kết thúc lặp phải từ ngày bắt đầu trở đi.', 'Repeat end must be on or after start.'); return; }
                    const patch = { title: f.title.value.trim(), fromDate: from, toDate: to, fromTime: first === null ? '' : M.time(first), endToTime: last === null ? '' : M.time(last), durationMinutes: duration };
                    if(item?.scheduleVersion===2&&!f.allDay.checked){
                        if(!item.fromTime&&f.fromTime.value===M.time(initialStart||0))patch.fromTime='';
                        if(!item.endToTime&&f.endToTime.value===M.time((initialStart||0)+initialLength))patch.endToTime='';
                    }
                    const repeat = item?.repeat && mode === 'one' ? '' : f.repeat.value;
                    if (repeat) Object.assign(patch, { repeat, repeatInterval: Number(f.repeatInterval.value) || 1, repeatDays: [...form.querySelectorAll('[name="repeatDay"]:checked')].map(node => Number(node.value)), repeatUntil: f.repeatUntil.value });
                    else if (!(item?.repeat && mode === 'one')) Object.assign(patch, { repeat: '', repeatInterval: 1, repeatDays: [], repeatUntil: '' });
                    if (!item) {
                        const record = { id: newId(), kind: 'task', ...patch, dates: [from], week: M.addDays(from, -((M.day(from).getDay() + 6) % 7)), parentId: null, completedDates: [] };
                        if (repeat) { record.start = from; getState().recurring.push(record); }
                        else getState().items.push(record);
                        close(); save();
                    } else {
                        close(); apply(item, origin, patch, mode);
                    }
                });
                const f = form.elements;
                f.title.value = source.title || ''; f.fromDate.value = origin;
                f.toDate.value = initialStart === null ? origin : M.addDays(origin, Math.floor((initialStart + initialLength) / 1440));
                f.fromTime.value = M.time(initialStart || 0); f.endToTime.value = M.time((initialStart || 0) + initialLength);
                f.allDay.checked = initialStart === null;
                f.repeat.value = source.repeat || (recurring ? 'weekly' : ''); f.repeatInterval.value = source.repeatInterval || 1;
                f.repeatUntil.value = source.repeatUntil || (source.repeat && !Object.hasOwn(source, 'durationMinutes') ? source.toDate : '') || '';
                const selected = source.repeatDays || [M.day(origin).getDay()];
                form.querySelectorAll('[name="repeatDay"]').forEach(node => { node.checked = selected.includes(Number(node.value)); });
                const update = () => {
                    f.fromTime.disabled = f.endToTime.disabled = f.allDay.checked;
                    form.querySelector('.calendar-repeat-days').hidden = f.repeat.value !== 'weekly';
                    f.repeatInterval.disabled = f.repeatUntil.disabled = !f.repeat.value;
                };
                f.repeat.onchange = update; f.allDay.onchange = update;
                if (item) {
                    if (item.repeat && mode === 'one') form.querySelector('[data-repeat-fields]').hidden = true;
                }
                update();
            };
            if (item) scope(item, open); else open('one');
        };
        return { edit, changeTime };
    };
})();
