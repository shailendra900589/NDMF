const fs = require('fs');
const path = require('path');
const { error } = require('../../lib/response');
const { normalizeRecordingUrl } = require('../../lib/mediaUrl');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

const MIME_TYPES = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};

/** Stream audio with HTTP Range support — browser inline play without download */
exports.streamRecording = (req, res) => {
  const rawPath = req.query.path || req.params.path || '';
  const relative = normalizeRecordingUrl(rawPath);
  if (!relative) return error(res, 'Invalid recording path', 400);

  const filename = path.basename(relative);
  const absolute = path.join(UPLOAD_DIR, filename);
  if (!absolute.startsWith(UPLOAD_DIR) || !fs.existsSync(absolute)) {
    return error(res, 'Recording not found', 404);
  }

  const stat = fs.statSync(absolute);
  const ext = path.extname(absolute).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  // Inline play in browser — not forced download
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (start >= stat.size || end >= stat.size) {
      res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
      return res.end();
    }
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', chunkSize);
    return fs.createReadStream(absolute, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', stat.size);
  return fs.createReadStream(absolute).pipe(res);
};
