import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/call_service.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/animated_entrance.dart';
import '../../../widgets/app_page_header.dart';
import '../../../widgets/streaming_recording_player.dart';
import '../controllers/customers_controller.dart';

class CallHistoryView extends GetView<CustomersController> {
  const CallHistoryView({super.key});

  @override
  Widget build(BuildContext context) {
    final callService = Get.find<CallService>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Call History'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        actions: [
          Obx(() => Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: Text(
                    callService.isRecording.value ? '● Recording' : 'Auto REC ON',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              )),
        ],
      ),
      body: Column(
        children: [
          const AppGradientBanner(
            icon: Icons.cloud_upload_outlined,
            title: 'Synced call logs',
            subtitle: 'Recordings stream to admin dashboard when online',
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoadingLogs.value) {
                return const AppLoading(message: 'Loading call history…');
              }
              if (controller.callLogs.isEmpty) {
                return const AppEmptyState(
                  icon: Icons.call_outlined,
                  title: 'No call logs yet',
                  subtitle: 'Outgoing calls from Dialer appear here with duration and recording.',
                );
              }
              return RefreshIndicator(
                onRefresh: controller.loadCallLogs,
                color: AppColors.primary,
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: controller.callLogs.length,
                  itemBuilder: (context, index) {
                    final log = controller.callLogs[index];
                    return FadeSlideIn(
                      index: index.clamp(0, 8),
                      child: Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    backgroundColor: _typeColor(log.type).withValues(alpha: 0.15),
                                    child: Icon(_typeIcon(log.type), color: _typeColor(log.type), size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(log.customerName, style: const TextStyle(fontWeight: FontWeight.w600)),
                                        Text(
                                          '${log.mobile} • ${log.time} • ${log.duration}',
                                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                        ),
                                        if (log.callSummary != null && log.callSummary!.isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: Text(
                                              log.callSummary!,
                                              style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  Chip(
                                    label: Text(log.type.label, style: const TextStyle(fontSize: 10)),
                                    visualDensity: VisualDensity.compact,
                                    backgroundColor: _typeColor(log.type).withValues(alpha: 0.12),
                                    side: BorderSide.none,
                                  ),
                                ],
                              ),
                              if (log.hasRecording) ...[
                                const SizedBox(height: 10),
                                const Divider(height: 1),
                                const SizedBox(height: 8),
                                StreamingRecordingPlayer(
                                  recordingUrl: log.recordingUrl,
                                  localRecordingPath: log.localRecordingPath,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Color _typeColor(CallType type) {
    switch (type) {
      case CallType.incoming:
        return AppColors.success;
      case CallType.outgoing:
        return AppColors.primary;
      case CallType.missed:
        return AppColors.error;
    }
  }

  IconData _typeIcon(CallType type) {
    switch (type) {
      case CallType.incoming:
        return Icons.call_received;
      case CallType.outgoing:
        return Icons.call_made;
      case CallType.missed:
        return Icons.call_missed;
    }
  }
}
