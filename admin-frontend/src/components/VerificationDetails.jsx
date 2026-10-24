import { useState } from "react";
import { mediaUrl } from "../utils/mediaUrl";
import RecordingPlayer from "./RecordingPlayer";
import StatusBadge from "./StatusBadge";
export const PHOTO_FIELDS = [
  ["customerPhoto", "Customer photo"],
  ["aadhaarFront", "Aadhaar front"],
  ["aadhaarBack", "Aadhaar back"],
  ["panFront", "PAN front"],
  ["shopPhoto1", "Shop photo 1"],
  ["shopPhoto2", "Shop photo 2"],
  ["shopPhoto3", "Shop photo 3"],
  ["shopPhoto4", "Shop photo 4"],
];
const safeMedia = (value) => {
  const url = mediaUrl(value);
  return typeof url === "string" && url.startsWith("/uploads/") ? url : null;
};
export const recordTime = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not recorded";
function Fields({ items }) {
  return (
    <dl className="record-fields">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "Not recorded"}</dd>
        </div>
      ))}
    </dl>
  );
}
function Photo({ photo, onEnlarge }) {
  const [failed, setFailed] = useState(false);
  const url = safeMedia(photo.media),
    meta = photo.media && typeof photo.media === "object" ? photo.media : {};
  return (
    <article className="customer-document">
      <h4>{photo.label}</h4>
      {!url ? (
        <div className="record-empty">
          {photo.media
            ? "Document unavailable for this account."
            : "Not uploaded in the available record."}
        </div>
      ) : /\.pdf(?:\?|$)/i.test(url) ? (
        <a href={url} target="_blank" rel="noreferrer">
          Open PDF document ↗
        </a>
      ) : failed ? (
        <div className="record-empty">
          Photo could not load. Refresh documents to renew access.
        </div>
      ) : (
        <button
          type="button"
          className="customer-photo-button"
          onClick={() => onEnlarge({ url, label: photo.label })}
        >
          <img
            src={url}
            alt={photo.label}
            loading="lazy"
            onError={() => setFailed(true)}
          />
          <span>Enlarge photo ↗</span>
        </button>
      )}
      {meta.capturedAt && <small>Captured {recordTime(meta.capturedAt)}</small>}
      {meta.latitude != null && meta.longitude != null && (
        <small>
          GPS: {meta.latitude}, {meta.longitude}
        </small>
      )}
      {meta.address && <small>{meta.address}</small>}
    </article>
  );
}
export default function VerificationDetails({
  data,
  isListing = false,
  calls = [],
  callsError = "",
  refresh,
  onPreviewChange,
}) {
  const [preview, setPreview] = useState(null);
  const v = isListing
    ? {
        ...data,
        listingId: data.id,
        submittedAt: data.createdAt,
        submittedBy: data.createdBy,
        shopAddress: data.shopFullAddress,
        latitude: data.shopLatitude,
        longitude: data.shopLongitude,
        photos: PHOTO_FIELDS.filter(([key]) => data[key]).map(
          ([key, label]) => ({ key, label, media: data[key] }),
        ),
      }
    : data.verification || {};
  const photos = Array.isArray(v.photos) ? v.photos : [],
    neighbors = Array.isArray(v.neighbors) ? v.neighbors : [];
  const documents = [
    ...PHOTO_FIELDS.map(
      ([key, label]) =>
        photos.find((p) => p.key === key) || { key, label, media: null },
    ),
    ...photos.filter((p) => !PHOTO_FIELDS.some(([key]) => key === p.key)),
  ];
  const lat = Number(v.latitude),
    lng = Number(v.longitude),
    gps =
      v.latitude != null &&
      v.longitude != null &&
      v.latitude !== "" &&
      v.longitude !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      (lat !== 0 || lng !== 0);
  const changePreview = (value) => {
    setPreview(value);
    onPreviewChange?.(Boolean(value));
  };
  if (preview)
    return (
      <section className="record-preview">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => changePreview(null)}
        >
          ← All documents
        </button>
        <h3>{preview.label}</h3>
        <img
          className="customer-photo-large"
          src={preview.url}
          alt={preview.label}
        />
        <a href={preview.url} target="_blank" rel="noreferrer">
          Open original ↗
        </a>
      </section>
    );
  return (
    <div className="record-details">
      <div className="record-summary">
        <span>
          <small>Application status</small>
          <StatusBadge
            status={
              isListing
                ? data.status
                : v.status === "listed"
                  ? "listed"
                  : "Not linked"
            }
          />
        </span>
        <span>
          <small>Documents saved</small>
          <strong>{photos.length}</strong>
        </span>
        <span>
          <small>Neighbor verifications</small>
          <strong>{neighbors.length}</strong>
        </span>
        <span>
          <small>Branch</small>
          <strong>{data.branch || "Not recorded"}</strong>
        </span>
      </div>
      <section className="record-section">
        <div className="record-section-title">
          <span>01</span>
          <div>
            <h3>Customer profile</h3>
            <p>Contact and identity information</p>
          </div>
        </div>
        <Fields
          items={[
            [isListing ? "Application ID" : "Customer ID", data.id],
            ["Full name", data.name],
            [
              "Mobile",
              data.mobile ? (
                <a href={`tel:${data.mobile}`}>{data.mobile}</a>
              ) : null,
            ],
            ["Branch", data.branch],
            ["Address", data.address || v.shopAddress],
            ["Aadhaar", data.aadhaar],
            ["PAN", data.pan],
            ["Customer since", recordTime(data.createdAt)],
          ]}
        />
      </section>
      <section className="record-section">
        <div className="record-section-title">
          <span>02</span>
          <div>
            <h3>Shop & location</h3>
            <p>Saved field visit address and coordinates</p>
          </div>
        </div>
        <Fields
          items={[
            ["Shop address", v.shopAddress],
            ["Saved GPS", gps ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null],
          ]}
        />
        {gps ? (
          <>
            <iframe
              loading="lazy"
              title="Shop map"
              className="record-map"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`}
            />
            <div className="record-actions">
              <a
                className="btn btn-outline btn-sm"
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
              >
                View on map ↗
              </a>
              <a
                className="btn btn-outline btn-sm"
                href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Get directions ↗
              </a>
            </div>
          </>
        ) : (
          <p className="record-empty">No saved GPS location in this record.</p>
        )}
      </section>
      <section className="record-section">
        <div className="record-section-title">
          <span>03</span>
          <div>
            <h3>Photos & documents ({photos.length})</h3>
            <p>Identity documents and shop verification photos</p>
          </div>
          {refresh && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={refresh}
            >
              Refresh documents
            </button>
          )}
        </div>
        {!photos.length && (
          <p className="record-empty">
            No photos or documents are present in the available customer or
            linked application records. Missing files cannot be displayed until
            uploaded.
          </p>
        )}
        <div className="customer-documents">
          {documents.map((photo) => (
            <Photo
              key={`${photo.key}-${safeMedia(photo.media)}`}
              photo={photo}
              onEnlarge={changePreview}
            />
          ))}
        </div>
      </section>
      <section className="record-section">
        <div className="record-section-title">
          <span>04</span>
          <div>
            <h3>Neighbor shop verification</h3>
            <p>Visit notes and saved voice recordings</p>
          </div>
        </div>
        <div className="record-neighbors">
          {neighbors.length ? (
            neighbors.map((n, i) => (
              <article className="customer-document" key={i}>
                <small>NEIGHBOR {i + 1}</small>
                <h4>{n.shopName || "Name not recorded"}</h4>
                <p>{n.remarks || "No remarks recorded"}</p>
                {safeMedia(n.voiceRecordingPath) ? (
                  <RecordingPlayer
                    url={safeMedia(n.voiceRecordingPath)}
                    compact
                  />
                ) : (
                  <small>No voice note saved</small>
                )}
              </article>
            ))
          ) : (
            <p className="record-empty">
              No neighbor verification was recorded.
            </p>
          )}
        </div>
      </section>
      <section className="record-section">
        <div className="record-section-title">
          <span>05</span>
          <div>
            <h3>Application & assignment</h3>
            <p>Available submission, assignment and approval records</p>
          </div>
        </div>
        <Fields
          items={[
            ["Application ID", v.listingId],
            ["Submitted", recordTime(v.submittedAt)],
            ["Submitted by", v.submittedBy],
            ["Submitter role", v.submittedByRole],
            ["Assigned employee", v.assignedToName],
            ["Employee ID", v.assignedToEmployeeId],
            ["Assigned", recordTime(v.assignedAt)],
            ["Approved / listed", recordTime(v.listedAt)],
            [
              "Review remarks",
              v.rejectionReason || v.reviewRemarks || v.remarks,
            ],
          ]}
        />
      </section>
      {isListing && (
        <section className="record-section">
          <div className="record-section-title">
            <span>06</span>
            <div>
              <h3>Call history ({calls.length})</h3>
              <p>Calls recorded for this mobile number</p>
            </div>
          </div>
          {callsError ? (
            <p role="alert" className="error-msg">
              {callsError}
            </p>
          ) : !calls.length ? (
            <p className="record-empty">No calls saved for this mobile yet.</p>
          ) : (
            calls.map((call) => (
              <article className="customer-document" key={call.id}>
                <strong>{call.customerName || data.name}</strong>
                <p>
                  {recordTime(call.date || call.createdAt)} ·{" "}
                  {call.duration || `${call.durationSeconds || 0}s`} ·{" "}
                  {call.callStatus || call.type || "Not recorded"}
                </p>
                <p>{call.callSummary || "No summary recorded"}</p>
                {call.recordingUrl && (
                  <RecordingPlayer url={call.recordingUrl} compact />
                )}
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
