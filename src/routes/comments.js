/**
 * src/routes/comments.js - 评论
 */
const { randomUUID } = require('crypto');
const { q1, qa, run, saveDB, ok, fail, getBan, notify, now } = require('../db');
const { requireAuth } = require('../middleware/auth');

function setupCommentRoutes(app) {
  // 获取评论树
  app.get('/api/posts/:id/comments', (req, res) => {
    const comments = qa(`SELECT c.*, u.name as author, u.avatar as authorAvatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC`, [req.params.id]);
    const map = {};
    const tree = [];
    comments.forEach(c => { c.replies = []; map[c.id] = c; });
    comments.forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(c);
      else tree.push(c);
    });
    ok(res, { data: tree });
  });

  // 发表评论
  app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) return fail(res, '评论内容不能为空');
    const post = q1('SELECT id FROM posts WHERE id=?', [req.params.id]);
    if (!post) return fail(res, '文章不存在', 404);
    const ban = getBan(req.user.id);
    if (ban) return fail(res, `你已被封禁，无法评论`, 403);
    const id = randomUUID();
    run('INSERT INTO comments VALUES (?,?,?,?,?,?)', [id, req.params.id, req.user.id, content.trim(), parent_id || null, now()]);
    saveDB();
    const postAuthor = q1('SELECT user_id FROM posts WHERE id=?', [req.params.id]);
    if (postAuthor && postAuthor.user_id !== req.user.id) notify(postAuthor.user_id, req.user.id, 'comment', req.params.id);
    if (parent_id) {
      const parentAuthor = q1('SELECT user_id FROM comments WHERE id=?', [parent_id]);
      if (parentAuthor && parentAuthor.user_id !== req.user.id && (!postAuthor || parentAuthor.user_id !== postAuthor.user_id))
        notify(parentAuthor.user_id, req.user.id, 'reply', req.params.id);
    }
    const comment = q1('SELECT c.*, u.name as author, u.avatar as authorAvatar FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?', [id]);
    ok(res, { message: '评论成功', data: comment });
  });

  // 删除评论
  app.delete('/api/comments/:id', requireAuth, (req, res) => {
    const c = q1('SELECT * FROM comments WHERE id=?', [req.params.id]);
    if (!c) return fail(res, '评论不存在', 404);
    if (c.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, '无权删除', 403);
    const replies = qa('SELECT id FROM comments WHERE parent_id=?', [req.params.id]);
    replies.forEach(r => run('DELETE FROM comments WHERE id=?', [r.id]));
    run('DELETE FROM comments WHERE id=?', [req.params.id]);
    saveDB();
    ok(res, { message: '评论已删除' });
  });
}

module.exports = setupCommentRoutes;
