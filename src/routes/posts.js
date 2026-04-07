/**
 * src/routes/posts.js - 文章 CRUD、草稿、标签、搜索、关于
 */
const { randomUUID } = require('crypto');
const { q1, qa, run, saveDB, ok, fail, getBan, logAudit, notify, now } = require('../db');
const { requireAuth } = require('../middleware/auth');

// 从数据库加载敏感词
function getSensitiveWords() {
  return qa('SELECT word FROM sensitive_words').map(r => r.word);
}

// 检查敏感词
function checkSensitiveWords(text) {
  if (!text) return null;
  const words = getSensitiveWords();
  const lower = text.toLowerCase();
  for (const word of words) {
    if (lower.includes(word)) return word;
  }
  return null;
}

function setupPostRoutes(app) {
  // 获取文章列表（支持分页、标签筛选、搜索、按用户筛选）
  app.get('/api/posts', (req, res) => {
    const { page = 1, limit = 6, tag, search, user_id } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    let where = 'WHERE p.status="published" AND 1=1', params = [];
    if (tag) { where += " AND EXISTS(SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id=t.id WHERE pt.post_id=p.id AND t.name=?)"; params.push(tag); }
    if (search) { where += ' AND (p.title LIKE ? OR p.summary LIKE ? OR p.content LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (user_id) { where += ' AND p.user_id=?'; params.push(user_id); }

    const total = q1(`SELECT COUNT(*) as c FROM posts p ${where}`, params)?.c || 0;
    const offset = (p - 1) * l;
    const orderBy = search
      ? `ORDER BY (CASE WHEN LOWER(p.title)=LOWER(?) THEN 0 WHEN p.title LIKE ? THEN 1 WHEN p.summary LIKE ? THEN 2 ELSE 3 END), p.created_at DESC`
      : 'ORDER BY p.created_at DESC';
    const searchParams = search ? [search, `%${search}%`, `%${search}%`] : [];
    const rows = qa(`SELECT p.id, p.title, p.summary, p.created_at, p.updated_at, u.name as author, u.id as authorId, u.avatar as author_avatar, p.likes, p.views, p.cover
      FROM posts p JOIN users u ON p.user_id=u.id ${where} GROUP BY p.id ${orderBy} LIMIT ${l} OFFSET ${offset}`, [...params, ...searchParams]);

    const result = rows.map(r => {
      const tRows = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: tRows.map(t => t.name) };
    });
    ok(res, { data: result, pagination: { page: p, limit: l, total } });
  });

  // 获取文章详情
  app.get('/api/posts/:id', (req, res) => {
    const post = q1(`SELECT p.*, u.name as author, u.id as authorId, u.avatar as author_avatar FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id = ?`, [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    const tRows = qa(`SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?`, [post.id]);
    const commentCount = q1('SELECT COUNT(*) as c FROM comments WHERE post_id=?', [post.id])?.c || 0;
    run('UPDATE posts SET views=views+1 WHERE id=?', [post.id]);
    saveDB();
    ok(res, { data: { ...post, tags: tRows.map(t => t.name), commentCount } });
  });

  // 创建文章（带敏感词自动过滤）
  app.post('/api/posts', requireAuth, (req, res) => {
    const ban = getBan(req.user.id);
    if (ban) return fail(res, `你已被封禁，无法发布文章。原因：${ban.reason}`, 403);
    const { title, summary, content, tags = [], cover = '' } = req.body;
    if (!title || !content) return fail(res, '标题和内容不能为空');

    // 检查敏感词
    const fullText = `${title} ${summary || ''} ${content}`;
    const matchedWord = checkSensitiveWords(fullText);
    let status = 'pending'; // 默认待审核
    let message = '文章已提交审核';

    // 管理员直接发布，用户文章如果无敏感词则直接发布
    if (req.user.role === 'admin') {
      status = 'published';
      message = '文章发布成功';
    } else if (!matchedWord) {
      // 无敏感词直接通过
      status = 'published';
      message = '文章发布成功';
    } else {
      // 有敏感词，标记为待审核并通知管理员
      message = '文章含敏感内容，已提交审核';
    }

    const id = randomUUID();
    run('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, req.user.id, title.trim(), (summary || '').trim(), content, cover, status, 0, 0, now(), now(), '', '', '', '', '']);
    for (const tagName of tags) {
      let existing = q1('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!existing) { const tid = randomUUID(); run('INSERT INTO tags VALUES (?,?)', [tid, tagName]); existing = { id: tid }; }
      run('INSERT OR IGNORE INTO post_tags VALUES (?,?)', [id, existing.id]);
    }
    logAudit(req.user.id, status === 'published' ? 'publish_post' : 'submit_post', id, title);
    if (status === 'pending') {
      const admins = qa('SELECT id FROM users WHERE role="admin"');
      admins.forEach(a => notify(a.id, req.user.id, 'review', id));
    }
    saveDB();
    ok(res, { message, data: { id, title, status }, matchedWord });
  });

  // 更新文章
  app.put('/api/posts/:id', requireAuth, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, '无权编辑此文章', 403);
    const { title, summary, content, tags, cover } = req.body;

    // 非管理员修改已发布/已拒绝文章 → pending 机制（检查敏感词）
    if (req.user.role !== 'admin' && (post.status === 'published' || post.status === 'rejected')) {
      const newTitle = title !== undefined ? title.trim() : post.title;
      const newSummary = summary !== undefined ? (summary || '').trim() : post.summary;
      const newContent = content || post.content;
      const newCover = cover || null;
      const newTags = tags ? JSON.stringify(tags) : '';
      
      // 检查新内容是否含敏感词
      const fullText = `${newTitle} ${newSummary} ${newContent}`;
      const matchedWord = checkSensitiveWords(fullText);
      
      if (!matchedWord) {
        // 无敏感词，直接发布新版本
        run('UPDATE posts SET title=?, summary=?, content=?, cover=?, tags=?, status=?, updated_at=? WHERE id=?',
          [newTitle, newSummary, newContent, newCover, newTags, 'published', now(), req.params.id]);
        logAudit(req.user.id, 'edit_post', req.params.id, newTitle);
        saveDB();
        return ok(res, { message: '修改已发布', data: { id: req.params.id, status: 'published' }, matchedWord: null });
      } else {
        // 有敏感词，存入 pending 等待审核
        run('UPDATE posts SET pending_title=?, pending_summary=?, pending_content=?, pending_cover=?, pending_tags=?, status=?, updated_at=? WHERE id=?',
          [newTitle, newSummary, newContent, newCover, newTags, 'pending', now(), req.params.id]);
        const admins = qa('SELECT id FROM users WHERE role="admin"');
        admins.forEach(a => notify(a.id, req.user.id, 'review', req.params.id));
        logAudit(req.user.id, 'edit_post', req.params.id, newTitle);
        saveDB();
        return ok(res, { message: '修改含敏感内容，已提交审核', data: { id: req.params.id, status: 'pending' }, matchedWord });
      }
    }

    // 管理员或修改草稿/pending文章 → 直接覆盖
    if (title !== undefined) run('UPDATE posts SET title=?, summary=?, content=?, updated_at=?, cover=COALESCE(?,cover) WHERE id=?',
      [title.trim(), summary !== undefined ? (summary || '').trim() : post.summary, content || post.content, now(), cover || null, req.params.id]);
    if (tags) {
      run('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
      for (const tagName of tags) {
        let existing = q1('SELECT id FROM tags WHERE name = ?', [tagName]);
        if (!existing) { const tid = randomUUID(); run('INSERT INTO tags VALUES (?,?)', [tid, tagName]); existing = { id: tid }; }
        run('INSERT OR IGNORE INTO post_tags VALUES (?,?)', [req.params.id, existing.id]);
      }
    }
    // 如果是管理员修改他人文章，通知作者
    if (req.user.role === 'admin' && post.user_id !== req.user.id) {
      notify(post.user_id, req.user.id, 'admin_edit', req.params.id);
    }
    logAudit(req.user.id, 'edit_post', req.params.id, title || '');
    saveDB();
    ok(res, { message: '文章更新成功', data: { id: req.params.id, status: post.status } });
  });

  // 删除文章
  app.delete('/api/posts/:id', requireAuth, (req, res) => {
    const post = q1('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, '无权删除此文章', 403);
    run('DELETE FROM comments WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM likes WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM favorites WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM post_tags WHERE post_id = ?', [req.params.id]);
    run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    logAudit(req.user.id, 'delete_post', req.params.id, post.title);
    saveDB();
    ok(res, { message: '文章已删除' });
  });

  // ===================== 点赞 =====================
  app.post('/api/posts/:id/like', requireAuth, (req, res) => {
    const post = q1('SELECT id FROM posts WHERE id=?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    const exists = q1('SELECT 1 FROM likes WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
    if (exists) {
      run('DELETE FROM likes WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
      run('UPDATE posts SET likes=MAX(0,likes-1) WHERE id=?', [req.params.id]);
      saveDB();
      ok(res, { liked: false });
    } else {
      run('INSERT INTO likes VALUES (?,?)', [req.user.id, req.params.id]);
      run('UPDATE posts SET likes=likes+1 WHERE id=?', [req.params.id]);
      saveDB();
      const postAuthor = q1('SELECT user_id FROM posts WHERE id=?', [req.params.id]);
      if (postAuthor && postAuthor.user_id !== req.user.id) notify(postAuthor.user_id, req.user.id, 'like', req.params.id);
      ok(res, { liked: true });
    }
  });

  app.get('/api/posts/:id/liked', requireAuth, (req, res) => {
    const exists = q1('SELECT 1 FROM likes WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
    ok(res, { liked: !!exists });
  });

  // ===================== 收藏 =====================
  app.get('/api/posts/:id/favorited', requireAuth, (req, res) => {
    const exists = q1('SELECT 1 FROM favorites WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
    ok(res, { favorited: !!exists });
  });

  app.post('/api/posts/:id/favorite', requireAuth, (req, res) => {
    const post = q1('SELECT id FROM posts WHERE id=?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    const exists = q1('SELECT 1 FROM favorites WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
    if (exists) {
      run('DELETE FROM favorites WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]);
      saveDB();
      ok(res, { favorited: false });
    } else {
      run('INSERT INTO favorites VALUES (?,?,?)', [req.user.id, req.params.id, now()]);
      saveDB();
      const postAuthor = q1('SELECT user_id FROM posts WHERE id=?', [req.params.id]);
      if (postAuthor && postAuthor.user_id !== req.user.id) notify(postAuthor.user_id, req.user.id, 'favorite', req.params.id);
      ok(res, { favorited: true });
    }
  });

  // ===================== 草稿 =====================
  app.get('/api/drafts', requireAuth, (req, res) => {
    // 每篇文章只保留最新草稿：按 post_id 分组取最新
    const rows = qa(`
      SELECT d.* FROM drafts d
      LEFT JOIN posts p ON d.post_id = p.id
      WHERE d.user_id=? 
      ORDER BY d.updated_at DESC
    `, [req.user.id]);
    // 按 post_id 去重，保留最新
    const seen = new Set();
    const deduped = [];
    rows.forEach(r => {
      if (!r.post_id) {
        deduped.push(r); // 无文章关联的独立草稿保留
      } else if (!seen.has(r.post_id)) {
        seen.add(r.post_id);
        deduped.push(r);
      }
    });
    deduped.forEach(r => { try { r.tags = JSON.parse(r.tags || '[]'); } catch { r.tags = []; } });
    ok(res, { data: deduped });
  });

  app.post('/api/drafts', requireAuth, (req, res) => {
    const { post_id, title = '', summary = '', content = '', tags = [] } = req.body;
    // 每篇文章只保留一个草稿：根据 post_id 查找，有则更新、无则创建
    let draft = post_id ? q1('SELECT id FROM drafts WHERE user_id=? AND post_id=?', [req.user.id, post_id]) : null;
    if (draft) {
      // 已有草稿 → 更新
      run('UPDATE drafts SET title=?, summary=?, content=?, tags=?, updated_at=? WHERE id=?',
        [title, summary || '', content || '', JSON.stringify(tags || []), now(), draft.id]);
      saveDB();
      ok(res, { message: '草稿已更新', data: { id: draft.id, post_id } });
    } else {
      // 新建草稿
      const id = randomUUID();
      run('INSERT INTO drafts VALUES (?,?,?,?,?,?,?,?)', [id, req.user.id, post_id || null, title, summary, content, JSON.stringify(tags), now()]);
      saveDB();
      ok(res, { message: '草稿已保存', data: { id, post_id } });
    }
  });

  app.put('/api/drafts/:id', requireAuth, (req, res) => {
    const draft = q1('SELECT * FROM drafts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!draft) return fail(res, '草稿不存在', 404);
    const { title, summary, content, tags } = req.body;
    run('UPDATE drafts SET title=?, summary=?, content=?, tags=?, updated_at=? WHERE id=?',
      [title || '', summary || '', content || '', JSON.stringify(tags || []), now(), req.params.id]);
    saveDB();
    ok(res, { message: '草稿已更新' });
  });

  app.delete('/api/drafts/:id', requireAuth, (req, res) => {
    // 支持按草稿id删除 或 按post_id删除
    if (req.params.id.startsWith('post:')) {
      const postId = req.params.id.substring(5);
      run('DELETE FROM drafts WHERE user_id=? AND post_id=?', [req.user.id, postId]);
    } else {
      run('DELETE FROM drafts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    }
    saveDB();
    ok(res, { message: '草稿已删除' });
  });

  // ===================== 标签 =====================
  app.get('/api/tags', (req, res) => {
    const rows = qa('SELECT t.id, t.name, COUNT(CASE WHEN p.status="published" THEN 1 END) as post_count FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.id LEFT JOIN posts p ON pt.post_id=p.id GROUP BY t.id ORDER BY post_count DESC');
    ok(res, { data: rows });
  });

  // ===================== 关于 =====================
  app.get('/api/about', (req, res) => {
    const tp = q1('SELECT COUNT(*) as c FROM posts WHERE status="published"')?.c || 0;
    const tu = q1('SELECT COUNT(*) as c FROM users')?.c || 0;
    const tt = q1('SELECT COUNT(*) as c FROM tags')?.c || 0;
    const tc = q1('SELECT COUNT(*) as c FROM comments')?.c || 0;
    ok(res, { data: { name: 'Glass Blog', description: '一个使用毛玻璃效果设计的现代化博客平台。支持 Markdown 渲染、标签分类、评论互动、关注系统等功能。', totalPosts: tp, totalUsers: tu, totalTags: tt, totalComments: tc } });
  });

  // ===================== 搜索 =====================
  app.get('/api/search', (req, res) => {
    const { q: query, page = 1, limit = 6 } = req.query;
    if (!query) return ok(res, { data: [], pagination: { page: 1, limit: 6, total: 0 } });
    const p = parseInt(page), l = parseInt(limit);
    const kw = `%${query}%`;
    const total = q1('SELECT COUNT(*) as c FROM posts WHERE status="published" AND (title LIKE ? OR summary LIKE ? OR content LIKE ?)', [kw, kw, kw])?.c || 0;
    const offset = (p - 1) * l;
    const rows = qa(`SELECT p.id, p.title, p.summary, p.created_at, u.name as author, u.avatar as author_avatar, p.likes, p.views
      FROM posts p JOIN users u ON p.user_id=u.id
      WHERE p.status="published" AND (p.title LIKE ? OR p.summary LIKE ? OR p.content LIKE ?)
      ORDER BY (CASE WHEN LOWER(p.title)=LOWER(?) THEN 0 WHEN p.title LIKE ? THEN 1 WHEN p.summary LIKE ? THEN 2 ELSE 3 END), p.created_at DESC
      LIMIT ${l} OFFSET ${offset}`, [kw, kw, kw, query, kw, kw]);
    const result = rows.map(r => {
      const tRows = qa('SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?', [r.id]);
      return { ...r, tags: tRows.map(t => t.name) };
    });
    ok(res, { data: result, pagination: { page: p, limit: l, total } });
  });
}

module.exports = setupPostRoutes;
