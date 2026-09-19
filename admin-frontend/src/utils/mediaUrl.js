/** Normalize photo/document paths for same-origin display */
export function mediaUrl(path) {
  if (!path) return null;
  let raw = path;
  if (typeof raw === 'object' && raw.filePath) raw = raw.filePath;
  const match = String(raw).match(/\/uploads\/[^\s?#]+/i);
  if (match) return match[0];
  if (String(raw).startsWith('http')) {
    const i = raw.indexOf('/uploads/');
    if (i >= 0) return raw.substring(i);
    return raw;
  }
  return String(raw).startsWith('/') ? raw : null;
}
