/**
 * src/routes/admin.js - 管理后台（统计、用户/文章/评论管理、审核、审计日志）
 */
const { randomUUID } = require('crypto');
const { q1, qa, run, saveDB, ok, fail, logAudit, notify, getBan, now } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function setupAdminRoutes(app) {
  // ===================== 统计仪表盘 =====================
  app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
    const totalPosts = q1('SELECT COUNT(*) as c FROM posts')?.c || 0;
    const totalUsers = q1('SELECT COUNT(*) as c FROM users')?.c || 0;
    const totalComments = q1('SELECT COUNT(*) as c FROM comments')?.c || 0;
    const todayStr = now().slice(0, 10);
    const totalBans = q1('SELECT COUNT(*) as c FROM bans WHERE banned_until > ?', [now()])?.c || 0;
    const todayPosts = q1('SELECT COUNT(*) as c FROM posts WHERE date(created_at)=?', [todayStr])?.c || 0;
    const todayComments = q1('SELECT COUNT(*) as c FROM comments WHERE date(created_at)=?', [todayStr])?.c || 0;
    const recentPosts = qa('SELECT p.id,p.title,p.created_at,u.name as author FROM posts p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC LIMIT 5');
    const recentComments = qa('SELECT c.content,c.created_at,u.name as author FROM comments c JOIN users u ON c.user_id=u.id ORDER BY c.created_at DESC LIMIT 5');
    ok(res, { data: { totalPosts, totalUsers, totalComments, totalBans, todayPosts, todayComments, recentPosts, recentComments } });
  });

  // ===================== 数据分析 =====================
  app.get('/api/admin/analytics', requireAuth, requireAdmin, (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const cutoffDate = new Date(Date.now() - days * 86400000);
    const pad = n => String(n).padStart(2, '0');
    const cutoffStr = `${cutoffDate.getFullYear()}-${pad(cutoffDate.getMonth()+1)}-${pad(cutoffDate.getDate())} ${pad(cutoffDate.getHours())}:${pad(cutoffDate.getMinutes())}:${pad(cutoffDate.getSeconds())}`;
    
    const rows = qa(`
      SELECT date(created_at) as day,
        COUNT(DISTINCT CASE WHEN table_name='users' THEN row_id END) as new_users,
        COUNT(DISTINCT CASE WHEN table_name='posts' THEN row_id END) as new_posts,
        COUNT(DISTINCT CASE WHEN table_name='comments' THEN row_id END) as new_comments
      FROM (
        SELECT 'users' as table_name, id as row_id, created_at FROM users WHERE created_at >= ?
        UNION ALL
        SELECT 'posts', id, created_at FROM posts WHERE created_at >= ?
        UNION ALL
        SELECT 'comments', id, created_at FROM comments WHERE created_at >= ?
      ) GROUP BY day ORDER BY day
    `, [cutoffStr, cutoffStr, cutoffStr]);
    const popularPosts = qa(`
      SELECT p.id, p.title, p.views, p.likes, u.name as author,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) as comment_count
      FROM posts p JOIN users u ON p.user_id=u.id
      WHERE p.status='published'
      ORDER BY p.views DESC LIMIT 10
    `);
    const tagDist = qa(`
      SELECT t.name, COUNT(pt.post_id) as cnt
      FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.id
      GROUP BY t.id HAVING cnt > 0 ORDER BY cnt DESC LIMIT 10
    `);
    ok(res, { data: { trend: rows, popularPosts, tagDist } });
  });

  // ===================== 用户管理 =====================
  app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const rows = qa('SELECT u.id, u.email, u.name, u.role, u.avatar, u.bio, u.created_at FROM users u');
    ok(res, { data: rows.map(u => ({
      ...u, postCount: (q1('SELECT COUNT(*) as c FROM posts WHERE user_id=?', [u.id])?.c) || 0,
      ban: getBan(u.id) || null
    })) });
  });

  // 封禁用户
  app.post('/api/admin/users/:id/ban', requireAuth, requireAdmin, (req, res) => {
    const user = q1('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return fail(res, '用户不存在', 404);
    if (user.role === 'admin') return fail(res, '无法封禁管理员');
    const { reason, duration = 30 } = req.body;
    if (!reason) return fail(res, '请填写封禁原因');
    const futureDate = new Date(Date.now() + parseInt(duration) * 86400000);
    const pad = n => String(n).padStart(2, '0');
    const until = `${futureDate.getFullYear()}-${pad(futureDate.getMonth()+1)}-${pad(futureDate.getDate())} ${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}:${pad(futureDate.getSeconds())}`;
    run('INSERT OR REPLACE INTO bans (user_id, reason, banned_until) VALUES (?,?,?)', [user.id, reason, until]);
    logAudit(req.user.id, 'ban_user', user.id, `${user.name}: ${reason} (${duration}天)`);
    saveDB();
    ok(res, { message: `已封禁用户 ${user.name}，解封时间：${until}` });
  });

  // 解封用户
  app.post('/api/admin/users/:id/unban', requireAuth, requireAdmin, (req, res) => {
    run('DELETE FROM bans WHERE user_id = ?', [req.params.id]);
    logAudit(req.user.id, 'unban_user', req.params.id, '');
    saveDB();
    ok(res, { message: '已解封' });
  });

  // ===================== 敏感词管理 =====================
  app.get('/api/admin/sensitive-words', requireAuth, requireAdmin, (req, res) => {
    ok(res, { data: qa('SELECT * FROM sensitive_words ORDER BY id') });
  });

  app.post('/api/admin/sensitive-words', requireAuth, requireAdmin, (req, res) => {
    const { word } = req.body;
    if (!word) return fail(res, '请输入敏感词');
    try {
      run('INSERT INTO sensitive_words (word) VALUES (?)', [word.trim()]);
      saveDB();
      ok(res, { message: '添加成功' });
    } catch {
      fail(res, '敏感词已存在');
    }
  });

  app.delete('/api/admin/sensitive-words/:word', requireAuth, requireAdmin, (req, res) => {
    run('DELETE FROM sensitive_words WHERE word = ?', [req.params.word]);
    saveDB();
    ok(res, { message: '删除成功' });
  });

  // ===================== 文章管理 =====================
  app.get('/api/admin/posts', requireAuth, requireAdmin, (req, res) => {
    const rows = qa(`SELECT p.id, p.title, p.created_at, p.updated_at, p.status, p.likes, p.views, u.name as author, p.user_id as authorId,
      CASE WHEN p.pending_title != '' THEN 1 ELSE 0 END as has_pending_edit
      FROM posts p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC`);
    ok(res, { data: rows.map(r => {
      const ts = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: ts.map(t => t.name) };
    }) });
  });

  // 审核文章（approve/reject）
  app.put('/api/admin/posts/:id/review', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    const { action } = req.body;
    if (action === 'approve') {
      if (post.pending_title) {
        const newTags = post.pending_tags ? JSON.parse(post.pending_tags) : null;
        run('UPDATE posts SET title=?, summary=?, content=?, cover=COALESCE(?,cover), status="published", pending_title="", pending_summary="", pending_content="", pending_cover="", pending_tags="" WHERE id=?',
          [post.pending_title, post.pending_summary || '', post.pending_content || '', post.pending_cover || null, req.params.id]);
        if (newTags && newTags.length > 0) {
          run('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
          for (const tagName of newTags) {
            let existing = q1('SELECT id FROM tags WHERE name = ?', [tagName]);
            if (!existing) { const tid = randomUUID(); run('INSERT INTO tags VALUES (?,?)', [tid, tagName]); existing = { id: tid }; }
            run('INSERT OR IGNORE INTO post_tags VALUES (?,?)', [req.params.id, existing.id]);
          }
        }
      } else {
        run('UPDATE posts SET status="published" WHERE id=?', [req.params.id]);
      }
      logAudit(req.user.id, 'approve_post', req.params.id, post.pending_title || post.title);
      notify(post.user_id, req.user.id, 'approve', req.params.id);
      saveDB();
      ok(res, { message: '文章已通过审核' });
    } else if (action === 'reject') {
      // 拒绝：文章status设为rejected，不再显示在首页
      run('UPDATE posts SET status="rejected", pending_title="", pending_summary="", pending_content="", pending_cover="", pending_tags="" WHERE id=?', [req.params.id]);
      logAudit(req.user.id, 'reject_post', req.params.id, post.title);
      notify(post.user_id, req.user.id, 'reject', req.params.id);
      saveDB();
      ok(res, { message: '已拒绝，文章从首页隐藏' });
    } else {
      fail(res, '无效操作');
    }
  });

  // 获取文章违规内容信息（敏感词匹配+上下文）
  app.get('/api/admin/posts/:id/violation', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    
    // 检查是否有待审核的修改内容
    const content = post.pending_title ? post.pending_content : post.content;
    const title = post.pending_title || post.title;
    const summary = post.pending_summary || post.summary || '';
    
    if (!content) return ok(res, { data: null });
    
    // 获取敏感词列表
    const words = qa('SELECT word FROM sensitive_words').map(r => r.word);
    const violations = [];
    const fullText = `${title} ${summary} ${content}`.toLowerCase();
    
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      const idx = fullText.indexOf(lowerWord);
      if (idx !== -1) {
        // 获取上下文（前后各50个字符）
        const start = Math.max(0, idx - 50);
        const end = Math.min(fullText.length, idx + word.length + 50);
        let context = fullText.slice(start, end);
        if (start > 0) context = '...' + context;
        if (end < fullText.length) context = context + '...';
        
        // 确定违规位置（标题/摘要/正文）
        let location = '正文';
        const titleLower = title.toLowerCase();
        const summaryLower = summary.toLowerCase();
        const titleIdx = titleLower.indexOf(lowerWord);
        const summaryIdx = summaryLower.indexOf(lowerWord);
        if (titleIdx !== -1) location = '标题';
        else if (summaryIdx !== -1) location = '摘要';
        
        violations.push({ word, context, location });
      }
    }
    
    // 检查是否有封面图片（图片直接推给管理员审核）
    const hasCover = !!post.pending_cover || !!post.cover;
    
    ok(res, { data: { violations, hasCover, hasPendingEdit: !!post.pending_title } });
  });

  // 管理员删除文章
  app.delete('/api/admin/posts/:id', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT title FROM posts WHERE id=?', [req.params.id]);
    run('DELETE FROM comments WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM likes WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM favorites WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    logAudit(req.user.id, 'admin_delete_post', req.params.id, post?.title || '');
    saveDB();
    ok(res, { message: '文章已删除' });
  });

  // 批量删除文章
  app.post('/api/admin/posts/batch-delete', requireAuth, requireAdmin, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return fail(res, '请选择要删除的文章');
    ids.forEach(pid => {
      run('DELETE FROM comments WHERE post_id = ?', [pid]);
      run('DELETE FROM likes WHERE post_id = ?', [pid]);
      run('DELETE FROM favorites WHERE post_id = ?', [pid]);
      run('DELETE FROM post_tags WHERE post_id = ?', [pid]);
      run('DELETE FROM posts WHERE id = ?', [pid]);
    });
    logAudit(req.user.id, 'admin_batch_delete_posts', '', `${ids.length}篇`);
    saveDB();
    ok(res, { message: `已删除 ${ids.length} 篇文章` });
  });

  // ===================== 评论管理 =====================
  app.get('/api/admin/comments', requireAuth, requireAdmin, (req, res) => {
    const rows = qa(`SELECT c.*, u.name as author, p.title as postTitle FROM comments c
      JOIN users u ON c.user_id=u.id JOIN posts p ON c.post_id=p.id ORDER BY c.created_at DESC`);
    ok(res, { data: rows });
  });

  app.delete('/api/admin/comments/:id', requireAuth, requireAdmin, (req, res) => {
    const replies = qa('SELECT id FROM comments WHERE parent_id=?', [req.params.id]);
    replies.forEach(r => run('DELETE FROM comments WHERE id=?', [r.id]));
    run('DELETE FROM comments WHERE id=?', [req.params.id]);
    logAudit(req.user.id, 'admin_delete_comment', req.params.id, '');
    saveDB();
    ok(res, { message: '评论已删除' });
  });

  // ===================== 审计日志 =====================
  app.get('/api/admin/audit-log', requireAuth, requireAdmin, (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    const offset = (p - 1) * l;
    const total = q1('SELECT COUNT(*) as c FROM audit_log')?.c || 0;
    const rows = qa(`SELECT a.*, u.name as userName FROM audit_log a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.created_at DESC LIMIT ${l} OFFSET ${offset}`);
    ok(res, { data: rows, pagination: { page: p, limit: l, total } });
  });

  // 用户资料审核
  app.get('/api/admin/pending-profiles', requireAuth, requireAdmin, (req, res) => {
    const rows = qa(`SELECT id, name, pending_name, pending_bio, bio, avatar, created_at FROM users WHERE profile_pending=1`);
    ok(res, { data: rows });
  });

  app.post('/api/admin/users/:id/profile-review', requireAuth, requireAdmin, (req, res) => {
    const user = q1('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!user) return fail(res, '用户不存在', 404);
    const { action } = req.body;
    if (action === 'approve') {
      if (user.pending_name) run('UPDATE users SET name=?, pending_name="" WHERE id=?', [user.pending_name, req.params.id]);
      if (user.pending_bio !== null) run('UPDATE users SET bio=?, pending_bio="" WHERE id=?', [user.pending_bio, req.params.id]);
      run('UPDATE users SET profile_pending=0 WHERE id=?', [req.params.id]);
      logAudit(req.user.id, 'approve_profile', req.params.id, user.pending_name || user.name);
      notify(req.params.id, req.user.id, 'profile_approve', '');
      saveDB();
      ok(res, { message: '资料已通过审核' });
    } else if (action === 'reject') {
      run('UPDATE users SET pending_name="", pending_bio="", profile_pending=0 WHERE id=?', [req.params.id]);
      logAudit(req.user.id, 'reject_profile', req.params.id, '');
      notify(req.params.id, req.user.id, 'profile_reject', '');
      saveDB();
      ok(res, { message: '已拒绝修改' });
    } else {
      fail(res, '无效操作');
    }
  });
}

module.exports = setupAdminRoutes;