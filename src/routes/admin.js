/**
 * src/routes/admin.js - 管理后台（统计、用户/文章/评论管理、审核、审计日志）
 */
const { randomUUID } = require('crypto');
const { q1, qa, run, saveDB, ok, fail, logAudit, notify, getBan, now } = require('../db');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

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
    if (user.role === 'admin' || user.role === 'super_admin') return fail(res, '无法封禁管理员');
    const { reason, until: untilParam } = req.body;
    if (!reason) return fail(res, '请填写封禁原因');
    if (!untilParam) return fail(res, '请选择封禁截止日期');
    // 规范化截止时间格式
    const until = untilParam.length === 10 ? `${untilParam} 23:59:59` : untilParam;
    run('INSERT OR REPLACE INTO bans (user_id, reason, banned_until) VALUES (?,?,?)', [user.id, reason, until]);
    logAudit(req.user.id, 'ban_user', user.id, `${user.name}: ${reason}`);
    // 发通知给被封禁用户
    notify(user.id, req.user.id, 'user_ban', '', `封禁原因：${reason}，解封时间：${until.slice(0, 10)}`);
    // 删除该用户的待处理申诉（重新封禁时清空旧申诉）
    run('DELETE FROM appeals WHERE user_id=? AND status=?', [user.id, 'pending']);
    saveDB();
    ok(res, { message: `已封禁用户 ${user.name}，解封时间：${until.slice(0, 10)}` });
  });

  // 解封用户
  app.post('/api/admin/users/:id/unban', requireAuth, requireAdmin, (req, res) => {
    const user = q1('SELECT * FROM users WHERE id = ?', [req.params.id]);
    run('DELETE FROM bans WHERE user_id = ?', [req.params.id]);
    logAudit(req.user.id, 'unban_user', req.params.id, '');
    // 发通知给被解封用户
    if (user) notify(user.id, req.user.id, 'user_unban', '', '');
    saveDB();
    ok(res, { message: '已解封' });
  });

  // ===================== 申诉管理 =====================

  // 管理员查看所有申诉
  app.get('/api/admin/appeals', requireAuth, requireAdmin, (req, res) => {
    const { status = '' } = req.query;
    const where = status ? 'WHERE a.status=?' : '';
    const params = status ? [status] : [];
    const rows = qa(`SELECT a.*, u.name as userName, u.email as userEmail,
      b.reason as banReason, b.banned_until as bannedUntil
      FROM appeals a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN bans b ON a.user_id = b.user_id
      ${where} ORDER BY a.created_at DESC`, params);
    ok(res, { data: rows });
  });

  // 管理员批准申诉 → 自动解封
  app.post('/api/admin/appeals/:id/approve', requireAuth, requireAdmin, (req, res) => {
    const appeal = q1('SELECT * FROM appeals WHERE id=?', [req.params.id]);
    if (!appeal) return fail(res, '申诉不存在', 404);
    if (appeal.status !== 'pending') return fail(res, '申诉已处理');
    run('UPDATE appeals SET status=?, resolved_at=? WHERE id=?', ['approved', now(), req.params.id]);
    run('DELETE FROM bans WHERE user_id=?', [appeal.user_id]);
    logAudit(req.user.id, 'appeal_approve', appeal.user_id, '');
    notify(appeal.user_id, req.user.id, 'appeal_approved', '', '你的解封申诉已通过，账号已恢复正常');
    saveDB();
    ok(res, { message: '申诉已批准，用户已解封' });
  });

  // 管理员拒绝申诉
  app.post('/api/admin/appeals/:id/reject', requireAuth, requireAdmin, (req, res) => {
    const appeal = q1('SELECT * FROM appeals WHERE id=?', [req.params.id]);
    if (!appeal) return fail(res, '申诉不存在', 404);
    if (appeal.status !== 'pending') return fail(res, '申诉已处理');
    const { note = '' } = req.body;
    run('UPDATE appeals SET status=?, admin_note=?, resolved_at=? WHERE id=?', ['rejected', note, now(), req.params.id]);
    logAudit(req.user.id, 'appeal_reject', appeal.user_id, note);
    notify(appeal.user_id, req.user.id, 'appeal_rejected', '', note ? `申诉被拒绝，原因：${note}` : '你的解封申诉已被拒绝');
    saveDB();
    ok(res, { message: '申诉已拒绝' });
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

  // ===================== 工具函数 =====================
  // 检查管理员是否有权限操作某篇文章（超管可操作全部，普通管理员只能操作被指派的文章）
  function canOperatePost(user, post) {
    if (user.role === 'super_admin') return { ok: true };
    // assigned_to 可能是 NULL 或空字符串，都视为未指派
    if (post.assigned_to === user.id || !post.assigned_to) return { ok: true };
    return { ok: false, msg: `该文章已被指派给 ${post.assigned_to_name || '其他管理员'} 负责，你无权操作` };
  }

  // ===================== 文章管理 =====================
  app.get('/api/admin/posts', requireAuth, requireAdmin, (req, res) => {
    // 自动释放超过 10 分钟未完成的认领
    run(`UPDATE posts SET reviewer_id='', reviewer_claimed_at='' WHERE reviewer_id != '' AND reviewer_claimed_at != '' AND (julianday('now','localtime') - julianday(reviewer_claimed_at)) * 1440 > 10`);
    const rows = qa(`SELECT p.id, p.title, p.created_at, p.updated_at, p.status, p.likes, p.views, u.name as author, p.user_id as authorId,
      CASE WHEN p.pending_title != '' THEN 1 ELSE 0 END as has_pending_edit,
      p.reviewer_id, p.reviewer_claimed_at, p.reviewed_by,
      p.assigned_to, p.assigned_at,
      ru.name as reviewer_name, rbu.name as reviewed_by_name,
      au.name as assigned_to_name
      FROM posts p
      JOIN users u ON p.user_id=u.id
      LEFT JOIN users ru ON p.reviewer_id=ru.id
      LEFT JOIN users rbu ON p.reviewed_by=rbu.id
      LEFT JOIN users au ON p.assigned_to=au.id
      ORDER BY p.created_at DESC`);
    ok(res, { data: rows.map(r => {
      const ts = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: ts.map(t => t.name) };
    }) });
  });

  // 认领文章审核（标记"我正在审"）
  app.post('/api/admin/posts/:id/claim', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT p.*, au.name as assigned_to_name FROM posts p LEFT JOIN users au ON p.assigned_to=au.id WHERE p.id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    // 权限检查
    const check = canOperatePost(req.user, post);
    if (!check.ok) return fail(res, check.msg, 403);
    // 已被别人认领且未超时（10分钟内）
    if (post.reviewer_id && post.reviewer_id !== req.user.id) {
      const claimed = post.reviewer_claimed_at;
      if (claimed) {
        const diffMin = (new Date() - new Date(claimed.replace(' ', 'T'))) / 60000;
        if (diffMin < 10) {
          const reviewer = q1('SELECT name FROM users WHERE id=?', [post.reviewer_id]);
          return fail(res, `该文章已被 ${reviewer?.name || '其他管理员'} 认领，请等待或强制抢占`, 409);
        }
      }
    }
    run(`UPDATE posts SET reviewer_id=?, reviewer_claimed_at=? WHERE id=?`, [req.user.id, now(), req.params.id]);
    saveDB();
    ok(res, { message: '认领成功' });
  });

  // 强制抢占认领（仅超管可用）
  app.post('/api/admin/posts/:id/claim-force', requireAuth, requireAdmin, (req, res) => {
    if (req.user.role !== 'super_admin') return fail(res, '只有超管可以强制抢占', 403);
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    run(`UPDATE posts SET reviewer_id=?, reviewer_claimed_at=? WHERE id=?`, [req.user.id, now(), req.params.id]);
    saveDB();
    ok(res, { message: '已抢占认领' });
  });

  // 释放认领（离开时调用）
  app.post('/api/admin/posts/:id/unclaim', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    if (post.reviewer_id !== req.user.id) return fail(res, '你未认领此文章', 403);
    run(`UPDATE posts SET reviewer_id='', reviewer_claimed_at='' WHERE id=?`, [req.params.id]);
    saveDB();
    ok(res, { message: '已释放认领' });
  });

  // 审核文章（approve/reject）
  app.put('/api/admin/posts/:id/review', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT p.*, au.name as assigned_to_name FROM posts p LEFT JOIN users au ON p.assigned_to=au.id WHERE p.id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    // 权限检查
    const check = canOperatePost(req.user, post);
    if (!check.ok) return fail(res, check.msg, 403);
    const { action, reason } = req.body;
    if (action === 'approve') {
      // 确定最终发布的标题和内容
      const finalTitle = post.pending_title || post.title;
      const finalSummary = post.pending_summary || post.summary || '';
      const finalContent = post.pending_content || post.content;
      
      if (post.pending_title) {
        const newTags = post.pending_tags ? JSON.parse(post.pending_tags) : null;
        // 审核通过时清空 ban_reason（针对被封禁后修改的文章）
        const updateSql = 'UPDATE posts SET title=?, summary=?, content=?, cover=COALESCE(?,cover), status=? , ban_reason=? , updated_at=?, pending_title="", pending_summary="", pending_content="", pending_cover="", pending_tags="", approved_title=?, approved_summary=?, approved_content=?, approved_at=? WHERE id=?';
        const updateParams = [finalTitle, finalSummary, finalContent, post.pending_cover || null, 'published', '', now(), finalTitle, finalSummary, finalContent, now(), req.params.id];
        console.log('[DEBUG] 审核通过 UPDATE, id=', req.params.id, 'params=', updateParams);
        const ok1 = run(updateSql, updateParams);
        if (!ok1) { console.error('审核通过 UPDATE 失败, id=', req.params.id); return fail(res, '审核失败：数据库更新错误', 500); }
        // 验证更新是否成功
        const verify = q1('SELECT id, title, status FROM posts WHERE id=?', [req.params.id]);
        console.log('[DEBUG] 更新后验证:', verify);
        if (newTags && newTags.length > 0) {
          run('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
          for (const tagName of newTags) {
            let existing = q1('SELECT id FROM tags WHERE name = ?', [tagName]);
            if (!existing) { const tid = randomUUID(); run('INSERT INTO tags VALUES (?,?)', [tid, tagName]); existing = { id: tid }; }
            run('INSERT OR IGNORE INTO post_tags VALUES (?,?)', [req.params.id, existing.id]);
          }
        }
      } else {
        // 新文章审核通过，记录已审核内容（同时清空 ban_reason）
        const ok2 = run('UPDATE posts SET status=? , ban_reason=? , updated_at=?, approved_title=?, approved_summary=?, approved_content=?, approved_at=? WHERE id=?',
          ['published', '', now(), finalTitle, finalSummary, finalContent, now(), req.params.id]);
        if (!ok2) { console.error('新文章审核通过 UPDATE 失败, id=', req.params.id); return fail(res, '审核失败：数据库更新错误', 500); }
        // 验证更新是否成功
        const verify = q1('SELECT id, title, status FROM posts WHERE id=?', [req.params.id]);
        console.log('[DEBUG] 新文章审核后验证:', verify);
      }
      // 审核完成：记录审核人，清空认领和指派状态
      run(`UPDATE posts SET reviewed_by=?, reviewer_id='', reviewer_claimed_at='', assigned_to='', assigned_at='' WHERE id=?`, [req.user.id, req.params.id]);
      logAudit(req.user.id, 'approve_post', req.params.id, post.pending_title || post.title);
      notify(post.user_id, req.user.id, 'approve', req.params.id);
      saveDB();
      ok(res, { message: '文章已通过审核' });
    } else if (action === 'reject') {
      if (!reason || !reason.trim()) return fail(res, '请填写拒绝原因');
      // 拒绝：文章status设为rejected，不再显示在首页，保存拒绝原因
      run('UPDATE posts SET status=? , reject_reason=? , pending_title="", pending_summary="", pending_content="", pending_cover="", pending_tags="" WHERE id=?', ['rejected', reason.trim(), req.params.id]);
      // 记录审核人，清空认领和指派状态
      run(`UPDATE posts SET reviewed_by=?, reviewer_id='', reviewer_claimed_at='', assigned_to='', assigned_at='' WHERE id=?`, [req.user.id, req.params.id]);
      logAudit(req.user.id, 'reject_post', req.params.id, `${post.title} | 原因: ${reason.trim()}`);
      notify(post.user_id, req.user.id, 'reject', req.params.id, `原因：${reason.trim()}`);
      saveDB();
      ok(res, { message: '已拒绝，文章从首页隐藏' });
    } else {
      fail(res, '无效操作');
    }
  });

  // 封禁博客（管理员可直接封禁并给出理由）
  app.post('/api/admin/posts/:id/ban', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT p.*, au.name as assigned_to_name FROM posts p LEFT JOIN users au ON p.assigned_to=au.id WHERE p.id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    // 权限检查
    const check = canOperatePost(req.user, post);
    if (!check.ok) return fail(res, check.msg, 403);
    const { reason } = req.body;
    if (!reason || !reason.trim()) return fail(res, '请填写封禁理由');
    
    // 将文章状态设为 banned，并记录封禁理由；同时记录审核人、清空认领和指派状态
    const ok1 = run('UPDATE posts SET status=? , ban_reason=? , updated_at=?, reviewed_by=?, reviewer_id="", reviewer_claimed_at="", assigned_to="", assigned_at="" WHERE id=?', 
      ['banned', reason.trim(), now(), req.user.id, req.params.id]);
    if (!ok1) return fail(res, '封禁失败：数据库更新错误', 500);
    
    logAudit(req.user.id, 'ban_post', req.params.id, `${post.title} | 理由: ${reason.trim()}`);
    notify(post.user_id, req.user.id, 'ban', req.params.id, `原因：${reason.trim()}`);
    saveDB();
    ok(res, { message: '博客已封禁' });
  });

  // 解封博客（作者修改后管理员可解封）
  app.post('/api/admin/posts/:id/unban', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    if (post.status !== 'banned') return fail(res, '该文章未被封禁', 400);
    
    // 将文章状态恢复为 published，清空封禁理由；记录解封人
    const ok1 = run('UPDATE posts SET status=? , ban_reason=? , updated_at=?, reviewed_by=? WHERE id=?', 
      ['published', '', now(), req.user.id, req.params.id]);
    if (!ok1) return fail(res, '解封失败：数据库更新错误', 500);
    
    logAudit(req.user.id, 'unban_post', req.params.id, post.title);
    notify(post.user_id, req.user.id, 'unban', req.params.id);
    saveDB();
    ok(res, { message: '博客已解封' });
  });

  // 获取文章违规内容信息（敏感词匹配+上下文）- 只检测新增/修改部分
  app.get('/api/admin/posts/:id/violation', requireAuth, requireAdmin, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    
    // 检查是否有待审核的修改内容
    const content = post.pending_title ? post.pending_content : post.content;
    const title = post.pending_title || post.title;
    const summary = post.pending_summary || post.summary || '';
    
    if (!content) return ok(res, { data: null });
    
    // 获取已审核通过的内容（用于对比）
    const approvedTitle = post.approved_title || '';
    const approvedSummary = post.approved_summary || '';
    const approvedContent = post.approved_content || '';
    
    // 获取敏感词列表
    const words = qa('SELECT word FROM sensitive_words').map(r => r.word);
    const violations = [];
    
    // 辅助函数：提取新增内容（简单实现：按行对比）
    function getNewLines(newText, oldText) {
      if (!oldText) return newText;
      if (!newText) return '';
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      return newLines.filter(line => !oldLines.includes(line)).join('\n');
    }
    
    // 只检测新增/修改的行
    const deltaTitle = getNewLines(title, approvedTitle);
    const deltaSummary = getNewLines(summary, approvedSummary);
    const deltaContent = getNewLines(content, approvedContent);
    
    // 检测标题中的敏感词
    const titleLower = deltaTitle.toLowerCase();
    for (const word of words) {
      let idx = titleLower.indexOf(word.toLowerCase());
      while (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(deltaTitle.length, idx + word.length + 30);
        let context = deltaTitle.slice(start, end);
        if (start > 0) context = '...' + context;
        if (end < deltaTitle.length) context = context + '...';
        violations.push({ word, context, location: '标题', isNew: true });
        idx = titleLower.indexOf(word.toLowerCase(), idx + 1);
      }
    }
    
    // 检测摘要中的敏感词
    const summaryLower = deltaSummary.toLowerCase();
    for (const word of words) {
      let idx = summaryLower.indexOf(word.toLowerCase());
      while (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(deltaSummary.length, idx + word.length + 30);
        let context = deltaSummary.slice(start, end);
        if (start > 0) context = '...' + context;
        if (end < deltaSummary.length) context = context + '...';
        violations.push({ word, context, location: '摘要', isNew: true });
        idx = summaryLower.indexOf(word.toLowerCase(), idx + 1);
      }
    }
    
    // 检测正文中的敏感词
    const contentLower = deltaContent.toLowerCase();
    for (const word of words) {
      let idx = contentLower.indexOf(word.toLowerCase());
      while (idx !== -1) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(deltaContent.length, idx + word.length + 50);
        let context = deltaContent.slice(start, end);
        if (start > 0) context = '...' + context;
        if (end < deltaContent.length) context = context + '...';
        violations.push({ word, context, location: '正文', isNew: true });
        idx = contentLower.indexOf(word.toLowerCase(), idx + 1);
      }
    }
    
    // 检查是否有封面图片（图片直接推给管理员审核）
    const hasCover = !!(post.pending_title ? post.pending_cover : post.cover);
    const isNewCover = post.pending_cover && post.pending_cover !== post.cover;
    
    ok(res, { data: { violations, hasCover, isNewCover, hasPendingEdit: !!post.pending_title } });
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

  // ===================== 审计日志（兼容旧路径，super_admin 专属） =====================
  app.get('/api/admin/audit-log', requireAuth, requireSuperAdmin, (req, res) => {
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
  // ===================== 超级管理员专属 =====================

  // 获取所有管理员列表（含 super_admin）
  app.get('/api/super/admins', requireAuth, requireSuperAdmin, (req, res) => {
    const admins = qa(`SELECT u.id, u.name, u.email, u.role, u.created_at,
      (SELECT COUNT(*) FROM audit_log WHERE user_id=u.id) as op_count,
      (SELECT created_at FROM audit_log WHERE user_id=u.id ORDER BY created_at DESC LIMIT 1) as last_op
      FROM users u WHERE u.role IN ('admin','super_admin') ORDER BY u.created_at ASC`);
    ok(res, { data: admins });
  });

  // 设置用户为管理员
  app.post('/api/super/admins/:id/grant', requireAuth, requireSuperAdmin, (req, res) => {
    const user = q1('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!user) return fail(res, '用户不存在', 404);
    if (user.role === 'super_admin') return fail(res, '不能修改超级管理员');
    if (user.role === 'admin') return fail(res, '该用户已是管理员');
    run('UPDATE users SET role=? WHERE id=?', ['admin', req.params.id]);
    logAudit(req.user.id, 'grant_admin', req.params.id, `${user.name} 被设为管理员`);
    saveDB();
    ok(res, { message: `已将 ${user.name} 设为管理员` });
  });

  // 取消用户的管理员权限
  app.post('/api/super/admins/:id/revoke', requireAuth, requireSuperAdmin, (req, res) => {
    const user = q1('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!user) return fail(res, '用户不存在', 404);
    if (user.role === 'super_admin') return fail(res, '不能撤销超级管理员');
    if (user.role !== 'admin') return fail(res, '该用户不是管理员');
    run('UPDATE users SET role=? WHERE id=?', ['user', req.params.id]);
    logAudit(req.user.id, 'revoke_admin', req.params.id, `${user.name} 被取消管理员`);
    saveDB();
    ok(res, { message: `已取消 ${user.name} 的管理员权限` });
  });

  // 审计日志（超级管理员专属，可按操作人筛选）
  app.get('/api/super/audit-log', requireAuth, requireSuperAdmin, (req, res) => {
    const { page = 1, limit = 20, userId = '', role = '', keyword = '' } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    const offset = (p - 1) * l;

    let where = [];
    let params = [];

    if (userId) {
      where.push('a.user_id=?');
      params.push(userId);
    }
    if (role) {
      where.push('u.role=?');
      params.push(role);
    }
    if (keyword) {
      where.push('u.name LIKE ?');
      params.push(`%${keyword}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = q1(`SELECT COUNT(*) as c FROM audit_log a LEFT JOIN users u ON a.user_id=u.id ${whereClause}`, params)?.c || 0;
    const rows = qa(`SELECT a.*, u.name as userName, u.role as userRole
      FROM audit_log a LEFT JOIN users u ON a.user_id=u.id
      ${whereClause} ORDER BY a.created_at DESC LIMIT ${l} OFFSET ${offset}`, params);
    ok(res, { data: rows, pagination: { page: p, limit: l, total } });
  });

}

module.exports = setupAdminRoutes;