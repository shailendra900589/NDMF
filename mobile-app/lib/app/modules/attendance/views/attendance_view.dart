import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/app_loading.dart';
import '../../../routes/app_routes.dart';
import '../../../data/services/tracking_service.dart';
import '../controllers/attendance_controller.dart';

class AttendanceView extends GetView<AttendanceController> {
  const AttendanceView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Attendance'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: Obx(() {
        if (controller.isLoading.value) return const AppLoading();
        return RefreshIndicator(
          onRefresh: controller.loadHistory,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Text(DateFormat('EEEE, dd MMMM yyyy').format(DateTime.now()),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                        Text(DateFormat('hh:mm a').format(DateTime.now()),
                            style: const TextStyle(color: AppColors.textSecondary)),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: controller.canCheckIn && !controller.isProcessing.value
                                    ? controller.checkIn
                                    : null,
                                icon: const Icon(Icons.login),
                                label: const Text('Check In'),
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: controller.canCheckOut && !controller.isProcessing.value
                                    ? controller.checkOut
                                    : null,
                                icon: const Icon(Icons.logout),
                                label: const Text('Check Out'),
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
                              ),
                            ),
                          ],
                        ),
                        if (controller.todayRecord != null) ...[
                          const SizedBox(height: 16),
                          Text('Distance from branch: ${(controller.distanceFromBranch / 1000).toStringAsFixed(2)} KM',
                              style: const TextStyle(color: AppColors.textSecondary)),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _TrackingStatusCard(),
                const SizedBox(height: 16),
                const Text('Attendance History', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (controller.history.isEmpty)
                  const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No attendance records')))
                else
                  ...controller.history.map((a) => Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: a.status == 'Present'
                                ? AppColors.success.withValues(alpha: 0.15)
                                : AppColors.error.withValues(alpha: 0.15),
                            child: Icon(
                              a.status == 'Present' ? Icons.check : Icons.close,
                              color: a.status == 'Present' ? AppColors.success : AppColors.error,
                            ),
                          ),
                          title: Text(DateFormat('dd MMM yyyy').format(a.date)),
                          subtitle: Text(
                            'In: ${a.checkInTime != null ? DateFormat('hh:mm a').format(a.checkInTime!) : '-'} | '
                            'Out: ${a.checkOutTime != null ? DateFormat('hh:mm a').format(a.checkOutTime!) : '-'}',
                          ),
                          trailing: Text(a.status, style: TextStyle(
                            color: a.status == 'Present' ? AppColors.success : AppColors.error,
                            fontWeight: FontWeight.w600,
                          )),
                        ),
                      )),
              ],
            ),
          ),
        );
      }),
    );
  }
}

class _TrackingStatusCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tracking = Get.find<TrackingService>();
    return Obx(() => Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: (tracking.isTracking.value ? AppColors.success : AppColors.textSecondary)
                  .withValues(alpha: 0.15),
              child: Icon(
                tracking.isTracking.value ? Icons.gps_fixed : Icons.gps_off,
                color: tracking.isTracking.value ? AppColors.success : AppColors.textSecondary,
              ),
            ),
            title: Text(
              tracking.isTracking.value ? 'Route tracking ON' : 'Route tracking OFF',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              tracking.isTracking.value
                  ? '${tracking.totalKmToday.value.toStringAsFixed(2)} KM today • auto with check-in'
                  : 'Check in to start GPS route for today',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Get.toNamed(AppRoutes.mapView),
          ),
        ));
  }
}
