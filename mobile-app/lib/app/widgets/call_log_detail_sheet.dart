import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/models/call_log_model.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import 'streaming_recording_player.dart';

/// Call detail + notes editor (mockup-aligned).
class CallLogDetailSheet {
  static Future<String?> show({
    required CallLogModel log,
    required Future<void> Function(String summary) onSave,
    VoidCallback? onCallBack,
  }) async {
    final controller = TextEditingController(text: log.callSummary ?? '');
    final tags = ['Follow Up', 'Interested', 'Send Documents'];

    return Get.bottomSheet<String>(
      SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 12,
            bottom: MediaQuery.of(Get.context!).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Call details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ),
                    TextButton(
                      onPressed: () async {
                        final text = controller.text.trim();
                        await onSave(text);
                        Get.back(result: text);
                      },
                      child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppRadii.card,
                    boxShadow: AppShadows.card,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(log.customerName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text('${log.mobile} • ${log.type.label}', style: const TextStyle(color: AppColors.textSecondary)),
                      Text('${log.time} • ${log.duration}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                if (log.hasRecording) ...[
                  const SizedBox(height: 12),
                  StreamingRecordingPlayer(
                    recordingUrl: log.recordingUrl,
                    localRecordingPath: log.localRecordingPath,
                  ),
                ],
                const SizedBox(height: 14),
                TextField(
                  controller: controller,
                  maxLines: 5,
                  maxLength: 500,
                  decoration: const InputDecoration(
                    labelText: 'Call notes',
                    hintText: 'What was discussed?',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: tags
                      .map(
                        (t) => ActionChip(
                          label: Text(t),
                          onPressed: () {
                            final cur = controller.text.trim();
                            controller.text = cur.isEmpty ? t : '$cur • $t';
                          },
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 16),
                if (onCallBack != null)
                  FilledButton.icon(
                    onPressed: () {
                      Get.back();
                      onCallBack();
                    },
                    icon: const Icon(Icons.call_rounded),
                    label: const Text('Call back'),
                  ),
              ],
            ),
          ),
        ),
      ),
      isScrollControlled: true,
      backgroundColor: AppColors.background,
    );
  }
}
