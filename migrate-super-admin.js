const initSqlJs = require('sql.js');
const fs = require('fs');
const DB_PATH = 'blog.db';

initSqlJs().then(SQL => {
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const before = db.exec("SELECT id, name, role FROM users WHERE role IN ('admin','super_admin')");
  console.log('迁移前:', JSON.stringify(before));

  // 如果没有 super_admin，把第一个 admin 升级
  db.run("UPDATE users SET role='super_admin' WHERE role='admin' AND id=(SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE role='super_admin')");

  const after = db.exec("SELECT id, name, role FROM users WHERE role IN ('admin','super_admin')");
  console.log('迁移后:', JSON.stringify(after));

  const buf2 = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, buf2);
  console.log('✅ 数据库已保存');
});
