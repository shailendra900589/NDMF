import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/access_control.dart';
import '../../../widgets/offline_banner.dart';
import '../../../widgets/animated_entrance.dart';
import '../controllers/dashboard_controller.dart';
import 'dashboard_view.dart';

class HomeView extends GetView<DashboardController> {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() => Scaffold(
          appBar: AppBar(
            title: const Text('Nirmaldhara Micro Foundation'),
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
              if (AccessControl.canUseDialer)
                IconButton(
                  icon: const Icon(Icons.dialpad),
                  tooltip: 'Dialer',
                  onPressed: () => Get.toNamed(AppRoutes.dialer),
                ),
              IconButton(
                icon: const Icon(Icons.person_outline),
                onPressed: () => Get.toNamed(AppRoutes.profile),
              ),
            ],
          ),
          body: Column(
            children: [
              const OfflineBanner(),
              Expanded(
                child: IndexedStack(
                  index: controller.selectedNavIndex.value,
                  children: const [
                    DashboardView(),
                    _QuickActionsPage(),
                  ],
                ),
              ),
            ],
          ),
          bottomNavigationBar: BottomNavigationBar(
            currentIndex: controller.selectedNavIndex.value,
            onTap: (i) => controller.selectedNavIndex.value = i,
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
              BottomNavigationBarItem(icon: Icon(Icons.apps), label: 'Quick Actions'),
            ],
          ),
        ));
  }
}

class _QuickActionsPage extends StatelessWidget {
  const _QuickActionsPage();

  @override
  Widget build(BuildContext context) {
    final actions = <_ActionItem>[];
    if (AccessControl.canAccess('payslips')) {
      actions.add(_ActionItem('Pay Slips', Icons.receipt_long, AppRoutes.payslips, Colors.deepPurple));
    }
    if (AccessControl.canUseDialer) {
      actions.add(_ActionItem('Dialer', Icons.dialpad, AppRoutes.dialer, AppColors.error));
    }
    if (AccessControl.canAccess('customers')) {
      actions.add(_ActionItem('Customers', Icons.people, AppRoutes.customers, AppColors.primaryDark));
    }
    if (AccessControl.canAccess('attendance')) {
      actions.add(_ActionItem('Attendance', Icons.access_time, AppRoutes.attendance, AppColors.success));
    }
    if (AccessControl.canAccess('tracking')) {
      actions.add(_ActionItem('GPS Tracking', Icons.route, AppRoutes.tracking, Colors.teal));
    }
    if (AccessControl.canUseDialer) {
      actions.add(_ActionItem('Call History', Icons.call, AppRoutes.callHistory, AppColors.accentDark));
    }
    if (AccessControl.canManageTeam) {
      actions.add(_ActionItem('Team & Users', Icons.badge_outlined, AppRoutes.team, Colors.indigo));
    }

    if (actions.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'No modules assigned to your account.\nContact admin for access.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.35,
      ),
      itemCount: actions.length,
      itemBuilder: (context, index) {
        final action = actions[index];
        return FadeSlideIn(
          index: index,
          child: PressScale(
            onTap: () => Get.toNamed(action.route),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: Colors.white,
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: action.color.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(action.icon, size: 26, color: action.color),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      action.title,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        height: 1.2,
                        color: Color(0xFF1A2E28),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ActionItem {
  final String title;
  final IconData icon;
  final String route;
  final Color color;
  _ActionItem(this.title, this.icon, this.route, this.color);
}
