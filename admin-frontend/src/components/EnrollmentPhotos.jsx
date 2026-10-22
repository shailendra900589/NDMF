import { useEffect, useRef, useState } from 'react';
import { attendanceApi } from '../api/api';
import { mediaUrl } from '../utils/mediaUrl';

export default function EnrollmentPhotos({ userId, name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    let active = true;
    setData(null); setError(''); setPreview(null);
    attendanceApi.getEnrollment(userId).then(res => active && setData(res.data))
      .catch(e => active && setError(e.message || 'Unable to load registration photos'));
    return () => { active = false; };
  }, [userId, attempt]);
  useEffect(() => {
    if (preview && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [preview]);
  const photos = (data?.photos || []).map(mediaUrl).filter(Boolean);
  return <section className="card enrollment-card" aria-label="Attendance registration photos">
    <div className="section-heading"><div><span className="section-kicker">IDENTITY REGISTRATION</span>
      <h3>Registered face photos</h3><p>Reference photos registered by {name} for attendance verification.</p></div>
      {data && <span className={`enrollment-badge ${data.complete ? 'is-complete' : ''}`}>{data.complete ? 'Registered' : 'Registration incomplete'}</span>}
    </div>
    {error ? <div role="alert"><p>{error}</p><button className="btn btn-outline btn-sm" onClick={() => setAttempt(n => n + 1)}>Retry</button></div> : !data ? <p role="status">Loading registration photos…</p> : <>
      {photos.length ? <div className="enrollment-gallery">{photos.map((url, i) => <figure key={`${userId}-${url}`}>
        <button type="button" aria-label={`Enlarge registration photo ${i + 1} for ${name}`} onClick={() => setPreview(url)}>
          <img src={url} alt={`${name} · registration photo ${i + 1}`} loading="lazy" onError={e => { e.currentTarget.hidden = true; e.currentTarget.parentElement.querySelector('span').hidden = false; }} />
          <span hidden>Photo unavailable. Refresh to renew access.</span>
        </button><figcaption>Reference {i + 1}</figcaption></figure>)}</div> : <p className="muted">No registration photos are available for this employee.</p>}
      <small>{data.enrolledAt ? `Registered ${new Date(data.enrolledAt).toLocaleString('en-IN')}. ` : ''}These are enrollment references; live check-in photos are separate.</small>
    </>}
    {preview && <dialog ref={dialog} className="enrollment-preview" onClose={() => setPreview(null)}>
      <button autoFocus className="btn btn-outline" onClick={() => dialog.current.close()}>Close preview</button>
      <img src={preview} alt={`${name} · enlarged attendance registration`} />
    </dialog>}
  </section>;
}
