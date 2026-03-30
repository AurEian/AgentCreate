/**
 * src/routes/announcements.js - 系统公告
 */
const { randomUUID } = require('crypto');
const { q1, qa, run, saveDB, ok, fail, logAudit } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function setupAnnouncementRoutes(app) {
  app.get('/api/announcements', (req, res) => {
    const rows = qa(`SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.user_id=u.id ORDER BY a.created_at DESC LIMIT 10`);
    ok(res, { data: rows });
  });

  app.post('/api/announcements', requireAuth, requireAdmin, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return fail(res, '标题和内容不能为空');
    const id = randomUUID();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    run('INSERT INTO announcements VALUES (?,?,?,?,?)', [id, req.user.id, title.trim(), content.trim(), now]);
    logAudit(req.user.id, 'create_announcement', id, title);
    saveDB();
    ok(res, { message: '公告发布成功' });
  });

  app.delete('/api/announcements/:id', requireAuth, requireAdmin, (req, res) => {
    run('DELETE FROM announcements WHERE id=?', [req.params.id]);
    saveDB();
    ok(res, { message: '公告已删除' });
  });
}

module.exports = setupAnnouncementRoutes;
