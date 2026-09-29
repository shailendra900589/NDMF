import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class HomeBottomNav extends StatelessWidget {
  const HomeBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.showDialer = true,
    this.showCustomers = true,
    this.showApplications = true,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool showDialer;
  final bool showCustomers;
  final bool showApplications;

  @override
  Widget build(BuildContext context) {
    final items = <_NavDef>[
      const _NavDef(0, 'Home', Icons.home_rounded),
      if (showDialer) const _NavDef(1, 'Dialer', Icons.dialpad_rounded),
      if (showCustomers) const _NavDef(2, 'Customers', Icons.people_outline_rounded),
      if (showApplications) const _NavDef(3, 'Applications', Icons.assignment_outlined),
      const _NavDef(4, 'More', Icons.grid_view_rounded),
    ];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items
                .map(
                  (d) => _NavItem(
                    label: d.label,
                    icon: d.icon,
                    selected: currentIndex == d.index,
                    onTap: () => onTap(d.index),
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
  }
}

class _NavDef {
  const _NavDef(this.index, this.label, this.icon);
  final int index;
  final String label;
  final IconData icon;
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 24, color: selected ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
