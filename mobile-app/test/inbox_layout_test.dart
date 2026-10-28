import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/enums/app_enums.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/storage_service.dart';
import 'package:nirmaldhara_micro_finance/app/widgets/team_inbox.dart';

class InboxStorage extends StorageService {
  @override
  UserRole? getRole() => UserRole.fieldOfficer;
  @override
  Map<String, bool> getPermissions() => {'visits': true, 'notices': false};
}

void main() {
  tearDown(() => Get.reset());
  testWidgets('home hides shortcut strip while profile actions fit a narrow screen', (tester) async {
    Get.put<StorageService>(InboxStorage());
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: TeamInboxButton(showActions: false))));
    expect(find.text('Salary slips'), findsNothing);
    expect(find.byType(ListTile), findsNothing);
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: TeamInboxButton())));
    expect(find.text('Salary slips'), findsOneWidget);
    expect(find.text('My visits'), findsOneWidget);
    expect(find.byType(ListTile), findsNWidgets(2));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
