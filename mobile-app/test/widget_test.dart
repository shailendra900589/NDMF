import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/main.dart';

void main() {
  testWidgets('App loads splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const NirmaldharaApp());
    await tester.pump();
    expect(find.text('Nirmaldhara'), findsOneWidget);
  });
}
