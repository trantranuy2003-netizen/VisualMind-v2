const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../js/calendar-model.js'), 'utf8'), context);
const M = context.window.CalendarModel;
test('custom weekly intervals use calendar weeks and selected weekdays', () => {
    const item = { repeat: 'weekly', start: '2026-09-07', repeatInterval: 2, repeatDays: [1, 3, 5], repeatUntil: '2026-09-25' };
    for (const day of ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-21', '2026-09-25']) assert.equal(M.occurs(item, day), true, day);
    for (const day of ['2026-09-08', '2026-09-14', '2026-09-28']) assert.equal(M.occurs(item, day), false, day);
    item.excludedDates = ['2026-09-09']; assert.equal(M.occurs(item, '2026-09-09'), false);
});
test('monthly repeats clamp month end; new all-day repeats do not end after one day', () => {
    assert.equal(M.occurs({ repeat: 'monthly', start: '2028-01-31' }, '2028-02-29'), true);
    assert.equal(M.occurs({ repeat: 'daily', start: '2026-09-07', toDate: '2026-09-07', durationMinutes: 0 }, '2026-09-08'), true);
});
test('overnight segments share the original date and cross week/year boundaries', () => {
    const item = { id: 'night', fromDate: '2026-12-31', toDate: '2027-01-01', fromTime: '23:00', endToTime: '01:00' };
    const first = M.segments([item], '2026-12-31')[0], next = M.segments([item], '2027-01-01')[0];
    assert.equal(first.start, 1380); assert.equal(first.end, 1440); assert.equal(first.continuesAfter, true);
    assert.equal(next.start, 0); assert.equal(next.end, 60); assert.equal(next.origin, '2026-12-31');
    assert.equal(M.segments([item], '2027-01-02').length, 0);
    item.excludedDates = ['2026-12-31']; assert.equal(M.segments([item], '2027-01-01').length, 0);
});
test('midnight endings do not create zero-length continuations; repeated nights retain identity', () => {
    const item = { repeat: 'daily', start: '2026-09-07', fromTime: '23:00', endToTime: '00:00', durationMinutes: 60 };
    assert.equal(M.segments([item], '2026-09-08').length, 1);
    item.durationMinutes = 120;
    assert.equal(M.segments([item], '2026-09-08').length, 2);
});
test('only connected overlap groups share columns', () => {
    const entries = [{ start: 540, end: 600 }, { start: 570, end: 660 }, { start: 630, end: 690 }, { start: 720, end: 780 }];
    M.layout(entries);
    assert.equal(entries[0].columns, 2); assert.equal(entries[2].columns, 2);
    assert.equal(entries[3].columns, 1); assert.equal(entries[3].lane, 0);
});
