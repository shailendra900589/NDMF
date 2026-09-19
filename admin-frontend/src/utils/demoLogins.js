/** Demo accounts — must match backend/src/seed/seedData.js */
export const DEMO_PASSWORD = 'ndfa1234';
export const DEMO_OTP = '123456';

/** Web admin panel only (no Field Officer) */
export const WEB_DEMO_ACCOUNTS = [
  {
    key: 'admin',
    role: 'admin',
    mobile: '9000000001',
    title: 'Admin',
    branch: 'All branches',
    scope: 'Full access • users • branches',
  },
  {
    key: 'bm_delhi',
    role: 'branchManager',
    mobile: '9000000002',
    title: 'Branch Manager',
    branch: 'Delhi Main Branch',
    scope: 'Delhi data only',
  },
  {
    key: 'bm_mumbai',
    role: 'branchManager',
    mobile: '9000000004',
    title: 'Branch Manager',
    branch: 'Mumbai Branch',
    scope: 'Mumbai data only',
  },
];

export const MOBILE_FIELD_OFFICERS = [
  { mobile: '9000000003', branch: 'Delhi Main Branch' },
  { mobile: '9000000005', branch: 'Mumbai Branch' },
];

export const WEB_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'branchManager', label: 'Branch Manager' },
];

export function accountForMobile(mobile) {
  return WEB_DEMO_ACCOUNTS.find((a) => a.mobile === mobile);
}
