/**
 * SEED DATA — v2.1 (RBAC + branches, no collections)
 */
const bcrypt = require('bcryptjs');
const { writeDb } = require('../lib/db');
const { ROLE_DEFAULTS } = require('../lib/rbac');

const DEMO_PASSWORD = 'ndfa1234';
const password = bcrypt.hashSync(DEMO_PASSWORD, 10);

const delhi = 'Delhi Main Branch';
const mumbai = 'Mumbai Branch';

const seedData = {
  branches: [
    {
      id: 'BR_DELHI',
      name: delhi,
      code: 'DELHI',
      city: 'New Delhi',
      state: 'Delhi',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'BR_MUM',
      name: mumbai,
      code: 'MUMBAI',
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  users: [
    {
      id: 'U_ADM001',
      name: 'Admin User',
      mobile: '9000000001',
      employeeId: 'ADM001',
      branch: null,
      role: 'admin',
      password,
      permissions: ROLE_DEFAULTS.admin,
      isActive: true,
    },
    {
      id: 'U_BM001',
      name: 'Branch Manager Delhi',
      mobile: '9000000002',
      employeeId: 'BM001',
      branch: delhi,
      role: 'branchManager',
      password,
      permissions: ROLE_DEFAULTS.branchManager,
      isActive: true,
    },
    {
      id: 'U_BM002',
      name: 'Branch Manager Mumbai',
      mobile: '9000000004',
      employeeId: 'BM002',
      branch: mumbai,
      role: 'branchManager',
      password,
      permissions: ROLE_DEFAULTS.branchManager,
      isActive: true,
    },
    {
      id: 'U_FO001',
      name: 'Field Officer Delhi',
      mobile: '9000000003',
      employeeId: 'FO001',
      branch: delhi,
      role: 'fieldOfficer',
      password,
      permissions: ROLE_DEFAULTS.fieldOfficer,
      isActive: true,
    },
    {
      id: 'U_FO002',
      name: 'Field Officer Mumbai',
      mobile: '9000000005',
      employeeId: 'FO002',
      branch: mumbai,
      role: 'fieldOfficer',
      password,
      permissions: ROLE_DEFAULTS.fieldOfficer,
      isActive: true,
    },
  ],
  customers: [],
  customerListings: [],
  attendance: [],
  tracking: [],
  callLogs: [],
};

writeDb(seedData);
console.log('✅ Seed v2.1 — RBAC + branches (collections removed)');
console.log('Password (all):', DEMO_PASSWORD);
console.log('Admin:', '9000000001', '| BM Delhi:', '9000000002', '| FO Delhi:', '9000000003');
console.log('BM Mumbai:', '9000000004', '| FO Mumbai:', '9000000005');
