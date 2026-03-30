/**
 * Glass Blog - 后端入口
 * 模块化架构
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDB } = require('./src/db');

// 导入所有路由模块
const setupAuthRoutes = require('./src/routes/auth');
const setupUserRoutes = require('./src/routes/user');
const setupPostRoutes = require('./src/routes/posts');
const setupCommentRoutes = require('./src/routes/comments');
const setupNotificationRoutes = require('./src/routes/notifications');
const setupAnnouncementRoutes = require('./src/routes/announcements');
const setupAdminRoutes = require('./src/routes/admin');
const setupUploadRoutes = require('./src/routes/upload');

const app = express();
const PORT = 3000;

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 确保上传目录存在
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ===================== ROUTES =====================
setupAuthRoutes(app);
setupUserRoutes(app);
setupPostRoutes(app);
setupCommentRoutes(app);
setupNotificationRoutes(app);
setupAnnouncementRoutes(app);
setupAdminRoutes(app);
setupUploadRoutes(app);

// ===================== SPA FALLBACK =====================
app.get('/{*splat}', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ===================== START =====================
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ✅ Glass Blog 已启动: http://localhost:${PORT}\n`);
    console.log('  📋 测试账号：');
    console.log('     管理员  admin@example.com / 123456');
    console.log('     用户    test@example.com  / test123');
    console.log('     用户    demo@example.com  / demo\n');
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
