import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [28.6139, 77.209];

function pin(html, size = 30) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
}

function fmtDuration(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * One shift on the map: the full path, start and end, numbered stops with
 * their minutes, and an optional replay marker.
 */
export default function RouteMap({ route, showStops = true, focus = null, replayIndex = null, height = 520 }) {
  const el = useRef(null);
  const map = useRef(null);
  const group = useRef(null);
  const replay = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current).setView(DEFAULT_CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    group.current = L.layerGroup().addTo(map.current);
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(el.current);
    return () => {
      resize.disconnect();
      map.current.remove();
      map.current = null;
      replay.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = group.current;
    g.clearLayers();
    replay.current = null;
    const pts = (route?.points || []).map((p) => [p.lat, p.lng]);
    if (!pts.length) {
      if (route?.checkIn?.lat != null) m.setView([route.checkIn.lat, route.checkIn.lng], 15);
      return;
    }
    L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(g);
    L.polyline(pts, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(g);

    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    L.marker(pts[0], { icon: pin('<div class="route-pin route-pin--start">S</div>'), zIndexOffset: 500 })
      .bindTooltip(`Start · ${fmtTime(first.at)}`, { direction: 'top' })
      .addTo(g);
    const live = route.summary?.onDuty;
    L.marker(pts[pts.length - 1], {
      icon: pin(`<div class="route-pin ${live ? 'route-pin--now' : 'route-pin--end'}">${live ? '' : 'E'}</div>`),
      zIndexOffset: 600,
    })
      .bindTooltip(`${live ? 'Latest position' : 'End'} · ${fmtTime(last.at)}`, { direction: 'top' })
      .addTo(g);

    if (showStops) {
      (route.stops || []).forEach((s) => {
        const icon = pin(`<div class="route-pin route-pin--stop">${s.number}</div>`, 28);
        L.marker([s.lat, s.lng], { icon, zIndexOffset: 700 })
          .bindTooltip(fmtDuration(s.minutes), { permanent: true, direction: 'right', className: 'route-stop-label', offset: [12, 0] })
          .bindPopup(
            `<div class="live-pop"><strong>Stop ${s.number}${s.isStart ? ' · start' : ''}</strong>` +
              `<span>${fmtTime(s.arrivedAt)} – ${s.ongoing ? 'now' : fmtTime(s.leftAt)}</span>` +
              `<span><b>${fmtDuration(s.minutes)}</b>${s.ongoing ? ' (still here)' : ''}</span>` +
              `<a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" rel="noreferrer">Open in Google Maps</a></div>`
          )
          .addTo(g);
      });
    }
    m.invalidateSize();
    m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 17 });
  }, [route, showStops]);

  useEffect(() => {
    if (focus && map.current) map.current.setView([focus.lat, focus.lng], 17, { animate: true });
  }, [focus]);

  useEffect(() => {
    const m = map.current;
    const p = replayIndex != null ? route?.points?.[replayIndex] : null;
    if (!m) return;
    if (!p) {
      replay.current?.remove();
      replay.current = null;
      return;
    }
    if (!replay.current) {
      replay.current = L.marker([p.lat, p.lng], { icon: pin('<div class="route-pin route-pin--replay"></div>', 22), zIndexOffset: 1000 }).addTo(group.current);
    } else {
      replay.current.setLatLng([p.lat, p.lng]);
    }
    if (!m.getBounds().pad(-0.1).contains([p.lat, p.lng])) m.panTo([p.lat, p.lng]);
  }, [replayIndex, route]);

  return <div ref={el} className="route-map" style={{ height }} />;
}
