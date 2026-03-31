// ========== LOGIN & REGISTER PAGES ==========
function renderLogin() {
  const page = document.getElementById('login');
  page.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8 4v7H4l8 8 8-8h-4V4L12 2z"></path></svg></div>
        <h2 class="auth-title">登录</h2>
        <p class="auth-sub">欢迎回到 Glass Blog</p>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" class="form-input" id="login-email" placeholder="user@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" id="login-pwd" placeholder="••••••" required>
          </div>
          <button type="submit" class="btn btn-primary w-full" style="margin-bottom:14px">登录</button>
        </form>
        <div style="text-align:center;font-size:13px;color:var(--t2)">
          还没有账号？<a href="#/register" style="color:var(--accent)">注册</a>
        </div>
      </div>
    </div>
  `;
  page.classList.add('active');
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pwd = document.getElementById('login-pwd').value;
    try {
      const res = await API.login(email, pwd);
      if (!res.success) {
        UI.showToast(res.message || '登录失败', 'err');
      } else {
        sessionStorage.setItem('token', res.token);
        currentUser = res.user;
        UI.showToast('登录成功！', 'ok');
        setTimeout(() => {
          location.hash = '#/';
          location.reload();
        }, 500);
      }
    } catch (err) {
      UI.showToast('登录失败', 'err');
    }
  });
}

function renderRegister() {
  const page = document.getElementById('login');
  page.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path></svg></div>
        <h2 class="auth-title">注册</h2>
        <p class="auth-sub">加入 Glass Blog 社区</p>
        <form id="reg-form">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" id="reg-name" placeholder="Your Name" required>
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" class="form-input" id="reg-email" placeholder="user@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" id="reg-pwd" placeholder="至少 6 位" required minlength="6">
          </div>
          <button type="submit" class="btn btn-primary w-full" style="margin-bottom:14px">注册</button>
        </form>
        <div style="text-align:center;font-size:13px;color:var(--t2)">
          已有账号？<a href="#/login" style="color:var(--accent)">登录</a>
        </div>
      </div>
    </div>
  `;
  page.classList.add('active');
  
  document.getElementById('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pwd = document.getElementById('reg-pwd').value;
    try {
      const res = await API.register(email, pwd, name);
      if (res.error) {
        UI.showToast(res.error, 'err');
      } else {
        UI.showToast('注册成功，请登录', 'ok');
        setTimeout(() => location.hash = '#/login', 500);
      }
    } catch (err) {
      UI.showToast('注册失败', 'err');
    }
  });
}

// ========== HOME PAGE ==========
async function renderHome(pageNum = 1, tagFilter = '') {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div id="announcement-bar" class="announcement-bar" style="display:none"></div>
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input type="text" class="search-input" id="search-input" placeholder="搜索文章..." value="${tagFilter ? '' : ''}" />
      </div>
      <div id="tag-bar" class="tag-bar"></div>
      <div class="section-head">
        <h1 class="section-title" id="home-section-title"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v2H3V3z"></path><path d="M3 8h18v2H3V8z"></path><path d="M3 13h18v2H3v-2z"></path><path d="M3 18h18v2H3v-2z"></path></svg>${tagFilter ? '分类: ' + tagFilter : '最新文章'}</h1>
      </div>
      <div id="posts-container" class="posts-grid"></div>
      <div id="pagination"></div>
    </div>
  `;
  page.classList.add('active');
  
  // Load announcements
  try {
    const anns = await API.getAnnouncements();
    if (anns && anns.length > 0) {
      const bar = document.getElementById('announcement-bar');
      bar.style.display = 'block';
      const first = anns[0];
      bar.innerHTML = `
        <div class="announcement-content">
          <span class="announcement-badge">📢 公告</span>
          <span class="announcement-text">${escHtml(first.title)}</span>
          <a href="javascript:void(0)" onclick="showAnnouncement('${first.id}')" class="announcement-more">查看详情</a>
        </div>
      `;
    }
  } catch {}

  // Load tags bar
  try {
    const tags = await API.getAllTags();
    const tagBar = document.getElementById('tag-bar');
    if (tags && tags.length > 0) {
      tagBar.innerHTML = `
        <button class="tag-pill${!tagFilter ? ' active' : ''}" data-tag="">全部</button>
        ${tags.filter(t => t.post_count > 0).map(t => 
          `<button class="tag-pill${tagFilter === t.name ? ' active' : ''}" data-tag="${t.name}">${t.name}<span class="tag-count">${t.post_count}</span></button>`
        ).join('')}
      `;
      tagBar.style.display = 'flex';
      tagBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-pill');
        if (!btn) return;
        const tag = btn.dataset.tag;
        // Clear search input when switching tags
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        location.hash = tag ? `#/tag/${encodeURIComponent(tag)}` : '#/home';
      });
    }
  } catch (e) { /* tag bar is optional */ }

  // Load posts
  try {
    const data = await API.getPosts(pageNum, 12, '', tagFilter);
    renderPostsList(data.posts, 'posts-container');
    const pageCallback = tagFilter
      ? (p) => { location.hash = `#/tag/${encodeURIComponent(tagFilter)}/${p}`; }
      : (p) => { location.hash = `#/home/${p}`; };
    renderPagination(data.total, pageNum, pageCallback, 'pagination');
  } catch (err) {
    document.getElementById('posts-container').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
  
  // Search
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value;
      if (q.length > 1) {
        API.getPosts(1, 12, q, tagFilter).then(data => {
          renderPostsList(data.posts, 'posts-container');
        });
      } else if (q.length === 0) {
        // Restore filtered/unfiltered list
        API.getPosts(pageNum, 12, '', tagFilter).then(data => {
          renderPostsList(data.posts, 'posts-container');
        });
      }
    }, 300);
  });
}

function renderPostsList(posts, containerId) {
  const container = document.getElementById(containerId);
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>暂无文章</h3></div>';
    return;
  }

  container.innerHTML = posts.map(post => {
    // Normalize field names (backend may use author or author_name, authorId or user_id)
    const authorName = post.author_name || post.author || '未知';
    const authorId = post.user_id || post.authorId || '';
    const summary = post.summary || (post.content ? post.content.replace(/[#*`>]/g, '').substring(0, 100) : '');
    const authorAvatar = post.author_avatar || post.authorAvatar || '';
    const avatarSm = UI.avatarHtml(authorName, authorAvatar, 24);

    return `
      <div class="post-card" onclick="location.hash='#/post/${post.id}'">
        ${post.cover ? `
          <div class="post-card-cover">
            <img src="${post.cover}" alt="${post.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'post-card-img-placeholder\\'><svg width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'rgba(167,139,250,.4)\\' stroke-width=\\'1.5\\'><path d=\\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\'/><polyline points=\\'14 2 14 8 20 8\\'/></svg></div>'">
          </div>
        ` : `
          <div class="post-card-img-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,.4)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
        `}
        <div class="post-card-body">
          <div class="post-card-tags">
            ${(post.tags || []).slice(0, 3).map(t => `<span class="post-card-tag">${t}</span>`).join('')}
          </div>
          <h3 class="post-card-title">${post.title}</h3>
          <p class="post-card-summary">${summary}</p>
        </div>
        <div class="post-card-footer">
          <div class="post-card-author" onclick="event.stopPropagation();location.hash='#/profile/${authorId}'">
            ${avatarSm}
            <span>${authorName}</span>
          </div>
          <div class="post-card-stats">
            <span class="stat-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              ${post.views || 0}
            </span>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              ${post.likes || 0}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination(total, current, callback, containerId) {
  const pages = Math.ceil(total / 12);
  const container = document.getElementById(containerId);
  if (pages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  if (current > 1) html += `<button class="page-btn" onclick="arguments[0].stopPropagation();renderPagination.callback(${current - 1})">&larr;</button>`;
  
  for (let i = Math.max(1, current - 2); i <= Math.min(pages, current + 2); i++) {
    html += `<button class="page-btn ${i === current ? 'curr' : ''}" onclick="arguments[0].stopPropagation();renderPagination.callback(${i})">${i}</button>`;
  }
  
  if (current < pages) html += `<button class="page-btn" onclick="arguments[0].stopPropagation();renderPagination.callback(${current + 1})">&rarr;</button>`;
  
  container.innerHTML = `<div class="pagination">${html}</div>`;
  renderPagination.callback = callback;
}

// ========== POST DETAIL PAGE ==========
async function renderPost(id) {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="post-detail">
      <button class="btn btn-ghost" style="margin-bottom:20px" onclick="location.hash='#/'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>返回</button>
      <div id="post-content"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const post = await API.getPost(id);
    
    // Normalize
    const authorId = post.user_id || post.authorId || post.author_id || '';
    const authorName = post.author_name || post.author || '未知';
    const authorAvatar = post.author_avatar || post.authorAvatar || '';
    
    // Check like/fav status
    let likedByMe = false, favedByMe = false;
    if (currentUser) {
      try {
        const likeRes = await fetch(`${API_BASE}/posts/${id}/liked`, { headers: authH() });
        const likeData = await likeRes.json();
        likedByMe = likeData.liked || likeData.data?.liked || false;
      } catch {}
      try {
        const favRes = await fetch(`${API_BASE}/posts/${id}/favorited`, { headers: authH() });
        const favData = await favRes.json();
        favedByMe = favData.favorited || favData.data?.favorited || false;
      } catch {}
    }
    
    const comments = await API.getComments(id);
    
    document.getElementById('post-content').innerHTML = `
      ${post.pending_title && currentUser && authorId === currentUser.id ? `
        <div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px;color:#fbbf24">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>你提交了修改版本，正在等待管理员审核。审核前此页面展示的是旧版本内容。</span>
        </div>
      ` : ''}
      ${post.pending_title && currentUser && currentUser.role === 'admin' && authorId !== currentUser.id ? `
        <div style="background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px;color:#60a5fa">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span>此文章有修改版本待审核。</span>
          <button class="btn btn-ghost" style="margin-left:auto;padding:4px 12px;font-size:12px" onclick="reviewPostInDetail('${id}','approve',this)">通过</button>
          <button class="btn btn-ghost" style="padding:4px 12px;font-size:12px;color:var(--err)" onclick="reviewPostInDetail('${id}','reject',this)">拒绝</button>
        </div>
      ` : ''}
      ${post.cover ? `
        <div class="post-cover-hero">
          <img src="${post.cover}" alt="${post.title}" onerror="this.parentElement.style.display='none'">
        </div>
      ` : ''}
      <div style="padding:16px 0 20px">
        <div class="post-card-tags" style="margin-bottom:12px">
          ${(post.tags ? (Array.isArray(post.tags) ? post.tags : post.tags.split(' ')) : []).map(t => `<span class="post-card-tag">${t}</span>`).join('')}
          ${post.status === 'pending' ? '<span class="post-card-tag tag-pending" style="background:rgba(234,179,8,.15);color:#eab308;border-color:rgba(234,179,8,.3)">待审核</span>' : ''}
          ${post.status === 'rejected' ? '<span class="post-card-tag tag-rejected" style="background:rgba(239,68,68,.15);color:#ef4444;border-color:rgba(239,68,68,.3)">已拒绝</span>' : ''}
          ${post.pending_title && post.status === 'published' ? '<span class="post-card-tag tag-pending" style="background:rgba(251,191,36,.15);color:#fbbf24;border-color:rgba(251,191,36,.3)">修改待审核</span>' : ''}
        </div>
        <h1 style="font-size:28px;font-weight:800;line-height:1.3;margin-bottom:16px">${post.title}</h1>
      </div>
      
      <div class="post-meta-bar">
        <div class="author" style="cursor:pointer" onclick="location.hash='#/profile/${authorId}'">
          ${UI.avatarHtml(authorName, authorAvatar)}
          <div>
            <div style="font-weight:500">${authorName}</div>
            <div style="font-size:12px;color:var(--t3)">${UI.formatDate(post.created_at)}</div>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:14px;align-items:center">
          <span style="font-size:13px;color:var(--t3)">👁️ ${post.views} 次浏览</span>
        </div>
      </div>
      
      <div class="md-body">${marked.parse(post.content || '')}</div>
      
      <div class="post-action-bar">
        <button class="action-btn ${likedByMe ? 'liked' : ''}" id="like-btn" onclick="toggleLike('${id}', this)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span id="like-count">${post.likes || 0}</span>
        </button>
        <button class="action-btn ${favedByMe ? 'faved' : ''}" id="fav-btn" onclick="toggleFav('${id}', this)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          收藏
        </button>
        ${currentUser && authorId === currentUser.id ? `
          <button class="action-btn" onclick="location.hash='#/write?edit=${id}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            编辑
          </button>
          <button class="action-btn" style="color:var(--err);border-color:rgba(239,68,68,.3)" onclick="deletePostConfirm('${id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            删除
          </button>
        ` : ''}
        ${currentUser && currentUser.role === 'admin' && post.status === 'pending' && authorId !== currentUser.id ? `
          <button class="action-btn" style="color:var(--ok);border-color:rgba(34,197,94,.3)" onclick="reviewPostInDetail('${id}','approve',this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            通过审核
          </button>
          <button class="action-btn" style="color:var(--err);border-color:rgba(239,68,68,.3)" onclick="reviewPostInDetail('${id}','reject',this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            拒绝
          </button>
        ` : ''}
      </div>
      
      <div class="comments-section">
        <h3 class="section-title">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          评论 <span style="color:var(--t3);font-weight:400">(${comments.length})</span>
        </h3>
        
        <div style="background:var(--glass);border:1px solid var(--glass-b);border-radius:14px;padding:16px;margin-bottom:20px">
          <textarea class="form-input" id="comment-text" placeholder="写一条评论..." rows="3"></textarea>
          <button class="btn btn-primary" style="margin-top:10px" onclick="submitComment('${id}')">发布评论</button>
        </div>
        
        <div id="comments-list"></div>
      </div>
    `;
    
    renderCommentTree(comments, 'comments-list', id);
    
    // Highlight code
    setTimeout(() => {
      document.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    }, 100);
    
  } catch (err) {
    console.error(err);
    document.getElementById('post-content').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

function renderCommentTree(comments, containerId, postId, parentId = null, depth = 0) {
  const container = document.getElementById(containerId);
  const filtered = comments.filter(c => c.parent_id === parentId);
  
  if (filtered.length === 0 && depth === 0) {
    container.innerHTML = '<div class="empty" style="padding:40px 20px"><h3>暂无评论</h3></div>';
    return;
  }
  
  const html = filtered.map(comment => {
    const authorName = comment.author_name || comment.author || '未知';
    const authorAvatar = comment.author_avatar || comment.authorAvatar || '';
    const profileLink = `#/profile/${comment.user_id}`;
    const avatarHtml = UI.avatarHtml(authorName, authorAvatar, 28);
    return `
      <div class="comment-item" style="margin-left:${depth * 20}px">
        <a href="${profileLink}" class="comment-avatar-link">${avatarHtml}</a>
        <div class="comment-content">
          <div class="comment-header">
            <a href="${profileLink}" class="comment-author-link">${authorName}</a>
            <span class="comment-time">${UI.formatTimeAgo(comment.created_at)}</span>
          </div>
          <p class="comment-text">${comment.content}</p>
          <div class="comment-actions">
            <button class="comment-action" onclick="showReplyForm('${comment.id}', '${authorName}')">回复</button>
            ${comment.user_id === currentUser.id ? `<button class="comment-action" style="color:var(--err)" onclick="deleteComment('${comment.id}')">删除</button>` : ''}
          </div>
          ${comments.some(c => c.parent_id === comment.id) ? `
            <div class="comment-replies">
              ${renderCommentTree(comments, null, postId, comment.id, depth + 1)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  if (container) {
    if (depth === 0) {
      container.innerHTML = html;
    } else {
      return html;
    }
  } else {
    return html;
  }
}

async function toggleLike(postId, btn) {
  const span = btn.querySelector('#like-count');
  try {
    if (btn.classList.contains('liked')) {
      const res = await API.unlikePost(postId);
      btn.classList.remove('liked');
      if (span) span.textContent = (parseInt(span.textContent) || 0) - 1;
    } else {
      const res = await API.likePost(postId);
      btn.classList.add('liked');
      if (span) span.textContent = (parseInt(span.textContent) || 0) + 1;
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function toggleFav(postId, btn) {
  try {
    if (btn.classList.contains('faved')) {
      await API.unfavoritePost(postId);
      btn.classList.remove('faved');
    } else {
      await API.favoritePost(postId);
      btn.classList.add('faved');
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function submitComment(postId) {
  const text = document.getElementById('comment-text').value.trim();
  if (!text) {
    UI.showToast('评论不能为空', 'err');
    return;
  }
  try {
    await API.createComment(postId, text);
    UI.showToast('评论已发布！', 'ok');
    setTimeout(() => renderPost(postId), 800);
  } catch {
    UI.showToast('发布失败', 'err');
  }
}

function showReplyForm(commentId, authorName) {
  // TODO: implement inline reply
}

async function deleteComment(commentId) {
  if (!await UI.showConfirm({ title: '删除评论', message: '确定删除此评论吗？删除后将无法恢复。', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deleteComment(commentId);
    UI.showToast('已删除', 'ok');
    location.reload();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

async function deletePostConfirm(postId) {
  if (!await UI.showConfirm({ title: '删除文章', message: '确定删除此文章吗？此操作无法撤销，所有评论、点赞等数据都将一并删除。', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deletePost(postId);
    UI.showToast('文章已删除', 'ok');
    setTimeout(() => location.hash = '#/', 500);
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

async function reviewPostInDetail(postId, action, btn) {
  if (!await UI.showConfirm({ 
    title: action === 'approve' ? '通过审核' : '拒绝文章', 
    message: action === 'approve' ? '确定通过此文章的审核吗？审核通过后文章将发布至平台。' : '确定拒绝此文章吗？作者会收到拒绝通知。', 
    confirmText: action === 'approve' ? '确认通过' : '确认拒绝',
    type: action === 'approve' ? 'info' : 'warn'
  })) return;
  try {
    const res = await fetch(`${API_BASE}/admin/posts/${postId}/review`, {
      method: 'PUT', headers: jsonH(),
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      UI.showToast(data.message, 'ok');
      // 200ms 后刷新页面，确保操作完成
      setTimeout(() => {
        location.hash = `#/post/${postId}`;
      }, 200);
    } else {
      UI.showToast(data.message || '操作失败', 'err');
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

// Announcement detail modal
async function showAnnouncement(id) {
  const anns = await API.getAnnouncements();
  const ann = anns.find(a => a.id === id);
  if (!ann) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-head">
        <h3>📢 ${escHtml(ann.title)}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body" style="color:var(--t2);line-height:1.7;white-space:pre-wrap">${escHtml(ann.content)}</div>
      <div style="text-align:right;padding:12px 20px;font-size:11px;color:var(--t3)">${escHtml(ann.author_name)} · ${UI.formatTimeAgo(ann.created_at)}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
