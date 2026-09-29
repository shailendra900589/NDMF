import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/access_control.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/home/home_bottom_nav.dart';
import '../../../widgets/home/home_premium_header.dart';
import '../../../widgets/home/home_quick_actions.dart';
import '../../../widgets/home/quick_action_banner_tile.dart';
import '../../../widgets/offline_banner.dart';
import '../controllers/dashboard_controller.dart';
import 'dashboard_view.dart';

class HomeView extends GetView<DashboardController> {
  HomeView({super.key});

  final _scaffoldKey = GlobalKey<ScaffoldState>();

  void _onBottomNav(int index) {
    if (index == 0) {
      controller.homeNavIndex.value = 0;
      return;
    }
    controller.homeNavIndex.value = 0;
    switch (index) {
      case 1:
        if (AccessControl.canUseDialer) Get.toNamed(AppRoutes.dialer);
        break;
      case 2:
        if (AccessControl.canAccess('customers')) Get.toNamed(AppRoutes.customers);
        break;
      case 3:
        if (AccessControl.canAccess('customerListings')) Get.toNamed(AppRoutes.customerApplication);
        break;
      case 4:
        _showMoreSheet();
        break;
    }
  }

  void _showMoreSheet() {
    final actions = HomeQuickAction.visible();
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('More', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.person_rounded, color: AppColors.primary),
              title: const Text('Profile'),
              onTap: () {
                Get.back();
                Get.toNamed(AppRoutes.profile);
              },
            ),
            if (AccessControl.canAccess('tracking'))
              ListTile(
                leading: const Icon(Icons.map_rounded, color: AppColors.primary),
                title: const Text('Live map'),
                onTap: () {
                  Get.back();
                  Get.toNamed(AppRoutes.mapView);
                },
              ),
            ...actions.map(
              (a) => ListTile(
                leading: Icon(a.icon, color: a.color),
                title: Text(a.title),
                subtitle: Text(a.subtitle),
                onTap: () {
                  Get.back();
                  Get.toNamed(a.route);
                },
              ),
            ),
          ],
        ),
      ),
      isScrollControlled: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final showDashboard = AccessControl.showDashboard;
    return Obx(() => Scaffold(
          key: _scaffoldKey,
          backgroundColor: AppColors.background,
          drawer: Drawer(
            child: SafeArea(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  DrawerHeader(
                    decoration: BoxDecoration(gradient: LinearGradient(colors: [AppColors.primaryDark, AppColors.primary])),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(controller.userName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                        Text(controller.userRole, style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                      ],
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.home_rounded),
                    title: const Text('Dashboard'),
                    onTap: () => Navigator.pop(context),
                  ),
                  ListTile(
                    leading: const Icon(Icons.person_rounded),
                    title: const Text('Profile'),
                    onTap: () {
                      Navigator.pop(context);
                      Get.toNamed(AppRoutes.profile);
                    },
                  ),
                ],
              ),
            ),
          ),
          body: Column(
            children: [
              const OfflineBanner(),
              Expanded(
                child: showDashboard
                    ? DashboardView(
                        onMenu: () => _scaffoldKey.currentState?.openDrawer(),
                        onNotifications: () => Get.snackbar('Notifications', 'No new alerts'),
                        onProfile: () => Get.toNamed(AppRoutes.profile),
                      )
                    : _QuickActionsOnly(
                        onMenu: () => _scaffoldKey.currentState?.openDrawer(),
                        onNotifications: () => Get.snackbar('Notifications', 'No new alerts'),
                        onProfile: () => Get.toNamed(AppRoutes.profile),
                      ),
              ),
            ],
          ),
          bottomNavigationBar: HomeBottomNav(
            currentIndex: controller.homeNavIndex.value,
            onTap: _onBottomNav,
            showDialer: AccessControl.canUseDialer,
            showCustomers: AccessControl.canAccess('customers'),
            showApplications: AccessControl.canAccess('customerListings'),
          ),
        ));
  }
}

class _QuickActionsOnly extends GetView<DashboardController> {
  const _QuickActionsOnly({
    required this.onMenu,
    required this.onNotifications,
    required this.onProfile,
  });

  final VoidCallback onMenu;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    final actions = HomeQuickAction.visible();
    if (actions.isEmpty) {
      return Column(
        children: [
          HomePremiumHeader(
            roleLabel: controller.userRole,
            branch: controller.userBranch,
            avatarLetter: controller.avatarLetter,
            onMenu: onMenu,
            onNotifications: onNotifications,
            onProfile: onProfile,
          ),
          const Expanded(child: NoPermissionsState()),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        HomePremiumHeader(
          roleLabel: controller.userRole,
          branch: controller.userBranch,
          avatarLetter: controller.avatarLetter,
          onMenu: onMenu,
          onNotifications: onNotifications,
          onProfile: onProfile,
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.55,
            ),
            itemCount: actions.length,
            itemBuilder: (context, index) {
              final a = actions[index];
              return QuickActionBannerTile(
                index: index,
                title: a.title,
                subtitle: a.subtitle,
                icon: a.icon,
                color: a.color,
                onTap: () => Get.toNamed(a.route),
              );
            },
          ),
        ),
      ],
    );
  }
}
