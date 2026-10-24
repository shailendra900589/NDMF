import { useEffect, useRef, useState } from "react";
import { customersApi } from "../api/api";
import VerificationDetails from "./VerificationDetails";
export default function CustomerDetails({ customerId, onClose }) {
  const dialog = useRef(null),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal?.();
    if (typeof document === "undefined") return () => node?.close?.();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close?.();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    customersApi
      .getById(customerId)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message ||
              e.message ||
              "Unable to load customer details",
          );
      });
    return () => {
      active = false;
    };
  }, [customerId, attempt]);
  return (
    <dialog
      ref={dialog}
      className="customer-detail-dialog"
      aria-labelledby="customer-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="customer-detail-shell">
        <header className="customer-detail-head">
          <div>
            <p className="section-kicker">CUSTOMER RECORD</p>
            <h2 id="customer-detail-title">
              {data?.name || "Customer details"}
            </h2>
            <p className="record-subtitle">
              Profile, documents and field verification
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            autoFocus
            onClick={onClose}
          >
            Close details
          </button>
        </header>
        <div className="customer-detail-body">
          {error ? (
            <div role="alert">
              <p className="error-msg">{error}</p>
              <button
                className="btn btn-outline"
                onClick={() => setAttempt((a) => a + 1)}
              >
                Retry
              </button>
            </div>
          ) : !data ? (
            <p role="status">Loading customer and verification records…</p>
          ) : (
            <VerificationDetails
              key={`${customerId}-${attempt}`}
              data={data}
              refresh={() => setAttempt((a) => a + 1)}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}
