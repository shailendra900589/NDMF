/**
 * Cashfree Secure ID — DigiLocker API client
 * Docs: https://docs.cashfree.com/docs/digilocker
 * Replaces legacy PAN360-style KYC with official DigiLocker flow.
 */
const {
  cashfreeClientId,
  cashfreeClientSecret,
  cashfreeVerificationBaseUrl,
} = require('../config/env');

function headers() {
  if (!cashfreeClientId || !cashfreeClientSecret) {
    const err = new Error('Cashfree credentials missing. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in .env');
    err.statusCode = 503;
    throw err;
  }
  return {
    'Content-Type': 'application/json',
    'x-client-id': cashfreeClientId,
    'x-client-secret': cashfreeClientSecret,
  };
}

async function parseResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Cashfree HTTP ${res.status}`);
    err.statusCode = res.status;
    err.cashfree = data;
    throw err;
  }
  return data;
}

async function verifyAccount({ verification_id, mobile_number, aadhaar_number }) {
  const body = { verification_id };
  if (mobile_number) body.mobile_number = mobile_number;
  if (aadhaar_number) body.aadhaar_number = aadhaar_number;

  const res = await fetch(`${cashfreeVerificationBaseUrl}/digilocker/verify-account`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseResponse(res);
}

async function createUrl({ verification_id, document_requested, redirect_url, user_flow }) {
  const res = await fetch(`${cashfreeVerificationBaseUrl}/digilocker`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      verification_id,
      document_requested,
      redirect_url,
      user_flow: user_flow || 'signup',
    }),
  });
  return parseResponse(res);
}

async function getVerificationStatus({ verification_id, reference_id }) {
  const params = new URLSearchParams();
  if (verification_id) params.set('verification_id', verification_id);
  if (reference_id != null) params.set('reference_id', String(reference_id));
  const qs = params.toString();
  const url = `${cashfreeVerificationBaseUrl}/digilocker${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { method: 'GET', headers: headers() });
  return parseResponse(res);
}

async function getDocument(documentType, { verification_id, reference_id }) {
  const params = new URLSearchParams();
  if (verification_id) params.set('verification_id', verification_id);
  if (reference_id != null) params.set('reference_id', String(reference_id));
  const qs = params.toString();
  const type = encodeURIComponent(documentType);
  const url = `${cashfreeVerificationBaseUrl}/digilocker/document/${type}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { method: 'GET', headers: headers() });
  return parseResponse(res);
}

module.exports = {
  verifyAccount,
  createUrl,
  getVerificationStatus,
  getDocument,
};
