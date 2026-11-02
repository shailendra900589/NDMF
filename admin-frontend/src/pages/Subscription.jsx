import { useEffect, useState } from 'react';
import { packageApi } from '../api/api';
import { useSession } from '../auth/Session';
import PageHeader from '../components/PageHeader';
import './Subscription.css';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Subscription() {
  const { user } = useSession();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => packageApi.subscription()
    .then((r) => setData(r.data))
    .catch((e) => setError(e.message || 'Unable to load subscription'));

  useEffect(() => { load(); }, []);

  const request = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await packageApi.requestRenewal();
      setMessage(r.message);
      await load();
    } catch (e) {
      setError(e.message || 'Unable to request renewal');
    } finally {
      setBusy(false);
    }
  };

  const subscription = data?.subscription;
  const renewal = data?.renewalRequest;
  const stopped = subscription && !subscription.isActive && subscription.status !== 'not_assigned';

  return (
    <div className="subscription-page">
      <PageHeader
        title="Plan & billing"
        description="Selected package, service period and renewal for this company workspace."
      />
      {!data ? (
        <section className="card">{error || 'Loading subscription…'}</section>
      ) : (
        <>
          <section className={`subscription-hero card subscription-hero--${subscription.status}`}>
            <div>
              <span className="subscription-kicker">SELECTED PLAN</span>
              <h2>{subscription.name || 'No package assigned'}</h2>
              <p>
                {subscription.status === 'not_assigned'
                  ? 'The Super Administrator has not assigned a SaaS package yet.'
                  : subscription.isActive
                    ? `Service is active until ${dateLabel(subscription.endsOn)}. Operational modules follow this package.`
                    : 'Service is stopped. Renew from this page so attendance, tracking and other modules can resume.'}
              </p>
            </div>
            <span className="subscription-status">{(subscription.label || subscription.status || '').replace('_', ' ')}</span>
          </section>

          <section className="subscription-grid">
            <article className="card">
              <span>Package details</span>
              <h2>{subscription.name || '—'}</h2>
              <dl>
                <div><dt>Service begins</dt><dd>{dateLabel(subscription.startsOn)}</dd></div>
                <div><dt>Plan expiry date</dt><dd>{dateLabel(subscription.endsOn)}</dd></div>
                <div><dt>Payment</dt><dd>{subscription.paymentStatus || '—'}</dd></div>
                <div><dt>Days remaining</dt><dd>{subscription.daysRemaining ?? 0}</dd></div>
              </dl>
            </article>
            <article className="card">
              <span>Current period estimate</span>
              <h2>{data.quote ? money(data.quote.periodTotal) : '—'}</h2>
              <p>
                {data.quote
                  ? `${data.quote.employees} billable employees · ${data.quote.billingMonths}-month service period`
                  : 'Assign a package from Super Admin → Packages & pricing.'}
              </p>
              {data.quote && (
                <p className="subscription-muted">
                  Includes {data.quote.includedEmployees} users; {data.quote.additionalEmployees} extra at {money(data.quote.extraEmployeeMonthlyPrice)}/month.
                </p>
              )}
            </article>
          </section>

          <section className={`card subscription-renew${stopped ? ' subscription-renew--urgent' : ''}`}>
            <div>
              <span className="subscription-kicker">RENEWAL</span>
              <h2>{stopped ? 'Restart your workspace' : 'Keep your workspace active'}</h2>
              <p>
                {isAdmin
                  ? 'Request renewal here. Online checkout (Razorpay) will appear on this page once payment credentials are configured.'
                  : 'Only a company administrator can submit a renewal request from this panel. Ask your admin to renew the selected plan.'}
              </p>
              {renewal && ['requested', 'contacted'].includes(renewal.status) && (
                <p className="subscription-muted">
                  Renewal request is already with the platform team ({renewal.status}) · plan expires {dateLabel(renewal.expiresOn)}.
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={request}
                disabled={busy || !subscription.packageId || (renewal && ['requested', 'contacted'].includes(renewal.status))}
              >
                {busy ? 'Sending…' : renewal && ['requested', 'contacted'].includes(renewal.status) ? 'Renewal requested' : 'Request renewal'}
              </button>
            )}
          </section>

          {(message || error) && (
            <p className={error ? 'subscription-error' : 'subscription-message'} role="status">{error || message}</p>
          )}
        </>
      )}
    </div>
  );
}
