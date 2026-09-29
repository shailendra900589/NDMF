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
    if (AccessControl.canUseDialer) {
      actions.add(const HomeQuickAction(
        title: 'Dialer',
        subtitle: 'Outbound calls',
        icon: Icons.dialpad_rounded,
        route: AppRoutes.dialer,
        color: Color(0xFFE57373),
      ));
    }
    if (AccessControl.canAccess('customerListings')) {
      actions.add(const HomeQuickAction(
        title: 'Applications',
        subtitle: 'New & approvals',
        icon: Icons.assignment_add,
        route: AppRoutes.customerApplication,
        color: Color(0xFFFFB74D),
      ));
    }
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
        title: 'GPS Duty',
        subtitle: 'Live tracking',
        icon: Icons.route_rounded,
        route: AppRoutes.tracking,
        color: Color(0xFF42A5F5),
      ));
    }
    if (AccessControl.canUseDialer) {
      actions.add(const HomeQuickAction(
        title: 'Call History',
        subtitle: 'Recordings',
        icon: Icons.history_rounded,
        route: AppRoutes.callHistory,
        color: Color(0xFF9575CD),
      ));
    }
    if (AccessControl.canAccess('payslips')) {
      actions.add(const HomeQuickAction(
        title: 'Pay Slips',
        subtitle: 'Admin payroll',
        icon: Icons.receipt_long_rounded,
        route: AppRoutes.payslips,
        color: Color(0xFF5E35B1),
      ));
    }
    if (AccessControl.canManageTeam) {
      actions.add(const HomeQuickAction(
        title: 'Team',
        subtitle: 'Roles & users',
        icon: Icons.badge_outlined,
        route: AppRoutes.team,
        color: Color(0xFF3949AB),
      ));
    }
    return actions;
  }
}
