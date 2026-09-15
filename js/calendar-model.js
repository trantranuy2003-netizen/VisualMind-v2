(() => {
    const day = value => new Date(value + 'T12:00:00');
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const addDays = (value, amount) => { const date = day(value); date.setDate(date.getDate() + amount); return key(date); };
    const daysBetween = (a, b) => {
        const utc = value => { const d = day(value); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
        return Math.round((utc(b) - utc(a)) / 86400000);
    };
    const minutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
    const time = value => `${String(Math.floor((value % 1440 + 1440) % 1440 / 60)).padStart(2, '0')}:${String((value % 60 + 60) % 60).padStart(2, '0')}`;
    const occurs = (item, date) => {
        if (item.trashedAt || item.excludedDates?.includes(date)) return false;
        if (item.extraDates?.includes(date)) return true;
        const lowerBound = item.start || item.fromDate;
        const start = lowerBound || item.repeatAnchor || '1970-01-05';
        if ((lowerBound && date < lowerBound) || (item.repeatUntil && date > item.repeatUntil)) return false;
        // Legacy recurring records used toDate as the end of the series.
        if (!item.repeatUntil && !Object.hasOwn(item, 'durationMinutes') && item.toDate && date > item.toDate) return false;
        const a = day(start), b = day(date), interval = Math.max(1, Number(item.repeatInterval) || 1);
        const distance = daysBetween(start, date);
        if (item.repeat === 'daily') return distance % interval === 0;
        if (item.repeat === 'weekdays') return b.getDay() > 0 && b.getDay() < 6 && Math.floor(distance / 7) % interval === 0;
        if (item.repeat === 'weekly') {
            const monday = addDays(start, -((a.getDay() + 6) % 7));
            return Math.floor(daysBetween(monday, date) / 7) % interval === 0 && (item.repeatDays?.length ? item.repeatDays : [a.getDay()]).includes(b.getDay());
        }
        if (item.repeat === 'monthly') return ((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) % interval === 0 && b.getDate() === Math.min(a.getDate(), new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate());
        return false;
    };
    const occurrenceStart = item => minutes(item.fromTime) ?? (item.scheduleVersion===2 && minutes(item.endToTime)!==null ? 0 : null);
    const duration = item => {
        if (Number(item.durationMinutes) > 0) return Number(item.durationMinutes);
        const start = occurrenceStart(item), end = minutes(item.endToTime || item.endFromTime || item.toTime);
        if (start === null) return 0;
        let value = end === null ? 60 : end - start;
        if (!item.repeat && item.fromDate && item.toDate) value += daysBetween(item.fromDate, item.toDate) * 1440;
        return value > 0 ? value : value + 1440;
    };
    const segments = (items, date) => {
        const result = [];
        items.forEach(item => {
            if (item.trashedAt) return;
            const start = occurrenceStart(item), length = duration(item);
            const startsOn = value => item.repeat ? occurs(item, value) : !item.excludedDates?.includes(value) && (item.extraDates?.includes(value) || (start !== null && item.fromDate ? value === item.fromDate : item.fromDate && item.toDate ? value >= item.fromDate && value <= item.toDate : item.dates?.includes(value)));
            const lookback = start === null ? 0 : Math.ceil(length / 1440);
            for (let back = 0; back <= lookback; back++) {
                const origin = addDays(date, -back);
                if (!startsOn(origin)) continue;
                const first = start === null ? null : start - back * 1440;
                const last = first === null ? null : first + length;
                if (first !== null && (last <= 0 || first >= 1440)) continue;
                result.push({ item, origin, start: first === null ? null : Math.max(0, first), end: last === null ? null : Math.min(1440, last), continuesBefore: first < 0, continuesAfter: last > 1440 });
            }
        });
        return result;
    };
    const layout = entries => {
        const sorted = entries.filter(entry => entry.start !== null).sort((a, b) => a.start - b.start || b.end - a.end);
        let group = [], end = -1;
        const flush = () => {
            const lanes = [];
            group.forEach(entry => {
                let lane = lanes.findIndex(value => value <= entry.start);
                if (lane < 0) lane = lanes.length;
                lanes[lane] = entry.end; entry.lane = lane;
            });
            group.forEach(entry => { entry.columns = lanes.length; });
        };
        sorted.forEach(entry => {
            if (entry.start >= end) { flush(); group = []; end = -1; }
            group.push(entry); end = Math.max(end, entry.end);
        });
        flush(); return entries;
    };
    window.CalendarModel = { day, key, addDays, daysBetween, minutes, time, occurs, duration, segments, layout, occurrenceStart };
})();
