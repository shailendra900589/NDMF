/// Demo logins — match backend seed + DEMO_LOGINS.md
class DemoCredentials {
  DemoCredentials._();

  static const String password = 'ndfa1234';
  static const String otp = '123456';

  static const adminMobile = '9000000001';
  static const branchManagerMobile = '9000000002';
  static const fieldOfficerMobile = '9000000003';

  static const String helpText =
      'Field Officer: $fieldOfficerMobile / $password\n'
      'OTP: $otp\n'
      'Admin (web): $adminMobile\n'
      'Branch Manager (web): $branchManagerMobile';
}
