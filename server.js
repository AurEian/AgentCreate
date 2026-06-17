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
const { setupImportRoutes } = require('./src/routes/import');

const app = express();
const PORT = process.env.PORT || 3100;

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
setupImportRoutes(app);

// ===================== SPA FALLBACK =====================
app.get('/{*splat}', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ===================== ERROR HANDLING =====================
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION]', err.message, err.stack);
});
process.on('unhandledRejection', err => {
  console.error('[UNHANDLED REJECTION]', err);
});

// ===================== START =====================
initDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\n  ✅ Glass Blog 已启动: http://localhost:${PORT}\n`);
    console.log('  📋 测试账号：');
    console.log('     管理员  admin@example.com / 123456');
    console.log('     用户    test@example.com  / test123');
    console.log('     用户    demo@example.com  / demo\n');
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用，请先关闭占用该端口的进程`);
    } else if (err.code === 'EACCES') {
      console.error(`❌ 端口 ${PORT} 权限不足，请用管理员权限运行或换一个端口`);
    } else {
      console.error('❌ 服务器启动失败:', err.message);
    }
    process.exit(1);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
