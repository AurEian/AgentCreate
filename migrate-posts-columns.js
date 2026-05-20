/**
 * migrate-posts-columns.js - 修复 posts 表列数不足的问题
 * 运行方式: node migrate-posts-columns.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'blog.db');

  if (!fs.existsSync(dbPath)) {
    console.error('blog.db 不存在');
    process.exit(1);
  }

  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // 检查当前列数
  const cols = db.exec('PRAGMA table_info(posts)');
  const existingCols = new Set(cols[0].values.map(r => r[1]));
  console.log(`当前 posts 表列数: ${existingCols.size}`);
  console.log('已有列:', [...existingCols].join(', '));

  // 需要新增的列（按 posts.js INSERT 顺序）
  const toAdd = [
    'pending_title',      // 11 - 待审核标题
    'pending_summary',    // 12 - 待审核摘要
    'pending_content',    // 13 - 待审核内容
    'pending_cover',      // 14 - 待审核封面
    'pending_tags',       // 15 - 待审核标签
    'approved_title',     // 16 - 已通过标题
    'approved_summary',   // 17 - 已通过摘要
    'approved_content',   // 18 - 已通过内容
    'approved_at',        // 19 - 审核通过时间
    'ban_reason',         // 20 - 封禁原因
    'reject_reason',      // 21 - 拒绝原因
    'reviewer_id',        // 22 - 审核人ID
    'reviewer_claimed_at', // 23 - 认领时间
    'reviewed_by',        // 24 - 审核人姓名
    'assigned_to',        // 25 - 被指派管理员ID
    'assigned_at',        // 26 - 指派时间
  ];

  let added = 0;
  for (const col of toAdd) {
    if (existingCols.has(col)) {
      console.log(`  ✓ ${col} 已存在，跳过`);
    } else {
      try {
        db.run(`ALTER TABLE posts ADD COLUMN ${col} TEXT DEFAULT ''`);
        console.log(`  + 新增 ${col}`);
        added++;
      } catch (e) {
        console.log(`  ✗ 新增 ${col} 失败: ${e.message}`);
      }
    }
  }

  // 验证
  const newCols = db.exec('PRAGMA table_info(posts)');
  console.log(`\n迁移后 posts 表列数: ${newCols[0].values.length}`);

  // 保存
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  console.log(`\n已保存到 ${dbPath}`);

  db.close();
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
