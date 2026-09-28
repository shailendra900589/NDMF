const { getCollection, upsert } = require('./db');

const SETTINGS_ID = 'global';

function readDoc() {
  const coll = getCollection('appSettings');
  return coll.find((s) => s.id === SETTINGS_ID) || null;
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
    id: SETTINGS_ID,
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
