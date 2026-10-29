import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { lookup, cachedAddress } from '../hooks/useAddress';

const DEFAULT_CENTER = [28.6139, 77.209];

function pin(html, size = 30) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone:'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
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
  const overviewControl = useRef(null);

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
    overviewControl.current?.remove();
    overviewControl.current = null;
    replay.current = null;
    const pts = (route?.points || []).map((p) => [p.lat, p.lng]);
    if (!pts.length) {
      if (route?.checkIn?.lat != null) m.setView([route.checkIn.lat, route.checkIn.lng], 15);
      return;
    }
    const segments=[];
    (route.points || []).forEach(p=>{if(!segments.length || p.breakBefore)segments.push([]);segments[segments.length-1].push([p.lat,p.lng]);});
    segments.forEach(segment=>{if(segment.length<2)return;L.polyline(segment, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(g);L.polyline(segment, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(g);});
    // A gap is deliberately not connected.  Mark its resume point so an
    // operator can distinguish missing observations from a travelled route.
    (route.points || []).forEach((p, index) => {
      if (!index || !p.breakBefore) return;
      const previous = route.points[index - 1];
      const elapsed = Math.max(0, Date.parse(p.at) - Date.parse(previous.at));
      const marker = L.circleMarker([p.lat, p.lng], { radius: 7, color: '#b45309', weight: 3, fillColor: '#fff7ed', fillOpacity: 1 });
      marker.bindTooltip(`GPS gap · ${fmtDuration(Math.round(elapsed / 60000))}<br/>Route resumes ${fmtTime(p.at)}`, { direction: 'top', className: 'route-stop-label', offset: [12, 0], sticky: true });
      marker.addTo(g);
    });

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
        const label = document.createElement('div');
        const duration = document.createElement('strong');duration.textContent=`Stop ${s.number} · ${fmtDuration(s.minutes)}`;
        const times = document.createElement('div');times.textContent=`${fmtTime(s.arrivedAt)} – ${s.ongoing ? 'latest fix' : fmtTime(s.leftAt)}`;
        const place = document.createElement('div');place.className='route-stop-place';place.textContent=cachedAddress(s.lat,s.lng) || `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`;
        label.append(duration,times,place);
        lookup(s.lat,s.lng).then(name=>{if(name) place.textContent=name;}).catch(()=>{});
        L.marker([s.lat, s.lng], { icon, zIndexOffset: 700, title: `Stop ${s.number} · ${fmtDuration(s.minutes)}`, alt: `Stop ${s.number}` })
          .bindTooltip(label, { permanent: false, direction: 'auto', className: 'route-stop-label', offset: [16, 0], opacity: 0.98 })
          .bindPopup(
            `<div class="live-pop"><strong>Stop ${s.number}${s.isStart ? ' · start' : ''}</strong>` +
              `<span>${fmtTime(s.arrivedAt)} – ${fmtTime(s.leftAt)} IST</span>` +
              `<span><b>${fmtDuration(s.minutes)}</b>${s.ongoing ? ' (through latest GPS fix)' : ''}</span>` +
              `<a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" rel="noreferrer">Open in Google Maps</a></div>`
          )
          .addTo(g);
      });
    }
    const bounds = L.latLngBounds(pts);
    const fit = () => m.fitBounds(bounds, { padding: [45, 45], maxZoom: 18, animate: false });
    m.invalidateSize();
    requestAnimationFrame(fit);
    const overview = L.control({ position: 'topleft' });
    overview.onAdd = () => { const button = L.DomUtil.create('button', 'route-map__overview'); button.type='button'; button.textContent='Fit complete route'; button.title='Show the full recorded route'; L.DomEvent.disableClickPropagation(button); L.DomEvent.on(button, 'click', fit); return button; };
    overview.addTo(m); overviewControl.current = overview;
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
