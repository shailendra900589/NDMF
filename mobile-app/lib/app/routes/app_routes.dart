class AppRoutes {
  AppRoutes._();

  static const String splash = '/';
  static const String login = '/login';
  static const String appLock = '/app-lock';
  static const String home = '/home';
  static const String attendance = '/attendance';
  static const String tracking = '/tracking';
  static const String customers = '/customers';
  static const String customerAdd = '/customers/add';
  static const String customerDetail = '/customers/detail';
  static const String callHistory = '/call-history';
  static const String profile = '/profile';
  static const String changePassword = '/profile/change-password';
  static const String deviceInfo = '/profile/device-info';
  static const String mapView = '/map';
  static const String dialer = '/dialer';
  static const String branches = '/branches';
  static const String team = '/team';
  static const String teamCreate = '/team/create';
  static const String teamAssign = '/team/assign';
  static const String payslips = '/payslips';
  static const String payslipForm = '/payslips/form';
  static const String faceEnrollment = '/face-enrollment';
  static const String visits = '/visits';
  static const String customerApplication = '/customer-application';
  /// Standalone path (not under `/customer-application`) so GetX routing stays reliable.
  static const String customerApplicationNew = '/customer-listing/new';
}
