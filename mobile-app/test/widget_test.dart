import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/app/routes/app_routes.dart';

/// Lightweight smoke tests (no device plugins — full UI tests need integration harness).
void main() {
  test('core routes are registered', () {
    expect(AppRoutes.home, '/home');
    expect(AppRoutes.login, '/login');
    expect(AppRoutes.profile, '/profile');
    expect(AppRoutes.customerApplicationNew, '/customer-listing/new');
  });
}
