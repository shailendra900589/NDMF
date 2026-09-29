import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/call_service.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../widgets/animated_entrance.dart';
import '../../../widgets/ndfa_segment_bar.dart';
import '../../../widgets/streaming_recording_player.dart';
import '../../../widgets/call_log_detail_sheet.dart';
import '../controllers/customers_controller.dart';

class CallHistoryView extends GetView<CustomersController> {
  const CallHistoryView({super.key});

  @override
  Widget build(BuildContext context) {
    final callService = Get.find<CallService>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: 'Call history',
        subtitle: 'Recordings & sync',
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
          Obx(() => NdfaSegmentBar(
                labels: const ['All', 'Outgoing', 'Incoming', 'Missed'],
                selectedIndex: controller.callLogFilter.value.index,
                onSelected: (i) => controller.callLogFilter.value = CallLogFilter.values[i],
              )),
          Expanded(
            child: Obx(() {
              if (controller.isLoadingLogs.value) {
                return const ListSkeleton();
              }
              final logs = controller.filteredCallLogs;
              if (logs.isEmpty) {
                return const EmptyState(
                  icon: Icons.call_outlined,
                  title: 'No call logs yet',
                  message: 'Outgoing calls from Dialer appear here with duration and recording.',
                );
              }
              return RefreshIndicator(
                onRefresh: controller.loadCallLogs,
                color: AppColors.primary,
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: logs.length,
                  itemBuilder: (context, index) {
                    final log = logs[index];
                    return FadeSlideIn(
                      index: index.clamp(0, 8),
                      child: Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => CallLogDetailSheet.show(
                            log: log,
                            onSave: (s) => controller.saveCallNotes(log, s),
                            onCallBack: () => controller.callCustomer(log.customerName, log.mobile),
                          ),
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
