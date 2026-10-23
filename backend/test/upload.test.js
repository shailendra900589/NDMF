const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { memoryUpload } = require('../src/middleware/uploadMemory');
const uploads = require('../src/modules/upload/upload.controller');

test('Multer upgrade preserves attendance memory and company disk uploads', async t => {
  const app = express();
  const files = [];
  app.use((req, res, next) => { req.user = { companyId: 'TEST_UPLOAD' }; next(); });
  app.post('/memory', memoryUpload.single('file'), (req, res) => res.json({ size: req.file.buffer.length, latitude: req.body.latitude }));
  app.post('/single', uploads.uploadMiddleware, uploads.uploadFile);
  app.post('/multiple', uploads.uploadMultipleMiddleware, uploads.uploadMultiple);
  app.use((error, req, res, next) => res.status(400).json({ code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  t.after(() => files.forEach(name => fs.unlinkSync(path.join(__dirname, '../uploads', name))));
  const base = `http://127.0.0.1:${server.address().port}`;
  const image = new Blob(['dummy-test-photo'], { type: 'image/png' });
  const memory = new FormData(); memory.append('file', image, 'face.png'); memory.append('latitude', '28.61');
  let response = await fetch(`${base}/memory`, { method: 'POST', body: memory });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { size: 16, latitude: '28.61' });
  for (const [route, field, count] of [['single', 'file', 1], ['multiple', 'files', 2]]) {
    const body = new FormData();
    for (let i = 0; i < count; i++) body.append(field, image, `photo-${i}.png`);
    response = await fetch(`${base}/${route}`, { method: 'POST', body });
    const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.success, true);
    const records = Array.isArray(result.data) ? result.data : [result.data];
    records.forEach(record => files.push(record.fileName));
    assert.equal(records.length, count);
    records.forEach(record => {
      assert.ok(record.fileName.startsWith('TEST_UPLOAD_'));
      assert.equal(fs.readFileSync(path.join(__dirname, '../uploads', record.fileName), 'utf8'), 'dummy-test-photo');
    });
  }
  const unexpected = new FormData(); unexpected.append('wrong-field', image, 'face.png');
  response = await fetch(`${base}/memory`, { method: 'POST', body: unexpected });
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'LIMIT_UNEXPECTED_FILE');
});
