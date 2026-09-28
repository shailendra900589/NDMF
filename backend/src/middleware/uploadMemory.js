const multer = require('multer');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = { memoryUpload };
