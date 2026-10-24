import {useEffect,useRef,useState} from 'react';
import {customersApi} from '../api/api';
import {mediaUrl} from '../utils/mediaUrl';
import RecordingPlayer from './RecordingPlayer';
function safeMedia(value){const url=mediaUrl(value);return typeof url==='string' && url.startsWith('/uploads/') ? url : null;}
const time=value=>value ? new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) : 'Not recorded';
function Photo({photo,onEnlarge}){
 const [failed,setFailed]=useState(false);const url=safeMedia(photo.media);
 const meta=photo.media && typeof photo.media==='object'?photo.media:{};
 return <article className="customer-document"><h4>{photo.label}</h4>{!url ? <p>Document unavailable for this account.</p> : /\.pdf(?:\?|$)/i.test(url) ? <a href={url} target="_blank" rel="noreferrer">Open PDF document ↗</a> : failed ? <p>Photo could not load. Refresh documents to renew access.</p> : <button type="button" className="customer-photo-button" onClick={()=>onEnlarge({url,label:photo.label})}><img src={url} alt={photo.label} loading="lazy" onError={()=>setFailed(true)}/><span>Enlarge photo</span></button>}
 {meta.capturedAt && <small>Captured {time(meta.capturedAt)}</small>}{meta.latitude!=null && meta.longitude!=null && <small>GPS: {meta.latitude}, {meta.longitude}</small>}</article>;
}
export default function CustomerDetails({customerId,onClose}){
 const dialog=useRef(null);const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[preview,setPreview]=useState(null);
 useEffect(()=>{const node=dialog.current;node?.showModal?.();return()=>node?.close?.();},[]);
 useEffect(()=>{let active=true;setData(null);setError('');setPreview(null);customersApi.getById(customerId).then(r=>{if(active)setData(r.data);}).catch(e=>{if(active)setError(e.response?.data?.message || e.message || 'Unable to load customer details');});return()=>{active=false;};},[customerId,attempt]);
 const verification=data?.verification;const photos=verification?.photos || [];
 return <dialog ref={dialog} className="customer-detail-dialog" aria-labelledby="customer-detail-title" onCancel={e=>{e.preventDefault();onClose();}}>
 <div className="customer-detail-head"><h2 id="customer-detail-title">{data?.name || 'Customer details'}</h2><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close details</button></div>
 {error ? <div role="alert"><p className="error-msg">{error}</p><button className="btn btn-outline" onClick={()=>setAttempt(a=>a+1)}>Retry</button></div> : !data ? <p role="status">Loading customer and verification records…</p> : preview ? <section><button className="btn btn-outline" onClick={()=>setPreview(null)}>← All documents</button><h3>{preview.label}</h3><img className="customer-photo-large" src={preview.url} alt={preview.label}/><a href={preview.url} target="_blank" rel="noreferrer">Open original ↗</a></section> : <>
 <dl className="customer-detail-fields">{[['Mobile',data.mobile],['Branch',data.branch],['Address',data.address],['Aadhaar',data.aadhaar],['PAN',data.pan],['Customer since',time(data.createdAt)],['Application status',verification?.status==='listed'?'Approved / listed':'No linked approved application'],['Submitted',time(verification?.submittedAt)],['Approved',time(verification?.listedAt)],['Submitted by',verification?.submittedBy],['Assigned employee',verification?.assignedToName]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
 <section><h3>Shop verification</h3><p>{verification?.shopAddress || 'No shop address recorded'}</p>{Number.isFinite(Number(verification?.latitude)) && Number.isFinite(Number(verification?.longitude)) && Number(verification?.latitude)!==0 && <p>Saved GPS: {verification.latitude}, {verification.longitude} · <a href={`https://www.google.com/maps/search/?api=1&query=${Number(verification.latitude)},${Number(verification.longitude)}`} target="_blank" rel="noreferrer">View on map ↗</a></p>}</section>
 <section><div className="customer-detail-head"><h3>Photos & documents ({photos.length})</h3><button className="btn btn-outline btn-sm" onClick={()=>setAttempt(a=>a+1)}>Refresh documents</button></div>{photos.length ? <div className="customer-documents">{photos.map(photo=><Photo key={`${photo.key}-${attempt}`} photo={photo} onEnlarge={setPreview}/>)}</div> : <p>No photos or documents were saved for this customer.</p>}</section>
 <section><h3>Neighbor shop verification</h3>{verification?.neighbors?.length ? verification.neighbors.map((neighbor,index)=><article className="customer-document" key={index}><h4>{neighbor.shopName || `Neighbor ${index+1}`}</h4><p>{neighbor.remarks || 'No remarks recorded'}</p>{neighbor.voiceRecordingPath && safeMedia(neighbor.voiceRecordingPath) && <RecordingPlayer url={safeMedia(neighbor.voiceRecordingPath)} compact/>}</article>) : <p>No neighbor verification was recorded.</p>}</section>
 </>}
 </dialog>;
}
