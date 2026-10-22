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

    return Get.dialog<String>(
      PopScope(
        canPop: false,
        child: Dialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 16),
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Call completed',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF1A2E28)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Add a short summary',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    customerLabel,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$mobile  •  $durationLabel  •  ${_statusLabel(callStatus)}',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'The recording uploads with this summary.',
                    style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: controller,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'What was discussed',
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: Color(0xFFF5F7FA),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      final t = (v ?? '').trim();
                      if (requireDetailedSummary && t.length < 10) {
                        return 'Enter at least 10 characters about the conversation';
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
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Save & sync to dashboard', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      barrierDismissible: false,
      barrierColor: const Color(0xCC0F172A),
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
