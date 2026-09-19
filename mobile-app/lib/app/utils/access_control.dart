import '../data/models/enums/app_enums.dart';
import '../data/services/storage_service.dart';
import 'package:get/get.dart';

class AccessControl {
  AccessControl._();

  static UserRole? get currentRole => Get.find<StorageService>().getRole();

  static bool get canManageTeam {
    final r = currentRole;
    return r == UserRole.admin || r == UserRole.branchManager;
  }
}
