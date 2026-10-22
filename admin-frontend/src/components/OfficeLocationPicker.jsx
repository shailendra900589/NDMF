import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [28.6139, 77.209];

/** Pulls "lat, lng" out of a Google Maps link or plain text. */
export function parseLatLng(text) {
  const s = String(text || '').trim();
  const patterns = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/**
 * Map to set an office's attendance point. Click or drag the pin; the circle
 * shows the allowed radius.
 */
export default function OfficeLocationPicker({ lat, lng, radius, onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current).setView(hasPoint ? [lat, lng] : DEFAULT_CENTER, hasPoint ? 17 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    map.current.on('click', (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    setTimeout(() => map.current?.invalidateSize(), 50);
    return () => {
      map.current.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!hasPoint) {
      marker.current?.remove();
      circle.current?.remove();
      marker.current = null;
      circle.current = null;
      return;
    }
    const pos = [lat, lng];
    if (!marker.current) {
      marker.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ className: '', html: '<div class="live-pin live-pin--live">HQ</div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
      }).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      circle.current = L.circle(pos, { radius: radius || 100, color: '#0f766e', weight: 2, fillOpacity: 0.12 }).addTo(m);
      m.setView(pos, Math.max(m.getZoom(), 17));
    } else {
      marker.current.setLatLng(pos);
      circle.current.setLatLng(pos);
    }
    circle.current.setRadius(radius || 100);
  }, [lat, lng, radius, hasPoint]);

  const applyPaste = () => {
    const p = parseLatLng(paste);
    if (!p) {
      setNote('Could not find coordinates. Paste a Google Maps link or "28.6139, 77.2090".');
      return;
    }
    setNote('');
    onChange(p);
    map.current?.setView([p.lat, p.lng], 17);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNote('This browser cannot read location.');
      return;
    }
    setNote('Reading this computer’s location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNote(`Location found (±${Math.round(pos.coords.accuracy)} m). Drag the pin if it is not exactly on the office.`);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 18);
      },
      () => setNote('Location permission was blocked. Click on the map instead.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="office-picker">
      <div className="office-picker__tools">
        <input
          placeholder="Paste Google Maps link or lat, lng"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyPaste())}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={applyPaste}>Use</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation}>My location</button>
      </div>
      <div ref={el} className="office-picker__map" />
      <p className="office-picker__hint">
        {note || (hasPoint ? 'Drag the pin or click the map to adjust. The circle is the allowed check-in area.' : 'Click on the map at the office entrance to set the attendance point.')}
      </p>
    </div>
  );
}
