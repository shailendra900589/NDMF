import 'package:flutter/material.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';

/// Status chip for customer listing / application workflow.
class ListingStatusChip extends StatelessWidget {
  const ListingStatusChip({super.key, required this.status});

  final CustomerListingStatus status;

  Color get _color {
    switch (status) {
      case CustomerListingStatus.draft:
        return AppColors.textSecondary;
      case CustomerListingStatus.branchPending:
        return Colors.blue.shade700;
      case CustomerListingStatus.adminPending:
        return Colors.deepPurple;
      case CustomerListingStatus.listed:
        return AppColors.success;
      case CustomerListingStatus.rejected:
        return AppColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.withValues(alpha: 0.35)),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
