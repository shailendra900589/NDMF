/**
 * Customer listing approval chain by submitter role.
 * - fieldOfficer → branchPending → (branch) → adminPending → (admin) → listed
 * - branchManager → adminPending → (admin) → listed
 * - admin → listed (no approval)
 */
function initialListingStatus(submitterRole) {
  if (submitterRole === 'admin') return 'listed';
  if (submitterRole === 'branchManager') return 'adminPending';
  return 'branchPending';
}

function canActorApprove(actor, listing) {
  if (actor.role === 'fieldOfficer') return false;
  if (listing.status === 'branchPending') {
    return actor.role === 'branchManager' || actor.role === 'admin';
  }
  if (listing.status === 'adminPending') {
    return actor.role === 'admin';
  }
  return false;
}

module.exports = { initialListingStatus, canActorApprove };
