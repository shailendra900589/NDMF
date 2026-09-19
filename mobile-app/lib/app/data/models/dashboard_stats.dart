class DashboardStats {
  final int pendingCustomerListing;
  final int totalCustomers;
  final int totalListings;
  final String attendanceStatus;
  final double distanceCoveredToday;
  final int totalCallsToday;
  final int totalCallsWithRecording;
  final int teamMembers;
  final String branch;
  final String scope;

  DashboardStats({
    this.pendingCustomerListing = 0,
    this.totalCustomers = 0,
    this.totalListings = 0,
    this.attendanceStatus = 'Not Checked In',
    this.distanceCoveredToday = 0,
    this.totalCallsToday = 0,
    this.totalCallsWithRecording = 0,
    this.teamMembers = 0,
    this.branch = '',
    this.scope = 'branch',
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      pendingCustomerListing: json['pendingCustomerListing'] ?? 0,
      totalCustomers: json['totalCustomers'] ?? 0,
      totalListings: json['totalListings'] ?? 0,
      attendanceStatus: json['attendanceStatus'] ?? 'Not Checked In',
      distanceCoveredToday: (json['distanceCoveredToday'] ?? 0).toDouble(),
      totalCallsToday: json['totalCallsToday'] ?? 0,
      totalCallsWithRecording: json['totalCallsWithRecording'] ?? 0,
      teamMembers: json['teamMembers'] ?? 0,
      branch: json['branch']?.toString() ?? '',
      scope: json['scope']?.toString() ?? 'branch',
    );
  }

  DashboardStats copyWith({double? distanceCoveredToday}) {
    return DashboardStats(
      pendingCustomerListing: pendingCustomerListing,
      totalCustomers: totalCustomers,
      totalListings: totalListings,
      attendanceStatus: attendanceStatus,
      distanceCoveredToday: distanceCoveredToday ?? this.distanceCoveredToday,
      totalCallsToday: totalCallsToday,
      totalCallsWithRecording: totalCallsWithRecording,
      teamMembers: teamMembers,
      branch: branch,
      scope: scope,
    );
  }
}
