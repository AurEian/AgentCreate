/**
 * src/routes/notifications.js - 通知
 */
const { q1, qa, run, saveDB, ok } = require('../db');
const { requireAuth } = require('../middleware/auth');

function setupNotificationRoutes(app) {
  app.get('/api/notifications', requireAuth, (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    const total = q1('SELECT COUNT(*) as c FROM notifications WHERE user_id=?', [req.user.id])?.c || 0;
    const rows = qa(`SELECT n.*, u.name as from_name, u.avatar as from_avatar,
        p.title as post_title
      FROM notifications n
      JOIN users u ON n.from_user_id=u.id
      LEFT JOIN posts p ON n.post_id=p.id
      WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT ${l} OFFSET ${(p - 1) * l}`, [req.user.id]);
    ok(res, { data: rows, pagination: { page: p, limit: l, total } });
  });

  app.get('/api/notifications/unread', requireAuth, (req, res) => {
    const c = q1('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0', [req.user.id])?.c || 0;
    ok(res, { count: c });
  });

  app.put('/api/notifications/read', requireAuth, (req, res) => {
    const { id } = req.body;
    if (id) {
      run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [id, req.user.id]);
    } else {
      run('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    }
    saveDB();
    ok(res, { message: '已读' });
  });
}

module.exports = setupNotificationRoutes;
