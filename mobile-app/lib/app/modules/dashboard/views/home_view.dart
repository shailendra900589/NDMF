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
    if (AccessControl.canAccess('customerListings')) {
      actions.add(_ActionItem('Customer Listing', Icons.person_search, AppRoutes.customerListing, AppColors.warning));
    }
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
    actions.add(_ActionItem('Profile', Icons.person, AppRoutes.profile, AppColors.textSecondary));

    if (actions.length <= 1) {
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
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.5,
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
                borderRadius: BorderRadius.circular(18),
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: action.color.withValues(alpha: 0.15),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: action.color.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(action.icon, size: 28, color: action.color),
                  ),
                  const SizedBox(height: 10),
                  Text(action.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
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
