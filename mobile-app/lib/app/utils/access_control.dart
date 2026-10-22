import '../data/models/enums/app_enums.dart';
import '../data/services/storage_service.dart';
import '../routes/app_routes.dart';
import 'package:get/get.dart';

class AccessControl {
  AccessControl._();

  static StorageService get _storage => Get.find<StorageService>();

  static UserRole? get currentRole => _storage.getRole();

  static bool get isAdmin => currentRole == UserRole.admin;

  static bool get isBranchManager => currentRole == UserRole.branchManager;

  static bool get isFieldOfficer => currentRole == UserRole.fieldOfficer;

  /// This app is only for Branch and Employee. Admin uses the website.
  static bool get isFieldAppUser => isBranchManager || isFieldOfficer;

  static Map<String, bool> get permissions => _storage.getPermissions();

  static bool canAccess(String key) {
    if (!isFieldAppUser) return false;
    if (key == 'payslips' || key == 'branches' || key == 'callLogs') return false;
    if (key == 'users') return isBranchManager && permissions['users'] != false;
    return permissions[key] == true;
  }

  /// Clears an Admin session and returns to login. True when the user was sent out.
  static bool leaveUnlessFieldAppUser() {
    if (currentRole == null || isFieldAppUser) return false;
    _storage.clearAuthSession();
    Get.offAllNamed(AppRoutes.login);
    Get.snackbar(
      'Branch and Employee only',
      'Admin accounts use the website, not this app.',
      snackPosition: SnackPosition.BOTTOM,
      duration: const Duration(seconds: 4),
    );
    return true;
  }

  static bool get canManageTeam => canAccess('users');

  static bool get canUseDialer => canAccess('callLogs');

  static bool get showDashboard => canAccess('dashboard');
}
