const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
const DEFAULT_COMPANY_ID = 'CO_NDFA';
const GLOBAL_COLLECTIONS = new Set(['companies', 'platformAudit', 'apiApplications', 'apiGrants']);
module.exports = { context, DEFAULT_COMPANY_ID, GLOBAL_COLLECTIONS };
