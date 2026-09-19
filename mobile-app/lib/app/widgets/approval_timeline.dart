import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../data/models/enums/app_enums.dart';

class ApprovalTimeline extends StatelessWidget {
  final LoanStatus currentStatus;

  const ApprovalTimeline({super.key, required this.currentStatus});

  int get _currentStep {
    switch (currentStatus) {
      case LoanStatus.draft:
        return 0;
      case LoanStatus.verificationPending:
        return 1;
      case LoanStatus.branchPending:
        return 2;
      case LoanStatus.adminPending:
        return 3;
      case LoanStatus.approved:
      case LoanStatus.disbursed:
        return 4;
      case LoanStatus.rejected:
        return -1;
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = ['Lead', 'Verification', 'Branch', 'Admin', 'Disbursement'];
    final current = _currentStep;
    final isRejected = currentStatus == LoanStatus.rejected;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Approval Timeline', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 16),
            Row(
              children: List.generate(steps.length * 2 - 1, (index) {
                if (index.isOdd) {
                  final stepIndex = index ~/ 2;
                  final isCompleted = !isRejected && stepIndex < current;
                  return Expanded(
                    child: Container(
                      height: 2,
                      color: isCompleted ? AppColors.primary : AppColors.divider,
                    ),
                  );
                }
                final stepIndex = index ~/ 2;
                final isCompleted = !isRejected && stepIndex < current;
                final isCurrent = !isRejected && stepIndex == current;
                final isRejectedStep = isRejected && stepIndex == 1;

                return Column(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: isRejectedStep
                          ? AppColors.error
                          : isCompleted
                              ? AppColors.primary
                              : isCurrent
                                  ? AppColors.accent
                                  : AppColors.divider,
                      child: Icon(
                        isRejectedStep
                            ? Icons.close
                            : isCompleted
                                ? Icons.check
                                : Icons.circle,
                        size: isCompleted || isRejectedStep ? 16 : 8,
                        color: isCompleted || isCurrent || isRejectedStep
                            ? Colors.white
                            : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      steps[stepIndex],
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                        color: isCurrent ? AppColors.primary : AppColors.textSecondary,
                      ),
                    ),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}
