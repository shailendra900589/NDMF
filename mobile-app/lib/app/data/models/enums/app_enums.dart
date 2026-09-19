enum LoanStatus {
  draft,
  verificationPending,
  branchPending,
  adminPending,
  approved,
  rejected,
  disbursed,
}

extension LoanStatusExtension on LoanStatus {
  String get label {
    switch (this) {
      case LoanStatus.draft:
        return 'Draft';
      case LoanStatus.verificationPending:
        return 'Verification Pending';
      case LoanStatus.branchPending:
        return 'Branch Pending';
      case LoanStatus.adminPending:
        return 'Admin Pending';
      case LoanStatus.approved:
        return 'Approved';
      case LoanStatus.rejected:
        return 'Rejected';
      case LoanStatus.disbursed:
        return 'Disbursed';
    }
  }

  String get value => name;
}

enum UserRole {
  fieldOfficer,
  branchManager,
  admin,
}

extension UserRoleExtension on UserRole {
  String get label {
    switch (this) {
      case UserRole.fieldOfficer:
        return 'Field Officer';
      case UserRole.branchManager:
        return 'Branch Manager';
      case UserRole.admin:
        return 'Admin';
    }
  }

  String get value => name;
}

enum LeadStatus {
  newLead,
  accepted,
  converted,
  rejected,
}

extension LeadStatusExtension on LeadStatus {
  String get label {
    switch (this) {
      case LeadStatus.newLead:
        return 'New';
      case LeadStatus.accepted:
        return 'Accepted';
      case LeadStatus.converted:
        return 'Converted';
      case LeadStatus.rejected:
        return 'Rejected';
    }
  }
}

enum CallType {
  incoming,
  outgoing,
  missed,
}

extension CallTypeExtension on CallType {
  String get label {
    switch (this) {
      case CallType.incoming:
        return 'Incoming';
      case CallType.outgoing:
        return 'Outgoing';
      case CallType.missed:
        return 'Missed';
    }
  }
}

enum VerificationStatus {
  pending,
  verified,
  rejected,
  draft,
}

enum ApprovalAction {
  approve,
  reject,
  rework,
  finalApprove,
  finalReject,
}

enum CustomerListingStatus {
  draft,
  branchPending,
  adminPending,
  listed,
  rejected,
}

extension CustomerListingStatusExtension on CustomerListingStatus {
  String get label {
    switch (this) {
      case CustomerListingStatus.draft:
        return 'Draft';
      case CustomerListingStatus.branchPending:
        return 'Branch Approval Pending';
      case CustomerListingStatus.adminPending:
        return 'Admin Approval Pending';
      case CustomerListingStatus.listed:
        return 'Customer Listed';
      case CustomerListingStatus.rejected:
        return 'Rejected';
    }
  }

  String get chipLabel {
    switch (this) {
      case CustomerListingStatus.draft:
        return 'Draft';
      case CustomerListingStatus.branchPending:
        return 'Branch';
      case CustomerListingStatus.adminPending:
        return 'Admin';
      case CustomerListingStatus.listed:
        return 'Listed';
      case CustomerListingStatus.rejected:
        return 'Rejected';
    }
  }
}
