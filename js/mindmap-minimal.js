(() => {
    const paths = {
        'Fit to screen': 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z',
        'Shortcuts': 'M3 6h18v12H3zM6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 15h10',
        'Versions': 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
        'Create task': 'M8 5H4v16h16V5h-4M8 3h8v4H8zM8 14l3 3 5-6',
        'Create flashcards': 'M3 3h14v15H3zM7 21h14V7M6 7h8m-8 4h6',
        'Search': 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        'Add node': 'M12 3v18M3 12h18',
        'Collapse': 'M4 7h16M4 17h16M8 11l4-4 4 4m-8 2 4 4 4-4'
    };
    const icon = (button, name) => {
        const title = button.dataset.mmVi ? MM.tr(button.dataset.mmVi, button.dataset.mmEn) : button.title || name;
        button.title = title; button.setAttribute('aria-label', title);
        if (button.querySelector('svg[data-mm-icon]')) return;
        button.innerHTML = `<svg data-mm-icon viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
    };
    window.addEventListener('DOMContentLoaded', () => {
        const tools = document.querySelector('.mm-tools'), input = tools.querySelector('input');
        const search = MM.button('Tìm kiếm', 'Search', () => { input.hidden = !input.hidden; search.setAttribute('aria-expanded', String(!input.hidden)); if (!input.hidden) input.focus(); });
        input.hidden = true; search.setAttribute('aria-expanded', 'false'); tools.prepend(search);
        input.addEventListener('focus', () => { input.hidden = false; search.setAttribute('aria-expanded', 'true'); });
        document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !event.target.closest('.mm-overlay')) { input.hidden = false; input.focus(); } }, true);
        const refresh = () => {
            document.querySelectorAll('.mm-tools > button, .controls > button[data-mm-en]').forEach(button => { if (paths[button.dataset.mmEn]) icon(button, button.dataset.mmEn); });
            icon(document.querySelector('.create-node-btn'), 'Add node'); icon(document.querySelector('#collapseToggleBtn'), 'Collapse');
            document.querySelectorAll('.app-topbar a').forEach(link => { if (!link.title) link.title = link.textContent.trim(); link.setAttribute('aria-label', link.title); [...link.childNodes].filter(node => node.nodeType === 3).forEach(node => node.remove()); });
        };
        refresh();
        new MutationObserver(refresh).observe(tools, { childList: true, subtree: true });
        new MutationObserver(refresh).observe(document.querySelector('.controls'), { childList: true, subtree: true });
        document.addEventListener('visualmind-preferences', refresh);
        document.addEventListener('keydown', event => {
            if (event.target.closest('input,textarea,select,[contenteditable],.mm-overlay')) return;
            if (!(event.ctrlKey || event.metaKey) || !selection.nodeId) return;
            const style = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()];
            if (style) { event.preventDefault(); event.stopImmediatePropagation(); toggleNodeStyle(selection.nodeId, style); }
        }, true);
    });
})();
