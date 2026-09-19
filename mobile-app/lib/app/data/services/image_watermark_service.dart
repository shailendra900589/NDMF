import 'dart:io';
import 'package:get/get.dart';
import 'package:image/image.dart' as img;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import '../models/loan_model.dart';

class ImageWatermarkService extends GetxService {
  Future<String> applyWatermark(String sourcePath, GpsLocation? location) async {
    final bytes = await File(sourcePath).readAsBytes();
    final image = img.decodeImage(bytes);
    if (image == null) return sourcePath;

    final now = DateTime.now();
    final dateLine = DateFormat('dd/MM/yyyy HH:mm:ss').format(now);
    final gpsLine = location != null
        ? 'Lat: ${location.latitude.toStringAsFixed(6)}, Lng: ${location.longitude.toStringAsFixed(6)}'
        : 'GPS: N/A';

    img.drawString(
      image,
      dateLine,
      font: img.arial14,
      x: 16,
      y: image.height - 48,
      color: img.ColorRgb8(255, 255, 255),
    );
    img.drawString(
      image,
      gpsLine,
      font: img.arial14,
      x: 16,
      y: image.height - 28,
      color: img.ColorRgb8(255, 255, 255),
    );

    final dir = await getApplicationDocumentsDirectory();
    final outputPath = '${dir.path}/wm_${now.millisecondsSinceEpoch}.jpg';
    await File(outputPath).writeAsBytes(img.encodeJpg(image, quality: 85));
    return outputPath;
  }
}
