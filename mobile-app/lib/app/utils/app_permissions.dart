import '../data/models/enums/app_enums.dart';

/// Mirrors backend ROLE_DEFAULTS + permission keys.
class AppPermissions {
  AppPermissions._();

  static const keys = [
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
