(() => {
    window.goalIcon = '<svg class="goal-target-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width=".85"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width=".85"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';

    window.dashboardText = key => window.I18n.t('dashboard.' + key);
    window.translateDashboard = (root = document) => {
        root.querySelectorAll('[data-dashboard-i18n]').forEach(node => {
            node.textContent = window.dashboardText(node.dataset.dashboardI18n);
        });
    };
    document.addEventListener('visualmind-preferences', event => {
        if (event.detail?.language) window.translateDashboard();
    });
})();
