import 'dart:typed_data';
import 'package:image/image.dart' as img;

/// Packs stride/pixel-stride padded YUV420 camera planes into ML Kit NV21.
Uint8List packNv21(int width, int height, List<Uint8List> planes,
    List<int> rowStrides, List<int> pixelStrides) {
  if (planes.length == 1) return Uint8List.fromList(planes.first);
  if (planes.length != 3 || width.isOdd || height.isOdd)
    throw StateError('Unsupported camera frame format');
  final out = Uint8List(width * height * 3 ~/ 2);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      out[y * width + x] = planes[0][y * rowStrides[0] + x * pixelStrides[0]];
    }
  }
  var at = width * height;
  for (var y = 0; y < height ~/ 2; y++) {
    for (var x = 0; x < width ~/ 2; x++) {
      out[at++] = planes[2][y * rowStrides[2] + x * pixelStrides[2]];
      out[at++] = planes[1][y * rowStrides[1] + x * pixelStrides[1]];
    }
  }
  return out;
}

/// Runs in a worker isolate for the two selected frames only.
Uint8List encodeFaceFrame(Map<String, dynamic> frame) {
  final width = frame['width'] as int, height = frame['height'] as int;
  final bytes = frame['bytes'] as Uint8List;
  img.Image image;
  if (frame['bgra'] == true) {
    image = img.Image.fromBytes(
        width: width,
        height: height,
        bytes: bytes.buffer,
        bytesOffset: bytes.offsetInBytes,
        rowStride: frame['rowStride'] as int,
        order: img.ChannelOrder.bgra);
  } else {
    image = img.Image(width: width, height: height);
    final offset = width * height;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        final c = bytes[y * width + x] - 16;
        final uv = offset + (y ~/ 2) * width + (x ~/ 2) * 2;
        final v = bytes[uv] - 128, u = bytes[uv + 1] - 128;
        image.setPixelRgb(
            x,
            y,
            ((298 * c + 409 * v + 128) >> 8).clamp(0, 255),
            ((298 * c - 100 * u - 208 * v + 128) >> 8).clamp(0, 255),
            ((298 * c + 516 * u + 128) >> 8).clamp(0, 255));
      }
    }
  }
  image = img.copyRotate(image, angle: frame['rotation'] as int);
  return Uint8List.fromList(img.encodeJpg(image, quality: 88));
}
