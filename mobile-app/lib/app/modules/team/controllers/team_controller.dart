import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../utils/access_control.dart';

class TeamController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final StorageService _storage = Get.find<StorageService>();

  final users = <Map<String, dynamic>>[].obs;
  final branches = <Map<String, dynamic>>[].obs;
  final isLoading = false.obs;
  final canCreateRoles = <String>['fieldOfficer'].obs;

  final nameCtrl = TextEditingController();
  final mobileCtrl = TextEditingController();
  final employeeIdCtrl = TextEditingController();
  final passwordCtrl = TextEditingController(text: 'ndfa1234');
  final selectedRole = 'fieldOfficer'.obs;
  final selectedBranch = ''.obs;
  final isSaving = false.obs;

  bool get isAdmin => AccessControl.isAdmin;

  @override
  void onInit() {
    super.onInit();
    loadTeam();
    final me = _storage.getUser();
    if (me != null && me.branch.isNotEmpty) selectedBranch.value = me.branch;
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
    try {
      final schema = await _api.getUsersPermissionSchema();
      final roles = schema['canCreateRoles'];
      if (roles is List && roles.isNotEmpty) {
        canCreateRoles.value = roles.map((e) => e.toString()).toList();
        if (!canCreateRoles.contains(selectedRole.value)) {
          selectedRole.value = canCreateRoles.first;
        }
      }
      users.value = await _api.getUsers();
      if (isAdmin) {
        branches.value = await _api.getBranches();
        if (selectedBranch.value.isEmpty && branches.isNotEmpty) {
          selectedBranch.value = branches.first['name']?.toString() ?? '';
        }
      }
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isLoading.value = false;
    }
  }

  List<Map<String, dynamic>> get fieldOfficers =>
      users.where((u) => u['role'] == 'fieldOfficer' && u['isActive'] != false).toList();

  Future<void> createEmployee() async {
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
        return 'Branch Manager';
      case 'admin':
        return 'Admin';
      default:
        return 'Field Officer';
    }
  }
}
