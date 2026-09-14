const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, localStorage: { getItem: () => null } });
for (const file of ['calendar-model', 'radar']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/' + file + '.js'), 'utf8'), context);
const M = context.window.RadarModel;
test('target denominator stays fixed and goals share category weight', () => {
    const goals = [{ category: 'Health', mode: 'manual', target: 16, actual: 8 }, { category: 'Health', mode: 'manual', target: 2, actual: 4 }];
    assert.equal(M.score({ goals }, 'Health', '2026-10', 'progress', []), 75);
    assert.equal(M.score({ goals }, 'Work', '2026-10', 'progress', []), null);
    assert.equal(M.score({ ratings: { Health: 0 } }, 'Health', '2026-10', 'rating', []), 0);
});
test('only linked active tasks count; overnight and multi-day tasks count once', () => {
    const entries = [
        { ref: 'plan:a', item: { fromDate: '2026-10-01', toDate: '2026-10-04', completedDates: ['2026-10-01', '2026-10-02'] } },
        { ref: 'task:b', item: { completed: true, fromDate: '2026-11-01' } },
        { ref: 'task:c', item: { completed: true, trashedAt: 'today' } }
    ];
    assert.equal(M.completed({ mode: 'tasks', links: entries.map(item => item.ref) }, '2026-10', entries), 1);
});
test('recurring counts distinct valid completed occurrences in the selected month', () => {
    const item = { repeat: 'daily', start: '2026-10-01', excludedDates: ['2026-10-02'], completedDates: ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-03', '2026-11-01'] };
    assert.equal(M.completed({ mode: 'tasks', links: ['plan:a'] }, '2026-10', [{ ref: 'plan:a', item }]), 2);
});
test('closed results survive subsequent task changes and year rollover works', () => {
    assert.equal(M.score({ closed: { Health: 50 }, goals: [] }, 'Health', '2026-10', 'progress', []), 50);
    assert.equal(M.shiftMonth('2026-12', 1), '2027-01');
});
