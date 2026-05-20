/**
 * src/routes/import.js - 导入 Markdown 文件 + 图片资源
 *
 * POST /api/import/parse   - 解析 md，返回 frontmatter 预览（不创建 post）
 * POST /api/import/create  - 接收解析好的数据，创建 post
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const AdmZip = require('adm-zip');
const { randomUUID } = require('crypto');
const {
  q1, run, saveDB, ok, fail,
  getBan, logAudit, notify, now,
  checkSensitiveWords
} = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── 解析 frontmatter（YAML between --- markers）─────────────
function parseFrontmatter(content) {
  const fm = { title: '', summary: '', tags: [], cover: '' };
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) return fm;
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return fm;
  try {
    const yamlText = trimmed.slice(4, end);
    const parsed = yaml.load(yamlText);
    fm.title = (parsed.title || '').toString().trim();
    fm.summary = (parsed.summary || parsed.description || '').toString().trim();
    fm.tags = Array.isArray(parsed.tags) ? parsed.tags.map(t => t.toString().trim()).filter(Boolean)
      : typeof parsed.tags === 'string' ? parsed.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      : [];
    fm.cover = (parsed.cover || parsed.coverImage || parsed.image || '').toString().trim();
  } catch { /* 解析失败，忽略 */ }
  return fm;
}

// ── 从 markdown 内容中提取本地图片相对路径 ─────────────────
function extractImagePaths(content) {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const paths = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    const src = m[2].trim();
    if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
      paths.push(src);
    }
  }
  return [...new Set(paths)];
}

// ── 从 zip 中提取图片，返回 { 原路径 -> /uploads/文件名 } ───
function extractZipImages(zipBuffer, uploadDir) {
  const mapping = {};
  try {
    const zip = new AdmZip(zipBuffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      if (!/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(entry.entryName)) continue;
      const ext = path.extname(entry.entryName);
      const newName = `${randomUUID()}${ext}`;
      const outPath = path.join(uploadDir, newName);
      try {
        fs.writeFileSync(outPath, entry.getData());
        const normalized = entry.entryName.replace(/\\/g, '/');
        mapping[normalized] = `/uploads/${newName}`;
      } catch { /* 跳过失败的文件 */ }
    }
  } catch { /* zip 解析失败 */ }
  return mapping;
}

function setupImportRoutes(app) {

  // STEP 1: 解析 md 文件，返回 frontmatter 预览（不创建 post）
  app.post('/api/import/parse', requireAuth, async (req, res) => {
    try {
      const formidableLib = await import('formidable');
      const formidable = formidableLib.default;

      const { fields, files } = await new Promise((resolve, reject) => {
        const form = formidable({
          uploadDir: '/tmp',
          keepExtensions: true,
          maxFileSize: 50 * 1024 * 1024
        });
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });

      const mdFile = files.file?.[0] || files.file;
      if (!mdFile) return fail(res, '请选择要导入的 .md 文件', 400);

      const ext = (mdFile.originalFilename || mdFile.filename || '').split('.').pop().toLowerCase();
      if (ext !== 'md' && ext !== 'markdown') {
        return fail(res, '只支持 .md 或 .markdown 文件', 400);
      }

      let rawContent;
      try {
        rawContent = fs.readFileSync(mdFile.filepath, 'utf-8');
      } catch {
        return fail(res, '无法读取文件内容', 500);
      } finally {
        try { fs.unlinkSync(mdFile.filepath); } catch {}
      }

      const fm = parseFrontmatter(rawContent);
      const trimmed = rawContent.trim();
      let bodyContent = trimmed;
      if (trimmed.startsWith('---')) {
        const end = trimmed.indexOf('\n---', 3);
        if (end !== -1) bodyContent = trimmed.slice(end + 4).trim();
      }

      extractImagePaths(bodyContent); // 提取备用（目前不需要特别处理）

      // 处理 zip 图片
      const zipFile = files.images?.[0] || files.images;
      let imageMapping = {};
      if (zipFile) {
        try {
          const zipBuffer = fs.readFileSync(zipFile.filepath);
          imageMapping = extractZipImages(zipBuffer, path.join(__dirname, '../../public/uploads'));
        } catch {}
        finally {
          try { fs.unlinkSync(zipFile.filepath); } catch {}
        }
      }

      // 没有封面时尝试从 zip 中取
      let cover = fm.cover;
      if (!cover && Object.keys(imageMapping).length > 0) {
        const firstSrc = Object.keys(imageMapping)[0];
        cover = imageMapping[firstSrc] || '';
      }

      ok(res, {
        data: {
          title: fm.title || (mdFile.originalFilename || '未命名文章').replace(/\.(md|markdown)$/i, ''),
          summary: fm.summary,
          tags: fm.tags,
          cover,
          content: bodyContent,
          imageMapping,
        }
      });

    } catch (e) {
      console.error('[DEBUG] import/parse error:', e.message);
      return fail(res, '解析失败：' + e.message, 500);
    }
  });

  // STEP 2: 根据解析结果创建 post
  app.post('/api/import/create', requireAuth, async (req, res) => {
    const ban = getBan(req.user.id);
    if (ban) return fail(res, `你已被封禁，无法导入文章。原因：${ban.reason}`, 403);

    const { title, summary, content, tags, cover } = req.body;
    if (!title || !content) return fail(res, '标题和内容不能为空');

    const fullText = `${title} ${summary || ''} ${content}`;
    const matchedWord = checkSensitiveWords(fullText);
    let status = 'pending';
    let message = '文章已提交审核';

    if (req.user.role === 'admin') {
      status = 'published';
      message = '文章导入并发布成功';
    } else if (!matchedWord) {
      status = 'published';
      message = '文章导入并发布成功';
    } else {
      message = '文章含敏感内容，已提交审核';
    }

    const id = randomUUID();
    run('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      id, req.user.id, title, summary, content, cover || '', status,
      0, 0, now(), now(),
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', ''
    ]);

    const tagList = Array.isArray(tags) ? tags
      : (typeof tags === 'string' ? tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : []);
    for (const tagName of tagList) {
      let existing = q1('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!existing) {
        const tid = randomUUID();
        run('INSERT INTO tags VALUES (?,?)', [tid, tagName]);
        existing = { id: tid };
      }
      run('INSERT OR IGNORE INTO post_tags VALUES (?,?)', [id, existing.id]);
    }

    logAudit(req.user.id, status === 'published' ? 'import_post' : 'submit_post', id, title);

    if (status === 'pending') {
      const admins = q1('SELECT id FROM users WHERE role IN ("admin","super_admin") ORDER BY last_assigned_at ASC NULLS FIRST LIMIT 1');
      if (admins) {
        run('UPDATE posts SET assigned_to=?, assigned_at=? WHERE id=?', [admins.id, now(), id]);
        run('UPDATE users SET last_assigned_at=? WHERE id=?', [now(), admins.id]);
        notify(admins.id, req.user.id, 'review', id);
      }
    }

    saveDB();
    ok(res, { message, data: { id, title, status }, matchedWord });
  });
}

module.exports = { setupImportRoutes };
