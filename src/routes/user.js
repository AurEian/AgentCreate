/**
 * src/routes/user.js - 用户资料/密码/关注
 */
const { q1, qa, run, saveDB, ok, fail, notify } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

function setupUserRoutes(app) {
  // 收藏列表（必须在 /api/user/:id 之前）
  app.get('/api/user/favorites', requireAuth, (req, res) => {
    const { page = 1, limit = 6 } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    const total = q1('SELECT COUNT(*) as c FROM favorites f JOIN posts p ON f.post_id=p.id WHERE f.user_id=?', [req.user.id])?.c || 0;
    const offset = (p - 1) * l;
    const rows = qa(`SELECT p.id, p.title, p.summary, p.created_at, u.name as author, u.avatar as author_avatar, p.likes, p.views
      FROM favorites f JOIN posts p ON f.post_id=p.id JOIN users u ON p.user_id=u.id
      WHERE f.user_id=? ORDER BY f.created_at DESC LIMIT ${l} OFFSET ${offset}`, [req.user.id]);
    const result = rows.map(r => {
      const tRows = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: tRows.map(t => t.name) };
    });
    ok(res, { data: result, pagination: { page: p, limit: l, total } });
  });

  // 关注列表（必须在 /api/user/:id 之前）
  app.get('/api/user/following', requireAuth, (req, res) => {
    const rows = qa(`SELECT u.id, u.name, u.bio, u.avatar FROM follows f JOIN users u ON f.following_id=u.id WHERE f.follower_id=? ORDER BY f.created_at DESC`, [req.user.id]);
    ok(res, { data: rows });
  });

  // 获取用户信息
  app.get('/api/user/:id', optionalAuth, (req, res) => {
    const u = q1('SELECT id,name,email,role,avatar,bio,created_at FROM users WHERE id=?', [req.params.id]);
    if (!u) return fail(res, '用户不存在', 404);
    const postCount = q1('SELECT COUNT(*) as c FROM posts WHERE user_id=? AND status="published"', [u.id])?.c || 0;
    const followerCount = q1('SELECT COUNT(*) as c FROM follows WHERE following_id=?', [u.id])?.c || 0;
    const followingCount = q1('SELECT COUNT(*) as c FROM follows WHERE follower_id=?', [u.id])?.c || 0;
    let isFollowing = false;
    if (req.user && req.user.id !== u.id) {
      isFollowing = !!q1('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, u.id]);
    }
    ok(res, { data: { ...u, postCount, followerCount, followingCount, isFollowing } });
  });

  // 用户文章列表
  app.get('/api/user/:id/posts', (req, res) => {
    const rows = qa(`SELECT p.id, p.title, p.summary, p.created_at, p.likes, p.views, u.name as author_name, u.avatar as author_avatar, p.user_id
      FROM posts p JOIN users u ON p.user_id=u.id WHERE p.user_id=? AND p.status='published' ORDER BY p.created_at DESC`, [req.params.id]);
    const withTags = rows.map(r => {
      const tRows = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: tRows.map(t => t.name) };
    });
    ok(res, { data: withTags });
  });

  // 敏感词检查函数
function checkSensitive(text) {
  if (!text) return null;
  const words = qa('SELECT word FROM sensitive_words');
  for (const w of words) {
    if (text.toLowerCase().includes(w.word.toLowerCase())) return w.word;
  }
  return null;
}

// 修改个人资料
  app.put('/api/user/profile', requireAuth, (req, res) => {
    const { name, bio, avatar } = req.body;
    
    // 检查敏感词
    const sensitiveName = name ? checkSensitive(name) : null;
    const sensitiveBio = bio ? checkSensitive(bio) : null;
    
    if (sensitiveName || sensitiveBio) {
      // 有敏感词：暂不直接修改，记录待审核
      const pendingName = name?.trim() || '';
      const pendingBio = bio !== undefined ? bio : '';
      if (name) run('UPDATE users SET pending_name=? WHERE id=?', [pendingName, req.user.id]);
      if (bio !== undefined) run('UPDATE users SET pending_bio=? WHERE id=?', [pendingBio, req.user.id]);
      run('UPDATE users SET profile_pending=1 WHERE id=?', [req.user.id]);
      saveDB();
      
      // 通知管理员
      const admins = qa('SELECT id FROM users WHERE role="admin"');
      const { notify } = require('../db');
      admins.forEach(a => notify(a.id, req.user.id, 'profile_review', ''));
      
      return ok(res, { message: '资料包含敏感词，已提交审核', pending: true });
    }
    
    // 无敏感词：直接修改
    if (name) run('UPDATE users SET name=? WHERE id=?', [name.trim(), req.user.id]);
    if (bio !== undefined) run('UPDATE users SET bio=? WHERE id=?', [bio, req.user.id]);
    if (avatar !== undefined) run('UPDATE users SET avatar=? WHERE id=?', [avatar, req.user.id]);
    saveDB();
    const u = q1('SELECT id,name,email,role,avatar,bio FROM users WHERE id=?', [req.user.id]);
    ok(res, { message: '资料已更新', user: u });
  });

  // 修改密码
  app.put('/api/user/password', requireAuth, (req, res) => {
    const { oldPwd, newPwd } = req.body;
    if (!oldPwd || !newPwd) return fail(res, '请填写旧密码和新密码');
    if (newPwd.length < 3) return fail(res, '新密码至少3位');
    const u = q1('SELECT password FROM users WHERE id=?', [req.user.id]);
    if (!u || u.password !== oldPwd) return fail(res, '旧密码错误');
    run('UPDATE users SET password=? WHERE id=?', [newPwd, req.user.id]);
    saveDB();
    ok(res, { message: '密码已修改' });
  });

  // 关注/取关（toggle）
  app.post('/api/follow/:id', requireAuth, (req, res) => {
    if (req.user.id === req.params.id) return fail(res, '不能关注自己');
    const target = q1('SELECT id FROM users WHERE id=?', [req.params.id]);
    if (!target) return fail(res, '用户不存在', 404);
    const exists = q1('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, req.params.id]);
    if (exists) {
      run('DELETE FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, req.params.id]);
      saveDB();
      ok(res, { message: '已取消关注', following: false });
    } else {
      run('INSERT INTO follows VALUES (?,?,?)', [req.user.id, req.params.id, now()]);
      saveDB();
      notify(req.params.id, req.user.id, 'follow');
      ok(res, { message: '已关注', following: true });
    }
  });

  // 查询关注状态
  app.get('/api/follow/status', requireAuth, (req, res) => {
    const { userId } = req.query;
    if (!userId) return ok(res, { data: { following: false } });
    const exists = q1('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, userId]);
    ok(res, { data: { following: !!exists } });
  });
}

module.exports = setupUserRoutes;
