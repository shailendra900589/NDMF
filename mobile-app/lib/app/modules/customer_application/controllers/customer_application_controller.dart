import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/repositories/customer_listing_repository.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../utils/access_control.dart';
import '../../../utils/api_errors.dart';

class CustomerApplicationController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final LocationService _location = Get.find<LocationService>();

  final nameCtrl = TextEditingController();
  final mobileCtrl = TextEditingController();
  final aadhaarCtrl = TextEditingController();
  final panCtrl = TextEditingController();
  final addressCtrl = TextEditingController();

  final branches = <Map<String, dynamic>>[].obs;
  final selectedBranch = ''.obs;
  final isSaving = false.obs;
  final wizardStep = 0.obs;
  double shopLat = 0;
  double shopLng = 0;

  void nextStep() {
    if (wizardStep.value == 0) {
      if (nameCtrl.text.trim().isEmpty || mobileCtrl.text.trim().length < 10) {
        Get.snackbar('Validation', 'Name and 10-digit mobile required');
        return;
      }
    }
    if (wizardStep.value < 2) wizardStep.value++;
  }

  void prevStep() {
    if (wizardStep.value > 0) wizardStep.value--;
  }

  @override
  void onInit() {
    super.onInit();
    _loadBranches();
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    mobileCtrl.dispose();
    aadhaarCtrl.dispose();
    panCtrl.dispose();
    addressCtrl.dispose();
    super.onClose();
  }

  Future<void> _loadBranches() async {
    try {
      if (AccessControl.isAdmin) {
        branches.value = await _api.getBranches();
        if (branches.isNotEmpty) {
          selectedBranch.value = branches.first['name']?.toString() ?? '';
        }
      }
    } catch (_) {}
  }

  Future<void> captureShopGps() async {
    final loc = await _location.getCurrentLocation();
    if (loc == null) {
      Get.snackbar('GPS', 'Enable location to capture shop coordinates');
      return;
    }
    shopLat = loc.latitude;
    shopLng = loc.longitude;
    Get.snackbar('GPS', 'Shop location captured');
  }

  Future<void> submit() async {
    if (nameCtrl.text.trim().isEmpty || mobileCtrl.text.trim().length < 10) {
      Get.snackbar('Validation', 'Name and 10-digit mobile required');
      return;
    }
    if (addressCtrl.text.trim().isEmpty || shopLat == 0) {
      Get.snackbar('Validation', 'Shop address and GPS required');
      return;
    }
    isSaving.value = true;
    try {
      final listing = CustomerListingModel(
        id: 'CL_${DateTime.now().millisecondsSinceEpoch}',
        name: nameCtrl.text.trim(),
        mobile: mobileCtrl.text.trim(),
        aadhaar: aadhaarCtrl.text.trim(),
        pan: panCtrl.text.trim(),
        shopFullAddress: addressCtrl.text.trim(),
        shopLatitude: shopLat,
        shopLongitude: shopLng,
        neighbors: [
          NeighborVerification(shopName: 'N1', remarks: 'Field visit'),
          NeighborVerification(shopName: 'N2', remarks: 'Field visit'),
        ],
        status: CustomerListingStatus.draft,
        createdAt: DateTime.now(),
      );
      await _repo.submit(
        listing,
        branch: AccessControl.isAdmin && selectedBranch.value.isNotEmpty ? selectedBranch.value : null,
      );
      Get.back(result: true);
      Get.snackbar('Submitted', 'Customer application sent for approval');
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    } finally {
      isSaving.value = false;
    }
  }
}
