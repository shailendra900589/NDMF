/// Frame selection only: server identity matching authorizes attendance.
/// No eye, mouth, gesture or expression classification is used.
class SingleFaceCapture {
  DateTime? _stableSince;
  int? _person;
  bool observe(
      {required bool singleCenteredFace,
      required DateTime now,
      int? trackingId}) {
    if (!singleCenteredFace ||
        (_person != null && trackingId != null && _person != trackingId)) {
      _stableSince = null;
      _person = null;
      return false;
    }
    _person ??= trackingId;
    _stableSince ??= now;
    return now.difference(_stableSince!) >= const Duration(milliseconds: 180);
  }
}
