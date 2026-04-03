// ============ API & STATE ============
// 用相对路径，自动适配本地开发(:3000)和生产环境(nginx :80)
const API_BASE = '/api';
let currentUser = null;
let userCache = {};
let postCache = {};

function tok() { return sessionStorage.getItem('token') || ''; }
function authH() { return { 'Authorization': tok() }; }
function jsonH() { return { 'Authorization': tok(), 'Content-Type': 'application/json' }; }

// ── Auth ──
async function register(email, password, name) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  return res.json();
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function getMe() {
  const token = tok();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/user/${token}`, { headers: authH() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch { return null; }
}

function logout() {
  sessionStorage.removeItem('token');
  currentUser = null;
  location.hash = '#/login';
  setTimeout(() => location.reload(), 100);
}

// ── Posts ──
function normPost(p) {
  // Normalize tags: might be space-separated string or array
  let tags = p.tags;
  if (typeof tags === 'string') tags = tags ? tags.split(' ').filter(Boolean) : [];
  if (!Array.isArray(tags)) tags = [];
  return {
    ...p,
    tags,
    author_name: p.author_name || p.author || '未知',
    user_id: p.user_id || p.authorId || ''
  };
}

async function getPosts(page = 1, limit = 12, search = '', tag = '') {
  const q = new URLSearchParams({ page, limit });
  if (search) q.set('search', search);
  if (tag) q.set('tag', tag);
  const res = await fetch(`${API_BASE}/posts?${q}`);
  const data = await res.json();
  // Backend returns { data: [...], pagination: {...} }
  const posts = (data.data || data.posts || []).map(normPost);
  const total = data.pagination?.total || posts.length;
  return { posts, total };
}

async function getPost(id) {
  const res = await fetch(`${API_BASE}/posts/${id}`, { headers: authH() });
  const data = await res.json();
  return data.data || data;
}

async function createPost(title, summary, content, tags, cover) {
  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST', headers: jsonH(),
    body: JSON.stringify({ title, summary, content, tags, cover })
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err._httpStatus = res.status;
    throw err;
  }
  return data;
}

async function updatePost(id, title, summary, content, tags, cover, status) {
  const res = await fetch(`${API_BASE}/posts/${id}`, {
    method: 'PUT', headers: jsonH(),
    body: JSON.stringify({ title, summary, content, tags, cover, status })
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err._httpStatus = res.status;
    throw err;
  }
  return data;
}

async function deletePost(id) {
  const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE', headers: authH() });
  return res.json();
}

// ── Comments ──
async function getComments(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
  const data = await res.json();
  return data.data || [];
}

async function createComment(postId, content, parentId = null) {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
    method: 'POST', headers: jsonH(),
    body: JSON.stringify({ content, parent_id: parentId })
  });
  return res.json();
}

async function deleteComment(commentId) {
  const res = await fetch(`${API_BASE}/comments/${commentId}`, { method: 'DELETE', headers: authH() });
  return res.json();
}

// ── Likes ──
async function likePost(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/like`, { method: 'POST', headers: authH() });
  return res.json();
}
async function unlikePost(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/like`, { method: 'POST', headers: authH() });
  return res.json();
}

// ── Favorites ──
async function favoritePost(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/favorite`, { method: 'POST', headers: authH() });
  return res.json();
}
async function unfavoritePost(postId) {
  const res = await fetch(`${API_BASE}/posts/${postId}/favorite`, { method: 'POST', headers: authH() });
  return res.json();
}

// ── Follows ── (backend: POST /api/follow/:id toggles)
async function follow(userId) {
  const res = await fetch(`${API_BASE}/follow/${userId}`, { method: 'POST', headers: authH() });
  delete userCache[userId]; // 清除缓存，下次获取用户信息会重新请求
  return res.json();
}
async function unfollow(userId) {
  // Same endpoint toggles
  const res = await fetch(`${API_BASE}/follow/${userId}`, { method: 'POST', headers: authH() });
  delete userCache[userId];
  return res.json();
}

// ── User profile ──
async function getUser(id) {
  if (userCache[id]) return userCache[id];
  const res = await fetch(`${API_BASE}/user/${id}`, { headers: authH() });
  const data = await res.json();
  const user = data.data || data;
  userCache[id] = user;
  return user;
}

async function updateProfile(name, bio, avatar) {
  const res = await fetch(`${API_BASE}/user/profile`, {
    method: 'PUT', headers: jsonH(),
    body: JSON.stringify({ name, bio, avatar })
  });
  return res.json();
}

async function changePassword(oldPass, newPass) {
  const res = await fetch(`${API_BASE}/user/password`, {
    method: 'PUT', headers: jsonH(),
    body: JSON.stringify({ oldPwd: oldPass, newPwd: newPass })
  });
  return res.json();
}

// ── Drafts ──
async function saveDraft(title, summary, content, tags, postId = null) {
  const res = await fetch(`${API_BASE}/drafts`, {
    method: 'POST', headers: jsonH(),
    body: JSON.stringify({ post_id: postId, title, summary, content, tags })
  });
  return res.json();
}

async function getDrafts() {
  if (!tok()) return [];
  const res = await fetch(`${API_BASE}/drafts`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function deleteDraft(draftId) {
  const res = await fetch(`${API_BASE}/drafts/${draftId}`, { method: 'DELETE', headers: authH() });
  return res.json();
}

// ── Admin ──
async function getStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, { headers: authH() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || data;
}

async function getAdminPosts() {
  const res = await fetch(`${API_BASE}/admin/posts`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function getAdminUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function getAdminComments() {
  const res = await fetch(`${API_BASE}/admin/comments`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function getAdminLogs() {
  const res = await fetch(`${API_BASE}/admin/audit-log`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function banUser(userId, reason, until) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/ban`, {
    method: 'POST', headers: jsonH(),
    body: JSON.stringify({ reason, until })
  });
  return res.json();
}

async function unbanUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/unban`, {
    method: 'POST', headers: jsonH()
  });
  return res.json();
}

// ── Image upload (to server) ──
function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: jsonH(),
          body: JSON.stringify({ image: reader.result, filename: file.name })
        });
        const data = await res.json();
        if (data.data && data.data.url) {
          resolve(data.data.url);
        } else {
          reject(new Error(data.message || '上传失败'));
        }
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Favorites list ──
async function getMyFavorites() {
  const res = await fetch(`${API_BASE}/user/favorites`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Following list ──
async function getMyFollowing() {
  const res = await fetch(`${API_BASE}/user/following`, { headers: authH() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── User's posts ──
async function getUserPosts(userId) {
  const res = await fetch(`${API_BASE}/user/${userId}/posts`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ============ UI UTILITIES ============
function avatarHtml(name, avatar, size = '') {
  const style = size ? ` style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.45)}px"` : '';
  if (avatar && avatar.startsWith('/')) {
    return `<div class="avatar-sm avatar-img"${style}><img src="${avatar}" onerror="this.outerHTML='${name.charAt(0).toUpperCase()}'"></div>`;
  }
  return `<div class="avatar-sm"${style}>${name.charAt(0).toUpperCase()}</div>`;
}

function showToast(msg, type = 'info') {
  const icons = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 7v5"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>',
  };
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = (icons[type] || '') + msg;
  document.getElementById('toast').appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (isNaN(diff)) return date;
  if (diff < 60) return '刚才';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  return d.toLocaleDateString('zh-CN');
}

// ============ SPA ROUTER ============
async function router() {
  const hash = (location.hash.slice(1) || '/').split('?')[0];
  const parts = hash.split('/').filter(x => x);
  const route = parts[0] || '';
  const param = parts[1] || '';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nlink').forEach(n => n.classList.remove('act'));

  // Unprotected routes
  if (route === 'login') { renderLogin(); return; }
  if (route === 'register') { renderRegister(); return; }

  // Protected
  if (!currentUser) { location.hash = '#/login'; return; }

  try {
    const nav = (page) => document.querySelector(`.nlink[data-page="${page}"]`)?.classList.add('act');
    if (!route || route === 'home') {
      renderHome(parseInt(param) || 1); nav('home');
    } else if (route === 'tag' && param) {
      // #/tag/:name or #/tag/:name/:page
      const tagName = decodeURIComponent(param);
      const pageParam = parts[2] ? parseInt(parts[2]) : 1;
      renderHome(pageParam, tagName); nav('home');
    } else if (route === 'notifications') {
      renderNotifications(parseInt(param) || 1);
    } else if (route === 'post' && param) {
      renderPost(param); nav('home');
    } else if (route === 'write') {
      renderWrite(); nav('write');
    } else if (route === 'profile' && param) {
      renderProfile(param);
    } else if (route === 'my-profile') {
      renderMyProfile(); nav('profile');
    } else if (route === 'favorites') {
      renderFavorites(); nav('favorites');
    } else if (route === 'follows') {
      renderFollows(); nav('follows');
    } else if (route === 'drafts') {
      renderDrafts(); nav('drafts');
    } else if (route === 'admin') {
      if (currentUser.role !== 'admin') { showToast('无权限', 'err'); location.hash = '#/'; return; }
      renderAdmin(); nav('admin');
    } else {
      renderHome(1); nav('home');
    }
  } catch (err) {
    console.error('Route error:', err);
    showToast('页面加载失败', 'err');
  }
}

// ============ INIT ============
window.addEventListener('hashchange', router);

document.addEventListener('DOMContentLoaded', async () => {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  currentUser = await getMe();

  if (currentUser) {
    document.getElementById('auth-box').style.display = 'none';
    document.getElementById('user-box').style.display = 'flex';
    if (currentUser.avatar && currentUser.avatar.startsWith('/')) {
      const avatarText = document.getElementById('avatar-text');
      const userAvatar = document.getElementById('user-avatar');
      if (avatarText && userAvatar) {
        userAvatar.style.background = 'none';
        avatarText.style.cssText = 'width:100%;height:100%;border-radius:50%;overflow:hidden;display:block';
        avatarText.innerHTML = `<img src="${currentUser.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.outerHTML='${currentUser.name.charAt(0).toUpperCase()}'">`;
      }
    } else {
      document.getElementById('avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();
    }
    if (currentUser.role === 'admin') {
      const el = document.getElementById('admin-nav');
      if (el) el.style.display = 'flex';
    }
    // Show notification bell
    document.getElementById('nav-bell').style.display = 'block';
    // Poll unread notifications
    pollNotifCount();
  } else {
    document.getElementById('auth-box').style.display = 'flex';
    document.getElementById('user-box').style.display = 'none';
  }

  document.getElementById('avatar-trigger')?.addEventListener('click', (e) => {
    document.getElementById('user-menu').classList.toggle('open');
    e.stopPropagation();
  });
  document.addEventListener('click', () => {
    document.getElementById('user-menu')?.classList.remove('open');
  });
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  router();
});

// Notification polling
let notifTimer = null;
let lastUnreadCount = 0;
async function pollNotifCount() {
  try {
    const count = await window.API.getUnreadCount();
    const badge = document.getElementById('notif-badge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
    // 如果未读数变了，且有新的增加，且当前在通知页面则自动刷新
    if (count > lastUnreadCount && typeof renderNotifications === 'function') {
      const hash = (location.hash.slice(1) || '/').split('?')[0];
      if (hash.startsWith('notifications')) renderNotifications();
    }
    lastUnreadCount = count;
  } catch {}
  notifTimer = setTimeout(pollNotifCount, 8000);
}

// Global API object
window.API = {
  register, login, getMe, logout, getPosts, getPost, createPost, updatePost, deletePost,
  getComments, createComment, deleteComment, likePost, unlikePost, favoritePost, unfavoritePost,
  follow, unfollow, getUser, updateProfile, changePassword, saveDraft, getDrafts, deleteDraft,
  getStats, getAdminPosts, getAdminUsers, getAdminComments, getAdminLogs, banUser, unbanUser,
  uploadImage, getMyFavorites, getMyFollowing, getUserPosts,
  getAllTags: async () => { const r = await fetch(`${API_BASE}/tags`); const d = await r.json(); return d.data || []; },
  getAnalytics: async (days = 7) => { const r = await fetch(`${API_BASE}/admin/analytics?days=${days}`, { headers: authH() }); if (!r.ok) return null; const d = await r.json(); return d.data || d; },
  getNotifications: async (page = 1) => { const r = await fetch(`${API_BASE}/notifications?page=${page}&limit=20`, { headers: authH() }); const d = await r.json(); return d; },
  getUnreadCount: async () => { const r = await fetch(`${API_BASE}/notifications/unread`, { headers: authH() }); const d = await r.json(); return d.count || 0; },
  markNotifRead: async (id) => { const r = await fetch(`${API_BASE}/notifications/read`, { method: 'PUT', headers: jsonH(), body: JSON.stringify({ id: id || null }) }); return r.json(); },
  getAnnouncements: async () => { const r = await fetch(`${API_BASE}/announcements`); const d = await r.json(); return d.data || []; },
  createAnnouncement: async (title, content) => { const r = await fetch(`${API_BASE}/announcements`, { method: 'POST', headers: jsonH(), body: JSON.stringify({ title, content }) }); return r.json(); },
  deleteAnnouncement: async (id) => { const r = await fetch(`${API_BASE}/announcements/${id}`, { method: 'DELETE', headers: authH() }); return r.json(); },
  getSensitiveWords: async () => { const r = await fetch(`${API_BASE}/admin/sensitive-words`, { headers: authH() }); const d = await r.json(); return d.data || []; },
  addSensitiveWord: async (word) => { const r = await fetch(`${API_BASE}/admin/sensitive-words`, { method: 'POST', headers: jsonH(), body: JSON.stringify({ word }) }); return r.json(); },
  deleteSensitiveWord: async (word) => { const r = await fetch(`${API_BASE}/admin/sensitive-words/${word}`, { method: 'DELETE', headers: authH() }); return r.json(); },
  getPendingProfiles: async () => { const r = await fetch(`${API_BASE}/admin/pending-profiles`, { headers: authH() }); const d = await r.json(); return d.data || []; },
  reviewProfile: async (userId, action) => { const r = await fetch(`${API_BASE}/admin/users/${userId}/profile-review`, { method: 'POST', headers: jsonH(), body: JSON.stringify({ action }) }); return r.json(); }
};
// ============ UI: Confirm Dialog ============
function showConfirm({ title, message, confirmText = '确定', cancelText = '取消', type = 'warn' }) {
  return new Promise((resolve) => {
    const icons = {
      warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
      danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon confirm-icon-${type}">${icons[type] || icons.warn}</div>
        <div class="confirm-title">${title || '确认操作'}</div>
        <div class="confirm-msg">${message || ''}</div>
        <div class="confirm-actions">
          <button class="btn btn-ghost confirm-cancel">${cancelText}</button>
          <button class="btn confirm-ok confirm-ok-${type}">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.confirm-cancel').onclick = () => { bg.remove(); resolve(false); };
    bg.querySelector('.confirm-ok').onclick = () => { bg.remove(); resolve(true); };
    bg.addEventListener('click', (e) => { if (e.target === bg) { bg.remove(); resolve(false); } });
  });
}

window.UI = { showToast, formatDate, formatTimeAgo, avatarHtml, showConfirm };
