(() => {
    const documentId = 'hodi-dashboard-v1';
    const tasksKey = 'visualmind-eisenhower-tasks';
    const plannerKey = 'visualmind-weekly-planner';
    const ownerKey = 'visualmind-dashboard-owner';
    const empty = () => ({ tasks: [], planner: { items: [], recurring: [] } });
    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    };
    const snapshot = () => ({ tasks: read(tasksKey, []), planner: read(plannerKey, empty().planner) });
    const cacheKey = owner => `visualmind-dashboard-cache:${owner || 'guest'}`;
    let owner = localStorage.getItem(ownerKey) || null;
    let generation = 0, timer, pending = Promise.resolve(), ready = false;
    const status = (text) => {
        window.dashboardSyncStatus = text;
        document.dispatchEvent(new CustomEvent('visualmind-dashboard-status', { detail: { text } }));
    };
    const apply = data => {
        localStorage.setItem(tasksKey, JSON.stringify(data.tasks || []));
        localStorage.setItem(plannerKey, JSON.stringify(data.planner || empty().planner));
        document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
    };
    const cache = () => {
        const previous = read(cacheKey(owner), {});
        const record = { ...previous, snapshot: snapshot(), dirty: true, revision: crypto.randomUUID() };
        localStorage.setItem(cacheKey(owner), JSON.stringify(record));
        return record;
    };
    async function flush() {
        clearTimeout(timer);
        if (!owner || !ready) return !owner;
        const account = owner, version = generation;
        pending = pending.catch(() => false).then(async () => {
            const record = read(cacheKey(account), null);
            if (!record?.dirty || version !== generation) return true;
            status('Đang lưu dashboard…');
            const saved = await saveMindmapToCloud('Hodi Dashboard', { dashboardVersion: 1, ...record.snapshot }, documentId, record.cloudId || null);
            if (version !== generation) return saved;
            const latest = read(cacheKey(account), {});
            if (saved && latest.revision === record.revision) {
                latest.dirty = false;
                localStorage.setItem(cacheKey(account), JSON.stringify(latest));
            }
            status(saved ? (latest.dirty ? 'Dashboard còn thay đổi đang chờ lưu…' : 'Đã lưu dashboard lên cloud') : 'Chưa lưu được dashboard. Bản trên máy vẫn được giữ; sẽ thử lại khi có mạng.');
            return saved;
        });
        return pending;
    }
    window.saveDashboardToCloud = flush;
    async function connect(user) {
        const account = user?.id || null;
        const version = ++generation;
        ready = false;
        clearTimeout(timer);
        const previousOwner = owner;
        if (account !== previousOwner) {
            // Never upload the previous account's dashboard to a new account.
            owner = account;
            if (owner) localStorage.setItem(ownerKey, owner);
            else localStorage.removeItem(ownerKey);
            const saved = read(cacheKey(owner), null);
            if (saved) apply(saved.snapshot);
            else if (previousOwner) apply(empty());
        }
        if (!account) { status('Dashboard được lưu trên máy. Đăng nhập để đồng bộ.'); return; }
        if (!read(cacheKey(account), null)) cache();
        status('Đang tải dashboard…');
        try {
            const { data, error } = await supabaseClient.from('hodi database').select('id, data')
                .eq('user_id', account).eq('data->>visualmindDocumentId', documentId).limit(1);
            if (error) throw error;
            if (generation !== version) return;
            let local = read(cacheKey(account), {});
            const remote = data?.[0];
            // A brand-new browser has an empty cache, not an intentional deletion.
            const hasLocal = local.snapshot?.tasks?.length || local.snapshot?.planner?.items?.length || local.snapshot?.planner?.recurring?.length;
            if (remote && (!local.dirty || (!hasLocal && !local.edited))) {
                local = { snapshot: { tasks: remote.data.tasks || [], planner: remote.data.planner || empty().planner }, dirty: false, revision: crypto.randomUUID() };
                apply(local.snapshot);
            }
            if (remote) local.cloudId = remote.id;
            localStorage.setItem(cacheKey(account), JSON.stringify(local));
            ready = true;
            if (local.dirty) await flush();
            else status('Đã đồng bộ dashboard');
        } catch (error) {
            if (version === generation) status(`Chưa tải được dashboard: ${error.message}. Bản trên máy vẫn được giữ.`);
        }
    }
    document.addEventListener('visualmind-dashboard-change', () => {
        const record = cache(); record.edited = true;
        localStorage.setItem(cacheKey(owner), JSON.stringify(record));
        status(owner ? 'Dashboard có thay đổi đang chờ lưu…' : 'Dashboard được lưu trên máy. Đăng nhập để đồng bộ.');
        clearTimeout(timer); timer = setTimeout(flush, 600);
    });
    document.addEventListener('visualmind-auth-change', event => { setTimeout(() => connect(event.detail.user), 0); });
    const reconnect = () => {
        if (supabaseClient) supabaseClient.auth.getSession().then(({ data }) => connect(data.session?.user));
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('storage', event => {
        if (event.storageArea !== localStorage) return;
        if (event.key === tasksKey || event.key === plannerKey) document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
    });
    document.addEventListener('click', async event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || link.target === '_blank') return;
        const record = read(cacheKey(owner), null);
        if (!owner || !record?.dirty || !ready) return;
        event.preventDefault();
        await flush();
        window.location.href = link.href;
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    reconnect();
})();
