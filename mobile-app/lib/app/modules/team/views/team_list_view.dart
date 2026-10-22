import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../routes/app_routes.dart';
import '../controllers/team_controller.dart';

class TeamListView extends GetView<TeamController> {
  const TeamListView({super.key});

  static String _initial(String? name) {
    final trimmed = (name ?? '').trim();
    if (trimmed.isEmpty) return '?';
    return trimmed[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(
        title: 'Team',
        subtitle: 'Employees in your branch',
      ),
      floatingActionButton: controller.canCreateUsers
          ? FloatingActionButton.extended(
              onPressed: () {
                controller.clearAssignState();
                Get.toNamed(AppRoutes.teamCreate);
              },
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text(
                'Add employee',
                style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
              ),
            )
          : null,
      body: Obx(() {
        if (controller.isLoading.value) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: AppColors.primary),
                SizedBox(height: 16),
                Text('Loading users…', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          );
        }
        final error = controller.loadError.value;
        if (error != null && controller.users.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.textSecondary),
                  const SizedBox(height: 12),
                  Text(error, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: controller.loadTeam, child: const Text('Retry')),
                ],
              ),
            ),
          );
        }
        if (controller.users.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No employees in your branch yet.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: controller.loadTeam,
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: controller.users.length + (controller.canCreateUsers ? 1 : 0),
            itemBuilder: (_, i) {
              if (controller.canCreateUsers && i == 0) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  color: AppColors.primary.withValues(alpha: 0.08),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.25)),
                  ),
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: AppColors.primary,
                      child: Icon(Icons.person_add_alt_1, color: Colors.white),
                    ),
                    title: const Text(
                      'Add an employee',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: const Text('Name, login ID, and what they can open'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      controller.clearAssignState();
                      Get.toNamed(AppRoutes.teamCreate);
                    },
                  ),
                );
              }
              final userIndex = controller.canCreateUsers ? i - 1 : i;
              final u = controller.users[userIndex];
              final role = u['role']?.toString() ?? '';
              final roleLabel = controller.roleLabel(role);
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.1)),
                ),
                child: ListTile(
                  onTap: controller.canAssignUsers
                      ? () async {
                          await controller.prepareAssignScreen(u);
                          if (controller.isAssignMode) {
                            await Get.toNamed(AppRoutes.teamAssign);
                          }
                        }
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    child: Text(
                      _initial(u['name']?.toString()),
                      style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.bold),
                    ),
                  ),
                  title: Text(
                    u['name']?.toString() ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF1A2E28)),
                  ),
                  subtitle: Text(
                    '${u['mobile']} • ${u['branch'] ?? ''}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  trailing: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 118),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primaryDark,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        roleLabel,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
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
}
