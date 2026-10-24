import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart' as permissions;
import '../models/loan_model.dart';

class LocationService extends GetxService {
  static const double branchLat = 28.6139;
  static const double branchLng = 77.2090;

  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      Get.snackbar('Location', 'Location services are disabled.');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        Get.snackbar('Location', 'Location permission denied.');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      Get.snackbar('Location', 'Location permission permanently denied.');
      return false;
    }
    return true;
  }

  /// Background access is requested only after the user has started duty.
  /// A foreground location service still runs with while-in-use access, but
  /// Android may pause it under aggressive battery policies without this grant.
  Future<bool> requestDutyBackgroundPermission() async {
    final allowed = await requestPermission();
    if (!allowed || !GetPlatform.isAndroid) return allowed;
    try {
      final status = await permissions.Permission.locationAlways.status;
      if (status.isGranted) return true;
      final requested = await permissions.Permission.locationAlways.request();
      return requested.isGranted;
    } catch (_) {
      return false;
    }
  }

  Future<GpsLocation?> getCurrentLocation() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      return GpsLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        address:
            '${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}',
      );
    } catch (e) {
      Get.snackbar('Location Error', 'Failed to get location: $e');
      return null;
    }
  }

  Future<Position?> getPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
    return Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
  }

  double distanceFromBranch(double lat, double lng) {
    return calculateDistance(lat, lng, branchLat, branchLng);
  }

  double calculateTotalDistance(List<GpsLocation> points) {
    if (points.length < 2) return 0;
    double total = 0;
    for (int i = 0; i < points.length - 1; i++) {
      total += calculateDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude,
      );
    }
    return total / 1000; // Convert to KM
  }
}
