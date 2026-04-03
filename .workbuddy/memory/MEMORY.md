# MEMORY.md

## 项目：Glass Blog 博客系统

### 当前进度（2026-03-30 完成前端重写）
- **后端 server.js** ✅ 完成，包含所有 API 接口
- **前端** ✅ 已拆分为多个文件，前端重写完成并通过基本测试
  - `index.html` - 骨架页面，引用所有 JS/CSS
  - `style.css` - 完整 CSS（毛玻璃风格、亮/暗主题）
  - `app.js` - API 函数库 + SPA 路由 + 初始化
  - `pages.js` - 登录/注册/首页/文章详情/评论
  - `pages2.js` - 写作编辑器/草稿/收藏/关注
  - `pages3.js` - 个人主页/管理后台
- **服务已启动**：`node server.js` 运行在 `http://localhost:3000`

### Bug 修复记录（2026-03-30）
1. seed 数据 comments 缺少 parent_id 字段 → 已修复（添加 null 占位符）
2. 后端 login 不返回 token → 已修复（返回 `token: user.id`）
3. 前端 auth header 用 `Bearer ${token}` → 已修复（后端用 `Authorization: userId`）
4. API 路径不匹配 → 已修复（统一用 `http://localhost:3000/api`）
5. 后端 tags 返回空格字符串 → 前端已做 normalize
6. 字段名不一致 (author vs author_name, authorId vs user_id) → 前端已做兼容

### Bug 修复记录（2026-03-30 个人主页）
7. pages3.js renderProfile/renderMyProfile 中 API 路径用 `/users/:id`（带s）→ 已改为 `API.getUser()`/`API.getUserPosts()`（正确路径为 `/user/:id`）
8. pages3.js renderProfile 鉴权头遗留 `Bearer ${token}` → 已改用 API.getUser()（内部自动用正确 authH()）
9. 粉丝/关注数字段名不匹配：前端用 `followers_count`/`following_count`，后端返回 `followerCount`/`followingCount` → 前端已做双重兼容

### Bug 修复记录（2026-03-30 头像/封面）
10. 封面图片上传只用 FileReader 转 data URL → 已改为调用后端 `/api/upload` 接口上传到服务器返回 `/uploads/xxx` 路径
11. 文章卡片/详情页不渲染 cover → 已加上条件渲染：有 cover 显示图片，否则显示占位符
12. 编辑资料弹窗没有头像上传 → 已增加头像上传/移除功能
13. 全局头像渲染不支持图片 → 已添加 `UI.avatarHtml()` 辅助函数，后端 SQL 查询也加上 `u.avatar as author_avatar`
14. 初始化时导航栏头像不显示图片 → 已根据 currentUser.avatar 判断是否显示 img

### Bug 修复记录（2026-03-30 点赞）
18. pages.js `toggleLike` 中 `btn.textContent` 包含 SVG 内容，`parseInt` 返回 NaN → 改为操作 `btn.querySelector('#like-count')` span 元素
19. 前端 `unlikePost` 用 `DELETE` 方法，但后端只有 `POST /api/posts/:id/like`（toggle）→ 改为 POST
20. Toast icon 偏上 → CSS 添加 `line-height:1.4`
21. 管理后台热门文章/最近动态的文章标题添加点击跳转链接
22. 后端 PUT /api/posts/:id 没返回 id → 已修复返回 `{ data: { id, status } }`
23. 发布后跳转逻辑优化：统一跳文章详情页，pending 提示等待审核
24. 写作页底部添加吸底操作栏（IntersectionObserver 监听顶部操作栏可见性）
25. 全局头像显示修复：`.avatar-sm` 和 `.avatar-lg` 用 `:has(img)` 去掉渐变背景；`avatarHtml()` 添加 `avatar-img` 类
26. 后端 PUT /api/posts/:id：非管理员修改已审核（published/rejected）文章后状态重置为 pending 重新审核，管理员保持原状态

### Bug 修复记录（2026-03-30 下午第二轮）
27. SPA 路由 hash 解析没有去掉 query string，导致 `#/write?edit=xxx` 匹配不到 `write` 路由直接跳首页 → 修改 router() 中 hash 先 `.split('?')[0]`
28. 普通用户发布文章后没给管理员发审核通知 → POST /api/posts 中 pending 状态文章创建后给所有管理员发 review 类型通知
29. 审核通过/拒绝通知类型错误（用的 comment）→ 改为 approve/reject
30. 通知中心缺少 review/approve/reject 类型显示 → typeMap 新增三种类型
31. 封面预览图 margin-top 从 10px 增大到 16px
32. token 存储从 localStorage 改为 sessionStorage，解决多标签页登录不同账号互相覆盖的问题
   - 原因：localStorage 同源共享，A 窗口登录测试用户后 B 窗口登录管理员会覆盖 token
   - 效果：sessionStorage 标签页隔离，两个窗口可以同时登录不同账号互不影响
   - 副作用：关闭标签页后需要重新登录（合理行为）
   - 同时解释了"管理员看不到审核通知"的问题：因为 token 被覆盖，测试用户发文章时实际用的是管理员 token，文章直接 published 不需要审核
33. 文章详情页给管理员添加审核按钮：标题区域显示 pending/rejected 状态标签，action-bar 中 pending 文章显示"通过审核"和"拒绝"按钮
34. 写作页内容持久化：新文章输入实时保存到 sessionStorage，离开再回来可恢复内容；编辑模式和发布成功时清除临时草稿
35. 已审核文章（published/rejected）被非管理员修改后状态重置 pending 时，通知所有管理员有新的审核任务
36. 全局确认弹窗升级：浏览器原生 `confirm()` → `UI.showConfirm()` 毛玻璃风格弹窗（支持 warn/danger/info 三种类型）
   - CSS 新增 `.confirm-dialog` 系列样式
   - app.js 新增 `showConfirm()` 函数（Promise-based，支持点击遮罩关闭）
   - pages.js/pages2.js/pages3.js 所有 confirm() 调用已替换
37. 浅色模式标签可读性优化：标签加不透明背景+深色文字+毛玻璃模糊，pending/rejected 标签也做了浅色适配
38. 通知轮询间隔 30s → 8s，通知中心页面自动刷新列表
39. 封面图间距优化：返回按钮 margin-bottom:20px，封面图 margin:16px 0 8px
40. 关注系统修复：
   - 后端 `GET /api/user/:id` 增加 `isFollowing` 字段（新增 `optionalAuth` 中间件）
   - 前端 `toggleFollowProfile` 直接调用 API 并正确切换 class（之前复用关注列表的函数导致状态不一致）
   - 取关后从关注列表移除卡片（带滑出动画），列表清空显示空状态
   - 评论区头像和用户名添加个人主页链接（hover 放大/变色效果）
   - `follow()/unfollow()` 调用后清除 `userCache[userId]`，避免缓存导致 `isFollowing` 状态过期
   - `toggleFollowProfile` 改为读取后端返回的 `following` 字段更新 UI 状态，不再前端自行判断
41. 已发布文章修改审核机制（审核期间旧版本继续展示）：
   - posts 表新增 `pending_title/pending_summary/pending_content/pending_cover/pending_tags` 字段
   - 非管理员修改已发布文章时：新版本存 pending 字段，**status 保持 published**（旧版本继续在首页展示）
   - 管理员审核通过：pending 内容覆盖到正式字段，清除 pending
   - 管理员审核拒绝：清除 pending 内容，旧版本不变
   - 文章详情页：作者看到"修改待审核"提示横幅，管理员看到审核按钮
   - 管理后台列表：`has_pending_edit` 字段标识，显示"修改待审"标记和审核按钮
   - 编辑文章时优先加载 pending 内容（待审核的新版本）
   - `GET /api/admin/posts` 新增 `has_pending_edit` 字段

### Bug 修复记录（2026-03-30 登录）
42. 登录失败无提示：后端 `fail` 返回 `{ success: false, message }`，但前端判断的是 `res.error`（undefined）→ 改为 `!res.success` 并用 `res.message` 显示错误
43. 后端登录接口拆分错误提示：先查邮箱是否存在（"该账号不存在"），再校验密码（"密码错误"）
44. 账号不存在时前端弹出毛玻璃确认框，询问是否跳转注册页面

### Bug 修复记录（2026-03-30 管理后台）
17. pages3.js 第594行 `reviewPost` 函数后多了一个 `}` → 已删除，修复 SyntaxError，管理后台恢复正常加载

### Bug 修复记录（2026-03-30 收藏功能）
15. 后端缺少 `GET /api/posts/:id/favorited` 接口 → 已添加，前端文章详情页可正确查询收藏状态
    - 前端请求 `/posts/:id/favorited` 但后端只有 `POST /posts/:id/favorite`（toggle），导致收藏状态永远查不到
    - 进入文章详情页 favedByMe 始终 false，收藏后离开再回来又变成未收藏
16. `GET /api/user/favorites` 和 `/api/user/following` 被 `GET /api/user/:id` 路由抢先匹配 → 已将固定路径路由移到 `/:id` 前面
    - Express 按注册顺序匹配，`favorites`/`following` 被 `:id` 捕获，查不到 ID 为 "favorites" 的用户，返回"用户不存在"
    - 收藏列表和关注列表页面始终为空

### 功能改进（2026-03-30 搜索和分类）
- 搜索排序改为相关度优先：标题精确匹配 > 标题包含 > 摘要包含 > 内容包含，同级按时间倒序
- 首页新增标签分类栏（毛玻璃药丸按钮），支持按标签筛选文章
- 新增 SPA 路由：`#/tag/:name` 和 `#/tag/:name/:page`
- 新增前端 API：`getAllTags()`

### 功能新增（2026-03-30 毕设增强）
1. **数据统计可视化**：管理员仪表盘加 Chart.js 图表（趋势折线图、标签分布饼图、热门文章TOP10、最近动态）
   - 新增后端 API：`GET /api/admin/analytics?days=7`
   - 新增前端 API：`getAnalytics(days)`
   - 前端引入 Chart.js CDN
2. **通知系统**：评论/点赞/收藏/关注自动触发通知 + 导航栏铃铛未读角标 + 通知中心页面
   - 新增 `notifications` 表
   - 新增 API：`GET/notifications`, `GET/notifications/unread`, `PUT/notifications/read`
   - 新增 `notify()` 辅助函数
   - 每 30s 轮询未读数
3. **编辑器增强**：工具栏（加粗/斜体/标题/代码块/链接/图片/表格）、Ctrl+V 粘贴图片上传、字数统计（中英文+阅读时间）
4. **文章审核流程**：普通用户发文章默认 `pending`（待审核），管理员直接 `published`
   - 新增 API：`PUT /api/admin/posts/:id/review`（approve/reject）
   - 管理后台文章列表显示状态（已发布/待审核/已拒绝/草稿）+ 审核按钮
5. **系统公告**：管理员发布公告，首页显示公告横幅 + 详情弹窗
   - 新增 `announcements` 表
   - 新增 API：`GET/POST/DELETE /api/announcements`
   - 管理后台新增"系统公告"tab

### 技术栈
- 后端：Node.js + Express 5 + sql.js（纯JS SQLite）
- 前端：原生 HTML/CSS/JS SPA + Marked.js + Highlight.js
- 风格：Glassmorphism 毛玻璃 + 深色渐变背景 + 动态光晕 + 亮/暗主题切换
- 路由：hash-based SPA

### 测试账号
- 管理员：admin@example.com / 123456
- 用户：test@example.com / test123
- 用户：demo@example.com / demo（密码：demo）

### 项目文件结构（2026-03-30 后端模块化重构后）
```
20260327083651/
├── server.js              ← Express 入口（只做配置 + 路由挂载 + 启动）
├── package.json           ← 依赖配置
├── start.ps1              ← 启动脚本
├── blog.db                ← SQLite 数据库（自动生成）
├── src/                   ← 后端源代码（模块化）
│   ├── db.js              ← 数据库初始化 + query helpers + 通用工具
│   ├── middleware/
│   │   └── auth.js        ← 认证中间件（requireAuth/optionalAuth/requireAdmin）
│   └── routes/            ← API 路由（按功能分模块）
│       ├── auth.js        ← 注册/登录
│       ├── user.js        ← 用户资料/密码/关注/收藏/关注列表
│       ├── posts.js       ← 文章 CRUD/草稿/点赞/收藏/搜索/标签/关于
│       ├── comments.js    ← 评论树形结构
│       ├── notifications.js  ← 通知系统
│       ├── announcements.js  ← 系统公告
│       ├── admin.js       ← 管理后台（统计/审核/用户管理/审计）
│       └── upload.js      ← 图片上传
└── public/                ← 前端静态资源（SPA）
    ├── index.html         ← SPA 骨架
    ├── css/
    │   └── style.css      ← 完整 CSS（毛玻璃风格、亮/暗主题）
    ├── js/
    │   ├── app.js         ← API 调用库 + 路由 + 初始化
    │   ├── pages.js       ← 登录/注册/首页/文章详情/评论
    │   ├── pages2.js      ← 写作编辑器/草稿/收藏/关注
    │   └── pages3.js      ← 个人主页/管理后台
    └── uploads/           ← 用户上传文件（头像/封面）
```

### Docker 部署（2026-04-02 完成）
- **Dockerfile**：基于 `node:20-alpine`，多层缓存构建，创建 `public/uploads` 和 `data` 目录
- **Nginx 反向代理**（2026-04-02）：`nginx.conf` + `docker-compose.yml` 新增 `glass-blog-nginx` 容器，监听 80 端口转发到 Node.js 3000，两个容器同 bridge 网络通信
- **docker-compose.yml**：挂载 `./data:/app/data`（数据库）和 `./uploads:/app/public/uploads`（上传），环境变量 `DB_PATH=/app/data/blog.db`
- **数据库路径**：`src/db.js` 支持 `process.env.DB_PATH`，本地开发回退到项目根 `blog.db`
- **CentOS 7 部署**：安装 Docker CE（阿里源）+ docker-compose v2，`git clone` + `docker-compose up -d --build`，开放 80 端口
- **已测试**：本地 docker-compose up 验证通过，Nginx 80 端口正常代理到 Node.js，数据库持久化正常
- **GitHub**：代码已推送，SSH 方式认证（密钥：`~/.ssh/id_ed25519`，公钥已加到 GitHub）

### 注意事项
- Express 5 路由用 `/{*splat}` 而非 `*`
- sql.js 只接受数组参数
- 后端鉴权：直接把 user.id 作为 Authorization header（非 JWT Bearer token）
- PowerShell 用 `start.ps1` 启动服务
- 新增端点：`GET /api/user/following`, `GET /api/user/:id/posts`, `GET /api/posts/:id/favorited`, `GET /api/admin/analytics`, `GET /api/notifications`, `GET /api/announcements`, `PUT /api/admin/posts/:id/review`
- 浏览器缓存问题：前端 JS 更新后需要 Ctrl+Shift+R 强制刷新才能加载最新版本
