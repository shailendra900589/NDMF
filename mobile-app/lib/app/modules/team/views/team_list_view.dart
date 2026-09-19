import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/app_loading.dart';
import '../../../routes/app_routes.dart';
import '../controllers/team_controller.dart';

class TeamListView extends GetView<TeamController> {
  const TeamListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Team & Roles'),
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Get.toNamed(AppRoutes.teamCreate),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Create / Assign role'),
      ),
      body: Obx(() {
        if (controller.isLoading.value) return const AppLoading(message: 'Loading team…');
        if (controller.users.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No employees yet.\nCreate a Field Officer and assign branch + role.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: controller.loadTeam,
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: controller.users.length,
            itemBuilder: (_, i) {
              final u = controller.users[i];
              final role = u['role']?.toString() ?? '';
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      (u['name']?.toString() ?? '?')[0].toUpperCase(),
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                  ),
                  title: Text(u['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${u['mobile']} • ${u['branch'] ?? ''}'),
                  trailing: Chip(
                    label: Text(controller.roleLabel(role), style: const TextStyle(fontSize: 10)),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    side: BorderSide.none,
                  ),
                ),
              );
            },
          ),
        );
      }),
    );
  }
}
