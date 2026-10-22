import 'dart:io';
import 'dart:isolate';

import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../models/customer_listing_model.dart';
import 'location_service.dart';

/// Opens the device camera and burns live GPS, date and time onto the photo.
///
/// Full-resolution camera frames were decoded on the UI isolate and closed the
/// app on low-memory phones. Capture is capped, then stamped on a background isolate.
class GpsStampCamera {
  GpsStampCamera(this._location);

  final LocationService _location;
  final ImagePicker _picker = ImagePicker();

  Future<GpsPhotoCapture?> capture({String address = ''}) async {
    final shot = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 72,
      maxWidth: 1280,
      maxHeight: 1280,
    );
    if (shot == null) return null;

    final loc = await _location.getCurrentLocation();
    if (loc == null) {
      throw Exception('Live GPS is required for every photo');
    }

    final capturedAt = DateTime.now();
    final dir = await getApplicationDocumentsDirectory();
    final outPath = '${dir.path}/gps_${capturedAt.millisecondsSinceEpoch}.jpg';
    final stamped = await Isolate.run(
      () => stampGpsPhoto(
        sourcePath: shot.path,
        outPath: outPath,
        latitude: loc.latitude,
        longitude: loc.longitude,
        capturedAtIso: capturedAt.toIso8601String(),
        address: address,
      ),
    );

    return GpsPhotoCapture(
      filePath: stamped,
      latitude: loc.latitude,
      longitude: loc.longitude,
      capturedAt: capturedAt,
      address: address,
    );
  }
}

/// Pure function so it can run off the UI isolate.
String stampGpsPhoto({
  required String sourcePath,
  required String outPath,
  required double latitude,
  required double longitude,
  required String capturedAtIso,
  required String address,
}) {
  final source = File(sourcePath);
  final bytes = source.readAsBytesSync();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    source.copySync(outPath);
    return outPath;
  }

  final fitted = _fit(decoded, 1280);
  final capturedAt = DateTime.tryParse(capturedAtIso) ?? DateTime.now();
  final lines = <String>[
    'Lat ${latitude.toStringAsFixed(6)}   Lng ${longitude.toStringAsFixed(6)}',
    DateFormat('dd MMM yyyy  HH:mm:ss').format(capturedAt),
    if (address.trim().isNotEmpty) address.trim(),
  ];

  const barHeight = 78;
  final canvas = img.Image(width: fitted.width, height: fitted.height + barHeight);
  img.fill(canvas, color: img.ColorRgb8(0, 0, 0));
  img.compositeImage(canvas, fitted);
  var y = fitted.height + 8;
  for (final line in lines) {
    final text = line.length > 64 ? '${line.substring(0, 61)}...' : line;
    img.drawString(
      canvas,
      text,
      font: img.arial14,
      x: 10,
      y: y,
      color: img.ColorRgb8(255, 255, 255),
    );
    y += 22;
  }

  File(outPath).writeAsBytesSync(img.encodeJpg(canvas, quality: 72));
  return outPath;
}

img.Image _fit(img.Image src, int maxSide) {
  if (src.width <= maxSide && src.height <= maxSide) return src;
  final scale = maxSide / (src.width > src.height ? src.width : src.height);
  return img.copyResize(
    src,
    width: (src.width * scale).round().clamp(1, maxSide),
    height: (src.height * scale).round().clamp(1, maxSide),
  );
}
