import { useEffect, useState } from 'react';

const CACHE_KEY = 'ndfa_place_names';
const cache = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
})();
let chain = Promise.resolve();

function keyOf(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

/** Looks up a short place name (OpenStreetMap), at most one request per second. */
function lookup(lat, lng) {
  const key = keyOf(lat, lng);
  if (cache[key]) return Promise.resolve(cache[key]);
  chain = chain
    .then(() => new Promise((r) => setTimeout(r, 1100)))
    .then(async () => {
      if (cache[key]) return cache[key];
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('lookup failed');
      const j = await res.json();
      const a = j.address || {};
      const name = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.city_district || a.village, a.city || a.town || a.state_district]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(', ') || j.display_name || '';
      cache[key] = name;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {
        /* storage full — keep in memory */
      }
      return name;
    });
  return chain;
}

export default function useAddress(lat, lng) {
  const [name, setName] = useState(() => (lat != null ? cache[keyOf(lat, lng)] || '' : ''));
  useEffect(() => {
    if (lat == null || lng == null) return undefined;
    let alive = true;
    const hit = cache[keyOf(lat, lng)];
    if (hit) {
      setName(hit);
      return undefined;
    }
    lookup(lat, lng)
      .then((n) => alive && setName(n))
      .catch(() => alive && setName(''));
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  return name;
}
