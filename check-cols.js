const initSqlJs = require('sql.js');
const fs = require('fs');
(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('blog.db');
  const database = new SQL.Database(buf);
  const cols = database.exec("PRAGMA table_info(posts)");
  console.log('posts table column count:', cols[0].values.length);
  cols[0].values.forEach(([cid, name]) => console.log(`  col ${cid}: ${name}`));
  process.exit(0);
})();
