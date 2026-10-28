/// Selects an open-eye reference and a blink frame, then waits for eyes to
/// reopen. This guides capture only; server identity/liveness is authoritative.
enum AutoFaceStep { waiting, reference, action, complete }

class AutoFaceCapture {
  AutoFaceStep step = AutoFaceStep.waiting;
  DateTime? _stableSince;
  int? _person;
  DateTime? _closedAt;
  void reset() {
    step = AutoFaceStep.waiting;
    _stableSince = null;
    _person = null;
    _closedAt = null;
  }

  AutoFaceStep observe(
      {required bool singleCenteredFace,
      required double leftEye,
      required double rightEye,
      required DateTime now,
      int? trackingId}) {
    if (!singleCenteredFace ||
        !leftEye.isFinite ||
        !rightEye.isFinite ||
        (_person != null && trackingId != null && _person != trackingId)) {
      reset();
      return step;
    }
    _person ??= trackingId;
    final open = leftEye > 0.75 && rightEye > 0.75;
    final closed = leftEye < 0.20 && rightEye < 0.20;
    if (step == AutoFaceStep.waiting) {
      if (!open) {
        _stableSince = null;
        return step;
      }
      _stableSince ??= now;
      if (now.difference(_stableSince!) >= const Duration(milliseconds: 180))
        step = AutoFaceStep.reference;
    } else if (step == AutoFaceStep.reference && closed) {
      _closedAt = now;
      step = AutoFaceStep.action;
    } else if (step == AutoFaceStep.action) {
      if (now.difference(_closedAt!) > const Duration(seconds: 3)) {
        reset();
      } else if (open) {
        step = AutoFaceStep.complete;
      }
    }
    return step;
  }
}
