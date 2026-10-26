import '../data/models/enums/app_enums.dart';

/// Mirrors backend ROLE_DEFAULTS + permission keys.
class AppPermissions {
  AppPermissions._();

  static const labels = <String, String>{
    'notices': 'Notice & Announcement', 'visits': 'Visit schedules',
    'dashboard': 'Dashboard',
    'customerListings': 'Customer listing',
    'customers': 'Customers',
    'attendance': 'Attendance',
    'tracking': 'GPS tracking',
    'callLogs': 'Call logs',
    'users': 'User management',
    'branches': 'Locations',
    'payslips': 'Pay slips',
  };

  static const keys = [
    'notices', 'visits',
    'dashboard',
    'customerListings',
    'customers',
    'attendance',
    'tracking',
    'callLogs',
    'users',
    'branches',
    'payslips',
  ];

  static Map<String, bool> defaultsForRole(UserRole role) {
    switch (role) {
      case UserRole.admin:
        return {
          'notices': true, 'visits': true,
          'dashboard': true,
          'customerListings': true,
          'customers': true,
          'attendance': true,
          'tracking': true,
          'callLogs': true,
          'users': true,
          'branches': true,
          'payslips': true,
        };
      case UserRole.branchManager:
        return {
          'notices': true, 'visits': true,
          'dashboard': true,
          'customerListings': true,
          'customers': true,
          'attendance': true,
          'tracking': true,
          'callLogs': true,
          'users': true,
          'branches': false,
          'payslips': false,
        };
      case UserRole.fieldOfficer:
        return {
          'notices': true, 'visits': true,
          'dashboard': true,
          'customerListings': true,
          'customers': true,
          'attendance': true,
          'tracking': true,
          'callLogs': true,
          'users': false,
          'branches': false,
          'payslips': false,
        };
    }
  }

  static Map<String, bool> merge(UserRole role, Map<String, dynamic>? fromApi) {
    final base = defaultsForRole(role);
    if (fromApi == null) return base;
    for (final k in keys) {
      final v = fromApi[k];
      if (v is bool) base[k] = v;
    }
    return base;
  }
}
