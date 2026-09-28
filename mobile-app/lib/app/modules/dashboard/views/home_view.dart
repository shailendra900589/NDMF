import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/access_control.dart';
import '../../../widgets/action_tile.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/offline_banner.dart';
import '../controllers/dashboard_controller.dart';
import 'dashboard_view.dart';

class HomeView extends GetView<DashboardController> {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    final showDashboard = AccessControl.showDashboard;
    return Obx(() => Scaffold(
          appBar: HomeAppBar(
            showDialer: AccessControl.canUseDialer,
            onDialer: () => Get.toNamed(AppRoutes.dialer),
            onProfile: () => Get.toNamed(AppRoutes.profile),
          ),
          body: Column(
            children: [
              const OfflineBanner(),
              Expanded(
                child: showDashboard
                    ? IndexedStack(
                        index: controller.selectedNavIndex.value,
                        children: const [
                          DashboardView(),
                          _QuickActionsPage(),
                        ],
                      )
                    : const _QuickActionsPage(),
              ),
            ],
          ),
          bottomNavigationBar: showDashboard
              ? BottomNavigationBar(
                  currentIndex: controller.selectedNavIndex.value,
                  onTap: (i) => controller.selectedNavIndex.value = i,
                  items: const [
                    BottomNavigationBarItem(icon: Icon(Icons.insights_outlined), label: 'Dashboard'),
                    BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'Quick Actions'),
                  ],
                )
              : null,
        ));
  }
}

class _QuickActionsPage extends StatelessWidget {
  const _QuickActionsPage();

  @override
  Widget build(BuildContext context) {
    final actions = <_ActionDef>[];
    if (AccessControl.canAccess('payslips')) {
      actions.add(_ActionDef('Pay Slips', 'Admin payroll', Icons.receipt_long_rounded, AppRoutes.payslips, const Color(0xFF5E35B1)));
    }
    if (AccessControl.canUseDialer) {
      actions.add(_ActionDef('Dialer', 'Outbound calls', Icons.dialpad_rounded, AppRoutes.dialer, const Color(0xFFD32F2F)));
    }
    if (AccessControl.canAccess('customerListings')) {
      actions.add(_ActionDef('Applications', 'New & approvals', Icons.assignment_add, AppRoutes.customerApplication, const Color(0xFFF9A825)));
    }
    if (AccessControl.canAccess('customers')) {
      actions.add(_ActionDef('Customers', 'Master list', Icons.people_rounded, AppRoutes.customers, const Color(0xFF00695C)));
    }
    if (AccessControl.canAccess('attendance')) {
      actions.add(_ActionDef('Attendance', 'Face + GPS', Icons.fingerprint_rounded, AppRoutes.attendance, const Color(0xFF388E3C)));
    }
    if (AccessControl.canAccess('tracking')) {
      actions.add(_ActionDef('GPS Duty', 'Live tracking', Icons.route_rounded, AppRoutes.tracking, const Color(0xFF00897B)));
    }
    if (AccessControl.canUseDialer) {
      actions.add(_ActionDef('Call History', 'Recordings', Icons.history_rounded, AppRoutes.callHistory, const Color(0xFFF57C00)));
    }
    if (AccessControl.canManageTeam) {
      actions.add(_ActionDef('Team', 'Create & assign roles', Icons.badge_outlined, AppRoutes.team, const Color(0xFF3949AB)));
    }

    if (actions.isEmpty) {
      return const NoPermissionsState();
    }

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.05,
      ),
      itemCount: actions.length,
      itemBuilder: (context, index) {
        final a = actions[index];
        return ActionTile(
          index: index,
          title: a.title,
          subtitle: a.subtitle,
          icon: a.icon,
          color: a.color,
          onTap: () => Get.toNamed(a.route),
        );
      },
    );
  }
}

class _ActionDef {
  final String title;
  final String subtitle;
  final IconData icon;
  final String route;
  final Color color;
  _ActionDef(this.title, this.subtitle, this.icon, this.route, this.color);
}
