/**
 * src/db.js - 数据库初始化、查询辅助函数、通用工具函数
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// 支持环境变量覆盖路径（Docker 部署时用 /app/data/blog.db）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'blog.db');
let db;

/** 获取当前本地时间字符串，格式 YYYY-MM-DD HH:MM:SS */
function now() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ===================== DATABASE INIT =====================
async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    console.log('  📦 已加载现有数据库');
    // Migrate: add new columns if missing
    const migrations = [
      "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN cover TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'published'",
      "ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN pending_title TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN pending_summary TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN pending_content TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN pending_cover TEXT DEFAULT ''",
      "ALTER TABLE posts ADD COLUMN pending_tags TEXT DEFAULT ''",
    ];
    migrations.forEach(sql => { try { db.run(sql); } catch {} });

    const tables = [
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL,
        content TEXT NOT NULL, parent_id TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT NOT NULL, post_id TEXT NOT NULL, PRIMARY KEY(user_id, post_id)
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL, post_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')),
        PRIMARY KEY(user_id, post_id)
      )`,
      `CREATE TABLE IF NOT EXISTS follows (
        follower_id TEXT NOT NULL, following_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        PRIMARY KEY(follower_id, following_id)
      )`,
      `CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT,
        title TEXT DEFAULT '', summary TEXT DEFAULT '', content TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(user_id, post_id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT, action TEXT NOT NULL, target TEXT DEFAULT '',
        detail TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL, from_user_id TEXT NOT NULL,
        type TEXT NOT NULL, post_id TEXT DEFAULT '',
        content TEXT DEFAULT '', is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        title TEXT NOT NULL, content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS sensitive_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )`,
    ];
    tables.forEach(sql => { try { db.run(sql); } catch {} });
    // 初始化敏感词
    const initWords = ['台独','藏独','疆独','分裂国家','颠覆政权','恐怖主义','赌博','博彩','诈骗','传销','色情','毒品','武器'];
    initWords.forEach(w => { try { db.run(`INSERT OR IGNORE INTO sensitive_words (word) VALUES (?)`, [w]); } catch {} });
    saveDB();
    return;
  }

  db = new SQL.Database();

  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
    avatar TEXT DEFAULT '', bio TEXT DEFAULT '',
    pending_name TEXT DEFAULT '', pending_bio TEXT DEFAULT '',
    profile_pending INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL, banned_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    banned_until TEXT NOT NULL, UNIQUE(user_id)
  )`);
  db.run(`CREATE TABLE sensitive_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  // 初始化默认敏感词
  const initWords = ['台独','藏独','疆独','分裂国家','颠覆政权','恐怖主义','赌博','博彩','诈骗','传销','色情','毒品','武器'];
  initWords.forEach(w => {
    try { db.run(`INSERT OR IGNORE INTO sensitive_words (word) VALUES (?)`, [w]); } catch {}
  });
  db.run(`CREATE TABLE tags (
    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL
  )`);
  db.run(`CREATE TABLE posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL, summary TEXT DEFAULT '', content TEXT NOT NULL,
    cover TEXT DEFAULT '', status TEXT DEFAULT 'published',
    likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    pending_title TEXT DEFAULT '', pending_summary TEXT DEFAULT '',
    pending_content TEXT DEFAULT '', pending_cover TEXT DEFAULT '',
    pending_tags TEXT DEFAULT ''
  )`);
  db.run(`CREATE TABLE post_tags (
    post_id TEXT NOT NULL REFERENCES posts(id), tag_id TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY(post_id, tag_id)
  )`);
  db.run(`CREATE TABLE comments (
    id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL,
    content TEXT NOT NULL, parent_id TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE likes (
    user_id TEXT NOT NULL, post_id TEXT NOT NULL, PRIMARY KEY(user_id, post_id)
  )`);
  db.run(`CREATE TABLE favorites (
    user_id TEXT NOT NULL, post_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY(user_id, post_id)
  )`);
  db.run(`CREATE TABLE follows (
    follower_id TEXT NOT NULL, following_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY(follower_id, following_id)
  )`);
  db.run(`CREATE TABLE drafts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT,
    title TEXT DEFAULT '', summary TEXT DEFAULT '', content TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, post_id)
  )`);
  db.run(`CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, action TEXT NOT NULL, target TEXT DEFAULT '',
    detail TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, from_user_id TEXT NOT NULL,
    type TEXT NOT NULL, post_id TEXT DEFAULT '',
    content TEXT DEFAULT '', is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE announcements (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Seed users
  const seed = [
    ['u1','admin@example.com','123456','管理员','admin','','全站管理员','2026-01-01 00:00:00'],
    ['u2','test@example.com','test123','测试用户','user','','热爱前端开发的程序员','2026-02-15 10:00:00'],
    ['u3','demo@example.com','demo','演示账户','user','','Node.js 后端开发者','2026-03-01 08:00:00'],
  ];
  const ins = db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)');
  seed.forEach(r => ins.run(r));
  ins.free();

  // Seed tags
  const tags = [['t1','JavaScript'],['t2','CSS'],['t3','React'],['t4','Node.js'],['t5','前端'],['t6','后端'],['t7','TypeScript'],['t8','Vue']];
  const it = db.prepare('INSERT INTO tags VALUES (?,?)');
  tags.forEach(r => it.run(r));
  it.free();

  // Seed posts
  const ip = db.prepare('INSERT INTO posts (id,user_id,title,summary,content,cover,status,likes,views,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const ipt = db.prepare('INSERT INTO post_tags VALUES (?,?)');
  const posts = [
    ['p1','u2','初学者指南：从零开始的 JavaScript 之旅','JavaScript 是现代 Web 开发的基石。本文将带你从变量声明、数据类型出发，逐步深入函数、异步编程与 ES6+ 新特性。',
`## 为什么要学 JavaScript？

JavaScript 是世界上使用最广泛的编程语言之一。无论是前端交互、后端服务、还是移动端开发，JavaScript 都扮演着重要角色。

### 1. 变量与数据类型

\`\`\`javascript
let name = 'World';
const age = 25;
var legacy = true;
\`\`\`

JavaScript 有 7 种原始数据类型：
- \`string\` — 字符串
- \`number\` — 数字
- \`boolean\` — 布尔值
- \`null\` — 空值
- \`undefined\` — 未定义
- \`symbol\` — 符号
- \`bigint\` — 大整数

### 2. 函数与箭头函数

\`\`\`javascript
function greet(name) {
  return 'Hello, ' + name;
}
const greet2 = (name) => \`Hello, \${name}\`;
\`\`\`

### 3. 异步编程

\`\`\`javascript
// Promise
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data));

// Async/Await
async function getData() {
  const res = await fetch('/api/data');
  return await res.json();
}
\`\`\`

> **提示**：Async/Await 让异步代码看起来像同步代码，是现代 JavaScript 开发的首选方式。

### 4. ES6+ 新特性

- **解构赋值**：\`const { name, age } = user;\`
- **模板字符串**：\`Hello, \${name}!\`
- **展开运算符**：\`const arr2 = [...arr1, 4, 5];\`
- **可选链**：\`const city = user?.address?.city;\`

---

开始你的 JavaScript 之旅吧！`,
'','published',12,156,'2026-03-20 09:00:00','2026-03-20 09:00:00',['t1','t5']],

    ['p2','u2','CSS 毛玻璃效果完全指南','Glassmorphism（毛玻璃效果）是近年来最受欢迎的 UI 设计趋势之一。本文详解 backdrop-filter 的使用方法。',
`## 什么是毛玻璃效果？

毛玻璃效果（Glassmorphism）是一种 UI 设计风格，通过 **背景模糊** + **半透明** + **微妙边框** 营造出磨砂玻璃般的视觉效果。

### 核心 CSS 属性

\`\`\`css
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
}
\`\`\`

### 三要素拆解

1. **半透明背景**：让背景色透出来
2. **模糊滤镜**：模糊背后的内容
3. **边框高光**：微妙的白色边框模拟玻璃边缘折射

> 结合渐变背景使用效果最佳，深色渐变 + 浮动光晕 + 毛玻璃卡片 = 现代感拉满。`,
'','published',8,98,'2026-03-22 14:00:00','2026-03-22 14:00:00',['t2','t5']],

    ['p3','u3','Node.js 后端入门：Express 框架实战','本文从零搭建一个 Express 服务器，涵盖路由、中间件、错误处理等核心概念。',
`## Express 简介

Express 是 Node.js 最流行的 Web 框架。

### 快速开始

\`\`\`javascript
const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
\`\`\`

### 中间件

\`\`\`javascript
app.use((req, res, next) => {
  console.log(\`\${req.method} \${req.path}\`);
  next();
});
\`\`\`

---

Express 简单而强大，是 Node.js 后端开发的不二之选！`,
'','published',5,67,'2026-03-25 11:00:00','2026-03-25 11:00:00',['t4','t6']],

    ['p4','u2','React Hooks 深入理解：useState 与 useEffect','Hooks 是 React 16.8 引入的革命性特性。本文深入剖析 useState 和 useEffect 的工作原理。',
`## 为什么需要 Hooks？

在 Hooks 出现之前，React 组件的逻辑复用只能通过高阶组件或 render props，代码容易产生"嵌套地狱"。

### useState

\`\`\`javascript
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
\`\`\`

### useEffect

\`\`\`javascript
useEffect(() => {
  const timer = setInterval(() => { /* ... */ }, 1000);
  return () => clearInterval(timer);
}, []);
\`\`\`

---

掌握 Hooks 是成为 React 高手的关键！`,
'','published',15,203,'2026-03-26 16:00:00','2026-03-26 16:00:00',['t3','t1','t5']],

    ['p5','u3','TypeScript 入门：类型系统的力量','TypeScript 为 JavaScript 添加了静态类型检查，让大型项目的开发更加安全和高效。',
`## 为什么要用 TypeScript？

TypeScript 是 JavaScript 的超集，它添加了类型系统和编译时类型检查。

### 基本类型

\`\`\`typescript
let name: string = 'World';
let age: number = 25;
let isDev: boolean = true;
let items: string[] = ['a', 'b'];
\`\`\`

### 接口

\`\`\`typescript
interface User {
  name: string;
  age: number;
  email?: string;
}
\`\`\`

> TypeScript 的类型推断非常强大，很多情况下你不需要显式标注类型。`,
'','published',3,42,'2026-03-27 10:00:00','2026-03-27 10:00:00',['t7','t1']],
  ];

  posts.forEach(([id,uid,title,summary,content,cover,status,likes,views,ca,ua,tags]) => {
    ip.run([id,uid,title,summary,content,cover||'',status||'published',likes||0,views||0,ca,ua]);
    tags.forEach(tid => ipt.run([id,tid]));
  });
  ip.free(); ipt.free();

  // Seed comments
  const ic = db.prepare('INSERT INTO comments VALUES (?,?,?,?,?,?)');
  const comments = [
    ['c1','p1','u3','写得太好了！对初学者非常友好',null,'2026-03-21 08:00:00'],
    ['c2','p1','u1','内容很全面，ES6+ 部分补充得很好',null,'2026-03-21 10:30:00'],
    ['c3','p2','u3','毛玻璃效果确实很炫！',null,'2026-03-23 14:00:00'],
    ['c4','p3','u2','Express 真的好用',null,'2026-03-26 09:00:00'],
    ['c5','p4','u3','Hooks 陷阱那部分讲得很清楚',null,'2026-03-27 08:00:00'],
  ];
  comments.forEach(r => ic.run(r));
  ic.free();

  // Seed follows
  const ifl = db.prepare('INSERT OR IGNORE INTO follows VALUES (?,?,?)');
  ifl.run(['u2','u3', now()]); ifl.run(['u3','u2', now()]); ifl.run(['u3','u1', now()]);
  ifl.free();

  saveDB();
  console.log('  🌱 已初始化数据库（含种子数据）');
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ===================== QUERY HELPERS =====================
function q1(sql, params = []) {
  try {
    const r = db.prepare(sql); r.bind(params);
    if (r.step()) { const row = r.getAsObject(); r.free(); return row; }
    r.free(); return null;
  } catch (e) { console.error('SQL:', sql, e.message); return null; }
}

function qa(sql, params = []) {
  try {
    const r = db.prepare(sql); r.bind(params);
    const rows = [];
    while (r.step()) rows.push(r.getAsObject());
    r.free(); return rows;
  } catch (e) { console.error('SQL:', sql, e.message); return []; }
}

function run(sql, params = []) {
  try { db.run(sql, params); return true; } catch (e) { console.error('SQL:', sql, e.message); return false; }
}

function ok(res, data, status = 200) { res.status(status).json({ success: true, ...data }); }
function fail(res, message, status = 400) { res.status(status).json({ success: false, message }); }

// ===================== UTILITY FUNCTIONS =====================
function notify(userId, fromUserId, type, postId = '') {
  try { run('INSERT INTO notifications (user_id,from_user_id,type,post_id) VALUES (?,?,?,?)', [userId, fromUserId, type, postId]); saveDB(); } catch {}
}

function getBan(userId) {
  return q1('SELECT * FROM bans WHERE user_id = ? AND banned_until > ?', [userId, now()]);
}

function logAudit(userId, action, target = '', detail = '') {
  run('INSERT INTO audit_log (user_id,action,target,detail) VALUES (?,?,?,?)', [userId, action, target, detail]);
}

module.exports = { initDB, saveDB, db: () => db, q1, qa, run, ok, fail, notify, getBan, logAudit, now };
