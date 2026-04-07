/**
 * src/routes/auth.js - 注册/登录
 */
const { randomUUID } = require('crypto');
const { q1, run, saveDB, ok, fail, getBan, now } = require('../db');

function setupAuthRoutes(app) {
  // 注册
  app.post('/api/register', (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return fail(res, '请填写所有字段');
    if (password.length < 3) return fail(res, '密码至少3位');
    const existing = q1('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return fail(res, '该邮箱已被注册');
    const id = randomUUID();
    run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, email, password, name.trim(), 'user', '', '', '', '', 0, now()]);
    saveDB();
    ok(res, { message: '注册成功', user: { id, name: name.trim(), email, role: 'user' } });
  });

  // 登录
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, '请填写邮箱和密码');
    const user = q1('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return fail(res, '该账号不存在，请先注册', 404);
    if (user.password !== password) return fail(res, '密码错误');
    const ban = getBan(user.id);
    if (ban) return fail(res, `你的账户已被封禁。原因：${ban.reason}，解封时间：${ban.banned_until}`);
    ok(res, { message: `欢迎回来，${user.name}！`, token: user.id, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || '' } });
  });
}

module.exports = setupAuthRoutes;
