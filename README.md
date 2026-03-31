# Glass Blog - 毛玻璃风格博客系统

一个基于 Node.js + Express + SQLite 的全栈 SPA 博客系统，采用 Glassmorphism（毛玻璃）设计风格。

## 技术栈

- **后端**：Node.js + Express 5 + sql.js（纯 JS SQLite）
- **前端**：原生 HTML/CSS/JS SPA + Marked.js + Highlight.js
- **风格**：Glassmorphism 毛玻璃 + 深色渐变背景 + 动态光晕 + 亮/暗主题切换
- **路由**：hash-based SPA 路由

## 项目结构

```
├── server.js              ← Express 入口（配置 + 路由挂载 + 启动）
├── package.json           ← 依赖配置
├── start.ps1              ← Windows 启动脚本
├── blog.db                ← SQLite 数据库（首次运行自动生成）
├── src/                   ← 后端源代码（模块化）
│   ├── db.js              ← 数据库初始化 + query helpers + 通用工具
│   ├── middleware/
│   │   └── auth.js        ← 认证中间件（requireAuth / optionalAuth / requireAdmin）
│   └── routes/            ← API 路由（按功能分模块）
│       ├── auth.js        ← 注册 / 登录
│       ├── user.js        ← 用户资料 / 密码 / 关注 / 收藏
│       ├── posts.js       ← 文章 CRUD / 草稿 / 点赞 / 收藏 / 搜索 / 标签
│       ├── comments.js    ← 评论（树形结构）
│       ├── notifications.js  ← 通知系统
│       ├── announcements.js  ← 系统公告
│       ├── admin.js       ← 管理后台（统计 / 审核 / 用户管理）
│       └── upload.js      ← 图片上传
└── public/                ← 前端静态资源（SPA）
    ├── index.html         ← SPA 骨架
    ├── css/
    │   └── style.css      ← 完整 CSS（毛玻璃风格、亮/暗主题）
    ├── js/
    │   ├── app.js         ← API 调用库 + 路由 + 初始化
    │   ├── pages.js       ← 登录 / 注册 / 首页 / 文章详情 / 评论
    │   ├── pages2.js      ← 写作编辑器 / 草稿 / 收藏 / 关注
    │   └── pages3.js      ← 个人主页 / 管理后台
    └── uploads/           ← 用户上传文件（头像 / 封面）
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动服务
node server.js

# 或使用 PowerShell 脚本启动（Windows）
.\start.ps1
```

启动后访问 [http://localhost:3000](http://localhost:3000)

### 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@example.com | 123456 |
| 用户 | test@example.com | test123 |
| 用户 | demo@example.com | demo |

> 数据库首次运行时自动创建并填充测试数据。

## 功能特性

### 用户功能
- 注册 / 登录 / 退出
- 个人资料编辑（头像、昵称、密码）
- 关注 / 取关用户
- 收藏 / 取消收藏文章
- 通知中心（评论、点赞、收藏、关注、审核通知）

### 文章功能
- 富文本写作编辑器（工具栏 + Ctrl+V 粘贴图片 + 字数统计）
- 文章发布（普通用户需审核，管理员直接发布）
- 草稿保存与管理
- 按标签分类浏览
- 全文搜索（标题 / 摘要 / 内容）
- 点赞 / 评论（支持回复，树形结构）
- 封面图片上传

### 管理员功能
- 文章审核（通过 / 拒绝）
- 已发布文章修改审核机制（审核期间旧版本继续展示）
- 用户管理（封禁 / 解封）
- 系统公告发布
- 数据统计仪表盘（Chart.js 可视化）
- 操作审计日志

### UI 特色
- Glassmorphism 毛玻璃设计风格
- 深色 / 亮色主题切换
- 动态渐变背景 + 光晕动画
- 响应式布局
- 毛玻璃风格确认弹窗和 Toast 提示

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| GET | `/api/posts` | 文章列表（分页、搜索、标签筛选） |
| GET | `/api/posts/:id` | 文章详情 |
| POST | `/api/posts` | 创建文章 |
| PUT | `/api/posts/:id` | 更新文章 |
| POST | `/api/posts/:id/like` | 点赞 / 取消点赞 |
| POST | `/api/posts/:id/favorite` | 收藏 / 取消收藏 |
| POST | `/api/posts/:id/comments` | 发表评论 |
| GET | `/api/user/:id` | 用户信息 |
| POST | `/api/user/:id/follow` | 关注 / 取关 |
| GET | `/api/notifications` | 通知列表 |
| PUT | `/api/notifications/read` | 标记通知已读 |
| GET | `/api/announcements` | 公告列表 |
| GET | `/api/admin/posts` | 管理后台文章列表 |
| PUT | `/api/admin/posts/:id/review` | 审核文章 |
| GET | `/api/admin/analytics` | 数据统计 |

## 注意事项

- sql.js 使用纯 JS 实现的 SQLite，所有时间通过 `now()` 工具函数生成，确保使用系统本地时区
- 后端鉴权直接使用 user.id 作为 Authorization header
- 前端使用 sessionStorage 存储 token，标签页隔离
- Express 5 路由使用 `/{*splat}` 而非 `*`
- sql.js 只接受数组参数
