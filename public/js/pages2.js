// ========== IMPORT MARKDOWN ==========
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
    <div id="import-progress" style="display:none;margin:8px 0;color:var(--t2);font-size:13px">… 正在解析和上传图片…</div>
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
        errorDiv.textContent = data.message || '\u89E3\u6790\u5931\u8D25';
        errorDiv.style.display = 'block';
        progressDiv.style.display = 'none';
        parseBtn.disabled = false;
        return;
      }

      parsedData = data.data;
      const imagesInMd = data.data.imageMapping ? Object.keys(data.data.imageMapping).length : 0;
      const matched = data.matchedWord;

      previewContent.innerHTML =
        '<div style="margin-bottom:8px"><b>\u2705 \u89E3\u6790\u6210\u529F</b></div>' +
        '<div><b>\u6807\u9898:</b> ' + escHtml(parsedData.title || '\u672A\u586B') + '</div>' +
        '<div><b>\u6458\u8981:</b> ' + escHtml(parsedData.summary || '\u672A\u586B') + '</div>' +
        '<div><b>\u6807\u7B7E:</b> ' + (parsedData.tags && parsedData.tags.length ? escHtml(parsedData.tags.join('\u3001')) : '\u672A\u586B') + '</div>' +
        '<div><b>\u5C01\u9762:</b> ' + (parsedData.cover ? '<img src="' + parsedData.cover + '" style="height:40px;border-radius:4px;vertical-align:middle">' : '\u672A\u586B') + '</div>' +
        '<div><b>\u5185\u5BB9\u5B57\u6570:</b> ' + (parsedData.content || '').length + ' \u5B57</div>' +
        (imagesInMd > 0 ? '<div><b>\u56FE\u7247:</b> \u5DF2\u89E3\u6790 ' + imagesInMd + ' \u5F20\uFF0C\u5C06\u81EA\u52A8\u4E0A\u4F20</div>' : '') +
        (matched ? '<div style="color:var(--err);margin-top:4px">\u26A0 \u542B\u6545\u611F\u8BCD\uFF1A' + escHtml(matched) + '\uFF0C\u5BFC\u5165\u540E\u5C06\u8FDB\u5165\u5BA1\u6838</div>' : '') +
        '<div style="margin-top:8px;font-size:12px;color:var(--t2)">\u70B9\u51FB\u201C\u5BFC\u5165\u201D\u540E\u5C06\u5141\u8BB8\u7F16\u8F91\u5185\u5BB9\uFF0C\u7136\u540E\u518D\u53D1\u5E03</div>';

      preview.style.display = 'block';
      progressDiv.style.display = 'none';
      parseBtn.textContent = '\u5BFC\u5165';
      parseBtn.disabled = false;

    } catch (e) {
      errorDiv.textContent = '\u7F51\u7EDC\u9519\u8BEF: ' + e.message;
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
      chip.innerHTML = tag + '<button onclick="this.parentElement.remove()">\u00D7</button>';
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
      const tags = [...document.querySelectorAll('.tag-chip')].map(c => c.textContent.replace('\u00D7', '').trim()).filter(Boolean);

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
          UI.showToast(data.message || '\u53D1\u5E03\u5931\u8D25', 'err');
          btn.disabled = false;
          btn.textContent = '发布';
          return;
        }
        if (data.data.status === 'pending') {
          UI.showToast('\u6587\u7AE0\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u5BA1\u6838', 'info');
          setTimeout(() => location.hash = '#/', 1000);
        } else {
          UI.showToast('\u6587\u7AE0\u5BFC\u5165\u5E76\u53D1\u5E03\u6210\u529F', 'ok');
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

let currentTags = [];
let coverDataUrl = '';
let currentEditPostId = null; // 当前编辑的文章ID（编辑模式时设置）

// Session draft: save/restore new post content across page navigations
function saveSessionDraft() {
  const title = document.getElementById('post-title')?.value || '';
  const summary = document.getElementById('post-summary')?.value || '';
  const content = document.getElementById('md-editor')?.value || '';
  if (!title && !content) return; // Don't save empty drafts
  try {
    sessionStorage.setItem('write-draft', JSON.stringify({ title, summary, content, tags: currentTags, cover: coverDataUrl }));
  } catch {}
}

function clearSessionDraft() {
  sessionStorage.removeItem('write-draft');
}

async function renderWrite() {
  const page = document.getElementById('home');
  
  // Check if editing existing post
  const editId = location.hash.includes('?edit=') ? location.hash.split('?edit=')[1] : null;
  currentEditPostId = editId; // 保存当前编辑的文章ID
  let editPost = null;
  if (editId) {
    editPost = await API.getPost(editId);
  }
  
  // New post: restore from session draft if exists
  let sessionDraft = null;
  if (!editId) {
    try {
      const saved = sessionStorage.getItem('write-draft');
      if (saved) sessionDraft = JSON.parse(saved);
    } catch {}
  }
  
  currentTags = editPost?.pending_tags ? JSON.parse(editPost.pending_tags) : (editPost?.tags || sessionDraft?.tags || []);
  coverDataUrl = editPost?.pending_cover || editPost?.cover || sessionDraft?.cover || '';
  const draftTitle = editPost?.pending_title || editPost?.title || sessionDraft?.title || '';
  const draftSummary = editPost?.pending_summary || editPost?.summary || sessionDraft?.summary || '';
  const draftContent = editPost?.pending_content || editPost?.content || sessionDraft?.content || '';
  
  page.innerHTML = `
    <div class="container">
      <div class="section-head">
        <h2 class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>${editId ? '编辑文章' : '写新文章'}</h2>
        <div style="display:flex;gap:10px;align-items:center">
          ${!editId ? '<button class="btn btn-ghost" onclick="showImportModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>导入 Markdown</button>' : ''}
          <span class="autosave" id="autosave-status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>自动保存</span>
          <button class="btn btn-ghost" onclick="location.hash='#/'">取消</button>
          ${editId ? `<button class="btn btn-primary" onclick="publishPost('${editId}')">保存修改</button>` : '<button class="btn btn-primary" onclick="publishPost()">发布</button>'}
        </div>
      </div>
      
      <div class="card card-body" style="margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="post-title" placeholder="文章标题..." value="${escHtml(draftTitle)}">
        </div>
        <div class="form-group">
          <label class="form-label">摘要</label>
          <input type="text" class="form-input" id="post-summary" placeholder="一句话简介（可选）" value="${escHtml(draftSummary)}">
        </div>
        <div class="form-group">
          <label class="form-label">标签</label>
          <div class="tags-input-wrap" id="tags-wrap">
            ${currentTags.map(t => `<span class="tag-chip">${t}<button onclick="removeTag('${t}')">×</button></span>`).join('')}
            <input type="text" id="tag-input" placeholder="输入标签按 Enter" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">封面图片（可选）</label>
          <div class="img-upload-area" id="cover-drop" onclick="document.getElementById('cover-file').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p>点击上传封面图片</p>
          </div>
          <div class="img-preview ${coverDataUrl ? '' : 'hidden'}" id="cover-preview">
            ${coverDataUrl ? `<img src="${coverDataUrl}" alt="cover"><button class="img-preview-rm" onclick="clearCover()">✕ 移除</button>` : ''}
          </div>
          <input type="file" id="cover-file" accept="image/*" class="hidden">
        </div>
      </div>
      
      <div class="editor-wrap">
        <div class="editor-pane">
          <div class="editor-toolbar" id="editor-toolbar">
            <button onclick="insertMd('**','**')" title="加粗"><strong>B</strong></button>
            <button onclick="insertMd('*','*')" title="斜体"><em>I</em></button>
            <button onclick="insertMd('~~','~~')" title="删除线"><s>S</s></button>
            <span class="toolbar-sep"></span>
            <button onclick="insertMd('## ','')" title="标题">H</button>
            <button onclick="insertMd('> ','')" title="引用">"</button>
            <button onclick="insertMd('- ','')" title="列表">•</button>
            <button onclick="insertMd('1. ','')" title="有序列表">1.</button>
            <span class="toolbar-sep"></span>
            <button onclick="insertMd('\`\`\`\\n','\`\`\`')" title="代码块">&lt;/&gt;</button>
            <button onclick="insertMd('[链接文字](',')')" title="链接">🔗</button>
            <button onclick="insertImageToMd()" title="图片">🖼</button>
            <span class="toolbar-sep"></span>
            <button onclick="insertTable()" title="表格">▦</button>
          </div>
          <div class="editor-pane-label">Markdown 编辑</div>
          <textarea id="md-editor" placeholder="开始写作...&#10;&#10;支持 Markdown 语法，可直接 Ctrl+V 粘贴图片">${escHtml(draftContent)}</textarea>
          <div class="editor-footer" id="editor-footer">
            <span id="word-count">0 字</span>
            <span id="char-count">0 字符</span>
            <span id="read-time">约 0 分钟阅读</span>
          </div>
        </div>
        <div class="editor-pane">
          <div class="editor-pane-label">实时预览</div>
          <div id="md-preview" class="md-body"></div>
        </div>
      </div>
      
      <!-- 底部吸底操作栏 -->
      <div class="editor-bottom-bar" id="editor-bottom-bar">
        <div class="editor-bottom-bar-inner">
          <span id="bottom-word-count" style="font-size:12px;color:var(--t3)">0 字</span>
          <div style="display:flex;gap:10px;align-items:center">
            <button class="btn btn-ghost" onclick="location.hash='#/'">取消</button>
            ${editId ? `<button class="btn btn-primary" onclick="publishPost('${editId}')">保存修改</button>` : '<button class="btn btn-primary" onclick="publishPost()">发布</button>'}
          </div>
        </div>
      </div>
    </div>
  `;
  page.classList.add('active');
  
  // Tags input
  document.getElementById('tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = e.target.value.trim().replace(',', '');
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        refreshTagsUI();
        saveSessionDraft();
        e.target.value = '';
      }
    }
  });
  
  // Save on title/summary input
  document.getElementById('post-title').addEventListener('input', saveSessionDraft);
  document.getElementById('post-summary').addEventListener('input', saveSessionDraft);
  
  // Editor live preview
  const editor = document.getElementById('md-editor');
  const preview = document.getElementById('md-preview');
  
  function updatePreview() {
    preview.innerHTML = marked.parse(editor.value || '');
    preview.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    updateWordCount();
  }
  
  function updateWordCount() {
    const text = editor.value || '';
    // Chinese character count
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    // Word count (English words)
    const eng = text.replace(/[\u4e00-\u9fff]/g, '').trim().split(/\s+/).filter(Boolean).length;
    const total = cjk + eng;
    const chars = text.length;
    const readMin = Math.max(1, Math.ceil(total / 300));
    const wc = document.getElementById('word-count');
    const cc = document.getElementById('char-count');
    const rt = document.getElementById('read-time');
    if (wc) wc.textContent = total + ' 字';
    if (cc) cc.textContent = chars + ' 字符';
    if (rt) rt.textContent = '约 ' + readMin + ' 分钟阅读';
    const bwc = document.getElementById('bottom-word-count');
    if (bwc) bwc.textContent = total + ' 字 · ' + chars + ' 字符';
  }

  updatePreview();
  editor.addEventListener('input', () => {
    updatePreview();
    triggerAutoSave();
    saveSessionDraft();
  });

  // Bottom bar: show when top buttons scroll out of view
  const sectionHead = document.querySelector('.section-head');
  const bottomBar = document.getElementById('editor-bottom-bar');
  if (sectionHead && bottomBar) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          bottomBar.classList.remove('visible');
        } else {
          bottomBar.classList.add('visible');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    observer.observe(sectionHead);
  }

  // Image paste upload
  editor.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        try {
          UI.showToast('正在上传图片...', '');
          const url = await API.uploadImage(file);
          const pos = editor.selectionStart;
          const before = editor.value.substring(0, pos);
          const after = editor.value.substring(pos);
          editor.value = before + `![图片](${url})\n` + after;
          updatePreview();
          UI.showToast('图片已上传', 'ok');
        } catch {
          UI.showToast('图片上传失败', 'err');
        }
        break;
      }
    }
  });
  
  // Cover image
  document.getElementById('cover-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      coverDataUrl = await API.uploadImage(file);
      const prev = document.getElementById('cover-preview');
      prev.innerHTML = `<img src="${coverDataUrl}" alt="cover"><button class="img-preview-rm" onclick="clearCover()">✕ 移除</button>`;
      prev.classList.remove('hidden');
    } catch {
      UI.showToast('图片上传失败', 'err');
    }
  });
}

function clearCover() {
  coverDataUrl = '';
  const prev = document.getElementById('cover-preview');
  prev.innerHTML = '';
  prev.classList.add('hidden');
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  refreshTagsUI();
}

function refreshTagsUI() {
  const input = document.getElementById('tag-input');
  const wrap = document.getElementById('tags-wrap');
  const existingChips = wrap.querySelectorAll('.tag-chip');
  existingChips.forEach(c => c.remove());
  
  currentTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${t}<button onclick="removeTag('${t}')">×</button>`;
    wrap.insertBefore(chip, input);
  });
}

function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  const status = document.getElementById('autosave-status');
  if (status) status.className = 'autosave saving';
  autoSaveTimer = setTimeout(async () => {
    const title = document.getElementById('post-title')?.value || '';
    const content = document.getElementById('md-editor')?.value || '';
    const summary = document.getElementById('post-summary')?.value || '';
    if (title.length > 0 || content.length > 10) {
      await API.saveDraft(title, summary, content, currentTags, currentEditPostId);
      const s = document.getElementById('autosave-status');
      if (s) {
        s.className = 'autosave saved';
        s.textContent = '✓ 已自动保存草稿';
        setTimeout(() => {
          if (s) { s.className = 'autosave'; s.textContent = '自动保存'; }
        }, 2000);
      }
    }
  }, 2000);
}

async function publishPost(editId) {
  const title = document.getElementById('post-title').value.trim();
  const summary = document.getElementById('post-summary').value.trim();
  const content = document.getElementById('md-editor').value.trim();
  
  if (!title || !content) {
    UI.showToast('标题和内容不能为空', 'err');
    return;
  }
  
  try {
    let res;
    if (editId) {
      res = await API.updatePost(editId, title, summary, content, currentTags, coverDataUrl, 'published');
    } else {
      res = await API.createPost(title, summary, content, currentTags, coverDataUrl);
    }
    
    if (!res.success) {
      UI.showToast(res.message || res.error || '操作失败', 'err');
      return;
    }
    
    clearTimeout(autoSaveTimer);
    clearSessionDraft();
    
    // 发布成功后删除对应草稿
    if (editId) {
      try { await API.deleteDraft('post:' + editId); } catch {}
    }
    
    console.log('[DEBUG] publishPost response:', JSON.stringify(res, null, 2));
    const newPost = res.data;
    console.log('[DEBUG] newPost:', newPost);
    const postId = newPost?.id || editId;
    const status = newPost?.status;
    
    if (!postId) {
      UI.showToast('发布成功，但无法获取文章ID', 'err');
      console.error('Missing postId in response:', res);
      return;
    }
    
    if (editId) {
      // 编辑模式
      if (res.message && res.message.includes('审核')) {
        UI.showToast(res.message, 'ok');
      } else {
        UI.showToast('修改已保存', 'ok');
      }
    } else {
      // 新发布
      if (status === 'pending') {
        UI.showToast('文章已提交，等待审核', 'info');
      } else {
        UI.showToast('文章发布成功', 'ok');
      }
    }
    setTimeout(() => location.hash = `#/post/${postId}`, 600);
  } catch (err) {
    UI.showToast(err.message || '发布失败', 'err');
  }
}

// ========== DRAFTS PAGE ==========
async function renderDrafts() {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div class="section-head">
        <h2 class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>草稿箱</h2>
      </div>
      <div id="drafts-list"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const drafts = await API.getDrafts();
    if (!drafts || drafts.length === 0) {
      document.getElementById('drafts-list').innerHTML = '<div class="empty"><h3>暂无草稿</h3><p>在写作时系统会自动保存草稿</p></div>';
      return;
    }
    
    document.getElementById('drafts-list').innerHTML = drafts.map(d => `
      <div class="card card-body" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:600;margin-bottom:4px">${d.title || '（无标题）'}</div>
          <div style="font-size:12px;color:var(--t3)">${UI.formatTimeAgo(d.updated_at)}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="loadDraft('${d.id}', '${encodeURIComponent(d.title)}', '${encodeURIComponent(d.content)}', '${encodeURIComponent(d.summary || '')}')">继续编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDraft('${d.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch {
    document.getElementById('drafts-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

function loadDraft(id, title, content, summary) {
  // Store to sessionStorage and navigate to write page
  sessionStorage.setItem('draft_title', decodeURIComponent(title));
  sessionStorage.setItem('draft_content', decodeURIComponent(content));
  sessionStorage.setItem('draft_summary', decodeURIComponent(summary));
  sessionStorage.setItem('draft_id', id);
  location.hash = '#/write';
  setTimeout(() => {
    const titleEl = document.getElementById('post-title');
    const contentEl = document.getElementById('md-editor');
    const summaryEl = document.getElementById('post-summary');
    if (titleEl) titleEl.value = decodeURIComponent(title);
    if (contentEl) contentEl.value = decodeURIComponent(content);
    if (summaryEl) summaryEl.value = decodeURIComponent(summary);
  }, 300);
}

async function deleteDraft(id) {
  if (!await UI.showConfirm({ title: '删除草稿', message: '确定删除此草稿吗？删除后将无法恢复。', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deleteDraft(id);
    UI.showToast('草稿已删除', 'ok');
    renderDrafts();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

// ========== FAVORITES PAGE ==========
async function renderFavorites() {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div class="section-head">
        <h2 class="section-title"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>我的收藏</h2>
      </div>
      <div id="fav-list" class="posts-grid"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const posts = await API.getMyFavorites();
    renderPostsList(Array.isArray(posts) ? posts : [], 'fav-list');
  } catch {
    document.getElementById('fav-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

// ========== FOLLOWS PAGE ==========
async function renderFollows() {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div class="section-head">
        <h2 class="section-title"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>关注的人</h2>
      </div>
      <div id="follows-list"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const users = await API.getMyFollowing();
    
    if (!users || users.length === 0) {
      document.getElementById('follows-list').innerHTML = '<div class="empty"><h3>还没有关注任何人</h3><p>去发现有趣的作者吧</p></div>';
      return;
    }
    
    document.getElementById('follows-list').innerHTML = users.map(u => `
      <div class="card card-body" style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <div class="avatar-lg">${u.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:16px">${u.name}</div>
          <div style="font-size:13px;color:var(--t3);margin-top:2px">${u.bio || '暂无简介'}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="location.hash='#/profile/${u.id}'">查看主页</button>
          <button class="follow-btn following" onclick="unfollowUser('${u.id}', this)">已关注</button>
        </div>
      </div>
    `).join('');
  } catch {
    document.getElementById('follows-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function unfollowUser(userId, btn) {
  try {
    await API.unfollow(userId);
    const card = btn.closest('.card');
    if (card) {
      card.style.transition = 'all .3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => card.remove(), 300);
      // 如果列表清空了，显示空状态
      setTimeout(() => {
        const list = document.getElementById('follows-list');
        if (list && list.children.length === 0) {
          list.innerHTML = '<div class="empty"><h3>还没有关注任何人</h3><p>去发现有趣的作者吧</p></div>';
        }
      }, 350);
    }
    UI.showToast('已取消关注', 'info');
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function followUser(userId, btn) {
  try {
    await API.follow(userId);
    btn.className = 'follow-btn following';
    btn.textContent = '已关注';
    btn.onclick = () => unfollowUser(userId, btn);
    UI.showToast('已关注', 'ok');
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

// ========== NOTIFICATIONS PAGE ==========
async function renderNotifications(pageNum = 1) {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div class="section-head" style="display:flex;justify-content:space-between;align-items:center">
        <h2 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          通知中心
        </h2>
        <button class="btn btn-sm" onclick="markAllRead()" style="background:var(--primary);color:white;border:1px solid rgba(255,255,255,.2);box-shadow:0 2px 8px rgba(99,102,241,.3);padding:8px 16px;border-radius:8px">全部已读</button>
      </div>
      <div id="notif-list" class="notif-list">
        <div class="skeleton skel-line"></div>
      </div>
    </div>
  `;
  page.classList.add('active');

  try {
    const res = await API.getNotifications(pageNum);
    const list = res.data || [];
    const container = document.getElementById('notif-list');
    if (!list.length) {
      container.innerHTML = '<div class="empty"><h3>暂无通知</h3></div>';
      return;
    }
    container.innerHTML = list.map(n => {
      // ban/unban：系统通知风格，不走通用格式
      if (n.type === 'ban') {
        return `
        <a href="${n.post_id ? `#/post/${n.post_id}` : '#/'}" class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}">
          <div class="notif-icon">🔒</div>
          <div class="notif-body">
            <div class="notif-main">你的文章${n.post_title ? `《${escHtml(n.post_title)}》` : ''}已被封禁${n.content ? `，${escHtml(n.content)}` : ''}</div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </a>`;
      }
      if (n.type === 'unban') {
        return `
        <a href="${n.post_id ? `#/post/${n.post_id}` : '#/'}" class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}">
          <div class="notif-icon">🔓</div>
          <div class="notif-body">
            <div class="notif-main">你的文章${n.post_title ? `《${escHtml(n.post_title)}》` : ''}已解除封禁</div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </a>`;
      }
      // 用户账号封禁/解封
      if (n.type === 'user_ban') {
        return `
        <div class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}" style="cursor:default">
          <div class="notif-icon">🚫</div>
          <div class="notif-body">
            <div class="notif-main" style="color:#f87171">你的账号已被封禁</div>
            ${n.content ? `<div class="notif-msg" style="font-size:12px;color:var(--t2);margin-top:3px">${escHtml(n.content)}</div>` : ''}
            <div style="margin-top:8px">
              <button class="btn btn-xs" style="background:rgba(99,102,241,.2);color:var(--accent);border:1px solid rgba(99,102,241,.4)" onclick="event.stopPropagation();showAppealModal()">提交申诉</button>
            </div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </div>`;
      }
      if (n.type === 'user_unban') {
        return `
        <div class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}" style="cursor:default">
          <div class="notif-icon">✅</div>
          <div class="notif-body">
            <div class="notif-main" style="color:#4ade80">你的账号封禁已解除，欢迎回来！</div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </div>`;
      }
      if (n.type === 'appeal') {
        return `
        <a href="#/admin" class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}">
          <div class="notif-icon">📨</div>
          <div class="notif-body">
            <div class="notif-main"><strong>${escHtml(n.from_name||'用户')}</strong> 提交了解封申诉</div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </a>`;
      }
      if (n.type === 'appeal_approved') {
        return `
        <div class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}" style="cursor:default">
          <div class="notif-icon">🎉</div>
          <div class="notif-body">
            <div class="notif-main" style="color:#4ade80">你的解封申诉已通过，账号已恢复正常！</div>
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </div>`;
      }
      if (n.type === 'appeal_rejected') {
        return `
        <div class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}" style="cursor:default">
          <div class="notif-icon">❌</div>
          <div class="notif-body">
            <div class="notif-main">你的解封申诉已被拒绝</div>
            ${n.content ? `<div class="notif-msg" style="font-size:12px;color:var(--t2);margin-top:3px">${escHtml(n.content)}</div>` : ''}
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </div>`;
      }
      const typeMap = {
        comment: ['评论了你的文章', '💬'], like: ['赞了你的文章', '❤️'], favorite: ['收藏了你的文章', '⭐'],
        follow: ['关注了你', '👤'], reply: ['回复了你的评论', '💬'],
        review: ['提交了新文章待审核', '📝'], approve: ['你的文章已通过审核', '✅'], reject: ['你的文章被拒绝了', '❌'],
        profile_review: ['提交了资料修改待审核', '👤'], profile_approve: ['你的资料修改已通过', '✅'], profile_reject: ['你的资料修改被拒绝了', '❌']
      };
      const [action, icon] = typeMap[n.type] || ['互动了', '🔔'];
      // review 类型：管理员收到，链接指向文章详情；approve/reject：作者收到
      let link;
      if (n.type === 'review' || n.type === 'approve' || n.type === 'reject') {
        link = n.post_id ? `#/post/${n.post_id}` : '#/';
      } else {
        link = n.post_id ? `#/post/${n.post_id}` : `#/profile/${n.from_user_id}`;
      }
      return `
        <a href="${link}" class="notif-item${n.is_read ? '' : ' unread'}" data-nid="${n.id}">
          <div class="notif-icon">${icon}</div>
          <div class="notif-body">
            <div class="notif-main"><strong>${escHtml(n.from_name)}</strong> ${action}${n.post_title ? `《${escHtml(n.post_title)}》` : ''}</div>
            ${n.content ? `<div class="notif-msg" style="font-size:12px;color:var(--t2);margin-top:2px">${escHtml(n.content)}</div>` : ''}
            <div class="notif-time">${UI.formatTimeAgo(n.created_at)}</div>
          </div>
          ${n.is_read ? '' : '<span class="notif-dot"></span>'}
        </a>`;
    }).join('');

    container.querySelectorAll('.notif-item.unread').forEach(el => {
      el.addEventListener('click', async () => {
        await API.markNotifRead(parseInt(el.dataset.nid));
        el.classList.remove('unread');
        el.querySelector('.notif-dot')?.remove();
      });
    });
  } catch {
    document.getElementById('notif-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function markAllRead() {
  try {
    await API.markNotifRead();
    document.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      el.querySelector('.notif-dot')?.remove();
    });
    document.getElementById('notif-badge').style.display = 'none';
    UI.showToast('已全部标记为已读', 'ok');
  } catch {}
}

// ========== EDITOR TOOLBAR HELPERS ==========
function insertMd(before, after) {
  const editor = document.getElementById('md-editor');
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end) || '文本';
  const replacement = before + selected + after;
  editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
  editor.focus();
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selected.length;
  editor.dispatchEvent(new Event('input'));
}

async function insertImageToMd() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      UI.showToast('正在上传图片...', '');
      const url = await API.uploadImage(file);
      const editor = document.getElementById('md-editor');
      const pos = editor.selectionStart;
      const before = editor.value.substring(0, pos);
      const after = editor.value.substring(pos);
      editor.value = before + `![图片](${url})\n` + after;
      editor.dispatchEvent(new Event('input'));
      UI.showToast('图片已上传', 'ok');
    } catch {
      UI.showToast('图片上传失败', 'err');
    }
  };
  input.click();
}

function insertTable() {
  const editor = document.getElementById('md-editor');
  const pos = editor.selectionStart;
  const table = '\n| 列1 | 列2 | 列3 |\n|------|------|------|\n| 内容 | 内容 | 内容 |\n';
  editor.value = editor.value.substring(0, pos) + table + editor.value.substring(pos);
  editor.focus();
  editor.dispatchEvent(new Event('input'));
}

// ===================== 申诉弹窗 =====================
async function showAppealModal() {
  // 检查是否已有待处理申诉
  try {
    const data = await API.getMyAppeal();
    const appeal = data.data?.appeal;
    if (appeal && appeal.status === 'pending') {
      UI.showToast('你已有一个待处理的申诉，请等待管理员处理', 'warn');
      return;
    }
  } catch {}

  document.getElementById('appeal-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'appeal-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:var(--glass-strong,rgba(20,20,40,.92));border:1px solid var(--glass-b);border-radius:20px;padding:28px 32px;width:420px;max-width:94vw;box-shadow:0 8px 40px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:36px;height:36px;background:rgba(99,102,241,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">📨</div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--t1)">提交解封申诉</div>
          <div style="font-size:12px;color:var(--t3);margin-top:2px">管理员将尽快处理你的申诉</div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:13px;color:var(--t2);display:block;margin-bottom:6px">申诉理由 <span style="color:#f87171">*</span></label>
        <textarea id="appeal-reason" rows="4" placeholder="请详细说明你的申诉理由，包括：为什么认为封禁有误，或者承诺改正的内容等..." style="width:100%;box-sizing:border-box;background:var(--glass);border:1px solid var(--glass-b);border-radius:10px;color:var(--t1);padding:10px 12px;font-size:14px;resize:vertical;font-family:inherit"></textarea>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="appeal-cancel" class="btn btn-ghost">取消</button>
        <button id="appeal-submit" class="btn btn-primary">提交申诉</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('appeal-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('appeal-submit').onclick = async () => {
    const reason = document.getElementById('appeal-reason').value.trim();
    if (!reason) { UI.showToast('请填写申诉理由', 'warn'); return; }
    const btn = document.getElementById('appeal-submit');
    btn.disabled = true; btn.textContent = '提交中...';
    try {
      const res = await API.submitAppeal(reason);
      if (res.success) {
        overlay.remove();
        UI.showToast('申诉已提交，请等待管理员处理', 'ok');
      } else {
        UI.showToast(res.message || '提交失败', 'err');
        btn.disabled = false; btn.textContent = '提交申诉';
      }
    } catch {
      UI.showToast('提交失败', 'err');
      btn.disabled = false; btn.textContent = '提交申诉';
    }
  };
}
