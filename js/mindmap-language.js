(() => {
    LANG.vi['sc-enter'] = 'Enter Thêm nhánh cùng cấp'; LANG.en['sc-enter'] = 'Enter Add sibling';
    window.mmText = (vi, en) => window.I18n.pair(vi, en);
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
    window.addEventListener('DOMContentLoaded', fixedLabels);
    document.addEventListener('visualmind-preferences', event => { if (event.detail?.language) fixedLabels(); });
})();
