/** Always return a same-origin stream path — works with Vite proxy, no download needed */
export function getRecordingStreamUrl(url) {
  if (!url) return '';
  const match = String(url).match(/\/uploads\/[^\s?#]+/i);
  if (match) return match[0];
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes('/uploads/')) return parsed.pathname;
  } catch {
    /* not a full URL */
  }
  return url.startsWith('/') ? url : '';
}

/** Authenticated stream URL (fallback) */
export function getAuthenticatedStreamUrl(url) {
  const path = getRecordingStreamUrl(url);
  if (!path) return '';
  const token = localStorage.getItem('ndfa_token');
  const q = new URLSearchParams({ path });
  if (token) q.set('token', token);
  return `/api/v1/media/stream?${q.toString()}`;
}
