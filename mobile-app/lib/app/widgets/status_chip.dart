import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../data/models/enums/app_enums.dart';

class LoanStatusChip extends StatelessWidget {
  final LoanStatus status;

  const LoanStatusChip({super.key, required this.status});

  Color get _color {
    switch (status) {
      case LoanStatus.draft:
        return AppColors.textSecondary;
      case LoanStatus.verificationPending:
        return AppColors.warning;
      case LoanStatus.branchPending:
        return Colors.blue;
      case LoanStatus.adminPending:
        return Colors.purple;
      case LoanStatus.approved:
        return AppColors.success;
      case LoanStatus.rejected:
        return AppColors.error;
      case LoanStatus.disbursed:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _color.withValues(alpha: 0.5)),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: _color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class LeadStatusChip extends StatelessWidget {
  final LeadStatus status;

  const LeadStatusChip({super.key, required this.status});

  Color get _color {
    switch (status) {
      case LeadStatus.newLead:
        return AppColors.accent;
      case LeadStatus.accepted:
        return AppColors.primary;
      case LeadStatus.converted:
        return AppColors.success;
      case LeadStatus.rejected:
        return AppColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: _color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
