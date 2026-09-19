import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../theme/app_colors.dart';

/// Mandatory post-call summary — what was discussed (not a fake "confirm call" tap).
class CallSummarySheet {
  static Future<String?> show({
    required String customerLabel,
    required String mobile,
    required String durationLabel,
    required String callStatus,
    required bool requireDetailedSummary,
  }) async {
    final controller = TextEditingController(
      text: callStatus == 'connected'
          ? ''
          : 'Call not connected / no conversation',
    );
    final formKey = GlobalKey<FormState>();

    return Get.bottomSheet<String>(
      WillPopScope(
        onWillPop: () async => false,
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(Get.context!).viewInsets.bottom + 20,
            ),
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Call completed — add summary',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$customerLabel • $mobile\nDuration: $durationLabel • Status: ${_statusLabel(callStatus)}',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Recording is uploaded automatically. Describe what was discussed.',
                    style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: controller,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Call summary / discussion points',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      final t = (v ?? '').trim();
                      if (requireDetailedSummary && t.length < 10) {
                        return 'Connected call: enter at least 10 characters about the conversation';
                      }
                      if (t.isEmpty) return 'Summary required';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      if (formKey.currentState!.validate()) {
                        Get.back(result: controller.text.trim());
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Save & sync to dashboard'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
    );
  }

  static String _statusLabel(String s) {
    switch (s) {
      case 'connected':
        return 'Connected (talk time verified)';
      case 'missed':
        return 'Missed';
      case 'not_answered':
        return 'Not answered';
      default:
        return 'Unknown';
    }
  }
}
