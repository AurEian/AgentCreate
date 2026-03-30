/**
 * src/middleware/auth.js - 认证中间件
 */
const { q1, fail } = require('../db');

function requireAuth(req, res, next) {
  const id = req.headers['authorization'];
  if (!id) return fail(res, '请先登录', 401);
  const user = q1('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) return fail(res, '用户不存在', 401);
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const id = req.headers['authorization'];
  if (id) {
    const user = q1('SELECT * FROM users WHERE id = ?', [id]);
    if (user) req.user = user;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return fail(res, '需要管理员权限', 403);
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
