import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../theme/app_tokens.dart';
import '../../../routes/app_routes.dart';
import '../../../data/services/tracking_service.dart';
import '../controllers/attendance_controller.dart';

class AttendanceView extends GetView<AttendanceController> {
  const AttendanceView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: CustomAppBar(
          title: 'Attendance',
          subtitle: 'Face verify + GPS',
          bottom: TabBar(
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            tabs: const [
              Tab(text: 'Check In / Out'),
              Tab(text: 'History'),
            ],
          ),
        ),
        body: Obx(() {
          if (controller.isLoading.value) return const ListSkeleton(itemCount: 3);
          return TabBarView(
            children: [
              const _CheckTab(),
              const _HistoryTab(),
            ],
          );
        }),
      ),
    );
  }
}

class _CheckTab extends GetView<AttendanceController> {
  const _CheckTab();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: controller.loadHistory,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: AppRadii.card,
                boxShadow: AppShadows.card,
              ),
              child: Column(
                children: [
                  Icon(
                    controller.canCheckOut ? Icons.check_circle_rounded : Icons.schedule_rounded,
                    size: 56,
                    color: controller.canCheckOut ? AppColors.success : AppColors.textSecondary,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    controller.canCheckOut ? 'Checked In' : 'Not Checked In',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    DateFormat('EEEE, dd MMM yyyy • hh:mm a').format(DateTime.now()),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 20),
                  _TrackingToggle(),
                  const SizedBox(height: 16),
                  Container(
                    height: 140,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: AppRadii.card,
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.map_rounded, color: AppColors.primary, size: 36),
                          const SizedBox(height: 8),
                          const Text('GPS location captured on check-in', style: TextStyle(fontWeight: FontWeight.w600)),
                          TextButton(onPressed: () => Get.toNamed(AppRoutes.mapView), child: const Text('Open map')),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 58,
              child: FilledButton.icon(
                onPressed: controller.canCheckIn && !controller.isProcessing.value ? controller.checkIn : null,
                icon: const Icon(Icons.fingerprint_rounded, size: 28),
                label: const Text('Check In', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                style: FilledButton.styleFrom(backgroundColor: AppColors.success, shape: RoundedRectangleBorder(borderRadius: AppRadii.button)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 58,
              child: FilledButton.icon(
                onPressed: controller.canCheckOut && !controller.isProcessing.value ? controller.checkOut : null,
                icon: const Icon(Icons.logout_rounded, size: 26),
                label: const Text('Check Out', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                style: FilledButton.styleFrom(backgroundColor: AppColors.error, shape: RoundedRectangleBorder(borderRadius: AppRadii.button)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryTab extends GetView<AttendanceController> {
  const _HistoryTab();

  @override
  Widget build(BuildContext context) {
    if (controller.history.isEmpty) {
      return const Center(child: Text('No attendance records'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: controller.history.length,
      itemBuilder: (_, i) {
        final a = controller.history[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: a.status == 'Present' ? AppColors.success.withValues(alpha: 0.15) : AppColors.error.withValues(alpha: 0.15),
              child: Icon(a.status == 'Present' ? Icons.check : Icons.close, color: a.status == 'Present' ? AppColors.success : AppColors.error),
            ),
            title: Text(DateFormat('dd MMM yyyy').format(a.date)),
            subtitle: Text(
              'In: ${a.checkInTime != null ? DateFormat('hh:mm a').format(a.checkInTime!) : '-'} | '
              'Out: ${a.checkOutTime != null ? DateFormat('hh:mm a').format(a.checkOutTime!) : '-'}',
            ),
          ),
        );
      },
    );
  }
}

class _TrackingToggle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tracking = Get.find<TrackingService>();
    return Obx(() => SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Auto GPS tracking', style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(tracking.isTracking.value ? 'On duty — live pings' : 'Starts with attendance check-in'),
          value: tracking.isTracking.value,
          activeThumbColor: AppColors.primary,
          onChanged: null,
        ));
  }
}
