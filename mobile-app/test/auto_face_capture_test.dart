import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:nirmaldhara_micro_finance/app/utils/auto_face_capture.dart';
import 'package:nirmaldhara_micro_finance/app/utils/camera_frame.dart';

void main() {
  test('single automatic capture needs only one stable face and no expression',
      () {
    final capture = SingleFaceCapture();
    final start = DateTime(2026);
    bool frame(int ms, {bool single = true, int person = 1}) => capture.observe(
        singleCenteredFace: single,
        now: start.add(Duration(milliseconds: ms)),
        trackingId: person);
    expect(frame(0), false);
    expect(frame(100), false);
    expect(frame(200), true);
    expect(frame(300, single: false), false);
    expect(frame(400), false);
    expect(frame(600), true);
    expect(frame(700, person: 2), false);
  });
  test('missing face never auto captures', () {
    final capture = SingleFaceCapture();
    for (var i = 0; i < 5; i++) {
      expect(
          capture.observe(
              singleCenteredFace: false,
              now: DateTime(2026).add(Duration(seconds: i))),
          false);
    }
  });
  test('YUV frame packing preserves padded planes and portrait rotation', () {
    final packed = packNv21(2, 2, [
      Uint8List.fromList([16, 40, 99, 80, 120, 99]),
      Uint8List.fromList([100, 99]),
      Uint8List.fromList([150, 99])
    ], [
      3,
      2,
      2
    ], [
      1,
      2,
      2
    ]);
    expect(packed, [16, 40, 80, 120, 150, 100]);
    final decoded = img.decodeJpg(encodeFaceFrame(
        {'width': 2, 'height': 2, 'bytes': packed, 'rotation': 90}))!;
    expect(decoded.width, 2);
    expect(decoded.height, 2);
    final portrait = img.decodeJpg(encodeFaceFrame({
      'width': 4,
      'height': 2,
      'bytes': Uint8List.fromList(List.filled(12, 128)),
      'rotation': 90
    }))!;
    expect(portrait.width, 2);
    expect(portrait.height, 4);
  });
}
