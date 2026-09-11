(() => {
    const nav = document.getElementById('appNavSidebar');
    const toggle = document.getElementById('appNavToggle');
    if (!nav || !toggle) return;

    const storageKey = 'visualmind-app-nav-collapsed';
    const setCollapsed = (collapsed) => {
        document.body.classList.toggle('app-nav-collapsed', collapsed);
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.title = collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng';
        if (!toggle.querySelector('.hodi-logo')) toggle.textContent = collapsed ? '☰' : '‹';
    };

    const syncCollapsed = () => setCollapsed(localStorage.getItem(storageKey) === 'true');
    syncCollapsed();
    window.addEventListener('storage', (event) => {
        if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) syncCollapsed();
    });
    window.addEventListener('pageshow', syncCollapsed);
    window.addEventListener('focus', syncCollapsed);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncCollapsed();
    });
    toggle.addEventListener('click', () => {
        const collapsed = !document.body.classList.contains('app-nav-collapsed');
        setCollapsed(collapsed);
        localStorage.setItem(storageKey, String(collapsed));
    });
})();
