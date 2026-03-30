/**
 * src/routes/upload.js - 图片上传
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { ok, fail } = require('../db');
const { requireAuth } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

function setupUploadRoutes(app) {
  app.post('/api/upload', requireAuth, (req, res) => {
    const { image, filename } = req.body;
    if (!image) return fail(res, '没有图片数据');
    try {
      const matches = image.match(/^data:(.+?);base64,(.+)$/);
      if (!matches) return fail(res, '图片格式错误');
      const ext = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1];
      const buf = Buffer.from(matches[2], 'base64');
      const fname = `${randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
      ok(res, { message: '上传成功', data: { url: `/uploads/${fname}` } });
    } catch (e) {
      fail(res, '上传失败: ' + e.message);
    }
  });
}

module.exports = setupUploadRoutes;
