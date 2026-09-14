// A rich text surface with the selection API used by the node formatting tools.
window.createMindmapRichEditor = node => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true');
    let saved = [0, 0], signature = '', composing = false;
    const offsets = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return saved;
        const range = selection.getRangeAt(0), before = range.cloneRange();
        before.selectNodeContents(editor); before.setEnd(range.startContainer, range.startOffset);
        const start = before.toString().length;
        saved = [start, start + range.toString().length]; return saved;
    };
    editor.setSelectionRange = (start, end) => {
        saved = [start, end];
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT), nodes = [];
        let child; while ((child = walker.nextNode())) nodes.push(child);
        if (!nodes.length) { editor.appendChild(document.createTextNode('')); nodes.push(editor.firstChild); }
        const locate = offset => { for (const text of nodes) { if (offset <= text.length) return [text, offset]; offset -= text.length; } return [nodes.at(-1), nodes.at(-1).length]; };
        const range = document.createRange(); range.setStart(...locate(start)); range.setEnd(...locate(end));
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    };
    Object.defineProperties(editor, {
        value: { get: () => editor.textContent, set: value => { editor.textContent = value; signature = ''; } },
        selectionStart: { get: () => offsets()[0], set: value => editor.setSelectionRange(value, offsets()[1]) },
        selectionEnd: { get: () => offsets()[1], set: value => editor.setSelectionRange(offsets()[0], value) }
    });
    editor.select = () => editor.setSelectionRange(0, editor.value.length);
    editor.setRangeText = (text, start, end) => { editor.value = editor.value.slice(0, start) + text + editor.value.slice(end); editor.setSelectionRange(start, start + text.length); editor.dispatchEvent(new Event('input', { bubbles: true })); };
    editor.refreshRichText = () => {
        if (composing) return;
        const value = editor.value, next = JSON.stringify([value, node.textStyles, node.bold, node.italic, node.underline]);
        if (signature === next) return;
        const range = offsets(), focused = document.activeElement === editor;
        signature = next;
        const fragment = document.createDocumentFragment();
        const boundaries = [...new Set([0, value.length, ...(node.textStyles || []).flatMap(style => [Math.max(0, Math.min(value.length, style.start)), Math.max(0, Math.min(value.length, style.end))])])].sort((a, b) => a - b);
        for (let i = 0; i < boundaries.length - 1; i++) {
            const start = boundaries[i], end = boundaries[i + 1], style = { bold: node.bold, italic: node.italic, underline: node.underline };
            (node.textStyles || []).filter(item => item.start <= start && item.end >= end).forEach(item => Object.assign(style, item));
            const span = document.createElement('span'); span.textContent = value.slice(start, end);
            if (style.bold) span.style.fontWeight = '800';
            if (style.italic) span.style.fontStyle = 'italic';
            span.style.textDecoration = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ');
            if (style.textColor) span.style.color = style.textColor;
            if (style.highlight) span.style.backgroundColor = node.highlightColor || '#FFF3B0';
            fragment.appendChild(span);
        }
        editor.replaceChildren(fragment);
        if (focused) editor.setSelectionRange(...range);
    };
    editor.addEventListener('compositionstart', () => { composing = true; });
    editor.addEventListener('compositionend', () => { composing = false; editor.dispatchEvent(new Event('input', { bubbles: true })); });
    editor.addEventListener('beforeinput', event => {
        if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') { event.preventDefault(); editor.setRangeText('\n', ...offsets()); const end = saved[1]; editor.setSelectionRange(end, end); }
    });
    editor.addEventListener('paste', event => { event.preventDefault(); editor.setRangeText(event.clipboardData.getData('text/plain'), ...offsets()); const end = saved[1]; editor.setSelectionRange(end, end); });
    return editor;
};
