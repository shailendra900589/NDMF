import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/customer_model.dart';
import 'package:nirmaldhara_micro_finance/app/widgets/custom_app_bar.dart';

void main() {
  test(
      'customer detail preserves signed verification media and legacy document objects',
      () {
    final customer = CustomerModel.fromJson({
      'id': 'C1',
      'name': 'Test',
      'documentPaths': [
        '/uploads/a.jpg?sig=one',
        {'filePath': '/uploads/b.jpg?sig=two'},
        null
      ],
      'verification': {
        'photos': [
          {'filePath': '/uploads/c.jpg?sig=three'}
        ]
      }
    });
    expect(customer.documentPaths,
        ['/uploads/a.jpg?sig=one', '/uploads/b.jpg?sig=two']);
    expect(CustomerModel.fromJson(customer.toJson()).verification,
        customer.verification);
  });
  testWidgets(
      'feature header keeps navigation without profile/logout duplicates',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
      appBar: CustomAppBar(title: 'GPS Duty', leading: BackButton()),
    )));
    expect(find.byType(BackButton), findsOneWidget);
    expect(find.byIcon(Icons.person), findsNothing);
    expect(find.byIcon(Icons.logout), findsNothing);
  });
}
