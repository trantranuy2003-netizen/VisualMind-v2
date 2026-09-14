(() => {
    const nav = document.getElementById('appNavSidebar');
    const toggle = document.getElementById('appNavToggle');
    if (!nav || !toggle) return;

    const storageKey = 'visualmind-app-nav-collapsed';
    const mobile = window.matchMedia('(max-width: 720px)');
    const backdrop = document.createElement('button');
    backdrop.className = 'app-nav-backdrop';
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Đóng thanh điều hướng');
    document.body.appendChild(backdrop);
    const setMobileOpen = (open) => {
        document.body.classList.toggle('app-nav-mobile-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.title = open ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng';
    };
    backdrop.addEventListener('click', () => { setMobileOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('app-nav-mobile-open')) {
            setMobileOpen(false); toggle.focus();
        }
    });
    nav.querySelectorAll('.app-nav-link').forEach(link => {
        link.title = link.textContent.trim();
        link.setAttribute('aria-label', link.title);
        if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
    });
    const setCollapsed = (collapsed) => {
        document.body.classList.toggle('app-nav-collapsed', collapsed);
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.title = collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng';
        if (!toggle.querySelector('.hodi-logo')) toggle.textContent = collapsed ? '☰' : '‹';
    };

    const syncCollapsed = () => {
        setCollapsed(localStorage.getItem(storageKey) === 'true');
        setMobileOpen(false);
        if (!mobile.matches) setCollapsed(localStorage.getItem(storageKey) === 'true');
    };
    mobile.addEventListener('change', syncCollapsed);
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
        if (mobile.matches) {
            setMobileOpen(!document.body.classList.contains('app-nav-mobile-open'));
            return;
        }
        const collapsed = !document.body.classList.contains('app-nav-collapsed');
        setCollapsed(collapsed);
        localStorage.setItem(storageKey, String(collapsed));
    });
})();
