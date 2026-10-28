import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:nirmaldhara_micro_finance/app/utils/auto_face_capture.dart';
import 'package:nirmaldhara_micro_finance/app/utils/camera_frame.dart';

void main() {
  test(
      'automatic capture requires one stable face and an open-close-open blink',
      () {
    final capture = AutoFaceCapture();
    final start = DateTime(2026);
    AutoFaceStep frame(int ms, double left, double right,
            {bool single = true, int person = 1}) =>
        capture.observe(
            singleCenteredFace: single,
            leftEye: left,
            rightEye: right,
            now: start.add(Duration(milliseconds: ms)),
            trackingId: person);
    expect(frame(0, .95, .95), AutoFaceStep.waiting);
    expect(frame(200, .95, .95), AutoFaceStep.reference);
    expect(frame(400, .95, .95), AutoFaceStep.reference); // static photo
    expect(frame(500, .1, .95), AutoFaceStep.reference); // wink
    expect(frame(600, .1, .1), AutoFaceStep.action);
    expect(frame(750, .95, .95), AutoFaceStep.complete);
    capture.reset();
    frame(0, .95, .95);
    frame(200, .95, .95);
    expect(frame(300, .1, .1, single: false), AutoFaceStep.waiting);
    frame(400, .95, .95);
    frame(600, .95, .95);
    expect(frame(700, .1, .1, person: 2), AutoFaceStep.waiting);
  });
  test('closed-eye hold and missing classification never auto-complete', () {
    final capture = AutoFaceCapture();
    final start = DateTime(2026);
    for (var i = 0; i < 5; i++) {
      expect(
          capture.observe(
              singleCenteredFace: true,
              leftEye: .1,
              rightEye: .1,
              now: start.add(Duration(seconds: i))),
          AutoFaceStep.waiting);
    }
    expect(
        capture.observe(
            singleCenteredFace: true,
            leftEye: double.nan,
            rightEye: .9,
            now: start),
        AutoFaceStep.waiting);
  });
  test('YUV frame packing respects padding and chroma pixel strides', () {
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
    final encoded = encodeFaceFrame(
        {'width': 2, 'height': 2, 'bytes': packed, 'rotation': 90});
    final decoded = img.decodeJpg(encoded)!;
    expect(decoded.width, 2);
    expect(decoded.height, 2);
    expect(decoded.getPixel(0, 0).r.isFinite, true);
    final portrait = img.decodeJpg(encodeFaceFrame({
      'width': 4,
      'height': 2,
      'bytes': Uint8List.fromList(
          [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128]),
      'rotation': 90,
    }))!;
    expect(portrait.width, 2);
    expect(portrait.height, 4);
  });
}
