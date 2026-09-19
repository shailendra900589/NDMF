import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/services/camera_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/voice_recording_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../data/services/api_constants.dart';
import '../../../routes/app_routes.dart';
import '../../../data/repositories/customer_listing_repository.dart';

class CustomerListingFormController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();
  CameraService get _camera => Get.find<CameraService>();
  LocationService get _location => Get.find<LocationService>();
  VoiceRecordingService get _voice => Get.find<VoiceRecordingService>();
  UploadService get _upload => Get.find<UploadService>();

  final currentStep = 0.obs;
  final isLoading = false.obs;
  final isCapturingGps = false.obs;
  final recordingNeighborIndex = RxnInt();

  late CustomerListingModel listing;

  final nameCtrl = TextEditingController();
  final mobileCtrl = TextEditingController();
  final aadhaarCtrl = TextEditingController();
  final panCtrl = TextEditingController();
  final shopAddressCtrl = TextEditingController();

  @override
  void onInit() {
    super.onInit();
    listing = CustomerListingModel(
      id: 'CL_${DateTime.now().millisecondsSinceEpoch}',
      createdAt: DateTime.now(),
      neighbors: List.generate(3, (_) => NeighborVerification()),
    );
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    mobileCtrl.dispose();
    aadhaarCtrl.dispose();
    panCtrl.dispose();
    shopAddressCtrl.dispose();
    super.onClose();
  }

  Future<void> capturePhoto(void Function(GpsPhotoCapture?) setter, String label) async {
    final photo = await _camera.captureLiveForListing();
    if (photo == null) {
      Get.snackbar('Capture Failed', '$label requires live GPS camera');
      return;
    }
    setter(photo);
    update(['photos']);
    Get.snackbar('Captured', '$label saved with GPS & timestamp');
  }

  Future<void> captureShopGps() async {
    isCapturingGps.value = true;
    final loc = await _location.getCurrentLocation();
    if (loc != null) {
      listing.shopLatitude = loc.latitude;
      listing.shopLongitude = loc.longitude;
      if (shopAddressCtrl.text.isEmpty) {
        shopAddressCtrl.text = loc.address;
      }
    } else {
      Get.snackbar('GPS Error', 'Could not fetch shop location');
    }
    isCapturingGps.value = false;
    update(['gps']);
  }

  Future<void> toggleNeighborRecording(int index) async {
    if (_voice.isRecording.value) {
      final path = await _voice.stopRecording();
      listing.neighbors[index].voiceRecordingPath = path;
      recordingNeighborIndex.value = null;
      update(['neighbors']);
    } else {
      await _voice.startRecording();
      recordingNeighborIndex.value = index;
    }
  }

  void nextStep() {
    if (!_validateStep()) return;
    _saveStepData();
    if (currentStep.value < 5) {
      currentStep.value++;
      if (currentStep.value == 3) captureShopGps();
    }
  }

  void previousStep() {
    if (currentStep.value > 0) currentStep.value--;
  }

  bool _validateStep() {
    switch (currentStep.value) {
      case 0:
        if (nameCtrl.text.isEmpty || mobileCtrl.text.length < 10) {
          Get.snackbar('Validation', 'Enter customer name and valid mobile');
          return false;
        }
        return true;
      case 1:
        if (listing.customerPhoto == null ||
            listing.aadhaarFront == null ||
            listing.aadhaarBack == null ||
            listing.panFront == null) {
          Get.snackbar('Validation', 'Capture all KYC photos via live camera');
          return false;
        }
        return true;
      case 2:
        if (listing.shopPhoto1 == null ||
            listing.shopPhoto2 == null ||
            listing.shopPhoto3 == null ||
            listing.shopPhoto4 == null) {
          Get.snackbar('Validation', 'Capture all 4 shop live photos');
          return false;
        }
        return true;
      case 3:
        if (shopAddressCtrl.text.isEmpty || !listing.hasShopLocation) {
          Get.snackbar('Validation', 'Shop address and GPS location required');
          return false;
        }
        return true;
      case 4:
        final valid = listing.neighbors.where((n) => n.shopName.isNotEmpty && n.remarks.isNotEmpty).length;
        if (valid < 2) {
          Get.snackbar('Validation', 'Add at least 2 neighbor shop verifications');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  void _saveStepData() {
    listing.name = nameCtrl.text;
    listing.mobile = mobileCtrl.text;
    listing.aadhaar = aadhaarCtrl.text;
    listing.pan = panCtrl.text;
    listing.shopFullAddress = shopAddressCtrl.text;
  }

  Future<GpsPhotoCapture?> _uploadPhoto(GpsPhotoCapture? photo) async {
    if (photo == null || !ApiConstants.useRemoteApi) return photo;
    final url = await _upload.uploadGpsPhoto(photo);
    return GpsPhotoCapture(
      filePath: url,
      latitude: photo.latitude,
      longitude: photo.longitude,
      capturedAt: photo.capturedAt,
      address: photo.address,
    );
  }

  Future<void> _uploadAllMedia() async {
    if (!ApiConstants.useRemoteApi) return;
    listing.customerPhoto = await _uploadPhoto(listing.customerPhoto);
    listing.aadhaarFront = await _uploadPhoto(listing.aadhaarFront);
    listing.aadhaarBack = await _uploadPhoto(listing.aadhaarBack);
    listing.panFront = await _uploadPhoto(listing.panFront);
    listing.shopPhoto1 = await _uploadPhoto(listing.shopPhoto1);
    listing.shopPhoto2 = await _uploadPhoto(listing.shopPhoto2);
    listing.shopPhoto3 = await _uploadPhoto(listing.shopPhoto3);
    listing.shopPhoto4 = await _uploadPhoto(listing.shopPhoto4);
    for (final n in listing.neighbors) {
      if (n.voiceRecordingPath != null && n.voiceRecordingPath!.isNotEmpty) {
        n.voiceRecordingPath = await _upload.uploadVoiceFile(n.voiceRecordingPath!);
      }
    }
  }

  Future<void> submitListing() async {
    if (!_validateStep()) return;
    _saveStepData();
    if (!listing.isReadyToSubmit) {
      Get.snackbar('Validation', 'Please complete all required fields');
      return;
    }
    isLoading.value = true;
    try {
      await _uploadAllMedia();
      await _repo.submit(listing);
      Get.snackbar('Submitted', 'Customer sent for Branch Approval');
      Get.offAllNamed(AppRoutes.home);
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isLoading.value = false;
    }
  }
}
