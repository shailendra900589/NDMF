import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/repositories/customer_listing_repository.dart';
import '../../../data/services/gps_stamp_camera.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../utils/access_control.dart';
import '../../../utils/api_errors.dart';

class CustomerApplicationController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final LocationService _location = Get.find<LocationService>();
  final StorageService _storage = Get.find<StorageService>();
  final UploadService _upload = Get.find<UploadService>();
  late final GpsStampCamera _camera = GpsStampCamera(_location);
  final AudioRecorder _notes = AudioRecorder();

  final nameCtrl = TextEditingController();
  final mobileCtrl = TextEditingController();
  final aadhaarCtrl = TextEditingController();
  final panCtrl = TextEditingController();
  final addressCtrl = TextEditingController();
  final neighborNameCtrls = List.generate(3, (_) => TextEditingController());
  final neighborRemarkCtrls = List.generate(3, (_) => TextEditingController());

  final branches = <Map<String, dynamic>>[].obs;
  final selectedBranch = ''.obs;
  final isSaving = false.obs;
  final wizardStep = 0.obs;
  final shopLat = 0.0.obs;
  final shopLng = 0.0.obs;
  final capturingSlot = ''.obs;
  final recordingNeighbor = (-1).obs;

  final customerPhoto = Rxn<GpsPhotoCapture>();
  final aadhaarFront = Rxn<GpsPhotoCapture>();
  final aadhaarBack = Rxn<GpsPhotoCapture>();
  final panFront = Rxn<GpsPhotoCapture>();
  final shopPhoto1 = Rxn<GpsPhotoCapture>();
  final shopPhoto2 = Rxn<GpsPhotoCapture>();
  final shopPhoto3 = Rxn<GpsPhotoCapture>();
  final shopPhoto4 = Rxn<GpsPhotoCapture>();
  final neighborVoices = <String?>[null, null, null].obs;

  static const photoSlots = <String, String>{
    'customerPhoto': 'Customer photo',
    'aadhaarFront': 'Aadhaar front',
    'aadhaarBack': 'Aadhaar back',
    'panFront': 'PAN front',
    'shopPhoto1': 'Shop photo 1',
    'shopPhoto2': 'Shop photo 2',
    'shopPhoto3': 'Shop photo 3',
    'shopPhoto4': 'Shop photo 4',
  };

  @override
  void onInit() {
    super.onInit();
    resetForm();
    _loadBranches();
  }

  void resetForm() {
    wizardStep.value = 0;
    shopLat.value = 0;
    shopLng.value = 0;
    nameCtrl.clear();
    mobileCtrl.clear();
    aadhaarCtrl.clear();
    panCtrl.clear();
    addressCtrl.clear();
    for (final c in neighborNameCtrls) {
      c.clear();
    }
    for (final c in neighborRemarkCtrls) {
      c.clear();
    }
    neighborVoices.value = [null, null, null];
    customerPhoto.value = null;
    aadhaarFront.value = null;
    aadhaarBack.value = null;
    panFront.value = null;
    shopPhoto1.value = null;
    shopPhoto2.value = null;
    shopPhoto3.value = null;
    shopPhoto4.value = null;
    selectedBranch.value = '';
    isSaving.value = false;
    recordingNeighbor.value = -1;
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    mobileCtrl.dispose();
    aadhaarCtrl.dispose();
    panCtrl.dispose();
    addressCtrl.dispose();
    for (final c in neighborNameCtrls) {
      c.dispose();
    }
    for (final c in neighborRemarkCtrls) {
      c.dispose();
    }
    _notes.dispose();
    super.onClose();
  }

  String get userBranch => _storage.getUser()?.branch.trim() ?? '';

  String get approvalFlowHint =>
      'After submit, your branch reviews it. Head office then approves, and the customer is listed.';

  Rxn<GpsPhotoCapture> slot(String key) {
    switch (key) {
      case 'customerPhoto':
        return customerPhoto;
      case 'aadhaarFront':
        return aadhaarFront;
      case 'aadhaarBack':
        return aadhaarBack;
      case 'panFront':
        return panFront;
      case 'shopPhoto1':
        return shopPhoto1;
      case 'shopPhoto2':
        return shopPhoto2;
      case 'shopPhoto3':
        return shopPhoto3;
      case 'shopPhoto4':
        return shopPhoto4;
      default:
        return customerPhoto;
    }
  }

  void nextStep() {
    final error = _stepError(wizardStep.value);
    if (error != null) {
      Get.snackbar('Required', error);
      return;
    }
    if (wizardStep.value < 3) wizardStep.value++;
  }

  void prevStep() {
    if (wizardStep.value > 0) wizardStep.value--;
  }

  String? _stepError(int step) {
    if (step == 0) {
      if (nameCtrl.text.trim().isEmpty || mobileCtrl.text.trim().length < 10) {
        return 'Customer name and 10-digit mobile are required';
      }
    }
    if (step == 1) {
      for (final entry in photoSlots.entries) {
        if (slot(entry.key).value == null) return '${entry.value} is required';
      }
    }
    if (step == 2) {
      if (addressCtrl.text.trim().isEmpty) return 'Shop full address is required';
      if (shopLat.value == 0 || shopLng.value == 0) return 'Capture the shop live GPS';
    }
    return null;
  }

  Future<void> _loadBranches() async {
    try {
      if (AccessControl.isAdmin) {
        branches.value = await _api.getBranches();
        if (branches.isNotEmpty) {
          selectedBranch.value = branches.first['name']?.toString() ?? '';
        }
      } else if (userBranch.isNotEmpty) {
        selectedBranch.value = userBranch;
      }
    } catch (_) {}
  }

  String? _branchForSubmit() {
    if (AccessControl.isAdmin) {
      final b = selectedBranch.value.trim();
      return b.isEmpty ? null : b;
    }
    final b = userBranch;
    return b.isEmpty ? null : b;
  }

  Future<void> captureShopGps() async {
    final loc = await _location.getCurrentLocation();
    if (loc == null) {
      Get.snackbar('GPS', 'Enable location to capture the shop');
      return;
    }
    shopLat.value = loc.latitude;
    shopLng.value = loc.longitude;
    Get.snackbar('GPS saved', 'This location stays on the listing for directions');
  }

  Future<void> captureSlot(String key) async {
    capturingSlot.value = key;
    try {
      final photo = await _camera.capture(address: addressCtrl.text.trim());
      if (photo != null) {
        slot(key).value = photo;
        if (shopLat.value == 0) {
          shopLat.value = photo.latitude;
          shopLng.value = photo.longitude;
        }
      }
    } catch (e) {
      Get.snackbar('Camera', apiErrorMessage(e));
    } finally {
      capturingSlot.value = '';
    }
  }

  Future<void> toggleNeighborVoice(int index) async {
    if (recordingNeighbor.value == index) {
      final path = await _notes.stop();
      recordingNeighbor.value = -1;
      if (path != null && path.isNotEmpty) {
        neighborVoices[index] = path;
        neighborVoices.refresh();
      }
      return;
    }
    if (recordingNeighbor.value != -1) {
      await _notes.stop();
    }
    if (!await _notes.hasPermission()) {
      Get.snackbar('Microphone', 'Allow microphone to record the neighbor');
      return;
    }
    final dir = await getApplicationDocumentsDirectory();
    final path = '${dir.path}/neighbor_${index}_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _notes.start(
      const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 44100),
      path: path,
    );
    recordingNeighbor.value = index;
  }

  int get _completeNeighbors {
    var count = 0;
    for (var i = 0; i < 3; i++) {
      if (neighborNameCtrls[i].text.trim().isNotEmpty && neighborRemarkCtrls[i].text.trim().isNotEmpty) {
        count++;
      }
    }
    return count;
  }

  Future<GpsPhotoCapture> _uploadPhoto(GpsPhotoCapture photo, String type) async {
    final url = await _upload.uploadGpsPhoto(photo, type: type);
    return GpsPhotoCapture(
      filePath: UploadService.normalizeUploadPath(url),
      latitude: photo.latitude,
      longitude: photo.longitude,
      capturedAt: photo.capturedAt,
      address: photo.address,
    );
  }

  Future<void> submit() async {
    for (var step = 0; step <= 2; step++) {
      final error = _stepError(step);
      if (error != null) {
        wizardStep.value = step;
        Get.snackbar('Required', error);
        return;
      }
    }
    if (_completeNeighbors < 2) {
      Get.snackbar('Required', 'Add at least 2 neighboring shops with what they said');
      return;
    }
    if (AccessControl.isAdmin && selectedBranch.value.trim().isEmpty) {
      Get.snackbar('Validation', 'Select a branch for this listing');
      return;
    }
    if (!AccessControl.isAdmin && userBranch.isEmpty) {
      Get.snackbar('Validation', 'Your account has no branch assigned. Contact admin.');
      return;
    }
    if (recordingNeighbor.value != -1) {
      await toggleNeighborVoice(recordingNeighbor.value);
    }

    isSaving.value = true;
    try {
      final uploaded = <String, GpsPhotoCapture>{};
      for (final key in photoSlots.keys) {
        uploaded[key] = await _uploadPhoto(slot(key).value!, key);
      }

      final neighbors = <NeighborVerification>[];
      for (var i = 0; i < 3; i++) {
        final shop = neighborNameCtrls[i].text.trim();
        final remarks = neighborRemarkCtrls[i].text.trim();
        if (shop.isEmpty && remarks.isEmpty) continue;
        String? voice = neighborVoices[i];
        if (voice != null && voice.isNotEmpty && !voice.startsWith('/uploads')) {
          voice = await _upload.uploadVoiceFile(voice);
        }
        neighbors.add(NeighborVerification(shopName: shop, remarks: remarks, voiceRecordingPath: voice));
      }

      final listing = CustomerListingModel(
        id: 'CL_${DateTime.now().millisecondsSinceEpoch}',
        name: nameCtrl.text.trim(),
        mobile: mobileCtrl.text.trim(),
        aadhaar: aadhaarCtrl.text.trim(),
        pan: panCtrl.text.trim().toUpperCase(),
        customerPhoto: uploaded['customerPhoto'],
        aadhaarFront: uploaded['aadhaarFront'],
        aadhaarBack: uploaded['aadhaarBack'],
        panFront: uploaded['panFront'],
        shopPhoto1: uploaded['shopPhoto1'],
        shopPhoto2: uploaded['shopPhoto2'],
        shopPhoto3: uploaded['shopPhoto3'],
        shopPhoto4: uploaded['shopPhoto4'],
        shopFullAddress: addressCtrl.text.trim(),
        shopLatitude: shopLat.value,
        shopLongitude: shopLng.value,
        neighbors: neighbors,
        status: CustomerListingStatus.draft,
        createdAt: DateTime.now(),
      );
      await _repo.submit(listing, branch: _branchForSubmit());
      Get.back(result: true);
      Get.snackbar('Submitted', 'Pending for branch approval');
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    } finally {
      isSaving.value = false;
    }
  }
}
