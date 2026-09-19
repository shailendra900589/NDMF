const { v4: uuid } = require('uuid');
const cashfree = require('../../services/cashfreeDigilocker.service');
const { success, error } = require('../../lib/response');
const { kycRedirectUrl } = require('../../config/env');
const {
  normalizeSubjectType,
  resolveSubject,
  buildVerificationId,
  findSessionByVerificationId,
  findLatestSession,
  saveSession,
  applyKycToSubject,
} = require('./digilocker.helpers');

const DEFAULT_DOCS = ['AADHAAR', 'PAN'];

function sessionResponse(session) {
  return {
    sessionId: session.id,
    subjectType: session.subjectType,
    subjectId: session.subjectId,
    verification_id: session.verification_id,
    reference_id: session.reference_id,
    status: session.status,
    url: session.url,
    document_requested: session.document_requested,
    documents: session.documents || {},
    cashfree: session.lastCashfreeStatus || null,
  };
}

/** POST — Step 1: Verify DigiLocker account (mobile / aadhaar) */
exports.verifyAccount = async (req, res) => {
  try {
    const subjectType = normalizeSubjectType(req.body.subjectType);
    const { subjectId, mobile_number, aadhaar_number, verification_id } = req.body;
    if (!subjectType || !subjectId) {
      return error(res, 'subjectType (user|vendor) and subjectId required');
    }
    if (!resolveSubject(subjectType, subjectId).entity) {
      return error(res, `${subjectType} not found`, 404);
    }

    const verificationId = verification_id || buildVerificationId(subjectType, subjectId);
    const cf = await cashfree.verifyAccount({
      verification_id: verificationId,
      mobile_number,
      aadhaar_number,
    });

    const session = saveSession({
      id: `DGL_${uuid().slice(0, 8)}`,
      subjectType,
      subjectId,
      verification_id: cf.verification_id || verificationId,
      reference_id: cf.reference_id ?? null,
      status: cf.status || 'VERIFY_ACCOUNT',
      document_requested: DEFAULT_DOCS,
      documents: {},
      verifyAccountResponse: cf,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return success(res, { ...sessionResponse(session), cashfree: cf });
  } catch (e) {
    return error(res, e.message, e.statusCode || 502);
  }
};

/** POST — Step 2: Create DigiLocker URL (User KYC or Vendor KYC by subjectId) */
exports.createUrl = async (req, res) => {
  try {
    const subjectType = normalizeSubjectType(req.body.subjectType);
    const { subjectId, document_requested, redirect_url, user_flow, mobile_number } = req.body;
    if (!subjectType || !subjectId) {
      return error(res, 'subjectType (user|vendor) and subjectId required');
    }
    const { entity } = resolveSubject(subjectType, subjectId);
    if (!entity) return error(res, `${subjectType} not found`, 404);

    const docs = document_requested?.length ? document_requested : DEFAULT_DOCS;
    const verificationId = buildVerificationId(subjectType, subjectId);
    const redirect = redirect_url || kycRedirectUrl;

    let verifyResult = null;
    if (mobile_number || entity.mobile) {
      try {
        verifyResult = await cashfree.verifyAccount({
          verification_id: verificationId,
          mobile_number: mobile_number || entity.mobile,
        });
      } catch {
        /* optional pre-check */
      }
    }

    const cf = await cashfree.createUrl({
      verification_id: verificationId,
      document_requested: docs,
      redirect_url: redirect,
      user_flow: user_flow || 'signup',
    });

    const session = saveSession({
      id: `DGL_${uuid().slice(0, 8)}`,
      subjectType,
      subjectId,
      verification_id: cf.verification_id || verificationId,
      reference_id: cf.reference_id ?? verifyResult?.reference_id ?? null,
      status: cf.status || 'PENDING',
      url: cf.url,
      document_requested: cf.document_requested || docs,
      redirect_url: redirect,
      documents: {},
      createUrlResponse: cf,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    applyKycToSubject(subjectType, subjectId, {
      kycStatus: 'pending',
      verification_id: session.verification_id,
      reference_id: session.reference_id,
    });

    return success(res, sessionResponse(session), 'DigiLocker URL created', 201);
  } catch (e) {
    return error(res, e.message, e.statusCode || 502);
  }
};

/** GET — Step 3: Verification status */
exports.getStatus = async (req, res) => {
  try {
    const subjectType = normalizeSubjectType(req.query.subjectType);
    const { subjectId, verification_id, reference_id } = req.query;

    let session = null;
    if (verification_id) session = findSessionByVerificationId(verification_id);
    else if (subjectType && subjectId) session = findLatestSession(subjectType, subjectId);

    const vId = verification_id || session?.verification_id;
    const rId = reference_id || session?.reference_id;
    if (!vId && rId == null) {
      return error(res, 'verification_id or subjectType+subjectId required');
    }

    const cf = await cashfree.getVerificationStatus({
      verification_id: vId,
      reference_id: rId,
    });

    if (session) {
      session.status = cf.status || session.status;
      session.lastCashfreeStatus = cf;
      session.reference_id = cf.reference_id ?? session.reference_id;
      saveSession(session);
      applyKycToSubject(session.subjectType, session.subjectId, {
        kycStatus: cf.status === 'SUCCESS' ? 'verified' : 'pending',
        lastStatus: cf.status,
        verification_id: session.verification_id,
        reference_id: session.reference_id,
      });
    }

    return success(res, {
      session: session ? sessionResponse(session) : null,
      cashfree: cf,
    });
  } catch (e) {
    return error(res, e.message, e.statusCode || 502);
  }
};

/** GET — Step 4: Fetch document (AADHAAR | PAN | DRIVING_LICENSE) */
exports.getDocument = async (req, res) => {
  try {
    const documentType = req.params.documentType?.toUpperCase();
    const { verification_id, reference_id, subjectType, subjectId } = req.query;

    let session = verification_id ? findSessionByVerificationId(verification_id) : null;
    if (!session && subjectType && subjectId) {
      session = findLatestSession(normalizeSubjectType(subjectType), subjectId);
    }

    const vId = verification_id || session?.verification_id;
    const rId = reference_id || session?.reference_id;
    if (!documentType || (!vId && rId == null)) {
      return error(res, 'documentType and verification_id/reference_id required');
    }

    const doc = await cashfree.getDocument(documentType, {
      verification_id: vId,
      reference_id: rId,
    });

    if (session) {
      session.documents = session.documents || {};
      session.documents[documentType] = doc;
      session.status = doc.status || session.status;
      saveSession(session);

      if (doc.status === 'SUCCESS') {
        applyKycToSubject(session.subjectType, session.subjectId, {
          kycStatus: 'verified',
          verification_id: session.verification_id,
          reference_id: session.reference_id,
          documents: session.documents,
          verifiedDocument: documentType,
          name: doc.name,
          dob: doc.dob,
          uid: doc.uid,
        });
      }
    }

    return success(res, {
      documentType,
      session: session ? sessionResponse(session) : null,
      document: doc,
    });
  } catch (e) {
    return error(res, e.message, e.statusCode || 502);
  }
};

/** Sync session from Cashfree (status + documents) */
async function syncSessionComplete(session) {
  const cf = await cashfree.getVerificationStatus({
    verification_id: session.verification_id,
    reference_id: session.reference_id,
  });
  session.status = cf.status || session.status;
  session.lastCashfreeStatus = cf;
  session.reference_id = cf.reference_id ?? session.reference_id;

  const docs = session.document_requested || DEFAULT_DOCS;
  session.documents = session.documents || {};

  for (const docType of docs) {
    try {
      const doc = await cashfree.getDocument(docType, {
        verification_id: session.verification_id,
        reference_id: session.reference_id,
      });
      session.documents[docType] = doc;
    } catch (docErr) {
      session.documents[docType] = { status: 'FAILED', message: docErr.message };
    }
  }

  const allSuccess = docs.every((d) => session.documents[d]?.status === 'SUCCESS');
  if (allSuccess) session.status = 'SUCCESS';
  saveSession(session);

  applyKycToSubject(session.subjectType, session.subjectId, {
    kycStatus: allSuccess ? 'verified' : cf.status === 'SUCCESS' ? 'partial' : 'pending',
    verification_id: session.verification_id,
    reference_id: session.reference_id,
    documents: session.documents,
    lastStatus: session.status,
  });

  return session;
}

/** POST — Poll status + download all requested documents */
exports.complete = async (req, res) => {
  try {
    const subjectType = normalizeSubjectType(req.body.subjectType);
    const { subjectId, verification_id } = req.body;
    if (!subjectType || !subjectId) {
      return error(res, 'subjectType and subjectId required');
    }

    let session = verification_id
      ? findSessionByVerificationId(verification_id)
      : findLatestSession(subjectType, subjectId);
    if (!session) return error(res, 'No DigiLocker session found. Call create-url first.', 404);

    session = await syncSessionComplete(session);
    return success(res, sessionResponse(session));
  } catch (e) {
    return error(res, e.message, e.statusCode || 502);
  }
};

/** GET — Stored KYC for user or vendor */
exports.getSubjectKyc = (req, res) => {
  const subjectType = normalizeSubjectType(req.params.subjectType);
  const { subjectId } = req.params;
  if (!subjectType) return error(res, 'subjectType must be user or vendor');

  const { entity } = resolveSubject(subjectType, subjectId);
  if (!entity) return error(res, `${subjectType} not found`, 404);

  const session = findLatestSession(subjectType, subjectId);
  return success(res, {
    subjectType,
    subjectId,
    kycStatus: entity.kycStatus || 'not_started',
    digilockerKyc: entity.digilockerKyc || null,
    latestSession: session ? sessionResponse(session) : null,
  });
};

/** GET — Redirect callback after DigiLocker (browser) */
exports.callback = async (req, res) => {
  const { verification_id } = req.query;
  try {
    if (verification_id) {
      const session = findSessionByVerificationId(verification_id);
      if (session) await syncSessionComplete(session);
    }
  } catch {
    /* still show landing page */
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
    <h2>KYC Complete</h2>
    <p>You can close this page and return to the NDFA app.</p>
    <p style="color:#666;font-size:14px">verification_id: ${verification_id || '-'}</p>
  </body></html>`);
};
