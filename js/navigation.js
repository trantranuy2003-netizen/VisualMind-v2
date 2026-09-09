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

    setCollapsed(localStorage.getItem(storageKey) === 'true');
    toggle.addEventListener('click', () => {
        const collapsed = !document.body.classList.contains('app-nav-collapsed');
        setCollapsed(collapsed);
        localStorage.setItem(storageKey, String(collapsed));
    });
})();
