import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../routes/app_routes.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/tracking_controller.dart';

class TrackingView extends GetView<TrackingController> {
  const TrackingView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: CustomAppBar(
          title: 'GPS Duty',
          subtitle: 'Live tracking • route history',
          bottom: const TabBar(
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            tabs: [
              Tab(text: 'Live Tracking'),
              Tab(text: 'Route History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _LiveTab(controller: controller),
            _HistoryTab(controller: controller),
          ],
        ),
      ),
    );
  }
}

class _LiveTab extends StatelessWidget {
  const _LiveTab({required this.controller});
  final TrackingController controller;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: controller.refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
              child: Column(
                children: [
                  Obx(() => Icon(
                        controller.isTracking.value ? Icons.gps_fixed_rounded : Icons.gps_not_fixed_rounded,
                        size: 56,
                        color: controller.isTracking.value ? AppColors.success : AppColors.textSecondary,
                      )),
                  const SizedBox(height: 8),
                  Obx(() => Text(
                        controller.isTracking.value ? 'ON DUTY' : 'OFF DUTY',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: controller.isTracking.value ? AppColors.success : AppColors.textSecondary,
                        ),
                      )),
                  const SizedBox(height: 12),
                  Obx(() => Text(
                        '${controller.totalKmToday.value.toStringAsFixed(2)} km today',
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.primary),
                      )),
                  Obx(() => Text(
                        '${controller.routePoints.length} GPS points',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      )),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => Get.toNamed(AppRoutes.mapView),
                      icon: const Icon(Icons.map_rounded),
                      label: const Text('Open live map'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({required this.controller});
  final TrackingController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.travelHistory.isEmpty) {
        return const Center(child: Text('No route history yet', style: TextStyle(color: AppColors.textSecondary)));
      }
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: controller.travelHistory.length,
        itemBuilder: (_, i) {
          final report = controller.travelHistory.reversed.elementAt(i);
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                child: const Icon(Icons.route_rounded, color: AppColors.primaryDark, size: 20),
              ),
              title: Text(DateFormat('dd MMM yyyy').format(report.date), style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text('${report.totalKm.toStringAsFixed(2)} km • ${report.routePoints.length} points'),
            ),
          );
        },
      );
    });
  }
}
