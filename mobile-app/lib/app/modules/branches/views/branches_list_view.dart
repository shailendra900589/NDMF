import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../controllers/branches_controller.dart';

class BranchesListView extends GetView<BranchesController> {
  const BranchesListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(
        title: 'Locations',
        subtitle: 'Branches & offices',
      ),
      floatingActionButton: Obx(() {
        if (!controller.canCreate) return const SizedBox.shrink();
        return FloatingActionButton.extended(
          onPressed: () => _openCreateSheet(context),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_location_alt_outlined),
          label: const Text('Add location', style: TextStyle(fontWeight: FontWeight.w700)),
        );
      }),
      body: Obx(() {
        if (controller.isLoading.value) return const ListSkeleton();
        if (controller.branches.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('No locations yet.', textAlign: TextAlign.center),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: controller.loadBranches,
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: controller.branches.length,
            itemBuilder: (_, i) {
              final b = controller.branches[i];
              final active = b['isActive'] != false;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.1)),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: const Icon(Icons.location_city_outlined, color: AppColors.primaryDark),
                  ),
                  title: Text(
                    b['name']?.toString() ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    [
                      if ((b['city']?.toString() ?? '').isNotEmpty) b['city'],
                      if ((b['state']?.toString() ?? '').isNotEmpty) b['state'],
                    ].join(', '),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  trailing: Text(
                    active ? 'Active' : 'Inactive',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: active ? AppColors.success : AppColors.textSecondary,
                    ),
                  ),
                ),
              );
            },
          ),
        );
      }),
    );
  }

  void _openCreateSheet(BuildContext context) {
    controller.resetForm();
    Get.bottomSheet(
      Container(
        padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.paddingOf(context).bottom + 24),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('New location', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              TextField(controller: controller.nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
              const SizedBox(height: 12),
              TextField(controller: controller.cityCtrl, decoration: const InputDecoration(labelText: 'City')),
              const SizedBox(height: 12),
              TextField(controller: controller.stateCtrl, decoration: const InputDecoration(labelText: 'State')),
              const SizedBox(height: 12),
              TextField(controller: controller.addressCtrl, decoration: const InputDecoration(labelText: 'Address')),
              const SizedBox(height: 20),
              Obx(() => ElevatedButton(
                    onPressed: controller.isSaving.value ? null : controller.createBranch,
                    child: controller.isSaving.value
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Create location'),
                  )),
            ],
          ),
        ),
      ),
      isScrollControlled: true,
    );
  }
}
