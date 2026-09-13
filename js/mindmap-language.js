(() => {
    const words = {
        'Mindmap Builder': 'Sơ đồ tư duy', 'Text to Mindmap': 'Văn bản thành sơ đồ', 'Import': 'Nhập', 'Export': 'Xuất', 'Language': 'Ngôn ngữ', 'Display': 'Giao diện', 'Update': 'Cập nhật',
        'Import JSON': 'Nhập JSON', 'Save as JSON': 'Lưu JSON', 'Save as Image': 'Xuất ảnh', 'Save as PDF': 'Xuất PDF', 'Node Properties': 'Thuộc tính node', 'Properties': 'Thuộc tính', 'Link Properties': 'Thuộc tính liên kết', 'Connector Properties': 'Thuộc tính đường nối',
        'Text': 'Nội dung', 'Icon': 'Biểu tượng', 'Font size': 'Cỡ chữ', 'Fill color': 'Màu nền', 'Text color': 'Màu chữ', 'Custom color': 'Màu tùy chọn', 'Black': 'Đen', 'White': 'Trắng', 'Red': 'Đỏ', 'Blue': 'Xanh dương',
        'Add child': 'Thêm nhánh con', 'Delete': 'Xóa', 'Collapse': 'Thu gọn', 'Expand': 'Mở rộng', 'Highlight color': 'Màu đánh dấu', 'Insert free node': 'Thêm node tự do', 'Insert table': 'Thêm bảng', 'Show level': 'Hiện cấp',
        'Copy': 'Sao chép', 'Cut': 'Cắt', 'Paste': 'Dán', 'Duplicate': 'Nhân bản', 'Group': 'Nhóm', 'Ungroup': 'Bỏ nhóm', 'Create link': 'Tạo liên kết', 'Link color': 'Màu liên kết', 'Width': 'Độ dày', 'Opacity': 'Độ mờ', 'Dashed': 'Nét đứt', 'Solid': 'Nét liền',
        'Delete link': 'Xóa liên kết', 'Connector color': 'Màu đường nối', 'Reset': 'Đặt lại', 'Cut connector (child → free)': 'Cắt đường nối (con → tự do)', 'Delete connector': 'Xóa đường nối', 'Free node': 'Node tự do',
        'Selected {count} node(s)': 'Đã chọn {count} node', 'Drag to select area. ESC to cancel.': 'Kéo để chọn vùng. Esc để hủy.', 'Save mindmap': 'Lưu sơ đồ', 'Enter filename:': 'Nhập tên tệp:', 'Filename (no .json needed)': 'Tên tệp (không cần .json)', 'Cancel': 'Hủy', 'Save': 'Lưu',
        'Select text then click B/I/U or choose color.': 'Chọn chữ rồi bấm B/I/U hoặc chọn màu.', 'Rows': 'Hàng', 'Columns': 'Cột', 'Create table': 'Tạo bảng', 'Double-click a cell to edit': 'Nhấp đúp ô để sửa', 'Light': 'Sáng', 'Dark': 'Tối', 'Collapse All': 'Thu gọn tất cả', 'Expand All': 'Mở tất cả',
        'Toggle sidebar': 'Ẩn/hiện thanh bên', 'Close sidebar': 'Đóng thanh bên', 'Zoom in': 'Phóng to', 'Zoom out': 'Thu nhỏ', 'Undo': 'Hoàn tác', 'Redo': 'Làm lại', 'Toggle collapse all': 'Thu gọn/mở tất cả',
        'Fill': 'Nền', 'Line': 'Đường', 'Line color': 'Màu đường', 'Smaller text': 'Giảm cỡ chữ', 'Larger text': 'Tăng cỡ chữ', 'Bold': 'In đậm', 'Italic': 'In nghiêng', 'Underline': 'Gạch chân', 'Strikethrough': 'Gạch ngang', 'Highlight': 'Đánh dấu', 'More properties': 'Thêm thuộc tính', 'Comment / note…': 'Bình luận / ghi chú…',
        'Delete node': 'Xóa node', 'Preview': 'Xem trước', 'Left': 'Trái', 'Center': 'Giữa', 'Right': 'Phải', 'Align left': 'Căn trái', 'Align center': 'Căn giữa', 'Align right': 'Căn phải', 'Bullets': 'Dấu đầu dòng', 'Bullet points': 'Dấu đầu dòng', 'Text alignment': 'Căn chỉnh chữ',
        'Please enter text to import': 'Nhập nội dung để tạo sơ đồ', '✓ Updated': '✓ Đã cập nhật', 'Could not parse text': 'Không đọc được cấu trúc văn bản'
    };
    const translate = text => {
        for (const [english, vietnamese] of Object.entries(words).sort((a, b) => b[0].length - a[0].length)) {
            if (text === english || (text.endsWith(english) && !/[a-zA-Z]/.test(text.slice(0, -english.length)))) return text.slice(0, -english.length) + vietnamese;
        }
        return text;
    };
    Object.keys(LANG.vi).forEach(key => { if (LANG.en[key] === LANG.vi[key]) LANG.vi[key] = translate(LANG.en[key]); });
    LANG.vi['sc-enter'] = 'Enter Thêm nhánh cùng cấp'; LANG.en['sc-enter'] = 'Enter Add sibling';
    window.mmText = (vi, en) => localStorage.getItem('visualmind-language') === 'en' ? en : vi;
    const originals = new WeakMap();
    const refresh = () => {
        const isVi = localStorage.getItem('visualmind-language') !== 'en';
        document.querySelectorAll('#sidebar, #right-panel, .controls, .node-mini-properties-panel, .node-inline-toolbar, .context-menu, #error-message').forEach(root => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let text;
            while ((text = walker.nextNode())) {
                if (text.parentElement.closest('textarea,input,script,[data-key]')) continue;
                const stored = originals.get(text);
                if (stored && (text.textContent === stored.en || text.textContent === stored.vi)) { const value = isVi ? stored.vi : stored.en; if (text.textContent !== value) text.textContent = value; }
                else {
                    const en = text.textContent, vi = translate(en.trim());
                    if (vi !== en.trim()) { const record = { en, vi: en.replace(en.trim(), vi) }; originals.set(text, record); if (isVi) text.textContent = record.vi; }
                }
            }
            root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(node => {
                for (const attr of ['title', 'placeholder', 'aria-label']) {
                    const current = node.getAttribute(attr); if (!current) continue;
                    const name = 'data-mm-original-' + attr;
                    const en = node.getAttribute(name) || current, vi = translate(en);
                    if (vi === en) continue;
                    node.setAttribute(name, en); const value = isVi ? vi : en; if (value !== current) node.setAttribute(attr, value);
                }
            });
        });
    };
    let queued = false;
    const queue = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; refresh(); }); };
    const fixedLabels = () => {
        const choose = window.mmText;
        const create = document.querySelector('.create-node-btn');
        if (create) { create.textContent = choose('＋ Thêm node', '＋ Add node'); create.title = choose('Thêm node vào nhánh đang chọn', 'Add a node to the selected branch'); }
        const home = document.querySelector('.app-topbar a[href="index.html"]');
        const homeText = home && [...home.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
        if (homeText) homeText.textContent = choose(' Trang chủ', ' Home');
        const guide = document.querySelector('.text-to-mindmap-guide');
        if (guide) {
            guide.querySelector('strong').textContent = choose('Cách viết nhanh', 'Quick outline guide');
            const lines = [choose('Dòng đầu tiên là chủ đề trung tâm.', 'The first line is the central topic.'), choose('Thụt vào 2 khoảng trắng cho mỗi cấp nhánh.', 'Indent each branch level with two spaces.'), choose('Dùng **Tên nhánh** để in đậm (không bắt buộc).', 'Use **Branch title** for optional bold text.')];
            guide.querySelectorAll('li').forEach((node, index) => { node.textContent = lines[index]; });
        }
        const prompt = document.querySelector('[onclick="copyMindmapAIPrompt()"]'); if (prompt) prompt.textContent = choose('✨ Sao chép hướng dẫn cho AI', '✨ Copy AI prompt');
        const textInput = document.querySelector('#textInput'); if (textInput) textInput.placeholder = choose('Dán dàn ý vào đây:\nChủ đề trung tâm\n  Nhánh thứ nhất\n    Ý con', 'Paste an outline here:\nCentral topic\n  First branch\n    Child idea');
    };
    window.addEventListener('DOMContentLoaded', () => { fixedLabels(); refresh(); new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true }); });
    document.addEventListener('visualmind-preferences', event => { if (event.detail?.language) fixedLabels(); queue(); });
})();
