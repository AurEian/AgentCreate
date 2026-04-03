// ========== PROFILE PAGES ==========
async function renderProfile(userId) {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div id="profile-content"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const userData = await API.getUser(userId);
    const user = userData && (userData.data || userData);
    if (!user || !user.id) throw new Error('用户不存在');

    const posts = await API.getUserPosts(userId);
    
    const isMe = currentUser && currentUser.id === userId;
    const isFollowing = user.isFollowing || false;
    
    document.getElementById('profile-content').innerHTML = `
      <div class="profile-hero">
        <div class="profile-top">
          <div class="avatar-lg">${user.avatar && user.avatar.startsWith('/') ? `<img src="${user.avatar}" onerror="this.outerHTML='${user.name.charAt(0).toUpperCase()}'">` : user.name.charAt(0).toUpperCase()}</div>
          <div class="profile-info">
            <div class="profile-name">${user.name}</div>
            <div class="profile-bio">${user.bio || '暂无简介'}</div>
            <div class="profile-stats">
              <div class="profile-stat">
                <div class="profile-stat-num">${posts.length || 0}</div>
                <div class="profile-stat-label">文章</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-num">${user.followerCount || user.followers_count || 0}</div>
                <div class="profile-stat-label">粉丝</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-num">${user.followingCount || user.following_count || 0}</div>
                <div class="profile-stat-label">关注</div>
              </div>
            </div>
          </div>
          ${!isMe ? `
            <button class="follow-btn ${isFollowing ? 'following' : ''}" id="follow-btn" onclick="toggleFollowProfile('${userId}', this)">
              ${isFollowing ? '已关注' : '+ 关注'}
            </button>
          ` : `
            <button class="btn btn-ghost" onclick="renderMyProfileEdit()">编辑资料</button>
          `}
        </div>
      </div>
      
      <div class="section-head">
        <h3 class="section-title">TA 的文章</h3>
      </div>
      <div id="profile-posts" class="posts-grid"></div>
    `;
    
    renderPostsList(Array.isArray(posts) ? posts : [], 'profile-posts');
  } catch (err) {
    document.getElementById('profile-content').innerHTML = '<div class="empty"><h3>用户不存在</h3></div>';
  }
}

async function toggleFollowProfile(userId, btn) {
  try {
    const res = await API.follow(userId); // 后端 toggle，返回 { following: true/false }
    const data = res.data || res;
    if (data.following !== undefined ? data.following : res.following) {
      btn.classList.add('following');
      btn.textContent = '已关注';
      UI.showToast('已关注', 'ok');
    } else {
      btn.classList.remove('following');
      btn.textContent = '+ 关注';
      UI.showToast('已取消关注', 'info');
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function renderMyProfile() {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container">
      <div id="my-profile-content"></div>
    </div>
  `;
  page.classList.add('active');
  
  try {
    const posts = await API.getUserPosts(currentUser.id);
    
    document.getElementById('my-profile-content').innerHTML = `
      <div class="profile-hero">
        <div class="profile-top">
          <div class="avatar-lg">${currentUser.avatar && currentUser.avatar.startsWith('/') ? `<img src="${currentUser.avatar}" onerror="this.outerHTML='${currentUser.name.charAt(0).toUpperCase()}'">` : currentUser.name.charAt(0).toUpperCase()}</div>
          <div class="profile-info">
            <div class="profile-name">${currentUser.name}</div>
            <div class="profile-bio">${currentUser.bio || '暂无简介'}</div>
            <div class="profile-stats">
              <div class="profile-stat">
                <div class="profile-stat-num">${posts.length || 0}</div>
                <div class="profile-stat-label">文章</div>
              </div>
            </div>
          </div>
          <button class="btn btn-ghost" onclick="renderMyProfileEdit()">编辑资料</button>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab active" onclick="switchProfileTab('posts', this)">我的文章</button>
        <button class="tab" onclick="switchProfileTab('settings', this)">账号设置</button>
      </div>
      
      <div id="profile-tab-posts">
        <div id="my-posts" class="posts-grid"></div>
      </div>
      
      <div id="profile-tab-settings" class="hidden">
        <div class="card card-body">
          <h3 style="margin-bottom:16px;font-size:16px;font-weight:600">修改密码</h3>
          <div class="form-group">
            <label class="form-label">当前密码</label>
            <input type="password" class="form-input" id="old-pwd" placeholder="输入当前密码">
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input type="password" class="form-input" id="new-pwd" placeholder="至少 6 位">
          </div>
          <button class="btn btn-primary" onclick="submitChangePassword()">修改密码</button>
        </div>
      </div>
    `;
    
    renderPostsList(Array.isArray(posts) ? posts : [], 'my-posts');
  } catch {
    document.getElementById('my-profile-content').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

function switchProfileTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  document.getElementById('profile-tab-posts').classList.add('hidden');
  document.getElementById('profile-tab-settings').classList.add('hidden');
  
  if (tab === 'posts') {
    document.getElementById('profile-tab-posts').classList.remove('hidden');
  } else if (tab === 'settings') {
    document.getElementById('profile-tab-settings').classList.remove('hidden');
  }
}

let editAvatarUrl = '';

function renderMyProfileEdit() {
  editAvatarUrl = currentUser.avatar || '';
  const html = `
    <div class="modal-bg" onclick="this.remove()">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:420px">
        <h3 class="modal-title">编辑资料</h3>
        <div class="form-group" style="display:flex;flex-direction:column;align-items:center;gap:10px">
          <div class="avatar-upload-wrap" id="avatar-upload-wrap" onclick="document.getElementById('avatar-file').click()">
            ${editAvatarUrl ? `<img src="${editAvatarUrl}" alt="avatar" class="avatar-upload-img" onerror="this.style.display='none'">` : ''}
            ${!editAvatarUrl ? `<div class="avatar-lg">${currentUser.name.charAt(0).toUpperCase()}</div>` : ''}
            <div class="avatar-upload-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>更换头像</span>
            </div>
          </div>
          <input type="file" id="avatar-file" accept="image/*" class="hidden">
          ${editAvatarUrl ? `<button type="button" class="btn btn-ghost btn-xs" onclick="clearEditAvatar(event)">移除头像</button>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input type="text" class="form-input" id="edit-name" value="${currentUser.name}" placeholder="用户名">
        </div>
        <div class="form-group">
          <label class="form-label">个人简介</label>
          <textarea class="form-input" id="edit-bio" placeholder="介绍一下自己...">${currentUser.bio || ''}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
          <button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">取消</button>
          <button class="btn btn-primary" onclick="submitProfileEdit()">保存</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  // Avatar upload handler
  document.getElementById('avatar-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      UI.showToast('正在上传...', 'info');
      editAvatarUrl = await API.uploadImage(file);
      const wrap = document.getElementById('avatar-upload-wrap');
      wrap.innerHTML = `
        <img src="${editAvatarUrl}" alt="avatar" class="avatar-upload-img" onerror="this.style.display='none'">
        <div class="avatar-upload-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>更换头像</span>
        </div>
      `;
      UI.showToast('头像已上传', 'ok');
    } catch {
      UI.showToast('头像上传失败', 'err');
    }
  });
}

function clearEditAvatar(e) {
  e.preventDefault();
  e.stopPropagation();
  editAvatarUrl = '';
  const wrap = document.getElementById('avatar-upload-wrap');
  wrap.innerHTML = `
    <div class="avatar-lg">${currentUser.name.charAt(0).toUpperCase()}</div>
    <div class="avatar-upload-overlay">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span>上传头像</span>
    </div>
  `;
}

async function submitProfileEdit() {
  const name = document.getElementById('edit-name').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  
  if (!name) {
    UI.showToast('用户名不能为空', 'err');
    return;
  }
  
  try {
    const res = await API.updateProfile(name, bio, editAvatarUrl);
    if (res.error) {
      UI.showToast(res.error, 'err');
      return;
    }
    currentUser.name = name;
    currentUser.bio = bio;
    currentUser.avatar = editAvatarUrl;
    document.querySelector('.modal-bg').remove();
    UI.showToast('资料已更新', 'ok');
    // Update nav avatar
    const avatarText = document.getElementById('avatar-text');
    const userAvatar = document.getElementById('user-avatar');
    if (avatarText && userAvatar) {
      if (editAvatarUrl) {
        userAvatar.style.background = 'none';
        avatarText.innerHTML = '';
        avatarText.style.cssText = 'width:100%;height:100%;border-radius:50%;overflow:hidden;display:block';
        avatarText.innerHTML = `<img src="${editAvatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.outerHTML='${name.charAt(0).toUpperCase()}'">`;
      } else {
        userAvatar.style.background = '';
        avatarText.style.cssText = '';
        avatarText.textContent = name.charAt(0).toUpperCase();
      }
    }
    renderMyProfile();
  } catch {
    UI.showToast('更新失败', 'err');
  }
}

async function submitChangePassword() {
  const oldPwd = document.getElementById('old-pwd').value;
  const newPwd = document.getElementById('new-pwd').value;
  
  if (!oldPwd || !newPwd) {
    UI.showToast('请填写完整', 'err');
    return;
  }
  if (newPwd.length < 6) {
    UI.showToast('新密码至少 6 位', 'err');
    return;
  }
  
  try {
    const res = await API.changePassword(oldPwd, newPwd);
    if (res.error) {
      UI.showToast(res.error, 'err');
    } else {
      UI.showToast('密码已修改', 'ok');
      document.getElementById('old-pwd').value = '';
      document.getElementById('new-pwd').value = '';
    }
  } catch {
    UI.showToast('修改失败', 'err');
  }
}

// ========== ADMIN PANEL ==========
async function renderAdmin() {
  const page = document.getElementById('home');
  page.innerHTML = `
    <div class="container-wide">
      <div class="section-head">
        <h2 class="section-title"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>管理后台</h2>
      </div>
      
      <div id="admin-stats" class="admin-grid">
        <div class="stat-card skeleton" style="height:84px"></div>
        <div class="stat-card skeleton" style="height:84px"></div>
        <div class="stat-card skeleton" style="height:84px"></div>
        <div class="stat-card skeleton" style="height:84px"></div>
      </div>

      <!-- Analytics Charts -->
      <div class="dashboard-charts" id="dashboard-charts" style="display:none">
        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-card-head">
              <h3>近 7 天趋势</h3>
              <select id="analytics-range" style="background:var(--glass);border:1px solid var(--glass-b);border-radius:8px;color:var(--t2);padding:4px 8px;font-size:12px">
                <option value="7">7天</option>
                <option value="14">14天</option>
                <option value="30">30天</option>
              </select>
            </div>
            <canvas id="chart-trend" height="200"></canvas>
          </div>
          <div class="chart-card">
            <h3>热门文章 TOP10</h3>
            <div id="popular-posts-list"></div>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-card">
            <h3>标签分布</h3>
            <div style="max-width:280px;margin:0 auto">
              <canvas id="chart-tags" height="280"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <h3>最近动态</h3>
            <div id="recent-activity"></div>
          </div>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab active" onclick="switchAdminTab('posts', this)">文章管理</button>
        <button class="tab" onclick="switchAdminTab('users', this)">用户管理</button>
        <button class="tab" onclick="switchAdminTab('profile-review', this)">资料审核</button>
        <button class="tab" onclick="switchAdminTab('comments', this)">评论管理</button>
        <button class="tab" onclick="switchAdminTab('announcements', this)">系统公告</button>
        <button class="tab" onclick="switchAdminTab('sensitive', this)">敏感词管理</button>
        <button class="tab" onclick="switchAdminTab('logs', this)">操作日志</button>
      </div>
      
      <div id="admin-tab-posts"></div>
      <div id="admin-tab-users" class="hidden"></div>
      <div id="admin-tab-profile-review" class="hidden"></div>
      <div id="admin-tab-comments" class="hidden"></div>
      <div id="admin-tab-announcements" class="hidden"></div>
      <div id="admin-tab-sensitive" class="hidden"></div>
      <div id="admin-tab-logs" class="hidden"></div>
    </div>
  `;
  page.classList.add('active');
  
  // Load stats
  try {
    const stats = await API.getStats();
    if (stats) {
      document.getElementById('admin-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon-box" style="background:rgba(99,102,241,.15)">
            <svg viewBox="0 0 24 24" fill="currentColor" style="color:#818cf8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          </div>
          <div><div class="stat-num">${stats.totalPosts}</div><div class="stat-label">文章</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-box" style="background:rgba(52,211,153,.15)">
            <svg viewBox="0 0 24 24" fill="currentColor" style="color:#34d399"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div><div class="stat-num">${stats.totalUsers}</div><div class="stat-label">用户</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-box" style="background:rgba(251,191,36,.15)">
            <svg viewBox="0 0 24 24" fill="currentColor" style="color:#fbbf24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          </div>
          <div><div class="stat-num">${stats.totalComments}</div><div class="stat-label">评论</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-box" style="background:rgba(248,113,113,.15)">
            <svg viewBox="0 0 24 24" fill="currentColor" style="color:#f87171"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
          <div><div class="stat-num">${stats.todayPosts}</div><div class="stat-label">今日新文章</div></div>
        </div>
      `;
    }
  } catch {}

  // Load analytics charts
  loadAnalyticsCharts();

  // Load first tab
  loadAdminPosts();
}

// Store chart instances for cleanup
let chartTrend = null, chartTags = null;

async function loadAnalyticsCharts(days = 7) {
  const box = document.getElementById('dashboard-charts');
  try {
    const data = await API.getAnalytics(days);
    if (!data) return;
    box.style.display = 'block';

    // ── Trend chart ──
    const trend = data.trend || [];
    const labels = trend.map(r => r.day ? r.day.slice(5) : '');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const textColor = isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.5)';

    if (chartTrend) chartTrend.destroy();
    const ctxTrend = document.getElementById('chart-trend').getContext('2d');
    chartTrend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '新用户', data: trend.map(r => r.new_users || 0), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,.1)', fill: true, tension: .4, pointRadius: 3 },
          { label: '新文章', data: trend.map(r => r.new_posts || 0), borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,.1)', fill: true, tension: .4, pointRadius: 3 },
          { label: '新评论', data: trend.map(r => r.new_comments || 0), borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,.1)', fill: true, tension: .4, pointRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, boxWidth: 12, padding: 12 } } },
        scales: { x: { ticks: { color: textColor }, grid: { color: gridColor } }, y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } } }
      }
    });

    // ── Popular posts ──
    const popPosts = data.popularPosts || [];
    document.getElementById('popular-posts-list').innerHTML = popPosts.length ? popPosts.map((p, i) => `
      <div class="popular-item" style="cursor:pointer" onclick="location.hash='#/post/${p.id}'">
        <span class="popular-rank">${i + 1}</span>
        <div class="popular-info">
          <div class="popular-title">${escHtml(p.title)}</div>
          <div class="popular-meta">${escHtml(p.author)} · ${p.views} 浏览 · ${p.comment_count || 0} 评论</div>
        </div>
      </div>
    `).join('') : '<div class="empty"><h3>暂无数据</h3></div>';

    // ── Tag distribution ──
    const tagDist = data.tagDist || [];
    const tagColors = ['#818cf8','#34d399','#fbbf24','#f87171','#a78bfa','#38bdf8','#fb923c','#e879f9','#4ade80','#f472b6'];
    if (chartTags) chartTags.destroy();
    if (tagDist.length) {
      const ctxTags = document.getElementById('chart-tags').getContext('2d');
      chartTags = new Chart(ctxTags, {
        type: 'doughnut',
        data: {
          labels: tagDist.map(t => t.name),
          datasets: [{ data: tagDist.map(t => t.cnt), backgroundColor: tagColors.slice(0, tagDist.length), borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: textColor, padding: 8, boxWidth: 10, font: { size: 12 } } } }
        }
      });
    }

    // ── Recent activity ──
    try {
      const stats = await API.getStats();
      if (stats) {
        const activities = [];
        (stats.recentPosts || []).forEach(p => activities.push({ type: 'post', text: `${p.author} 发布了`, title: p.title, postId: p.id, time: p.created_at }));
        (stats.recentComments || []).forEach(c => activities.push({ type: 'comment', text: `${c.author} 评论了「${c.content.slice(0, 20)}...」`, time: c.created_at }));
        activities.sort((a, b) => b.time > a.time ? 1 : -1);
        document.getElementById('recent-activity').innerHTML = activities.length ? activities.slice(0, 8).map(a => `
          <div class="activity-item" ${a.postId ? `style="cursor:pointer" onclick="location.hash='#/post/${a.postId}'"` : ''}>
            <span class="activity-dot ${a.type}"></span>
            <span class="activity-text">${escHtml(a.text)}${a.title ? `《<span style="color:var(--accent)">${escHtml(a.title)}</span>》` : ''}</span>
            <span class="activity-time">${UI.formatTimeAgo(a.time)}</span>
          </div>
        `).join('') : '<div class="empty"><h3>暂无动态</h3></div>';
      }
    } catch {}

    // Range selector
    document.getElementById('analytics-range').addEventListener('change', function() {
      loadAnalyticsCharts(parseInt(this.value));
    });

  } catch (e) {
    console.warn('Analytics load error', e);
  }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  ['posts', 'users', 'profile-review', 'comments', 'announcements', 'sensitive', 'logs'].forEach(t => {
    const el = document.getElementById(`admin-tab-${t}`);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
  
  if (tab === 'posts') loadAdminPosts();
  else if (tab === 'users') loadAdminUsers();
  else if (tab === 'profile-review') loadAdminProfileReview();
  else if (tab === 'comments') loadAdminComments();
  else if (tab === 'announcements') loadAdminAnnouncements();
  else if (tab === 'sensitive') loadAdminSensitive();
  else if (tab === 'logs') loadAdminLogs();
}

async function loadAdminPosts() {
  const container = document.getElementById('admin-tab-posts');
  container.innerHTML = '<div class="skeleton skel-line"></div>';
  
  try {
    const posts = await API.getAdminPosts();
    
    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="empty"><h3>暂无文章</h3></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>标题</th>
              <th>作者</th>
              <th>状态</th>
              <th>浏览</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${posts.map(p => {
              const authorName = p.author_name || p.author || '-';
              const statusMap = { published: ['已发布', 'text-ok'], pending: ['待审核', 'text-warn'], rejected: ['已拒绝', 'text-err'], draft: ['草稿', 'text-muted'] };
              const [statusText, statusClass] = statusMap[p.status] || [p.status, ''];
              const hasPending = p.has_pending_edit == 1;
              return `
              <tr>
                <td><a href="#/post/${p.id}" style="color:var(--accent)">${escHtml(p.title)}</a>${hasPending ? ' <span style="font-size:11px;background:rgba(251,191,36,.15);color:#fbbf24;padding:1px 6px;border-radius:6px;margin-left:4px">修改待审</span>' : ''}</td>
                <td>${escHtml(authorName)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${p.views || 0}</td>
                <td>${UI.formatDate(p.created_at)}</td>
                <td>
                  <div class="tbl-actions">
                    ${p.status === 'pending' ? `
                      <button class="btn btn-xs" style="background:var(--ok);color:#fff" onclick="reviewPost('${p.id}','approve')">通过</button>
                      <button class="btn btn-danger btn-xs" onclick="reviewPost('${p.id}','reject')">拒绝</button>
                    ` : ''}
                    ${hasPending ? `
                      <button class="btn btn-xs" style="background:var(--ok);color:#fff" onclick="reviewPost('${p.id}','approve')">通过修改</button>
                      <button class="btn btn-danger btn-xs" onclick="reviewPost('${p.id}','reject')">拒绝修改</button>
                    ` : ''}
                    <button class="btn btn-ghost btn-xs" onclick="location.hash='#/write?edit=${p.id}'">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="adminDeletePost('${p.id}')">删除</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function adminDeletePost(id) {
  if (!await UI.showConfirm({ title: '删除文章', message: '确认删除此文章？所有相关评论、点赞等数据都将一并删除，此操作无法撤销。', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deletePost(id);
    UI.showToast('文章已删除', 'ok');
    loadAdminPosts();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

async function reviewPost(id, action) {
  // 判断是修改审核还是新文章审核
  const post = await API.getPost(id);
  const isModifyReview = !!(post?.pending_title);
  const title = isModifyReview ? (action === 'approve' ? '通过修改' : '拒绝修改') : (action === 'approve' ? '通过审核' : '拒绝文章');
  const message = isModifyReview
    ? (action === 'approve' ? '确定通过此文章的修改吗？修改后的内容将替换原内容正式发布。' : '确定拒绝此修改吗？作者会收到拒绝通知，原内容不变。')
    : (action === 'approve' ? '确定通过此文章的审核吗？审核通过后文章将发布至平台。' : '确定拒绝此文章吗？作者会收到拒绝通知。');
  if (!await UI.showConfirm({ title, message, confirmText: action === 'approve' ? '确认通过' : '确认拒绝', type: action === 'approve' ? 'info' : 'warn' })) return;
  try {
    const res = await fetch(`${API_BASE}/admin/posts/${id}/review`, {
      method: 'PUT', headers: jsonH(),
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      UI.showToast(data.message, 'ok');
      loadAdminPosts();
    } else {
      UI.showToast(data.message || '操作失败', 'err');
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-tab-users');
  container.innerHTML = '<div class="skeleton skel-line"></div>';
  
  try {
    const users = await API.getAdminUsers();
    
    if (!users || users.length === 0) {
      container.innerHTML = '<div class="empty"><h3>暂无用户</h3></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><a href="#/profile/${u.id}" style="color:var(--accent)">${u.name}</a></td>
                <td>${u.email}</td>
                <td>${u.role === 'admin' ? '<span class="badge-admin">管理员</span>' : '用户'}</td>
                <td>${UI.formatDate(u.created_at)}</td>
                <td>
                  <div class="tbl-actions">
                    ${u.id !== currentUser.id ? `<button class="btn btn-danger btn-xs" onclick="banUser('${u.id}')">封禁</button>` : '<span style="color:var(--t3);font-size:12px">（自己）</span>'}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function loadAdminComments() {
  const container = document.getElementById('admin-tab-comments');
  container.innerHTML = '<div class="skeleton skel-line"></div>';
  
  try {
    const comments = await API.getAdminComments();
    
    if (!comments || comments.length === 0) {
      container.innerHTML = '<div class="empty"><h3>暂无评论</h3></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>评论内容</th>
              <th>作者</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${comments.map(c => {
              const authorName = c.author_name || c.author || '-';
              return `
              <tr>
                <td style="max-width:300px"><div class="truncate">${c.content}</div></td>
                <td>${authorName}</td>
                <td>${UI.formatDate(c.created_at)}</td>
                <td>
                  <div class="tbl-actions">
                    <button class="btn btn-danger btn-xs" onclick="adminDeleteComment('${c.id}')">删除</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function loadAdminProfileReview() {
  const container = document.getElementById('admin-tab-profile-review');
  container.innerHTML = '<div class="skeleton skel-line"></div>';
  
  try {
    const profiles = await API.getPendingProfiles();
    
    if (!profiles || profiles.length === 0) {
      container.innerHTML = '<div class="empty"><h3>暂无待审核的资料修改</h3></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>用户</th>
              <th>当前资料</th>
              <th>修改为</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${profiles.map(p => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${p.avatar ? `<img src="${p.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div class="avatar avatar-sm">${p.name[0]}</div>`}
                    <span>${escHtml(p.name)}</span>
                  </div>
                </td>
                <td style="max-width:200px">
                  <div class="truncate">${escHtml(p.bio || '-')}</div>
                </td>
                <td style="max-width:200px">
                  <div class="truncate" style="color:var(--primary)">${escHtml(p.pending_bio || p.pending_name || '-')}</div>
                </td>
                <td>
                  <div class="tbl-actions">
                    <button class="btn btn-primary btn-xs" onclick="approveProfile('${p.id}')">通过</button>
                    <button class="btn btn-danger btn-xs" onclick="rejectProfile('${p.id}')">拒绝</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function approveProfile(userId) {
  if (!await UI.showConfirm({ title: '通过审核', message: '确认通过此资料修改？', confirmText: '确认通过', type: 'info' })) return;
  try {
    await API.reviewProfile(userId, 'approve');
    UI.showToast('已通过审核', 'ok');
    loadAdminProfileReview();
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function rejectProfile(userId) {
  if (!await UI.showConfirm({ title: '拒绝修改', message: '确认拒绝此资料修改？', confirmText: '确认拒绝', type: 'danger' })) return;
  try {
    await API.reviewProfile(userId, 'reject');
    UI.showToast('已拒绝修改', 'ok');
    loadAdminProfileReview();
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

// ========== ADMIN: SENSITIVE WORDS ==========
async function loadAdminSensitive() {
  const container = document.getElementById('admin-tab-sensitive');
  container.innerHTML = `
    <div class="admin-form-card" style="background:var(--glass);border:1px solid var(--glass-b);border-radius:16px;padding:20px;margin-bottom:20px">
      <h3 style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        添加敏感词
      </h3>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <input type="text" class="form-input" id="sensitive-word" placeholder="输入敏感词" style="flex:1;max-width:280px">
        <button class="btn btn-primary" onclick="addSensitiveWord()" style="min-width:80px;box-shadow:0 2px 8px rgba(99,102,241,.3)">添加</button>
      </div>
      <div style="font-size:12px;color:var(--t3);margin-top:10px">
        💡 提示：多个敏感词用逗号分隔，一次最多10个
      </div>
      
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--glass-b)">
        <h4 style="font-size:14px;color:var(--t2);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5l-4 4m0 0l-4-4m4 4V4"/></svg>
          批量导入
        </h4>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <textarea id="bulk-words" class="form-input" placeholder="每行一个敏感词，或用逗号分隔" rows="4" style="flex:1;resize:vertical;min-width:300px"></textarea>
          <button class="btn" onclick="bulkImportWords()" style="min-width:100px;background:var(--primary);color:white;border:1px solid rgba(255,255,255,.2);box-shadow:0 2px 8px rgba(99,102,241,.3)">批量导入</button>
        </div>
      </div>
    </div>
    <div id="sensitive-list"><div class="skeleton skel-line"></div></div>
  `;

  try {
    const words = await API.getSensitiveWords();
    const list = document.getElementById('sensitive-list');
    if (!words.length) {
      list.innerHTML = '<div class="empty"><h3>暂无敏感词</h3></div>';
      return;
    }
    list.innerHTML = `
      <div class="admin-form-card" style="background:var(--glass);border:1px solid var(--glass-b);border-radius:16px;padding:20px">
        <h3 style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          敏感词库（共${words.length}个）
        </h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${words.map(w => `
            <span style="background:rgba(239,68,68,.12);color:#ef4444;padding:6px 12px;border-radius:20px;font-size:13px;display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(239,68,68,.25)">
              ${escHtml(w.word)}
              <button onclick="removeSensitiveWord('${w.word}')" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font-size:15px;line-height:1;opacity:.7" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.7">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  } catch {
    document.getElementById('sensitive-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function addSensitiveWord() {
  const input = document.getElementById('sensitive-word');
  const word = input.value.trim();
  if (!word) return;
  try {
    const res = await API.addSensitiveWord(word);
    if (res.success) {
      UI.showToast('添加成功', 'ok');
      input.value = '';
      loadAdminSensitive();
    } else {
      UI.showToast(res.message || '添加失败', 'err');
    }
  } catch {
    UI.showToast('添加失败', 'err');
  }
}

async function bulkImportWords() {
  const textarea = document.getElementById('bulk-words');
  const text = textarea.value.trim();
  if (!text) return;
  const words = text.split(/[\n,，]/).map(w => w.trim()).filter(w => w);
  let success = 0, fail = 0;
  for (const w of words) {
    try {
      const res = await API.addSensitiveWord(w);
      if (res.success) success++;
      else fail++;
    } catch { fail++; }
  }
  UI.showToast(`导入完成：${success}成功，${fail}失败`, fail > 0 ? 'warn' : 'ok');
  if (success > 0) {
    textarea.value = '';
    loadAdminSensitive();
  }
}

async function removeSensitiveWord(word) {
  if (!await UI.showConfirm({ title: '删除敏感词', message: `确认删除「${word}」吗？`, confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deleteSensitiveWord(word);
    UI.showToast('已删���', 'ok');
    loadAdminSensitive();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

async function loadAdminLogs() {
  const container = document.getElementById('admin-tab-logs');
  container.innerHTML = '<div class="skeleton skel-line"></div>';
  
  // 操作类型中文映射
  const actionMap = {
    'create_post': '发布文章', 'update_post': '修改文章', 'delete_post': '删除文章',
    'edit_post': '编辑文章', 'publish_post': '发布文章', 'submit_post': '提交审核', 'review_post': '审核文章',
    'approve_post': '通过审核', 'reject_post': '拒绝文章',
    'approve_profile': '通过资料', 'reject_profile': '拒绝资料',
    'create_comment': '发表评论', 'delete_comment': '删除评论',
    'admin_delete_comment': '删除评论',
    'like_post': '点赞文章', 'unlike_post': '取消点赞',
    'favorite_post': '收藏文章', 'unfavorite_post': '取消收藏',
    'follow_user': '关注用户', 'unfollow_user': '取消关注',
    'create_user': '注册用户', 'update_user': '更新资料', 'delete_user': '删除用户',
    'ban_user': '封禁用户', 'unban_user': '解封用户',
    'admin_delete_post': '管理员删除文章', 'admin_batch_delete_posts': '批量删除文章',
    'login': '登录', 'logout': '登出',
    'create_announcement': '发布公告', 'delete_announcement': '删除公告',
    'update_profile': '修改资料', 'change_password': '修改密码'
  };

  try {
    const logs = await API.getAdminLogs();
    
    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="empty"><h3>暂无日志</h3></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>操作</th>
              <th>目标</th>
              <th>详情</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td><span class="text-accent">${actionMap[l.action] || l.action}</span></td>
                <td>${l.target || '-'}</td>
                <td style="max-width:240px"><div class="truncate text-sm text-muted">${l.detail || ''}</div></td>
                <td class="text-sm text-dim">${UI.formatDate(l.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

// Helper to format date (used in inline onclick before window.UI is used)
function formatDate(d) { return UI ? UI.formatDate(d) : d; }
function formatTimeAgo(d) { return UI ? UI.formatTimeAgo(d) : d; }

async function banUser(userId) {
  const reason = prompt('请输入封禁原因：');
  if (!reason) return;
  const until = prompt('封禁至（格式：2026-12-31）：', '2026-12-31');
  if (!until) return;
  try {
    const res = await API.banUser(userId, reason, until);
    if (res.success) {
      UI.showToast('封禁成功', 'ok');
      loadAdminUsers();
    } else {
      UI.showToast(res.message || '操作失败', 'err');
    }
  } catch {
    UI.showToast('操作失败', 'err');
  }
}

async function adminDeleteComment(id) {
  if (!await UI.showConfirm({ title: '删除评论', message: '确认删除此评论吗？', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deleteComment(id);
    UI.showToast('评论已删除', 'ok');
    loadAdminComments();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}

// ========== ADMIN: ANNOUNCEMENTS ==========
async function loadAdminAnnouncements() {
  const container = document.getElementById('admin-tab-announcements');
  container.innerHTML = `
    <div style="margin-bottom:16px">
      <h3 style="font-size:14px;color:var(--t2);margin-bottom:10px">发布新公告</h3>
      <div class="form-group">
        <input type="text" class="form-input" id="ann-title" placeholder="公告标题">
      </div>
      <div class="form-group">
        <textarea class="form-input" id="ann-content" placeholder="公告内容..." rows="3" style="resize:vertical"></textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="publishAnnouncement()">发布公告</button>
    </div>
    <div id="ann-list"><div class="skeleton skel-line"></div></div>
  `;

  try {
    const anns = await API.getAnnouncements();
    const list = document.getElementById('ann-list');
    if (!anns.length) {
      list.innerHTML = '<div class="empty"><h3>暂无公告</h3></div>';
      return;
    }
    list.innerHTML = anns.map(a => `
      <div style="background:var(--glass);border:1px solid var(--glass-b);border-radius:12px;padding:14px 16px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--t1)">${escHtml(a.title)}</div>
            <div style="font-size:12px;color:var(--t2);margin-top:4px;white-space:pre-wrap">${escHtml(a.content)}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:6px">${escHtml(a.author_name)} · ${UI.formatTimeAgo(a.created_at)}</div>
          </div>
          <button class="btn btn-danger btn-xs" onclick="deleteAnn('${a.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch {
    document.getElementById('ann-list').innerHTML = '<div class="empty"><h3>加载失败</h3></div>';
  }
}

async function publishAnnouncement() {
  const title = document.getElementById('ann-title')?.value?.trim();
  const content = document.getElementById('ann-content')?.value?.trim();
  if (!title || !content) return UI.showToast('请填写标题和内容', 'err');
  try {
    await API.createAnnouncement(title, content);
    UI.showToast('公告已发布', 'ok');
    loadAdminAnnouncements();
  } catch {
    UI.showToast('发布失败', 'err');
  }
}

async function deleteAnn(id) {
  if (!await UI.showConfirm({ title: '删除公告', message: '确认删除此公告吗？删除后将无法恢复。', confirmText: '确认删除', type: 'danger' })) return;
  try {
    await API.deleteAnnouncement(id);
    UI.showToast('已删除', 'ok');
    loadAdminAnnouncements();
  } catch {
    UI.showToast('删除失败', 'err');
  }
}
