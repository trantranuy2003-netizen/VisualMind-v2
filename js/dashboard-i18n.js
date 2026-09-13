(() => {
    window.goalIcon = '<svg class="goal-target-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width=".85"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width=".85"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
    const labels = {
        tasks: ['Danh sách công việc', 'To-do list'],
        newlyAdded: ['Việc mới', 'Newly added'],
        scheduled: ['Đã lên lịch', 'Scheduled'],
        recurring: ['Việc lặp lại', 'Recurring tasks'],
        weeklyTasks: ['Công việc trong tuần', 'Weekly to-do list'],
        calendar: ['Lịch', 'Calendar'],
        goal: ['Mục tiêu', 'Goal'],
        task: ['Công việc', 'Task'],
        priority: ['Mức ưu tiên', 'Priority'],
        categories: ['Danh mục', 'Categories'],
        editTask: ['Sửa công việc', 'Edit task'],
        taskName: ['Tên công việc', 'Task name'],
        addRecurring: ['Thêm việc lặp lại', 'Add recurring task'],
        emptyWeek: ['Chưa có kế hoạch. Thêm mục tiêu hoặc công việc cho tuần này.', 'No plans yet. Add a goal or task for this week.']
    };
    window.dashboardText = key => labels[key]?.[localStorage.getItem('visualmind-language') === 'en' ? 1 : 0] || key;
    window.translateDashboard = (root = document) => {
        root.querySelectorAll('[data-dashboard-i18n]').forEach(node => {
            node.textContent = window.dashboardText(node.dataset.dashboardI18n);
        });
    };
    document.addEventListener('visualmind-preferences', event => {
        if (event.detail?.language) window.translateDashboard();
    });
})();
