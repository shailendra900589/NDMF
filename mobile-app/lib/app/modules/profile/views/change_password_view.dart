import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../widgets/form_widgets.dart';
import '../controllers/profile_controller.dart';

class ChangePasswordView extends GetView<ProfileController> {
  const ChangePasswordView({super.key});

  @override
  Widget build(BuildContext context) {
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();

    return Scaffold(
      appBar: AppBar(title: const Text('Change Password')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            AppTextField(label: 'Current Password', controller: oldCtrl, obscureText: true),
            const SizedBox(height: 12),
            AppTextField(label: 'New Password', controller: newCtrl, obscureText: true),
            const SizedBox(height: 12),
            AppTextField(label: 'Confirm Password', controller: confirmCtrl, obscureText: true),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                if (newCtrl.text != confirmCtrl.text) {
                  Get.snackbar('Error', 'Passwords do not match');
                  return;
                }
                controller.changePassword(oldCtrl.text, newCtrl.text);
              },
              child: const SizedBox(width: double.infinity, child: Center(child: Text('Update Password'))),
            ),
          ],
        ),
      ),
    );
  }
}
