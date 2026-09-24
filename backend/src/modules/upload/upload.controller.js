/**
 * UPLOAD CONTROLLER
 * -----------------
 * Photos aur voice recordings upload karne ke liye.
 * Flutter app camera se photo le kar yahan upload karegi.
 *
 * Response me file URL milega jo model me save hoga.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const { success, error } = require('../../lib/response');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

exports.uploadMiddleware = upload.single('file');

exports.uploadFile = (req, res) => {
  if (!req.file) return error(res, 'No file uploaded');

  const { latitude, longitude, capturedAt, type } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;

  return success(res, {
    fileUrl,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    capturedAt: capturedAt || new Date().toISOString(),
    type: type || 'photo',
  }, 'File uploaded');
};

exports.uploadMultipleMiddleware = upload.array('files', 10);

exports.uploadMultiple = (req, res) => {
  if (!req.files?.length) return error(res, 'No files uploaded');

  const files = req.files.map((f) => ({
    fileUrl: `/uploads/${f.filename}`,
    fileName: f.filename,
  }));

  return success(res, files, 'Files uploaded');
};
