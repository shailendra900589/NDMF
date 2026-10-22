import { useCallback, useEffect, useRef, useState } from 'react';
import { trackingApi } from '../api/api';

/** Polls the live team positions; pauses while the browser tab is hidden. */
export default function useLiveTeam(intervalMs = 15000, enabled = true) {
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try {
      const res = await trackingApi.getLive();
      setTeam(res.data || []);
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.message || 'Could not load live locations');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, refresh]);

  return { team, error, updatedAt, loading, refresh };
}

/** Re-renders every second so "12 s ago" labels stay current. */
export function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export const STATUS_LABELS = {
  live: 'Live',
  delayed: 'Delayed',
  offline: 'No signal',
  checked_out: 'Checked out',
};
