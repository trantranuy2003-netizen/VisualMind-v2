(() => {
    const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    function svgContext(native) {
        let path = '', current = [0, 0], clips = [], stack = []; const elements = [], defs = [];
        const transform = () => { const m = native.getTransform(); return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`; };
        const emit = (tag, attributes, content = '') => {
            let element = `<${tag} transform="${transform()}" opacity="${native.globalAlpha}" ${attributes}>${content}</${tag}>`;
            for (const clip of clips) element = `<g clip-path="url(#${clip})">${element}</g>`;
            elements.push(element);
        };
        const stroke = () => `fill="none" stroke="${xml(native.strokeStyle)}" stroke-width="${native.lineWidth}" stroke-linecap="${native.lineCap}" stroke-dasharray="${native.getLineDash().join(' ')}"`;
        const methods = {
            save() { native.save(); stack.push([...clips]); }, restore() { native.restore(); clips = stack.pop() || []; },
            beginPath() { path = ''; native.beginPath(); },
            moveTo(x, y) { path += `M${x} ${y} `; current = [x, y]; },
            lineTo(x, y) { path += `L${x} ${y} `; current = [x, y]; },
            bezierCurveTo(a, b, c, d, x, y) { path += `C${a} ${b} ${c} ${d} ${x} ${y} `; current = [x, y]; },
            arcTo(x1, y1, x2, y2, radius) {
                const ax = current[0] - x1, ay = current[1] - y1, bx = x2 - x1, by = y2 - y1;
                const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
                if (!al || !bl || !radius) { methods.lineTo(x1, y1); return; }
                const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / al / bl)));
                if (angle < .00001 || Math.abs(angle - Math.PI) < .00001) { methods.lineTo(x1, y1); return; }
                const distance = radius / Math.tan(angle / 2), sx = x1 + ax / al * distance, sy = y1 + ay / al * distance, ex = x1 + bx / bl * distance, ey = y1 + by / bl * distance;
                path += `L${sx} ${sy} A${radius} ${radius} 0 0 ${ax * by - ay * bx < 0 ? 1 : 0} ${ex} ${ey} `; current = [ex, ey];
            },
            arc(x, y, r, start, end) { const sx = x + r * Math.cos(start), sy = y + r * Math.sin(start); path += `M${sx} ${sy} A${r} ${r} 0 1 1 ${x - r * Math.cos(start)} ${y - r * Math.sin(start)} A${r} ${r} 0 1 1 ${sx} ${sy} `; current = [sx, sy]; },
            closePath() { path += 'Z '; },
            fill() { emit('path', `d="${path}" fill="${xml(native.fillStyle)}"`); },
            stroke() { emit('path', `d="${path}" ${stroke()}`); },
            fillRect(x, y, w, h) { emit('rect', `x="${x}" y="${y}" width="${w}" height="${h}" fill="${xml(native.fillStyle)}"`); },
            strokeRect(x, y, w, h) { emit('rect', `x="${x}" y="${y}" width="${w}" height="${h}" ${stroke()}`); },
            clip() { const id = 'clip' + defs.length; defs.push(`<clipPath id="${id}"><path d="${path}" transform="${transform()}"/></clipPath>`); clips.push(id); },
            fillText(text, x, y) { emit('text', `x="${x}" y="${y}" fill="${xml(native.fillStyle)}" style="font:${xml(native.font)};white-space:pre" text-anchor="${native.textAlign === 'center' ? 'middle' : native.textAlign === 'right' ? 'end' : 'start'}" dominant-baseline="${native.textBaseline === 'middle' ? 'central' : 'alphabetic'}"`, xml(text)); }
        };
        const proxy = new Proxy(native, { get(target, key) { if (methods[key]) return methods[key]; const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; }, set(target, key, value) { target[key] = value; return true; } });
        return { context: proxy, content: () => `<defs>${defs.join('')}</defs>${elements.join('')}` };
    }
    function capture(format, scale = 1) {
        const box = MM.bounds(); if (!box) throw Error(MM.tr('Sơ đồ đang trống.', 'The mindmap is empty.'));
        const width = Math.ceil(box.width), height = Math.ceil(box.height);
        if (format === 'png' && (width * height * scale * scale > 32000000 || Math.max(width, height) * scale > 16384)) throw Error(MM.tr('Ảnh quá lớn. Hãy giảm độ phân giải hoặc chọn SVG/PDF.', 'Image is too large. Reduce resolution or choose SVG/PDF.'));
        const original = { canvas, ctx, viewport, selection, inlineEdit, dragDropTargetId }, collapsed = Object.values(mindmap.nodes).map(node => [node, node.collapsed]);
        const offscreen = document.createElement('canvas'); offscreen.width = format === 'png' ? width * scale : 1; offscreen.height = format === 'png' ? height * scale : 1;
        const recorder = format !== 'png' ? svgContext(offscreen.getContext('2d')) : null;
        try {
            window.mmExporting = true; collapsed.forEach(([node]) => { node.collapsed = false; });
            canvas = { width, height }; ctx = recorder?.context || offscreen.getContext('2d');
            if (format === 'png') ctx.scale(scale, scale);
            viewport = { x: -(box.x + width / 2), y: -(box.y + height / 2), zoom: 1 };
            selection = { ...selection, nodeId: null, selectedIds: [], selectedConnectors: [], selectedLink: null, isBoxSelecting: false }; inlineEdit = null; dragDropTargetId = null;
            render();
            if (format === 'png') return offscreen;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${recorder.content()}</svg>`;
        } finally { ({ canvas, ctx, viewport, selection, inlineEdit, dragDropTargetId } = original); collapsed.forEach(([node, value]) => { node.collapsed = value; }); window.mmExporting = false; render(); }
    }
    const download = (blob, name) => { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    window.MindmapExport = { capture };
    window.openMindmapExport = (format = 'png') => {
        closeInlineEdit();
        const { panel, close } = MM.dialog('Xuất toàn bộ sơ đồ', 'Export entire mindmap');
        const form = document.createElement('form');
        form.innerHTML = `<label>${MM.tr('Định dạng', 'Format')}<select name="format"><option value="png">PNG</option><option value="svg">SVG</option><option value="pdf">PDF</option></select></label><label>${MM.tr('Độ phân giải PNG', 'PNG resolution')}<select name="scale"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></label><p>${MM.tr('Xuất tất cả nhánh, kể cả nhánh thu gọn. PDF mở hộp in: chọn Lưu thành PDF.', 'Includes all branches, including collapsed ones. For PDF, choose Save as PDF in the print dialog.')}</p><p role="alert"></p>`;
        form.elements.format.value = format; form.elements.scale.value = '2';
        const submit = MM.button('Xuất', 'Export', () => {}); submit.type = 'submit'; form.append(submit); panel.append(form);
        form.onsubmit = async event => {
            event.preventDefault(); const type = form.elements.format.value;
            const printWindow = type === 'pdf' ? window.open('', '_blank') : null;
            try {
                await document.fonts?.ready;
                const result = capture(type, Number(form.elements.scale.value));
                if (type === 'png') { const blob = await new Promise(resolve => result.toBlob(resolve, 'image/png')); if (!blob) throw Error('PNG export failed'); download(blob, 'mindmap.png'); }
                else if (type === 'svg') download(new Blob([result], { type: 'image/svg+xml;charset=utf-8' }), 'mindmap.svg');
                else {
                    if (!printWindow) throw Error(MM.tr('Cho phép cửa sổ bật lên để lưu PDF.', 'Allow popups to save PDF.'));
                    printWindow.document.write('<!doctype html><html><head><title>Mindmap</title><style>@page{size:A4 landscape;margin:10mm}body{margin:0}svg{display:block;width:100%;height:calc(100vh - 20mm)}@media print{svg{height:180mm}}</style></head><body>' + result + '</body></html>'); printWindow.document.close();
                    await printWindow.document.fonts.ready; printWindow.focus(); printWindow.print();
                }
                close();
            } catch (error) { printWindow?.close(); form.querySelector('[role="alert"]').textContent = error.message; }
        };
    };
    window.addEventListener('DOMContentLoaded', () => { document.querySelector('#tab-export').append(MM.button('Xuất SVG', 'Export SVG', () => openMindmapExport('svg'))); });
})();
