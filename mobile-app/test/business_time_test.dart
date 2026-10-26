import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/app/utils/business_time.dart';

void main() {
  test('UTC attendance becomes the correct IST business day and time', () {
    final time = indiaTime(DateTime.parse('2026-10-26T20:30:00Z'));
    expect(time.day, 27);
    expect(time.hour, 2);
    expect(time.minute, 0);
    expect(indiaTime(DateTime.parse('2026-10-26T09:00:00+05:30')).hour, 9);
  });
}
