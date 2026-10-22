import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../utils/access_control.dart';
import '../../../utils/app_permissions.dart';

class TeamController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final StorageService _storage = Get.find<StorageService>();

  final users = <Map<String, dynamic>>[].obs;
  final branches = <Map<String, dynamic>>[].obs;
  final isLoading = false.obs;
  final loadError = RxnString();
  final canCreateRoles = <String>['fieldOfficer'].obs;
  final assignablePermKeys = <String>[].obs;
  final selectedPermissions = RxMap<String, bool>({});

  final nameCtrl = TextEditingController();
  final mobileCtrl = TextEditingController();
  final employeeIdCtrl = TextEditingController();
  final passwordCtrl = TextEditingController(text: 'ndfa1234');
  final selectedRole = 'fieldOfficer'.obs;
  final selectedBranch = ''.obs;
  final isSaving = false.obs;

  final editingUserId = RxnString();
  final editingEmployeeId = ''.obs;
  final editingMobile = ''.obs;

  bool get isAdmin => false;
  bool get isAssignMode => editingUserId.value != null;
  /// Branch creates employees for its own location.
  bool get canCreateUsers => AccessControl.isBranchManager;

  bool get canAssignUsers => AccessControl.canManageTeam;

  static const _managerCreatableRoles = ['fieldOfficer'];
  static const _hiddenPermKeys = {'users', 'branches', 'payslips', 'callLogs'};

  @override
  void onInit() {
    super.onInit();
    _seedCreatableRolesForCurrentUser();
    loadTeam();
    final me = _storage.getUser();
    if (me != null && me.branch.isNotEmpty) selectedBranch.value = me.branch;
  }

  void _seedCreatableRolesForCurrentUser() {
    if (AccessControl.isBranchManager) {
      canCreateRoles.value = List<String>.from(_managerCreatableRoles);
      selectedRole.value = 'fieldOfficer';
    }
  }

  List<String> _creatableRolesFromSchema(Map<String, dynamic> schema) {
    final roles = schema['canCreateRoles'];
    final parsed = roles is List
        ? roles.map((e) => e.toString()).where((r) => r == 'fieldOfficer').toList()
        : <String>[];
    if (parsed.isNotEmpty) return parsed;
    if (AccessControl.isBranchManager) return List<String>.from(_managerCreatableRoles);
    return [];
  }

  void _applyCreatableRoles(Map<String, dynamic> schema) {
    final roles = _creatableRolesFromSchema(schema);
    if (roles.isEmpty) return;
    canCreateRoles.value = roles;
    if (!canCreateRoles.contains(selectedRole.value)) {
      selectedRole.value = canCreateRoles.first;
    }
  }

  void _loadPermissionSchema(Map<String, dynamic> schema) {
    final keys = schema['keys'];
    if (keys is List && keys.isNotEmpty) {
      assignablePermKeys.value = keys
          .map((e) => e.toString())
          .where((k) => !_hiddenPermKeys.contains(k))
          .toList();
    } else {
      assignablePermKeys.value = AppPermissions.keys.where((k) => !_hiddenPermKeys.contains(k)).toList();
    }
    _roleDefaultsFromSchema = {};
    final defaults = schema['roleDefaults'];
    if (defaults is Map) {
      for (final entry in defaults.entries) {
        if (entry.value is Map) {
          _roleDefaultsFromSchema[entry.key.toString()] = Map<String, bool>.from(
            (entry.value as Map).map((k, v) => MapEntry(k.toString(), v == true)),
          );
        }
      }
    }
  }

  Map<String, Map<String, bool>> _roleDefaultsFromSchema = {};

  void applyPermissionsForRole(String role) {
    final fromSchema = _roleDefaultsFromSchema[role];
    if (fromSchema != null) {
      selectedPermissions.assignAll(fromSchema);
      return;
    }
    final userRole = UserRole.values.firstWhere(
      (e) => e.name == role,
      orElse: () => UserRole.fieldOfficer,
    );
    selectedPermissions.assignAll(AppPermissions.defaultsForRole(userRole));
  }

  void setPermissionsFromUser(Map<String, dynamic>? raw) {
    if (raw == null) return;
    for (final k in assignablePermKeys) {
      final v = raw[k];
      if (v is bool) selectedPermissions[k] = v;
    }
    selectedPermissions.refresh();
  }

  void togglePermission(String key) {
    selectedPermissions[key] = !(selectedPermissions[key] ?? false);
  }

  Map<String, bool> permissionsPayload() {
    final out = <String, bool>{};
    for (final k in assignablePermKeys) {
      out[k] = selectedPermissions[k] ?? false;
    }
    return out;
  }

  /// Load branches + creatable roles when opening Create employee screen.
  Future<void> prepareCreateScreen() async {
    try {
      final schema = await _api.getUsersPermissionSchema();
      _loadPermissionSchema(schema);
      _applyCreatableRoles(schema);
      applyPermissionsForRole(selectedRole.value);

      if (isAdmin) {
        branches.value = await _api.getBranches();
        if (selectedBranch.value.isEmpty && branches.isNotEmpty) {
          selectedBranch.value = branches.first['name']?.toString() ?? '';
        }
      } else {
        final me = _storage.getUser();
        final b = me?.branch ?? '';
        if (b.isNotEmpty) {
          branches.value = [
            {'id': 'mine', 'name': b},
          ];
          selectedBranch.value = b;
        }
      }
    } catch (e) {
      Get.snackbar('Error', e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    mobileCtrl.dispose();
    employeeIdCtrl.dispose();
    passwordCtrl.dispose();
    super.onClose();
  }

  Future<void> loadTeam() async {
    isLoading.value = true;
    loadError.value = null;
    try {
      final schema = await _api.getUsersPermissionSchema();
      _loadPermissionSchema(schema);
      _applyCreatableRoles(schema);
      users.value = (await _api.getUsers()).where((u) => u['role']?.toString() != 'admin').toList();
      if (isAdmin) {
        branches.value = await _api.getBranches();
        if (selectedBranch.value.isEmpty && branches.isNotEmpty) {
          selectedBranch.value = branches.first['name']?.toString() ?? '';
        }
      }
    } catch (e) {
      users.clear();
      loadError.value = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading.value = false;
    }
  }

  List<Map<String, dynamic>> get fieldOfficers =>
      users.where((u) => u['role'] == 'fieldOfficer' && u['isActive'] != false).toList();

  void clearAssignState() {
    editingUserId.value = null;
    editingEmployeeId.value = '';
    editingMobile.value = '';
  }

  Future<void> prepareAssignScreen(Map<String, dynamic> user) async {
    final id = user['id']?.toString();
    if (id == null || id.isEmpty) {
      Get.snackbar('Error', 'Invalid user');
      return;
    }
    editingUserId.value = id;
    editingEmployeeId.value = user['employeeId']?.toString() ?? '';
    editingMobile.value = user['mobile']?.toString() ?? '';
    nameCtrl.text = user['name']?.toString() ?? '';
    final role = user['role']?.toString() ?? 'fieldOfficer';
    selectedRole.value = role;
    final branch = user['branch']?.toString() ?? '';
    if (branch.isNotEmpty) selectedBranch.value = branch;
    await prepareCreateScreen();
    if (role != 'admin' && !canCreateRoles.contains(role)) {
      canCreateRoles.value = [...canCreateRoles, role];
    }
    setPermissionsFromUser(user['permissions'] is Map ? Map<String, dynamic>.from(user['permissions'] as Map) : null);
  }

  Future<void> assignRole() async {
    final id = editingUserId.value;
    if (id == null || id.isEmpty) {
      Get.snackbar('Error', 'No user selected');
      return;
    }
    if (nameCtrl.text.trim().isEmpty) {
      Get.snackbar('Validation', 'Name required');
      return;
    }
    final branch = selectedBranch.value.trim();
    if (branch.isEmpty) {
      Get.snackbar('Validation', 'Branch required');
      return;
    }

    isSaving.value = true;
    try {
      final payload = <String, dynamic>{
        'name': nameCtrl.text.trim(),
        'role': selectedRole.value,
      };
      if (isAdmin) payload['branch'] = branch;
      payload['permissions'] = permissionsPayload();
      await _api.updateUser(id, payload);
      Get.back();
      clearAssignState();
      Get.snackbar('Success', 'Role assigned');
      await loadTeam();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> createEmployee() async {
    if (!AccessControl.isBranchManager) {
      Get.snackbar('Access', 'Only a branch account can add employees');
      return;
    }
    if (nameCtrl.text.trim().isEmpty || mobileCtrl.text.trim().length < 10) {
      Get.snackbar('Validation', 'Name and valid mobile required');
      return;
    }
    if (employeeIdCtrl.text.trim().isEmpty) {
      Get.snackbar('Validation', 'Employee ID required');
      return;
    }
    final branch = selectedBranch.value.trim();
    if (branch.isEmpty) {
      Get.snackbar('Validation', 'Branch required');
      return;
    }

    isSaving.value = true;
    try {
      await _api.createUser({
        'name': nameCtrl.text.trim(),
        'mobile': mobileCtrl.text.trim(),
        'employeeId': employeeIdCtrl.text.trim(),
        'role': selectedRole.value,
        'branch': branch,
        'password': passwordCtrl.text.trim().isEmpty ? 'ndfa1234' : passwordCtrl.text.trim(),
        'permissions': permissionsPayload(),
      });
      Get.back();
      Get.snackbar('Success', 'Employee created & role assigned');
      await loadTeam();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isSaving.value = false;
    }
  }

  String roleLabel(String role) {
    switch (role) {
      case 'branchManager':
        return 'Branch';
      case 'admin':
        return 'Admin';
      default:
        return 'Employee';
    }
  }
}
