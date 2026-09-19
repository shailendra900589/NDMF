const { v4: uuid } = require('uuid');
const { findById, upsert, getCollection } = require('../../lib/db');

const SUBJECT_TYPES = ['user', 'vendor'];

function normalizeSubjectType(type) {
  const t = String(type || '').toLowerCase();
  if (!SUBJECT_TYPES.includes(t)) return null;
  return t;
}

function subjectCollection(subjectType) {
  return subjectType === 'vendor' ? 'vendors' : 'users';
}

function resolveSubject(subjectType, subjectId) {
  const collection = subjectCollection(subjectType);
  const entity = findById(collection, subjectId);
  if (!entity) return { error: `${subjectType} not found: ${subjectId}`, collection, entity: null };
  return { collection, entity };
}

function buildVerificationId(subjectType, subjectId) {
  const short = uuid().slice(0, 8);
  return `NDFA_${subjectType}_${subjectId}_${short}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50);
}

function findSessionByVerificationId(verificationId) {
  return getCollection('digilockerSessions').find((s) => s.verification_id === verificationId) || null;
}

function findLatestSession(subjectType, subjectId) {
  return getCollection('digilockerSessions')
    .filter((s) => s.subjectType === subjectType && s.subjectId === subjectId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
}

function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  upsert('digilockerSessions', session);
  return session;
}

function applyKycToSubject(subjectType, subjectId, patch) {
  const { collection, entity, error } = resolveSubject(subjectType, subjectId);
  if (error) return null;

  entity.kycStatus = patch.kycStatus ?? entity.kycStatus ?? 'pending';
  entity.digilockerKyc = {
    ...(entity.digilockerKyc || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  upsert(collection, entity);
  return entity;
}

module.exports = {
  SUBJECT_TYPES,
  normalizeSubjectType,
  subjectCollection,
  resolveSubject,
  buildVerificationId,
  findSessionByVerificationId,
  findLatestSession,
  saveSession,
  applyKycToSubject,
};
