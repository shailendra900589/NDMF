import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../routes/app_routes.dart';
import '../../../widgets/app_page_header.dart';
import '../controllers/tracking_controller.dart';

/// Read-only travel summary — tracking is tied to attendance check-in/out.
class TrackingView extends GetView<TrackingController> {
  const TrackingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Travel Route'),
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
          IconButton(
            icon: const Icon(Icons.map_outlined),
            tooltip: 'View map',
            onPressed: () => Get.toNamed(AppRoutes.mapView),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: controller.refresh,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AppGradientBanner(
                icon: Icons.access_time_filled,
                title: 'Linked to attendance',
                subtitle: 'Check in starts GPS route • Check out saves distance to dashboard',
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Obx(() => Icon(
                            controller.isTracking.value ? Icons.gps_fixed : Icons.gps_not_fixed,
                            size: 56,
                            color: controller.isTracking.value ? AppColors.success : AppColors.textSecondary,
                          )),
                      const SizedBox(height: 12),
                      Obx(() => Text(
                            controller.isTracking.value
                                ? 'Tracking active (on duty)'
                                : 'Not tracking — check in to start',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: controller.isTracking.value ? AppColors.success : AppColors.textSecondary,
                            ),
                          )),
                      const SizedBox(height: 12),
                      Obx(() => Text(
                            '${controller.totalKmToday.value.toStringAsFixed(2)} KM today',
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          )),
                      Obx(() => Text(
                            '${controller.routePoints.length} GPS points on map',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          )),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => Get.toNamed(AppRoutes.mapView),
                          icon: const Icon(Icons.map),
                          label: const Text('Open route map'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Daily travel report', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Obx(() {
                if (controller.travelHistory.isEmpty) {
                  return const Card(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('No travel history yet')),
                    ),
                  );
                }
                return Column(
                  children: controller.travelHistory.reversed.map((report) {
                    return Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: AppColors.primary,
                          child: Icon(Icons.route, color: Colors.white, size: 20),
                        ),
                        title: Text(DateFormat('dd MMM yyyy').format(report.date)),
                        subtitle: Text(
                          '${report.totalKm.toStringAsFixed(2)} KM • ${report.routePoints.length} points',
                        ),
                        trailing: report.startTime != null
                            ? Text(
                                DateFormat('hh:mm a').format(report.startTime!),
                                style: const TextStyle(fontSize: 12),
                              )
                            : null,
                      ),
                    );
                  }).toList(),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}
