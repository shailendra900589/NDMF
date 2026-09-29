import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../utils/view_load_state.dart';
import '../../../widgets/approval_bottom_sheet.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/listing_approval_timeline.dart';
import '../../../widgets/ndfa_search_field.dart';
import '../../../widgets/ndfa_segment_bar.dart';
import '../../../widgets/status_badge.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../widgets/application_detail_sheet.dart';
import '../controllers/customer_application_hub_controller.dart';

class CustomerApplicationHubView extends GetView<CustomerApplicationHubController> {
  const CustomerApplicationHubView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Applications', subtitle: 'Customer onboarding'),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final ok = await Get.toNamed<bool>(AppRoutes.customerApplicationNew);
          if (ok == true) controller.refresh();
        },
        backgroundColor: AppColors.accent,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
      body: Obx(() {
        final state = controller.loadState.value;
        if (state == ViewLoadState.loading && controller.listings.isEmpty) {
          return const ListSkeleton();
        }
        if (state == ViewLoadState.error && controller.listings.isEmpty) {
          return EmptyState(
            title: 'Load failed',
            message: 'Check network and try again.',
            icon: Icons.wifi_off_rounded,
            actionLabel: 'Retry',
            onAction: controller.refresh,
          );
        }
        return Column(
          children: [
            NdfaSegmentBar(
              labels: controller.filterLabels,
              selectedIndex: controller.filterIndex,
              onSelected: controller.setFilterIndex,
            ),
            NdfaSearchField(
              hint: 'Search application ID, name…',
              onChanged: (v) => controller.searchQuery.value = v,
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: controller.refresh,
                child: _ApplicationList(
                  listings: controller.visibleListings,
                  isPendingMode: controller.listingFilter.value == ListingUiFilter.pending,
                ),
              ),
            ),
          ],
        );
      }),
    );
  }
}

class _ApplicationList extends GetView<CustomerApplicationHubController> {
  const _ApplicationList({required this.listings, required this.isPendingMode});

  final List<CustomerListingModel> listings;
  final bool isPendingMode;

  @override
  Widget build(BuildContext context) {
    if (listings.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 48),
          EmptyState(
            title: 'No applications',
            message: 'Tap + to submit a new customer application.',
            icon: Icons.assignment_outlined,
          ),
        ],
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 96),
      itemCount: listings.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final listing = listings[i];
        return _ApplicationCard(
          listing: listing,
          onTap: isPendingMode
              ? () async {
                  final action = await showListingApprovalSheet(listing);
                  if (action != null) await controller.actOnApproval(listing.id, action);
                }
              : () => ApplicationDetailSheet.show(listing),
        );
      },
    );
  }
}

class _ApplicationCard extends StatelessWidget {
  const _ApplicationCard({required this.listing, this.onTap});

  final CustomerListingModel listing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final initials = listing.name.isNotEmpty ? listing.name[0].toUpperCase() : '?';
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadii.card,
      elevation: 0,
      child: DecoratedBox(
        decoration: BoxDecoration(borderRadius: AppRadii.card, boxShadow: AppShadows.card),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadii.card,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                      child: Text(initials, style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(listing.id, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          Text(listing.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        ],
                      ),
                    ),
                    StatusBadge.listing(listing.status),
                  ],
                ),
                const SizedBox(height: 10),
                Text('Mobile: ${listing.mobile}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                Text(
                  'Created: ${DateFormat('dd MMM yyyy').format(listing.createdAt)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 8),
                ListingApprovalTimeline(status: listing.status),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
