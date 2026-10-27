import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_LABELS, timeAgo, useNow } from '../hooks/useLiveTeam';

const DEFAULT_CENTER = [28.6139, 77.209];

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function escapeHtml(text = '') {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function popupHtml(e) {
  const rows = [
    `<strong>${escapeHtml(e.name || e.employeeId)}</strong>`,
    `<span>${escapeHtml(e.branch || '')}</span>`,
    `<span class="live-pop__status live-pop__status--${e.status}">${STATUS_LABELS[e.status] || e.status} · ${timeAgo(e.lastSeenAt)}</span>`,
    `<span>${Number(e.totalKmToday || 0).toFixed(2)} km today</span>`,
  ];
  if (e.accuracy != null) rows.push(`<span>GPS accuracy ±${Math.round(e.accuracy)} m</span>`);
  if (e.speedKmh != null) rows.push(`<span>Speed ${e.speedKmh} km/h</span>`);
  if (e.mocked) rows.push('<span class="live-pop__warn">Fake GPS app detected</span>');
  rows.push(
    `<a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" rel="noreferrer">Open in Google Maps</a>`
  );
  return `<div class="live-pop">${rows.join('')}</div>`;
}

/**
 * Live map of field staff. Every employee has their own pin, coloured by
 * status, with the GPS accuracy circle. Selecting someone draws today's route.
 */
export default function LiveTeamMap({ team = [], selectedId = null, onSelect, route = null, height = 420 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({ markers: null, route: null });
  const pins = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedIds = useRef('');
  const now = useNow();

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layers.current.markers = L.layerGroup().addTo(map.current);
    layers.current.route = L.layerGroup().addTo(map.current);
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(el.current);
    return () => {
      resize.disconnect();
      map.current.remove();
      map.current = null;
      pins.current.clear();
      fittedIds.current = '';
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = layers.current.markers;
    const existing = pins.current;
    const seen = new Set();
    team.forEach((e) => {
      seen.add(e.userId);
      const pos = [e.lat, e.lng];
      const selected = e.userId === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div class="live-pin live-pin--${e.status}${selected ? ' live-pin--selected' : ''}">${escapeHtml(initials(e.name))}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16],
      });
      const showCircle = e.accuracy != null && e.accuracy <= 150 && e.status !== 'checked_out';
      let pin = existing.get(e.userId);
      if (!pin) {
        const marker = L.marker(pos, { icon, title: e.name })
          .bindPopup(popupHtml(e))
          .on('click', () => onSelectRef.current?.(e.userId))
          .addTo(group);
        const circle = L.circle(pos, { radius: 1, color: '#0f766e', weight: 1, fillOpacity: 0.08, interactive: false });
        pin = { marker, circle };
        existing.set(e.userId, pin);
      } else {
        pin.marker.setLatLng(pos).setIcon(icon);
        pin.marker.setPopupContent(popupHtml(e));
      }
      pin.marker.setZIndexOffset(selected ? 1000 : 0);
      if (showCircle) {
        pin.circle.setLatLng(pos).setRadius(e.accuracy);
        if (!group.hasLayer(pin.circle)) pin.circle.addTo(group);
      } else if (group.hasLayer(pin.circle)) {
        group.removeLayer(pin.circle);
      }
    });
    for (const [id, pin] of existing) {
      if (seen.has(id)) continue;
      group.removeLayer(pin.marker);
      group.removeLayer(pin.circle);
      existing.delete(id);
    }

    const ids = team.map((e) => e.userId).sort().join(',');
    if (team.length && ids !== fittedIds.current) {
      fittedIds.current = ids;
      const bounds = L.latLngBounds(team.map((e) => [e.lat, e.lng]));
      m.invalidateSize();
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [team, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = layers.current.route;
    group.clearLayers();
    const pts = (route?.points || []).map((p) => [p.lat, p.lng]);
    if (pts.length >= 2) {
      L.polyline(pts, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(group);
      L.circleMarker(pts[0], { radius: 6, color: '#16a34a', fillOpacity: 1 }).bindTooltip('Start').addTo(group);
      m.invalidateSize();
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 17 });
    }
  }, [route]);

  const sorted = useMemo(() => {
    const order = { live: 0,weak_gps:1,gps_pending:1,location_off:1,permission_required:1, delayed: 1, offline: 2, checked_out: 3 };
    return [...team].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [team]);

  const focus = (e) => {
    onSelect?.(e.userId);
    map.current?.setView([e.lat, e.lng], Math.max(map.current.getZoom(), 15));
  };

  return (
    <div className="live-team-map">
      <div ref={el} className="live-team-map__canvas" style={{ height }} />
      {sorted.length === 0 ? (
        <p className="muted live-team-map__empty">No one is on duty right now. Staff appear here after they check in on the mobile app.</p>
      ) : (
        <div className="live-team-map__legend">
          {sorted.map((e) => (
            <button
              type="button"
              key={e.userId}
              className={`live-chip${e.userId === selectedId ? ' live-chip--selected' : ''}`}
              onClick={() => focus(e)}
            >
              <span className={`live-dot live-dot--${e.status}`} />
              <strong>{e.name || e.employeeId}</strong>
              <span>{Number(e.totalKmToday || 0).toFixed(2)} km</span>
              <span className="live-chip__ago">{STATUS_LABELS[e.status]} · {timeAgo(e.lastSeenAt, now)}</span>
              {e.mocked && <span className="live-chip__warn">Fake GPS</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
