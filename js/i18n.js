/* Shared dictionary and locale lifecycle. User-authored content is never translated. */
(() => {
    const dictionary = {};
    const phrases = new Map();
    const templates = [];
    const language = () => localStorage.getItem('visualmind-language') === 'en' ? 'en' : 'vi';
    const register = entries => {
        for (const [key, pair] of Object.entries(entries)) {
            dictionary[key] = pair;
            phrases.set(pair[0], pair); phrases.set(pair[1], pair);
            if (pair[0].includes('{')) for (const source of pair) {
                const names=[];
                const pattern=source.split(/(\{\w+\})/).map(part=>{if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return '(.+?)';}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');
                templates.push({key,names,pattern:new RegExp('^'+pattern+'$')});
            }
        }
    };
    const t = (key, params = {}) => {
        const pair = dictionary[key] || phrases.get(key);
        return (pair ? pair[language() === 'en' ? 1 : 0] : key).replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    };
    const pair = (vi, en) => { register({ [vi]: [vi, en] }); return t(vi); };
    const text = source => {
        if (phrases.has(source)) return t(source);
        for(const template of templates){const match=source.match(template.pattern);if(match)return t(template.key,Object.fromEntries(template.names.map((name,i)=>[name,match[i+1]])));}
        return source;
    };
    const skip = 'script,style,textarea,input,[contenteditable],.todo-item-title,.planner-task-title,.calendar-event-title,.library-node-name,#fcCardText,.fc-list-q,.fc-list-a,.h-answer,[data-user-content],svg text:not([data-i18n])';
    const translate = (root = document.body) => {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (!node.parentElement || node.parentElement.closest(skip)) continue;
            const source = node.textContent.trim();
            const value = node.textContent.replace(source, text(source)); if (value !== node.textContent) node.textContent = value;
        }
        root.querySelectorAll('[data-i18n-key]').forEach(node => { node.textContent = t(node.dataset.i18nKey); });
        root.querySelectorAll('[data-ui-key]').forEach(node => {
            const label=t(node.dataset.uiKey), value=node.dataset.uiTemplate.replace('{label}',label);
            if(node.textContent!==value)node.textContent=value;
            if(node.title!==label)node.title=label;
            if(node.getAttribute('aria-label')!==label)node.setAttribute('aria-label',label);
        });
        root.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(node => {
            if (node.closest('[data-user-content],.library-node-name')) return;
            for (const attr of ['title', 'placeholder', 'aria-label', 'alt']) {
                const value = node.getAttribute(attr);
                if (value && text(value) !== value) node.setAttribute(attr, text(value));
            }
        });
        document.documentElement.lang = language();
    };
    window.I18n = { dictionary, register, t, pair, text, language, translate, locale: () => language() === 'en' ? 'en-US' : 'vi-VN' };
    document.addEventListener('invalid', event => {
        const input=event.target;if(!input.validity || !input.setCustomValidity)return;
        input.setCustomValidity('');const validity=input.validity;
        input.setCustomValidity(validity.valueMissing?t('requiredField'):validity.rangeUnderflow?t('minField',{value:input.min}):validity.rangeOverflow?t('maxField',{value:input.max}):t('invalidField'));
    },true);
    document.addEventListener('input',event=>event.target.setCustomValidity?.(''),true);
    let queued = false;
    const queue = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; translate(); }); };
    document.addEventListener('DOMContentLoaded', () => { translate(); new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] }); });
    document.addEventListener('visualmind-preferences', queue);
    window.addEventListener('storage', event => { if (event.key === 'visualmind-language') queue(); });
})();
