import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/models/customer_listing_model.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import 'listing_approval_timeline.dart';
import 'listing_status_chip.dart';

Future<ApprovalAction?> showListingApprovalSheet(CustomerListingModel listing) {
  return Get.bottomSheet<ApprovalAction>(
    SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(listing.name, style: AppTextStyles.titleMedium.copyWith(fontSize: 18)),
                ),
                ListingStatusChip(status: listing.status),
              ],
            ),
            Text(listing.mobile, style: AppTextStyles.bodyMedium),
            const SizedBox(height: AppSpacing.sm),
            ListingApprovalTimeline(status: listing.status),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: () => Get.back(result: ApprovalAction.approve),
              child: const Text('Approve'),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: () => Get.back(result: ApprovalAction.reject),
              child: const Text('Reject'),
            ),
            TextButton(
              onPressed: () => Get.back(),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    ),
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
    ),
    isScrollControlled: true,
  );
}
