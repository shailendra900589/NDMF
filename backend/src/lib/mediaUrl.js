/** Normalize any stored recording URL to /uploads/filename.ext */
function normalizeRecordingUrl(url) {
  if (!url) return null;
  const match = String(url).match(/\/uploads\/[^\s?#]+/i);
  return match ? match[0] : null;
}

module.exports = { normalizeRecordingUrl };
