/** Lightweight live map — OpenStreetMap embed (no API key). */
export default function LiveTeamMap({ team = [] }) {
  const withGps = team.filter((e) => e.lat != null && e.lng != null);
  const center = withGps.length
    ? {
        lat: withGps.reduce((s, e) => s + Number(e.lat), 0) / withGps.length,
        lng: withGps.reduce((s, e) => s + Number(e.lng), 0) / withGps.length,
      }
    : { lat: 28.6139, lng: 77.209 };

  const pad = 0.08;
  const bbox = [
    center.lng - pad,
    center.lat - pad,
    center.lng + pad,
    center.lat + pad,
  ].join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;

  return (
    <div className="live-team-map">
      <iframe title="Live team map" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <div className="live-team-map__legend">
        {withGps.length === 0 && <p className="muted">No live GPS — field staff must check in on mobile.</p>}
        {withGps.map((e) => (
          <a
            key={e.userId || e.employeeId}
            className="live-team-map__pin"
            href={`https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=16/${e.lat}/${e.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <strong>{e.name || e.employeeId}</strong>
            <span>{e.totalKmToday?.toFixed?.(2) ?? e.totalKmToday ?? 0} km</span>
          </a>
        ))}
      </div>
    </div>
  );
}
