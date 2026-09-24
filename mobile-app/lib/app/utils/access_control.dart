import '../data/models/enums/app_enums.dart';
import '../data/services/storage_service.dart';
import 'package:get/get.dart';

class AccessControl {
  AccessControl._();

  static StorageService get _storage => Get.find<StorageService>();

  static UserRole? get currentRole => _storage.getRole();

  static bool get isAdmin => currentRole == UserRole.admin;

  static Map<String, bool> get permissions => _storage.getPermissions();

  static bool canAccess(String key) => permissions[key] == true;

  static bool get canManageTeam => canAccess('users');

  static bool get canUseDialer => canAccess('callLogs');

  static bool get showDashboard => canAccess('dashboard');
}
