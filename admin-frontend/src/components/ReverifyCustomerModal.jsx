import { displayLocation } from '../utils/displayLabels';

const PRESET_REASONS = [
  'Periodic verification',
  'Fresh shop photos and GPS required',
  'Document or identity review',
  'Branch compliance review',
];

export default function ReverifyCustomerModal({
  customer,
  reason,
  onReasonChange,
  busy,
  error,
  onConfirm,
  onClose,
}) {
  if (!customer) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 500;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="card modal-card reverify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reverify-title"
      >
        <p className="section-kicker" style={{ marginBottom: 8 }}>
          Customer re-verification
        </p>
        <h3 id="reverify-title" style={{ marginTop: 0 }}>
          Send for fresh verification
        </h3>
        <p className="field-hint" style={{ marginTop: 0, lineHeight: 1.6 }}>
          <strong>{customer.name}</strong> · {customer.mobile} ·{' '}
          {displayLocation(customer.branch)}
        </p>

        <ol className="reverify-modal__steps">
          <li>Existing customer record, loan history and previous proofs stay on file.</li>
          <li>A new <strong>draft</strong> appears under Customer Listing for this mobile and branch.</li>
          <li>Field staff must submit fresh shop photos, GPS and neighbor verification.</li>
          <li>Branch and admin approval apply as for a normal listing — drafts cannot be approved without fresh submission.</li>
        </ol>

        <div className="form-group">
          <label htmlFor="reverify-reason">Reason for re-verification</label>
          <div className="reverify-modal__chips">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`reverify-modal__chip${reason === preset ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => onReasonChange(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            id="reverify-reason"
            rows={3}
            maxLength={500}
            placeholder="Describe why fresh verification is needed (required, 3–500 characters)…"
            value={reason}
            disabled={busy}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          <span className="field-hint">
            {trimmed.length}/500 · shown on the listing audit trail
          </span>
        </div>

        {error ? (
          <p role="alert" className="error-msg">
            {error}
          </p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !valid}
            onClick={onConfirm}
          >
            {busy ? 'Creating draft…' : 'Send to Customer Listing'}
          </button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
