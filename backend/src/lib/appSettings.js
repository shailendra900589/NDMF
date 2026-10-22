const { getCollection, upsert } = require('./db');

const { context, DEFAULT_COMPANY_ID } = require('./tenantContext');
const settingsId = () => `settings_${context.getStore()?.companyId || DEFAULT_COMPANY_ID}`;

function readDoc() {
  const coll = getCollection('appSettings');
  return coll.find((s) => s.id === settingsId()) || null;
}

function getAppSettings() {
  const doc = readDoc();
  return {
    faceAttendanceRequired: doc?.faceAttendanceRequired !== false,
    updatedAt: doc?.updatedAt || null,
  };
}

function settingsForClient() {
  return { faceAttendanceRequired: getAppSettings().faceAttendanceRequired };
}

function setFaceAttendanceRequired(required) {
  const doc = {
    id: settingsId(),
    faceAttendanceRequired: !!required,
    updatedAt: new Date().toISOString(),
  };
  upsert('appSettings', doc);
  return getAppSettings();
}

module.exports = {
  getAppSettings,
  settingsForClient,
  setFaceAttendanceRequired,
};
