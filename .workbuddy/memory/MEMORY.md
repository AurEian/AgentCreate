# MEMORY.md

## 项目：Glass Blog 博客系统

### 技术栈
- 后端：Node.js + Express 5 + sql.js（纯JS SQLite）
- 前端：原生 HTML/CSS/JS SPA + Marked.js + Highlight.js
- 风格：Glassmorphism 毛玻璃 + 深色渐变背景 + 动态光晕 + 亮/暗主题切换
- 路由：hash-based SPA

### 项目文件结构
```
20260327083651/
├── server.js              ← Express 入口
├── blog.db                ← SQLite 数据库（自动生成）
├── src/
│   ├── db.js              ← 数据库初始化 + query helpers + 通用工具
│   ├── middleware/auth.js ← requireAuth/optionalAuth/requireAdmin
│   └── routes/
│       ├── auth.js        ← 注册/登录
│       ├── user.js        ← 用户资料/密码/关注/收藏
│       ├── posts.js       ← 文章 CRUD/草稿/点赞/收藏/搜索/标签
│       ├── comments.js    ← 评论树形结构
│       ├── notifications.js
│       ├── announcements.js
│       ├── admin.js       ← 管理后台（统计/审核/用户管理/审计）
│       └── upload.js      ← 图片上传
└── public/
    ├── index.html
    ├── css/style.css
    ├── js/app.js / pages.js / pages2.js / pages3.js
    └── uploads/           ← 用户上传文件
```

### 测试账号
- 管理员：admin@example.com / 123456
- 用户：test@example.com / test123
- 用户：demo@example.com / demo

### 重要技术约定
- 后端鉴权：直接把 user.id 作为 Authorization header（非 JWT Bearer token）
- Express 5 路由用 `/{*splat}` 而非 `*`
- sql.js 只接受数组参数
- token 存在 sessionStorage（标签页隔离，避免多账号互串）
- 浏览器缓存问题：前端 JS 更新后需要 Ctrl+Shift+R 强制刷新
- ok() 函数：`res.status(200).json({ success: true, ...data })`
- posts 表共 21 列（新增 ban_reason），INSERT 必须提供 21 个值
- 文章状态：`published`/`pending`/`rejected`/`banned`

### 关键 API 端点
- `GET /api/user/following`, `GET /api/user/:id/posts`
- `GET /api/posts/:id/favorited`
- `GET /api/admin/analytics`
- `GET /api/notifications`, `GET /api/notifications/unread`, `PUT /api/notifications/read`
- `GET /api/announcements`, `POST /api/announcements`, `DELETE /api/announcements/:id`
- `PUT /api/admin/posts/:id/review`（approve/reject）
- `POST /api/admin/posts/:id/ban`（封禁博客，需理由）
- `POST /api/admin/posts/:id/unban`（解封博客）
- `DELETE /api/comments/:id`（管理员可删除任何评论）

### Docker 部署
- Dockerfile 基于 `node:20-alpine`
- nginx.conf + docker-compose.yml：Nginx 80 端口反代 Node.js 3000
- 数据库路径：`src/db.js` 支持 `process.env.DB_PATH`，本地回退到 `blog.db`
- 挂载：`./data:/app/data`（数据库）和 `./uploads:/app/public/uploads`

### 主要功能
1. **文章审核流程**：普通用户发文章默认 `pending`，管理员直接 `published`；有敏感词才需审核
2. **已发布文章修改机制**：修改内容存 pending 字段，旧版本继续展示，审核通过后覆盖
3. **通知系统**：评论/点赞/收藏/关注触发通知，导航栏铃铛角标，8s 轮询
4. **数据统计**：管理员仪表盘 Chart.js 图表（Chart.js CDN: jsDelivr）
5. **系统公告**：管理员发布，首页横幅展示
6. **标签分类**：首页药丸按钮筛选，`#/tag/:name` 路由
7. **编辑器增强**：工具栏、Ctrl+V 粘贴上传图片、字数统计
8. **全局确认弹窗**：UI.showConfirm()（毛玻璃风格，warn/danger/info 类型）
9. **关注系统**：optionalAuth 中间件，isFollowing 字段
10. **博客封禁功能**：
    - 管理员可封禁博客并填写理由
    - 被封禁博客仅管理员和作者可见，显示封禁理由
    - 作者修改后若无敏感词自动解封发布，若有敏感词进入 pending 等待审核
    - 管理员可直接解封博客
11. **管理员删除评论**：管理员可在博客页面直接删除任何用户的评论

### 近期 Bug 修复（2026-04-07~08）
- 通知模板字符串嵌套：`'《${escHtml(n.post_title)}》'` → 反引号
- Chart.js CDN 404 → jsDelivr
- 发布文章 404：posts 表 20 列但 INSERT 只给 16 值 → 已修复为 20 个占位符
- 无封面自动随机分配：发布文章时若 cover 为空，从 `public/uploads` 随机选一张
- 封禁通知改为系统通知风格：`pages2.js` 中 ban/unban 类型单独处理，不再显示"管理员 xxx了"，直接显示"你的文章《xxx》已被封禁，原因：xxx"

### 排查经验
- **sql.js 内存数据库异常**：遇到莫名其妙的 404 或数据不一致，先尝试重启服务器
- **调试日志保留**：`src/db.js` 和 `src/routes/*.js` 中已添加 `[DEBUG]` 日志，方便下次排查
