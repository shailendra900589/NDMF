import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/customer_listing_model.dart';
import '../models/loan_model.dart';
import 'location_service.dart';
import 'image_watermark_service.dart';

class CameraService extends GetxService {
  final ImagePicker _picker = ImagePicker();
  LocationService get _locationService => Get.find<LocationService>();
  ImageWatermarkService get _watermark => Get.find<ImageWatermarkService>();

  bool get _supportsLiveCamera =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  Future<bool> requestCameraPermission() async {
    final status = await Permission.camera.request();
    return status.isGranted;
  }

  Future<bool> requestGalleryPermission() async {
    final status = await Permission.photos.request();
    if (status.isGranted) return true;
    final storageStatus = await Permission.storage.request();
    return storageStatus.isGranted;
  }

  /// Live camera capture only — with GPS, date/time watermark metadata.
  Future<GpsPhotoCapture?> captureLiveGpsPhoto() async {
    if (_supportsLiveCamera) {
      if (!await requestCameraPermission()) {
        Get.snackbar('Camera', 'Camera permission required for live capture');
        return null;
      }
    } else if (!await requestGalleryPermission()) {
      Get.snackbar('Photo', 'Pick a photo from gallery (desktop test mode)');
      return null;
    }

    final location = await _locationService.getCurrentLocation();
    if (location == null) {
      Get.snackbar('GPS Required', 'Live location is mandatory for photo capture');
      return null;
    }

    XFile? photo;
    try {
      if (_supportsLiveCamera) {
        photo = await _picker.pickImage(
          source: ImageSource.camera,
          imageQuality: 85,
          maxWidth: 1920,
          preferredCameraDevice: CameraDevice.rear,
        );
      } else {
        photo = await _picker.pickImage(
          source: ImageSource.gallery,
          imageQuality: 85,
          maxWidth: 1920,
        );
      }
    } catch (e) {
      Get.snackbar(
        'Photo',
        _supportsLiveCamera
            ? 'Could not open camera'
            : 'Could not pick image on this device',
      );
      return null;
    }
    if (photo == null) return null;

    final path = await _processImage(photo.path, location);
    if (path == null) return null;

    return GpsPhotoCapture(
      filePath: path,
      latitude: location.latitude,
      longitude: location.longitude,
      capturedAt: DateTime.now(),
      address: location.address,
    );
  }

  Future<String?> captureFromCamera() async {
    final capture = await captureLiveGpsPhoto();
    return capture?.filePath;
  }

  Future<String?> pickFromGallery() async {
    if (!await requestGalleryPermission()) {
      Get.snackbar('Gallery', 'Gallery permission denied');
      return null;
    }
    final XFile? photo = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (photo == null) return null;
    final loc = await _locationService.getCurrentLocation();
    return _processImage(
      photo.path,
      loc ?? GpsLocation(latitude: 0, longitude: 0, address: ''),
    );
  }

  /// Live GPS camera only (no gallery) — for customer listing documents.
  Future<GpsPhotoCapture?> captureLiveForListing() => captureLiveGpsPhoto();

  Future<String?> _processImage(String path, GpsLocation location) async {
    final compressed = await compressImage(path);
    final sourcePath = compressed ?? path;
    final watermarked = await _watermark.applyWatermark(sourcePath, location);

    final dir = await getApplicationDocumentsDirectory();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final lat = location.latitude.toStringAsFixed(4);
    final lng = location.longitude.toStringAsFixed(4);
    final newPath = '${dir.path}/img_${timestamp}_${lat}_$lng.jpg';

    await File(watermarked).copy(newPath);
    return newPath;
  }

  Future<String?> compressImage(String path) async {
    try {
      final dir = await getTemporaryDirectory();
      final targetPath = '${dir.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final result = await FlutterImageCompress.compressAndGetFile(
        path,
        targetPath,
        quality: 70,
        minWidth: 1024,
        minHeight: 1024,
      );
      return result?.path;
    } catch (e) {
      return path;
    }
  }

  Future<String?> showImageSourceDialog(BuildContext context) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Color(0xFF00897B)),
                title: const Text('Take Photo'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Color(0xFF00897B)),
                title: const Text('Choose from Gallery'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == ImageSource.camera) return captureFromCamera();
    if (source == ImageSource.gallery) return pickFromGallery();
    return null;
  }

  String getWatermarkText(GpsLocation? location) {
    final now = DateTime.now();
    final dateStr =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final gps = location != null
        ? 'Lat: ${location.latitude.toStringAsFixed(6)}, Lng: ${location.longitude.toStringAsFixed(6)}'
        : 'GPS: N/A';
    return '$dateStr | $gps';
  }
}
