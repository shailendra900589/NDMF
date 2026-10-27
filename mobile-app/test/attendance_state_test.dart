import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/attendance_model.dart';
import 'package:nirmaldhara_micro_finance/app/utils/attendance_state.dart';

AttendanceModel row(String id, String uid, String at, {String? out}) =>
    AttendanceModel(
        id: id,
        userId: uid,
        date: DateTime.parse(at),
        checkInTime: DateTime.parse(at),
        checkOutTime: out == null ? null : DateTime.parse(out));
void main() {
  test('a manager never inherits an employee open shift', () {
    final now = DateTime.parse('2026-10-26T16:00:00Z');
    final team = [row('employee', 'E', '2026-10-26T15:00:00Z')];
    expect(ownAttendanceState(team, 'M', now: now), isNull);
    team.add(row('manager', 'M', '2026-10-26T03:00:00Z',
        out: '2026-10-26T12:00:00Z'));
    expect(ownAttendanceState(team, 'M', now: now)?.isCheckedOut, isTrue);
  });
  test(
      'own shift survives India midnight but stale shifts do not become active',
      () {
    final active = row('night', 'M', '2026-10-26T17:00:00Z');
    expect(
        ownAttendanceState([active], 'M',
                now: DateTime.parse('2026-10-26T20:30:00Z'))
            ?.id,
        'night');
    expect(
        ownAttendanceState([active], 'M',
            now: DateTime.parse('2026-10-27T15:00:00Z')),
        isNull);
  });
}
