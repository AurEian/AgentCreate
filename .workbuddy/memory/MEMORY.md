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
│       ├── user.js        ← 用户资料/密码/关注/申诉
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
- posts 表共 23 列，INSERT 必须提供 24 个值（已含 assigned_to、assigned_at）
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
- `POST /api/admin/users/:id/ban`（封禁用户，body: `{ reason, until: 'YYYY-MM-DD' }`，自动发通知）
- `GET /api/admin/appeals`（管理员查申诉列表）
- `POST /api/admin/appeals/:id/approve`（批准申诉自动解封）
- `POST /api/admin/appeals/:id/reject`（拒绝申诉）
- `POST /api/user/appeal`（用户提交解封申诉）
- `GET /api/user/appeal`（用户查申诉状态）

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
12. **超级管理员（super_admin）角色**：
    - 角色体系：`super_admin` > `admin` > `user`
    - `requireAdmin` 中间件兼容 super_admin（既是超管也是管理员）
    - super_admin 可设置/取消其他用户的 admin 权限
    - 审计日志仅 super_admin 可见，含操作人姓名和角色
    - 初始种子账号 u1(admin@example.com) 为 super_admin
    - **前端注意**：所有 `role === 'admin'` 的判断都需改为 `role === 'admin' || role === 'super_admin'`，否则超管功能缺失

### 关键 API 端点（超级管理员）
- `GET /api/super/admins` - 管理员列表（含操作次数）
- `POST /api/super/admins/:id/grant` - 设为管理员
- `POST /api/super/admins/:id/revoke` - 取消管理员
- `GET /api/super/audit-log?userId=&page=` - 审计日志（可按人筛选，含 userName/userRole）

### 近期 Bug 修复（2026-04-07~08）
- 通知模板字符串嵌套：`'《${escHtml(n.post_title)}》'` → 反引号
- Chart.js CDN 404 → jsDelivr
- 发布文章 404：posts 表 20 列但 INSERT 只给 16 值 → 已修复为 20 个占位符
- 无封面自动随机分配：发布文章时若 cover 为空，从 `public/uploads` 随机选一张
- 封禁通知改为系统通知风格：`pages2.js` 中 ban/unban 类型单独处理，不再显示"管理员 xxx了"，直接显示"你的文章《xxx》已被封禁，原因：xxx"
- **Docker 建文章 404**（2026-04-08~09）：posts 表 22 列（20 + ban_reason + reject_reason 迁移）但 INSERT 列数不对 → 最终修复为 22 个 `?` + 22 个值（`src/routes/posts.js`，commit e495627）

### 近期修复（2026-05-06）
- **申诉理由乱码**：问题根源是 `public/js/app.js` 中 `jsonH()` 函数设置 `Content-Type: application/json` 时未指定 `charset=utf-8`，导致某些浏览器环境（尤其是中文 Windows）发送 GBK/GB2312 编码而非 UTF-8。修复：所有 `Content-Type: application/json` 改为 `Content-Type: application/json; charset=utf-8`（包括 `register`、`login` 和 `jsonH()`）。已清理旧乱码数据并重启服务器。

### 近期新增（2026-05-07）
13. **审核轮换指派机制**：
    - 用户提交文章（含敏感词进 pending）时，系统自动分配给一名管理员（轮换制）
    - 分配规则：选 `last_assigned_at` 最早/为空的 admin/super_admin（轮换）
    - 新增字段：`posts.assigned_to`（被指派管理员ID）、`posts.assigned_at`（指派时间）、`users.last_assigned_at`（用于轮换计数）
    - 权限控制：普通管理员只能操作被指派给自己的文章；超管可操作全部
    - 审核完成后（通过/拒绝/封禁）自动清空 assigned_to
    - 通知只发给被指派的管理员，不发给所有人
    - 前端列表显示 📋「谁负责」/ ⚠️「无人负责」徽章
    - 认领接口增加 403 权限检查；强制抢占（claim-force）仅超管可用

### 排查经验
- **sql.js 内存数据库异常**：遇到莫名其妙的 404 或数据不一致，先尝试重启服务器
- **调试日志保留**：`src/db.js` 和 `src/routes/*.js` 中已添加 `[DEBUG]` 日志，方便下次排查
- **pkill 在 Windows 上不可用**：Git Bash 的 `pkill` 不工作，必须用 `taskkill //F //IM node.exe`Node.js console.log 在显示数组参数时可能用 Latin-1 编码，导致中文在终端显示乱码，但这不代表数据库中的数据也损坏了。区分方法：用 `JSON.stringify()` 或直接通过 API 响应验证数据正确性
- **浏览器 charset 问题**：中文 Windows 环境下，浏览器发送 fetch 请求时可能不使用 UTF-8（即使 body 是 JSON.stringify）。必须显式设置 `charset=utf-8` 才能保证跨浏览器一致性
