// ========== WRITE / EDIT POST ==========
let autoSaveTimer = null;
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
      const typeMap = {
        comment: ['评论了你的文章', '💬'], like: ['赞了你的文章', '❤️'], favorite: ['收藏了你的文章', '⭐'],
        follow: ['关注了你', '👤'], reply: ['回复了你的评论', '💬'],
        review: ['提交了新文章待审核', '📝'], approve: ['你的文章已通过审核', '✅'], reject: ['你的文章被拒绝了', '❌'],
        profile_review: ['提交了资料修改待审核', '👤'], profile_approve: ['你的资料修改已通过', '✅'], profile_reject: ['你的资料修改被拒绝了', '❌'],
        admin_edit: ['管理员修改了你的文章', '🔧']
      };
      const [action, icon] = typeMap[n.type] || ['互动了', '🔔'];
      // review/admin_edit 类型：管理员收到，链接指向文章详情；approve/reject：作者收到
      let link;
      if (n.type === 'review' || n.type === 'approve' || n.type === 'reject' || n.type === 'admin_edit') {
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
