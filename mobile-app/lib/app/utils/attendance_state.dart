import '../data/models/attendance_model.dart';
import 'business_time.dart';

/// Mirrors the server's active shift window and India business-day selection.
AttendanceModel? ownAttendanceState(
    List<AttendanceModel> records, String userId,
    {DateTime? now}) {
  final instant = now ?? DateTime.now();
  final today = indiaTime(instant);
  final own = records.where((record) => record.userId == userId).toList()
    ..sort(
        (a, b) => (b.checkInTime ?? b.date).compareTo(a.checkInTime ?? a.date));
  for (final record in own) {
    if (record.checkInTime == null || record.checkOutTime != null) continue;
    final age = instant.difference(record.checkInTime!);
    if (!age.isNegative && age <= const Duration(hours: 20)) return record;
  }
  for (final record in own) {
    final day = indiaTime(record.date);
    if (day.year == today.year &&
        day.month == today.month &&
        day.day == today.day) {
      return record;
    }
  }
  return null;
}
