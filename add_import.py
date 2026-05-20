"""写入导入功能到 pages2.js（两步流程：先解析预览，再创建）"""
import re

with open('public/js/pages2.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 检查是否已有导入功能
if 'showImportModal' in content:
    # 找到并删除旧的导入代码块
    old_start = content.find('// ========== IMPORT MARKDOWN ==========')
    if old_start != -1:
        old_end = content.find('// ========== WRITE / EDIT POST ==========', old_start)
        if old_end != -1:
            content = content[:old_start] + '// ========== WRITE / EDIT POST ==========\n' + content[old_end + len('// ========== WRITE / EDIT POST ==========\n'):]
            print("已删除旧的导入代码")

with open('public/js/pages2.js', 'r', encoding='utf-8') as f:
    content = f.read()

import_code = '''// ========== IMPORT MARKDOWN ==========
function showImportModal() {
  const existing = document.getElementById('import-modal-bg');
  if (existing) existing.remove();
  const bg = document.createElement('div');
  bg.id = 'import-modal-bg';
  bg.className = 'modal-bg';
  bg.innerHTML = `
  <div class="confirm-dialog" style="max-width:580px;width:95%">
    <div class="confirm-title">导入 Markdown</div>
    <div class="confirm-msg" style="font-size:13px;color:var(--t2);margin-bottom:12px">
      支持标准 Markdown，含 YAML Frontmatter（title / summary / tags / cover）。<br>
      如 md 中有本地图片引用，请将图片打包为 zip 一起上传，自动关联。
    </div>
    <div class="form-group">
      <label class="form-label">Markdown 文件 *</label>
      <input type="file" id="import-md" accept=".md,.markdown" style="width:100%;font-size:13px">
    </div>
    <div class="form-group">
      <label class="form-label">图片压缩包（可选）</label>
      <input type="file" id="import-zip" accept=".zip" style="width:100%;font-size:13px">
    </div>
    <div id="import-preview" style="display:none;margin:12px 0;padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;line-height:1.8">
      <div id="import-preview-content"></div>
    </div>
    <div id="import-error" style="display:none;margin:8px 0;color:var(--err);font-size:13px"></div>
    <div id="import-progress" style="display:none;margin:8px 0;color:var(--t2);font-size:13px">\u2026 正在解析和上传图片\u2026</div>
    <div class="confirm-actions">
      <button class="btn btn-ghost" id="import-cancel">取消</button>
      <button class="btn btn-primary" id="import-parse" disabled>下一步：预览</button>
    </div>
  </div>`;
  document.body.appendChild(bg);

  const mdInput = document.getElementById('import-md');
  const zipInput = document.getElementById('import-zip');
  const preview = document.getElementById('import-preview');
  const previewContent = document.getElementById('import-preview-content');
  const errorDiv = document.getElementById('import-error');
  const progressDiv = document.getElementById('import-progress');
  const parseBtn = document.getElementById('import-parse');

  let parsedData = null; // 解析结果

  mdInput.addEventListener('change', () => {
    parseBtn.disabled = !mdInput.files[0];
    preview.style.display = 'none';
    errorDiv.style.display = 'none';
    parsedData = null;
    parseBtn.textContent = '下一步：预览';
  });

  parseBtn.addEventListener('click', async () => {
    if (!mdInput.files[0]) return;
    errorDiv.style.display = 'none';
    preview.style.display = 'none';
    progressDiv.style.display = 'block';
    parseBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', mdInput.files[0]);
    if (zipInput.files[0]) formData.append('images', zipInput.files[0]);

    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Authorization': tok() },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        errorDiv.textContent = data.message || '\\u89E3\\u6790\\u5931\\u8D25';
        errorDiv.style.display = 'block';
        progressDiv.style.display = 'none';
        parseBtn.disabled = false;
        return;
      }

      parsedData = data.data;
      const imagesInMd = data.data.imageMapping ? Object.keys(data.data.imageMapping).length : 0;
      const matched = data.matchedWord;

      previewContent.innerHTML =
        '<div style="margin-bottom:8px"><b>\\u2705 \\u89E3\\u6790\\u6210\\u529F</b></div>' +
        '<div><b>\\u6807\\u9898:</b> ' + escHtml(parsedData.title || '\\u672A\\u586B') + '</div>' +
        '<div><b>\\u6458\\u8981:</b> ' + escHtml(parsedData.summary || '\\u672A\\u586B') + '</div>' +
        '<div><b>\\u6807\\u7B7E:</b> ' + (parsedData.tags && parsedData.tags.length ? escHtml(parsedData.tags.join('\\u3001')) : '\\u672A\\u586B') + '</div>' +
        '<div><b>\\u5C01\\u9762:</b> ' + (parsedData.cover ? '<img src="' + parsedData.cover + '" style="height:40px;border-radius:4px;vertical-align:middle">' : '\\u672A\\u586B') + '</div>' +
        '<div><b>\\u5185\\u5BB9\\u5B57\\u6570:</b> ' + (parsedData.content || '').length + ' \\u5B57</div>' +
        (imagesInMd > 0 ? '<div><b>\\u56FE\\u7247:</b> \\u5DF2\\u89E3\\u6790 ' + imagesInMd + ' \\u5F20\\uFF0C\\u5C06\\u81EA\\u52A8\\u4E0A\\u4F20</div>' : '') +
        (matched ? '<div style="color:var(--err);margin-top:4px">\\u26A0 \\u542B\\u6545\\u611F\\u8BCD\\uFF1A' + escHtml(matched) + '\\uFF0C\\u5BFC\\u5165\\u540E\\u5C06\\u8FDB\\u5165\\u5BA1\\u6838</div>' : '') +
        '<div style="margin-top:8px;font-size:12px;color:var(--t2)">\\u70B9\\u51FB\\u201C\\u5BFC\\u5165\\u201D\\u540E\\u5C06\\u5141\\u8BB8\\u7F16\\u8F91\\u5185\\u5BB9\\uFF0C\\u7136\\u540E\\u518D\\u53D1\\u5E03</div>';

      preview.style.display = 'block';
      progressDiv.style.display = 'none';
      parseBtn.textContent = '\\u5BFC\\u5165';
      parseBtn.disabled = false;

    } catch (e) {
      errorDiv.textContent = '\\u7F51\\u7EDC\\u9519\\u8BEF: ' + e.message;
      errorDiv.style.display = 'block';
      progressDiv.style.display = 'none';
      parseBtn.disabled = false;
    }
  });

  parseBtn.addEventListener('click', async () => {
    if (!parsedData) return;
    bg.remove();

    // 填充到编辑器，然后发布
    const page = document.getElementById('home');
    page.innerHTML = `
    <div class="container">
      <div class="section-head">
        <h2 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          导入预览 - ${escHtml(parsedData.title)}
        </h2>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn btn-ghost" onclick="location.hash='#/'">取消</button>
          <button class="btn btn-primary" id="import-publish-btn">发布</button>
        </div>
      </div>
      <div class="card card-body" style="margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="post-title" value="${escHtml(parsedData.title)}">
        </div>
        <div class="form-group">
          <label class="form-label">摘要</label>
          <input type="text" class="form-input" id="post-summary" placeholder="一句话简介（可选）" value="${escHtml(parsedData.summary)}">
        </div>
        <div class="form-group">
          <label class="form-label">标签</label>
          <div class="tags-input-wrap" id="tags-wrap">
            <input type="text" id="tag-input" placeholder="输入标签按 Enter" />
          </div>
        </div>
      </div>
      <div style="margin-bottom:12px;font-size:13px;color:var(--t2)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        正文内容（可编辑）
      </div>
      <div id="editor-wrap">
        <div class="toolbar" id="editor-toolbar"></div>
        <textarea class="md-editor" id="md-editor" style="min-height:400px">${escHtml(parsedData.content)}</textarea>
      </div>
    </div>`;

    // 填充标签
    const tagsWrap = document.getElementById('tags-wrap');
    const tagInput = document.getElementById('tag-input');
    const addTag = (tag) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = tag + '<button onclick="this.parentElement.remove()">\\u00D7</button>';
      tagsWrap.insertBefore(chip, tagInput);
    };
    if (parsedData.tags) parsedData.tags.forEach(t => addTag(t));

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val) { addTag(val); tagInput.value = ''; }
      }
    });

    document.getElementById('import-publish-btn').addEventListener('click', async () => {
      const title = document.getElementById('post-title').value.trim();
      const summary = document.getElementById('post-summary').value.trim();
      const content = document.getElementById('md-editor').value;
      const tags = [...document.querySelectorAll('.tag-chip')].map(c => c.textContent.replace('\\u00D7', '').trim()).filter(Boolean);

      if (!title || !content) { UI.showToast('标题和内容不能为空', 'err'); return; }

      const btn = document.getElementById('import-publish-btn');
      btn.disabled = true;
      btn.textContent = '发布中...';

      try {
        const res = await fetch('/api/import/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': tok() },
          body: JSON.stringify({ title, summary, content, tags })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          UI.showToast(data.message || '\\u53D1\\u5E03\\u5931\\u8D25', 'err');
          btn.disabled = false;
          btn.textContent = '发布';
          return;
        }
        if (data.data.status === 'pending') {
          UI.showToast('\\u6587\\u7AE0\\u5DF2\\u63D0\\u4EA4\\uFF0C\\u7B49\\u5F85\\u5BA1\\u6838', 'info');
          setTimeout(() => location.hash = '#/', 1000);
        } else {
          UI.showToast('\\u6587\\u7AE0\\u5BFC\\u5165\\u5E76\\u53D1\\u5E03\\u6210\\u529F', 'ok');
          setTimeout(() => location.hash = '#/post/' + data.data.id, 800);
        }
      } catch (e) {
        UI.showToast(e.message, 'err');
        btn.disabled = false;
        btn.textContent = '发布';
      }
    });
  });

  document.getElementById('import-cancel').addEventListener('click', () => bg.remove());
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
}

// ========== WRITE / EDIT POST ==========
'''

content = content.replace(
    '// ========== WRITE / EDIT POST ==========\nlet autoSaveTimer = null;',
    import_code
)

with open('public/js/pages2.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\\u5199\\u5165\\u5B8C\\u6210")
