const { DEFAULT_COMPANY_ID } = require('./tenantContext');
function ownsUpload(filename, companyId) {
  if (!companyId) return false;
  if (filename.startsWith(`${companyId}_`)) return true;
  // Files created before the company migration belong to Nirmaldhara only.
  return companyId === DEFAULT_COMPANY_ID && /^[0-9a-f]{8}-[0-9a-f-]{27,}\.[a-z0-9]+$/i.test(filename);
}
module.exports = { ownsUpload };
