import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../utils/access_control.dart';

class BranchesController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();

  final branches = <Map<String, dynamic>>[].obs;
  final isLoading = false.obs;
  final isSaving = false.obs;

  final nameCtrl = TextEditingController();
  final cityCtrl = TextEditingController();
  final stateCtrl = TextEditingController();
  final addressCtrl = TextEditingController();

  bool get canCreate => AccessControl.isAdmin;

  @override
  void onInit() {
    super.onInit();
    loadBranches();
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    cityCtrl.dispose();
    stateCtrl.dispose();
    addressCtrl.dispose();
    super.onClose();
  }

  Future<void> loadBranches() async {
    isLoading.value = true;
    try {
      branches.value = await _api.getBranches();
    } catch (e) {
      Get.snackbar('Error', e.toString().replaceFirst('Exception: ', ''));
    } finally {
      isLoading.value = false;
    }
  }

  void resetForm() {
    nameCtrl.clear();
    cityCtrl.clear();
    stateCtrl.clear();
    addressCtrl.clear();
  }

  Future<void> createBranch() async {
    if (!canCreate) {
      Get.snackbar('Access', 'Only admin can add locations');
      return;
    }
    if (nameCtrl.text.trim().isEmpty) {
      Get.snackbar('Validation', 'Location name required');
      return;
    }
    isSaving.value = true;
    try {
      await _api.createBranch(
        name: nameCtrl.text.trim(),
        city: cityCtrl.text.trim(),
        state: stateCtrl.text.trim(),
        address: addressCtrl.text.trim(),
      );
      resetForm();
      Get.back();
      Get.snackbar('Success', 'Location created');
      await loadBranches();
    } catch (e) {
      Get.snackbar('Error', e.toString().replaceFirst('Exception: ', ''));
    } finally {
      isSaving.value = false;
    }
  }
}
