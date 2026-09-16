(() => {
    const t = (...args) => I18n.t(...args);
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
    const button = (key, action, symbol) => { const node = el('button', 'planner-button', symbol || t(key)); node.dataset.uiKey=key; node.dataset.uiTemplate=symbol ? symbol.replace(t(key),'{label}') : '{label}'; node.type = 'button'; node.title = t(key); node.setAttribute('aria-label', t(key)); node.onclick = action; return node; };
    const dialog = (key, draw, literal = false) => {
        const previous = document.activeElement, overlay = el('div', 'library-dialog-overlay'), panel = el('section', 'library-dialog wheel-dialog');
        panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label', literal ? key : t(key));
        const close = () => { overlay.remove(); if (previous?.isConnected) previous.focus(); };
        const heading = el('header', 'dashboard-panel-heading'); heading.append(el('h3','',literal ? key : t(key)),button('close',close,'🗑')); panel.append(heading);
        overlay.append(panel); document.body.append(overlay);
        overlay.onclick = event => { if (event.target === overlay) close(); };
        overlay.onkeydown = event => {
            if (event.key === 'Escape') { event.stopPropagation(); close(); }
            if (event.key === 'Tab') { const nodes = [...panel.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length); if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); } }
        };
        draw(panel,close); panel.querySelector('input,button')?.focus(); return panel;
    };
    const field = (form, key, type, value = '') => { const label = el('label','wheel-field',t(key)), input = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'); if (!['textarea','select'].includes(type)) input.type = type; input.name = key; input.value = value; label.append(input); form.append(label); return input; };
    const select = (form, key, values, selected) => { const input = field(form,key,'select'); values.forEach(value => { const option=el('option','',t(value || 'none')); option.value=value; input.append(option); }); input.value=selected || ''; return input; };
    window.DashboardUI = { el, button, dialog, field, select, t };
})();
