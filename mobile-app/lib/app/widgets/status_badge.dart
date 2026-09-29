import 'package:flutter/material.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';
/// Premium status pill for listings and workflows.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
  });

  factory StatusBadge.listing(CustomerListingStatus status, {Key? key}) {
    return StatusBadge(key: key, label: status.label, color: _colorFor(status));
  }

  final String label;
  final Color color;

  static Color _colorFor(CustomerListingStatus status) {
    switch (status) {
      case CustomerListingStatus.draft:
        return AppColors.textSecondary;
      case CustomerListingStatus.branchPending:
      case CustomerListingStatus.adminPending:
        return AppColors.warning;
      case CustomerListingStatus.listed:
        return AppColors.success;
      case CustomerListingStatus.rejected:
        return AppColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.2),
      ),
    );
  }
}
