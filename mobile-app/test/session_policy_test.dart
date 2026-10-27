import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/app/utils/session_policy.dart';

void main() {
  test('a late failure from an old session cannot expire the new login', () {
    expect(
        isCurrentSessionRequest('Bearer old-session', 'new-session'), isFalse);
    expect(isCurrentSessionRequest('Bearer current', 'current'), isTrue);
    expect(isCurrentSessionRequest(null, 'current'), isFalse);
  });
  test('expired tokens and disabled accounts expire sessions', () {
    expect(shouldExpireSession(401, '/customers', 'Invalid token'), isTrue);
    expect(shouldExpireSession(403, '/auth/me', 'Account disabled'), isTrue);
    expect(
        shouldExpireSession(403, '/auth/me', 'Company is suspended'), isTrue);
  });
  test('permission errors and credential mistakes preserve valid sessions', () {
    expect(shouldExpireSession(403, '/users', 'Access denied'), isFalse);
    expect(
        shouldExpireSession(401, '/auth/login', 'Invalid password'), isFalse);
    expect(
        shouldExpireSession(
            401, '/auth/change-password', 'Current password is incorrect'),
        isFalse);
  });
}
