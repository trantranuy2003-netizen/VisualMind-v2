(() => {
    const KEY = 'visualmind-radar', TASKS = 'visualmind-eisenhower-tasks', PLANNER = 'visualmind-weekly-planner';
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
    const defaults = ['Công việc', 'Học tập', 'Cá nhân', 'Sức khỏe', 'Gia đình', 'Tài chính', 'Dự án', 'Khác'];
    const palette = ['#f8d5d0', '#d9e5fa', '#eadcf4', '#d6eddc', '#fbe5c7', '#f7edbf', '#d2eceb', '#e5e3e0'];
    const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const shiftMonth = (month, delta) => monthKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + delta, 1));
    const days = month => Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
    const records = () => {
        const planner = read(PLANNER, { items: [], recurring: [] });
        return [...read(TASKS, []).map(item => ({ item, ref: 'task:' + item.id })), ...[...(planner.items || []), ...(planner.recurring || [])].map(item => ({ item, ref: 'plan:' + item.id }))];
    };
    const completed = (goal, month, entries = records()) => {
        if (goal.mode !== 'tasks') return Math.max(0, Number(goal.actual) || 0);
        return entries.filter(({ ref, item }) => goal.links?.includes(ref) && !item.trashedAt && item.kind !== 'goal').reduce((sum, { item }) => {
            if (item.repeat) return sum + days(month).filter(date => window.CalendarModel.occurs(item, date) && item.completedDates?.includes(date)).length;
            const dates = [...new Set([item.fromDate, ...(item.dates || []), ...(item.extraDates || [])].filter(Boolean))];
            const inMonth = dates.filter(date => date.startsWith(month) && !item.excludedDates?.includes(date));
            if (dates.length && !inMonth.length) return sum;
            return sum + Number(Boolean(item.completed || (item.completedDates || []).some(date => date.startsWith(month) && !item.excludedDates?.includes(date))));
        }, 0);
    };
    const score = (plan, category, month, mode, entries = records()) => {
        if (mode === 'rating') return plan?.ratings?.[category] == null ? null : Number(plan.ratings[category]) * 10;
        if (plan?.closed && Object.hasOwn(plan.closed, category)) return plan.closed[category];
        const goals = (plan?.goals || []).filter(goal => goal.category === category);
        return goals.length ? goals.reduce((sum, goal) => sum + Math.min(100, completed(goal, month, entries) / Math.max(1, Number(goal.target)) * 100), 0) / goals.length : null;
    };
    window.RadarModel = { completed, score, shiftMonth };
    window.setupRadar = dashboard => {
        let month = monthKey(), mode = 'progress', compare = false;
        const data = () => read(KEY, { months: {}, categories: defaults.slice(0, 6) });
        const plan = () => data().months?.[month] || { goals: [], ratings: {} };
        const actualFor = (goal, current = plan()) => current.closedActual?.[goal.id] ?? completed(goal, month);
        const save = mutate => { const state = data(); state.months ||= {}; state.months[month] ||= { goals: [], ratings: {} }; mutate(state.months[month], state); localStorage.setItem(KEY, JSON.stringify(state)); document.dispatchEvent(new CustomEvent('visualmind-dashboard-change')); };
        const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
        const button = (text, action, label = text) => { const node = element('button', 'planner-button', text); node.type = 'button'; if (label) { node.title = label; node.setAttribute('aria-label', label); } node.onclick = action; return node; };
        const categories = () => [...new Set([...defaults, ...Object.keys(read('visualmind-category-colors', {})), ...records().map(({ item }) => item.category).filter(Boolean), ...Object.values(data().months || {}).flatMap(value => (value.goals || []).map(goal => goal.category)), ...(data().categories || [])])];
        const color = category => read('visualmind-category-colors', {})[category] || records().find(({ item }) => item.category === category && item.categoryColor)?.item.categoryColor || palette[categories().indexOf(category) % palette.length];
        const card = element('section', 'todo-panel radar-panel'); card.dataset.radar = ''; dashboard.appendChild(card);
        const dialog = (title, draw) => {
            const previous = document.activeElement, overlay = element('div', 'library-dialog-overlay radar-overlay'), panel = element('section', 'library-dialog radar-dialog');
            panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', title);
            const header = element('header', 'radar-dialog-heading');
            let cleanup;
            const close = () => { cleanup?.(); overlay.remove(); if (previous?.isConnected) previous.focus(); };
            const closeButton = button('🗑', close, 'Đóng'); header.append(element('h3', '', title), closeButton);
            panel.append(header); overlay.append(panel); document.body.appendChild(overlay);
            overlay.onclick = event => { if (event.target === overlay) close(); };
            overlay.onkeydown = event => {
                if (event.key === 'Escape') { event.stopPropagation(); close(); }
                if (event.key === 'Tab') { const nodes = [...panel.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length); if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); } }
            };
            cleanup = draw(panel, close); closeButton.focus(); return panel;
        };
        const field = (form, title, type, value = '') => { const label = element('label', 'radar-field', title), input = element(type === 'select' ? 'select' : 'input'); if (type !== 'select') input.type = type; input.value = value; label.append(input); form.append(label); return input; };
        const notifyTasks = () => { document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored')); document.dispatchEvent(new CustomEvent('visualmind-dashboard-change')); };
        const editGoal = (category, existing, after = () => {}) => dialog(existing ? 'Sửa mục tiêu tháng' : 'Lập kế hoạch tháng', (panel, close) => {
            const form = element('form', 'radar-form'); panel.append(form);
            const categoryInput = field(form, 'Danh mục', 'select'); categories().forEach(name => { const option = element('option', '', name); option.value = name; categoryInput.append(option); }); categoryInput.value = existing?.category || category || categories()[0];
            const title = field(form, 'Mục tiêu', 'text', existing?.title || ''); title.required = true; title.maxLength = 160; title.placeholder = 'Ví dụ: Tập luyện 16 buổi';
            const target = field(form, 'Số lượng mục tiêu', 'number', existing?.target || 1); target.min = '1'; target.max = '1000000'; target.step = '1'; target.required = true;
            const unit = field(form, 'Đơn vị', 'text', existing?.unit || 'buổi'); unit.maxLength = 30;
            const tracking = field(form, 'Cách cập nhật', 'select'); [['manual', 'Nhập số lượng thủ công'], ['tasks', 'Tự động từ task đã hoàn thành']].forEach(([value, text]) => { const option = element('option', '', text); option.value = value; tracking.append(option); }); tracking.value = existing?.mode || 'tasks';
            const actual = field(form, 'Đã thực hiện', 'number', existing?.actual || 0); actual.min = '0'; actual.max = '1000000'; actual.step = 'any';
            const links = element('fieldset', 'radar-link-list'); links.append(element('legend', '', 'Liên kết task')); form.append(links);
            const selected = new Set(existing?.links || []);
            const drawLinks = () => {
                links.querySelectorAll('label,p').forEach(node => node.remove());
                records().filter(({ item }) => !item.trashedAt && item.kind !== 'goal' && item.category === categoryInput.value).forEach(({ item, ref }) => {
                    const label = element('label', 'radar-check'), input = element('input'); input.type = 'checkbox'; input.value = ref; input.checked = selected.has(ref); input.onchange = () => input.checked ? selected.add(ref) : selected.delete(ref); label.append(input, element('span', '', item.title + (item.repeat ? ' ↻' : ''))); links.append(label);
                });
                if (!links.querySelector('label')) links.append(element('p', 'radar-muted', 'Chưa có task trong danh mục này. Lưu mục tiêu rồi thêm task trong chi tiết.'));
            };
            categoryInput.onchange = () => { selected.clear(); drawLinks(); }; drawLinks();
            const update = () => { links.hidden = tracking.value !== 'tasks'; actual.parentElement.hidden = tracking.value !== 'manual'; }; tracking.onchange = update; update();
            form.append(element('p', 'radar-muted', 'Task thường tính một lần; mỗi lần lặp hoàn thành trong tháng tính một lần. Mục tiêu (goal) không được đếm như task.'));
            const submit = button('Lưu mục tiêu', () => {}); submit.type = 'submit'; submit.classList.add('is-primary'); form.append(submit);
            form.onsubmit = event => { event.preventDefault(); if (!title.value.trim()) return;
                save(current => { if (current.closed) return; const goal = { id: existing?.id || crypto.randomUUID(), title: title.value.trim(), category: categoryInput.value, target: Number(target.value), unit: unit.value.trim(), mode: tracking.value, actual: Number(actual.value), links: [...selected] }; current.goals ||= []; const index = current.goals.findIndex(item => item.id === goal.id); if (index < 0) current.goals.push(goal); else current.goals[index] = goal; }); close(); after();
            };
        });
        const addTask = (goal, after) => dialog('Thêm task cho mục tiêu', (panel, close) => {
            const form = element('form', 'radar-form'); panel.append(form);
            const title = field(form, 'Tên task', 'text'); title.required = true; title.maxLength = 160;
            const date = field(form, 'Ngày thực hiện', 'date', days(month)[0]); date.min = days(month)[0]; date.max = days(month).at(-1); date.required = true;
            const repeat = field(form, 'Lặp lại', 'select'); [['', 'Không lặp'], ['daily', 'Hằng ngày'], ['weekly', 'Hằng tuần vào ngày đã chọn']].forEach(([value, name]) => { const option = element('option', '', name); option.value = value; repeat.append(option); });
            const submit = button('Thêm và liên kết', () => {}); submit.type = 'submit'; form.append(submit);
            form.onsubmit = event => { event.preventDefault(); if (!title.value.trim() || plan().closed) return;
                const planner = read(PLANNER, { items: [], recurring: [] }), id = 'plan-' + crypto.randomUUID();
                const item = { id, title: title.value.trim(), kind: 'task', category: goal.category, categoryColor: color(goal.category), fromDate: date.value, dates: [date.value], completedDates: [], parentId: null, week: window.CalendarModel.addDays(date.value, -((window.CalendarModel.day(date.value).getDay() + 6) % 7)) };
                if (repeat.value) { Object.assign(item, { repeat: repeat.value, start: date.value, repeatUntil: days(month).at(-1) }); planner.recurring.push(item); } else planner.items.push(item);
                localStorage.setItem(PLANNER, JSON.stringify(planner)); save(current => { const found = current.goals.find(item => item.id === goal.id); if (found) { found.mode = 'tasks'; found.links = [...new Set([...(found.links || []), 'plan:' + id])]; } }); notifyTasks(); close(); after();
            };
        });
        const detail = category => dialog(category + ' · ' + month, panel => {
            const body = element('div'); panel.append(body);
            const draw = () => {
                body.replaceChildren(); const current = plan();
                const goals = (current.goals || []).filter(goal => goal.category === category);
                if (!goals.length) body.append(element('p', 'radar-muted', 'Chưa có mục tiêu cho danh mục này.'));
                goals.forEach(goal => {
                    const row = element('article', 'radar-goal'); row.dataset.goalId = goal.id;
                    const actual = actualFor(goal, current); row.append(element('h4', '', goal.title), element('p', '', `${actual} / ${goal.target} ${goal.unit || ''} · ${Math.round(Math.min(100, actual / goal.target * 100))}%`));
                    const progress = element('progress'); progress.max = goal.target; progress.value = actual; progress.setAttribute('aria-label', goal.title); row.append(progress);
                    if (!current.closed) {
                        const actions = element('div', 'radar-actions'); actions.append(button('🖊', () => editGoal(category, goal, draw), 'Sửa mục tiêu'));
                        if (goal.mode === 'tasks') actions.append(button('＋ Task', () => addTask(goal, draw), 'Thêm task cho mục tiêu'));
                        actions.append(button('Bỏ mục tiêu', () => { save(value => { value.goals = value.goals.filter(item => item.id !== goal.id); }); draw(); }, 'Bỏ mục tiêu khỏi kế hoạch; giữ các task')); row.append(actions);
                    }
                    if (goal.mode === 'tasks') {
                        records().filter(({ ref, item }) => goal.links?.includes(ref) && !item.trashedAt).forEach(({ item, ref }) => {
                            const scheduled = [...new Set([item.fromDate, ...(item.dates || []), ...(item.extraDates || [])].filter(Boolean))];
                            const dates = item.repeat ? days(month).filter(date => window.CalendarModel.occurs(item, date)) : [scheduled.find(date => date.startsWith(month) && !item.excludedDates?.includes(date)) || (scheduled.length ? '' : days(month)[0])];
                            dates.filter(date => date.startsWith(month)).forEach(date => {
                                const label = element('label', 'radar-check'), input = element('input'); input.type = 'checkbox'; input.checked = Boolean(item.completed || (item.repeat ? item.completedDates?.includes(date) : item.completedDates?.some(value => value.startsWith(month) && !item.excludedDates?.includes(value)))); input.disabled = Boolean(current.closed);
                                input.onchange = () => {
                                    const tasks = read(TASKS, []), planner = read(PLANNER, { items: [], recurring: [] });
                                    const target = (ref.startsWith('task:') ? tasks : [...planner.items, ...planner.recurring]).find(record => record.id === item.id); if (!target) return;
                                    if (ref.startsWith('task:')) target.completed = input.checked;
                                    else { target.completedDates = (target.completedDates || []).filter(value => item.repeat ? value !== date : !value.startsWith(month)); if (input.checked) target.completedDates.push(date); }
                                    localStorage.setItem(TASKS, JSON.stringify(tasks)); localStorage.setItem(PLANNER, JSON.stringify(planner)); notifyTasks(); draw();
                                };
                                label.append(input, element('span', '', item.title + ' · ' + date.slice(8) + '/' + date.slice(5, 7)));
                                const taskRow = element('div', 'radar-task-row'); taskRow.append(label);
                                if (!current.closed) taskRow.append(button('🖊', () => {
                                    const tasks = read(TASKS, []), planner = read(PLANNER, { items: [], recurring: [] });
                                    const target = (ref.startsWith('task:') ? tasks : [...planner.items, ...planner.recurring]).find(record => record.id === item.id);
                                    if (target) window.editDashboardTask(target, () => { localStorage.setItem(TASKS, JSON.stringify(tasks)); localStorage.setItem(PLANNER, JSON.stringify(planner)); notifyTasks(); draw(); });
                                }, 'Sửa task ' + item.title));
                                row.append(taskRow);
                            });
                        });
                    }
                    body.append(row);
                });
                if (!current.closed) body.append(button('＋ Mục tiêu', () => editGoal(category, null, draw)));
                else body.append(element('p', 'radar-muted', 'Tháng đã chốt. Điểm radar được giữ tại thời điểm chốt.'));
            }; draw();
        });
        const settings = () => dialog('Danh mục trên radar', (panel, close) => {
            const form = element('form', 'radar-form'), list = element('div'); panel.append(form); form.append(element('p', 'radar-muted', 'Chọn 3–8 danh mục. Dùng ↑ ↓ để đổi thứ tự. Danh mục bỏ chọn vẫn giữ kế hoạch.'), list);
            const selected = data().categories || defaults.slice(0, 6), order = [...new Set([...selected, ...categories()])];
            const chosen = new Set(selected);
            const draw = () => { list.replaceChildren(); order.forEach((category, index) => { const row = element('div', 'radar-settings-row'), label = element('label', 'radar-check'), input = element('input'); input.type = 'checkbox'; input.checked = chosen.has(category); input.onchange = () => input.checked ? chosen.add(category) : chosen.delete(category); label.append(input, element('span', '', category)); row.append(label); [-1, 1].forEach(delta => { const move = button(delta < 0 ? '↑' : '↓', () => { [order[index], order[index + delta]] = [order[index + delta], order[index]]; draw(); }, 'Di chuyển ' + category); move.disabled = index + delta < 0 || index + delta >= order.length; row.append(move); }); list.append(row); }); }; draw();
            const error = element('p', 'task-editor-error'); error.setAttribute('role', 'alert'); form.append(error); const submit = button('Lưu', () => {}); submit.type = 'submit'; form.append(submit);
            form.onsubmit = event => { event.preventDefault(); if (chosen.size < 3 || chosen.size > 8) { error.textContent = 'Vui lòng chọn từ 3 đến 8 danh mục.'; return; } save((current, state) => { state.categories = order.filter(category => chosen.has(category)); }); close(); };
        });
        const rate = () => dialog('Tự đánh giá · ' + month, (panel, close) => {
            const form = element('form', 'radar-form'); panel.append(form); const inputs = [];
            (data().categories || defaults.slice(0, 6)).forEach(category => { const input = field(form, category + ' (0–10)', 'number', plan().ratings?.[category] ?? ''); input.min = '0'; input.max = '10'; input.step = '1'; inputs.push([category, input]); });
            const note = element('textarea'); note.placeholder = 'Ghi chú tháng này…'; note.setAttribute('aria-label', 'Ghi chú tự đánh giá'); note.maxLength = 2000; note.value = plan().note || ''; form.append(note);
            const submit = button('Lưu đánh giá', () => {}); submit.type = 'submit'; form.append(submit);
            form.onsubmit = event => { event.preventDefault(); save(current => { if (current.closed) return; current.ratings ||= {}; inputs.forEach(([category, input]) => { if (input.value === '') delete current.ratings[category]; else current.ratings[category] = Number(input.value); }); current.note = note.value; }); close(); };
        });
        const review = () => dialog('Tổng kết · ' + month, (panel, close) => {
            const current = plan(), state = data();
            (state.categories || defaults.slice(0, 6)).forEach(category => { const value = score(current, category, month, 'progress'); panel.append(element('p', '', category + ': ' + (value == null ? 'Chưa có dữ liệu' : Math.round(value) + '%'))); });
            panel.append(element('p', 'radar-muted', 'Chốt tháng giữ nguyên điểm radar. Chọn các mục tiêu còn thiếu để chuyển sang tháng sau; task cũ giữ nguyên lịch.'));
            const selected = new Set();
            (current.goals || []).filter(goal => actualFor(goal, current) < goal.target).forEach(goal => { const label = element('label', 'radar-check'), input = element('input'); input.type = 'checkbox'; input.onchange = () => input.checked ? selected.add(goal.id) : selected.delete(goal.id); label.append(input, element('span', '', goal.title + ' · còn ' + (goal.target - actualFor(goal, current)) + ' ' + goal.unit)); panel.append(label); });
            panel.append(button('Chốt tháng và chuyển phần đã chọn', () => {
                save((value, all) => {
                    value.closed ||= Object.fromEntries(categories().map(category => [category, score(value, category, month, 'progress')]));
                    value.closedActual ||= Object.fromEntries((value.goals || []).map(goal => [goal.id, completed(goal, month)]));
                    const next = shiftMonth(month, 1); all.months[next] ||= { goals: [], ratings: {} };
                    if (all.months[next].closed) return;
                    selected.forEach(id => { const goal = value.goals.find(item => item.id === id); if (!goal || all.months[next].goals.some(item => item.carriedFrom === id)) return; all.months[next].goals.push({ ...goal, id: crypto.randomUUID(), carriedFrom: id, target: Math.max(1, goal.target - actualFor(goal, value)), actual: 0, links: [] }); });
                }); close();
            }));
            if (current.closed) panel.append(button('Mở lại tháng để chỉnh sửa', () => { save(value => { delete value.closed; delete value.closedActual; }); close(); }));
        });
        const chart = container => {
            const state = data(), selected = state.categories || defaults.slice(0, 6), current = plan(), entries = records(), last = shiftMonth(month, -1);
            const values = selected.map(category => score(current, category, month, mode, entries));
            const previous = selected.map(category => score(state.months?.[last], category, last, mode, entries));
            const svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 600 440'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Radar danh mục ' + month); svg.classList.add('radar-chart');
            const make = (tag, attrs) => { const node = document.createElementNS(svgNS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); svg.append(node); return node; };
            const point = (index, radius) => { const angle = -Math.PI / 2 + index * 2 * Math.PI / selected.length; return [300 + Math.cos(angle) * radius, 218 + Math.sin(angle) * radius]; };
            const polygon = numbers => numbers.map((value, index) => point(index, (value || 0) * 1.48).join(',')).join(' ');
            [20, 40, 60, 80, 100].forEach(value => { make('polygon', { points: polygon(selected.map(() => value)), class: 'radar-ring' }); const label = make('text', { x: 306, y: 216 - value * 1.48, class: 'radar-tick' }); label.textContent = mode === 'rating' ? value / 10 : value + '%'; });
            selected.forEach((category, index) => { const [x, y] = point(index, 148); make('line', { x1: 300, y1: 218, x2: x, y2: y, class: 'radar-axis' }); });
            if (compare && previous.some(value => value !== null)) make('polygon', { points: polygon(previous), class: 'radar-previous' });
            if (values.some(value => value !== null)) make('polygon', { points: polygon(values), class: 'radar-area' });
            selected.forEach((category, index) => {
                const [x, y] = point(index, 185), label = make('text', { x, y, 'text-anchor': x < 290 ? 'end' : x > 310 ? 'start' : 'middle', class: 'radar-label', tabindex: '0', role: 'button', 'aria-label': 'Xem ' + category });
                label.textContent = category.length > 22 ? category.slice(0, 21) + '…' : category; label.onclick = () => detail(category); label.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); detail(category); } };
                if (values[index] != null) { const [cx, cy] = point(index, values[index] * 1.48); make('circle', { cx, cy, r: 4, fill: color(category), stroke: '#eb762a', 'stroke-width': 2 }); }
            });
            container.append(svg);
            if (values.every(value => value === null)) container.append(element('p', 'radar-muted', mode === 'rating' ? 'Chưa có đánh giá. Chấm điểm 0–10 cho từng danh mục.' : 'Chưa có kế hoạch tháng này. Thêm mục tiêu để bắt đầu.'));
            const legend = element('p', 'radar-muted', `Cam: ${mode === 'rating' ? 'điểm tự đánh giá' : 'tiến độ'} · Viền ngoài: ${mode === 'rating' ? '10 điểm' : 'mục tiêu 100%'}${compare ? ' · Nét đứt: tháng trước' : ''}`); container.append(legend);
            const list = element('div', 'radar-summary'); selected.forEach((category, index) => { const row = button('', () => detail(category)); const dot = element('span', 'radar-category-dot'); dot.style.background = color(category); row.append(dot, element('span', '', category), element('strong', '', values[index] == null ? 'Chưa có dữ liệu' : mode === 'rating' ? (values[index] / 10).toFixed(1) + '/10' : Math.round(values[index]) + '%')); list.append(row); }); container.append(list);
        };
        const render = () => {
            card.replaceChildren(); const header = element('div', 'dashboard-panel-heading'), title = element('div'); title.append(element('p', 'dashboard-kicker', 'Kế hoạch tháng'), element('h2', '', 'Cân bằng danh mục')); header.append(title);
            const actions = element('div', 'radar-actions');
            actions.append(button('⚙', settings, 'Chọn và sắp xếp danh mục'), button('⛶', () => dialog('Cân bằng danh mục · ' + month, panel => { panel.classList.add('radar-expanded'); const body = element('div'); panel.append(body); const redraw = () => { body.replaceChildren(); chart(body); }; redraw(); document.addEventListener('visualmind-dashboard-change', redraw); return () => document.removeEventListener('visualmind-dashboard-change', redraw); }), 'Mở rộng radar')); header.append(actions); card.append(header);
            const toolbar = element('div', 'radar-actions'); const picker = element('input'); picker.type = 'month'; picker.value = month; picker.setAttribute('aria-label', 'Tháng kế hoạch'); picker.onchange = () => { if (/^\d{4}-\d{2}$/.test(picker.value)) { month = picker.value; render(); } };
            const select = element('select'); select.setAttribute('aria-label', 'Chế độ radar'); [['progress', 'Tiến độ mục tiêu'], ['rating', 'Tự đánh giá']].forEach(([value, text]) => { const option = element('option', '', text); option.value = value; select.append(option); }); select.value = mode; select.onchange = () => { mode = select.value; render(); };
            const comparison = element('label', 'radar-check'), check = element('input'); check.type = 'checkbox'; check.checked = compare; check.onchange = () => { compare = check.checked; render(); }; comparison.append(check, element('span', '', 'So tháng trước'));
            toolbar.append(button('‹', () => { month = shiftMonth(month, -1); render(); }, 'Tháng trước'), picker, button('›', () => { month = shiftMonth(month, 1); render(); }, 'Tháng sau'), select, comparison); card.append(toolbar);
            const body = element('div', 'radar-body'); chart(body); card.append(body);
            const footer = element('div', 'radar-actions'); if (!plan().closed) footer.append(button(mode === 'rating' ? 'Đánh giá tháng này' : '＋ Lập kế hoạch', mode === 'rating' ? rate : () => editGoal())); footer.append(button(plan().closed ? 'Đã chốt · Xem tổng kết' : 'Tổng kết tháng', review)); card.append(footer);
            card.append(element('p', 'radar-muted', 'Mỗi danh mục lấy trung bình tiến độ các mục tiêu, tối đa 100% mỗi mục tiêu. Mục chưa có dữ liệu không có điểm; đường biểu đồ đi qua tâm ở trục đó.'));
        };
        document.addEventListener('visualmind-dashboard-change', render);
        document.addEventListener('visualmind-dashboard-restored', render);
        window.addEventListener('storage', event => { if ([KEY, TASKS, PLANNER, 'visualmind-category-colors', null].includes(event.key)) render(); });
        render();
    };
})();
