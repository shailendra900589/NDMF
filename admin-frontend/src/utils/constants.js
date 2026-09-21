export const ROLES = {
  fieldOfficer: 'Employee',
  branchManager: 'Manager',
  admin: 'Admin',
};

export const LOAN_STATUS = {
  draft: 'Draft',
  verificationPending: 'Verification Pending',
  branchPending: 'Manager Pending',
  adminPending: 'Admin Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
};

export const LISTING_STATUS = {
  draft: 'Draft',
  branchPending: 'Manager Pending',
  adminPending: 'Admin Pending',
  listed: 'Listed',
  rejected: 'Rejected',
};

export const STATUS_COLORS = {
  branchPending: '#f59e0b',
  adminPending: '#8b5cf6',
  approved: '#10b981',
  listed: '#10b981',
  rejected: '#ef4444',
  verificationPending: '#3b82f6',
  newLead: '#3b82f6',
  accepted: '#10b981',
};
