/**
 * Every customer listing starts with the branch, then admin.
 * field officer, branch manager, and admin all submit as branchPending.
 * Branch approval moves it to adminPending. Admin approval lists the customer.
 */
function initialListingStatus() {
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
