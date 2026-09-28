import 'package:flutter/material.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';

/// Stepper for customer application approval chain.
class ListingApprovalTimeline extends StatelessWidget {
  const ListingApprovalTimeline({super.key, required this.status});

  final CustomerListingStatus status;

  int get _step {
    switch (status) {
      case CustomerListingStatus.draft:
        return 0;
      case CustomerListingStatus.branchPending:
        return 1;
      case CustomerListingStatus.adminPending:
        return 2;
      case CustomerListingStatus.listed:
        return 3;
      case CustomerListingStatus.rejected:
        return -1;
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = ['Submitted', 'Branch', 'Admin', 'Listed'];
    final step = _step;
    final rejected = status == CustomerListingStatus.rejected;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: List.generate(labels.length * 2 - 1, (i) {
          if (i.isOdd) {
            final idx = i ~/ 2;
            final done = !rejected && idx < step;
            return Expanded(
              child: Container(
                height: 2,
                color: done ? AppColors.primary : AppColors.divider,
              ),
            );
          }
          final idx = i ~/ 2;
          final done = !rejected && idx < step;
          final current = !rejected && idx == step;
          return Column(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: rejected && idx == 1
                    ? AppColors.error
                    : done
                        ? AppColors.primary
                        : current
                            ? AppColors.accent
                            : AppColors.divider,
                child: Icon(
                  rejected && idx == 1 ? Icons.close : done ? Icons.check : Icons.circle,
                  size: done ? 14 : 8,
                  color: done || current ? Colors.white : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                labels[idx],
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: current ? FontWeight.w700 : FontWeight.w500,
                  color: current ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}
