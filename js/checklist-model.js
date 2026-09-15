/* Calendar, Checklist and Eisenhower share the planner record IDs. */
(() => {
    const KEY = 'visualmind-weekly-planner', OLD = 'visualmind-eisenhower-tasks';
    const M = window.CalendarModel;
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
    const load = () => { const value = read(KEY, {}); return { ...value, items: value.items || [], recurring: value.recurring || [] }; };
    const all = (state = load()) => [...state.items, ...state.recurring];
    const commit = state => {
        localStorage.setItem(KEY, JSON.stringify(state));
        document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
        document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));
    };
    const migrate = () => {
        const state = load(), legacy = read(OLD, []);
        if (!legacy.length) return false;
        if (!localStorage.getItem('visualmind-tasks-backup-v1')) localStorage.setItem('visualmind-tasks-backup-v1', JSON.stringify(legacy));
        for (const task of legacy) if (!all(state).some(item => item.id === task.id)) {
            const copy = { ...task, kind: 'task', matrixStatus: task.status === 'inbox' ? null : task.status, completedDates: task.completedDates || [] };
            (copy.repeat ? state.recurring : state.items).push(copy);
        }
        localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(OLD, '[]');
        return true;
    };
    const today = () => M.key(new Date());
    const period = (view, anchor = today(), customEnd = anchor) => {
        const date = M.day(anchor); let start = anchor, end = anchor;
        if (view === 'week') { start = M.addDays(anchor, -(date.getDay() + 6) % 7); end = M.addDays(start, 6); }
        if (view === 'month') { start = M.key(new Date(date.getFullYear(), date.getMonth(), 1)); end = M.key(new Date(date.getFullYear(), date.getMonth() + 1, 0)); }
        if (view === 'year') { start = date.getFullYear() + '-01-01'; end = date.getFullYear() + '-12-31'; }
        if (view === 'custom') end = customEnd;
        let previousStart = M.addDays(start, -M.daysBetween(start, end) - 1);
        if (view === 'month') previousStart = M.key(new Date(date.getFullYear(), date.getMonth() - 1, 1));
        if (view === 'year') previousStart = (date.getFullYear() - 1) + '-01-01';
        return { start, end, previousStart, previousEnd: M.addDays(start, -1) };
    };
    const occurrences = (task, start, end) => {
        const result = [];
        for (let date = start; date <= end; date = M.addDays(date, 1)) {
            if (M.segments([task], date).some(entry => entry.origin === date)) result.push(date);
        }
        return result;
    };
    const done = (task, date) => task.repeat || task.fromDate || task.dates?.length ? Boolean(task.completed || task.completedDates?.includes(date)) : Boolean(task.completed);
    const groups = (state, range) => {
        const result = { unscheduled: [], scheduled: [], recurring: [], previous: [] };
        for (const task of all(state)) {
            if (task.trashedAt || task.kind === 'goal') continue;
            const dated = task.repeat || task.fromDate || task.dates?.length || task.extraDates?.length;
            if (!dated) { result.unscheduled.push({ task, date: today() }); continue; }
            for (const date of occurrences(task, range.start, range.end)) result[task.repeat ? 'recurring' : 'scheduled'].push({ task, date });
            for (const date of occurrences(task, range.previousStart, range.previousEnd)) if (!done(task, date)) result.previous.push({ task, date });
        }
        return result;
    };
    const update = (id, mutate) => { const state = load(), task = all(state).find(item => item.id === id); if (!task) return; mutate(task, state); commit(state); };
    const toggle = (id, date, checked) => update(id, task => {
        if (task.repeat || task.fromDate || task.dates?.length) { task.completed = false; task.completedDates = (task.completedDates || []).filter(value => value !== date); if (checked) task.completedDates.push(date); }
        else task.completed = checked;
    });
    window.ChecklistModel = { load, all, commit, migrate, today, period, occurrences, done, groups, update, toggle };
})();
