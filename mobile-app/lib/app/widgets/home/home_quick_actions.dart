import 'package:flutter/material.dart';
import '../../routes/app_routes.dart';
import '../../utils/access_control.dart';

class HomeQuickAction {
  const HomeQuickAction({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.route,
    required this.color,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String route;
  final Color color;

  static List<HomeQuickAction> visible() {
    final actions = <HomeQuickAction>[];
    if (AccessControl.canAccess('customers')) {
      actions.add(const HomeQuickAction(
        title: 'Customers',
        subtitle: 'Master list',
        icon: Icons.people_rounded,
        route: AppRoutes.customers,
        color: Color(0xFF26A69A),
      ));
    }
    if (AccessControl.canAccess('attendance')) {
      actions.add(const HomeQuickAction(
        title: 'Attendance',
        subtitle: 'Face + GPS',
        icon: Icons.fingerprint_rounded,
        route: AppRoutes.attendance,
        color: Color(0xFF66BB6A),
      ));
    }
    if (AccessControl.canAccess('tracking')) {
      actions.add(const HomeQuickAction(
        title: 'GPS Tracking',
        subtitle: 'Live map & routes',
        icon: Icons.map_outlined,
        route: AppRoutes.tracking,
        color: Color(0xFF42A5F5),
      ));
    }
    if (AccessControl.canManageTeam) {
      actions.add(const HomeQuickAction(
        title: 'Team',
        subtitle: 'Your employees',
        icon: Icons.badge_outlined,
        route: AppRoutes.team,
        color: Color(0xFF3949AB),
      ));
    }
    return actions;
  }
}
