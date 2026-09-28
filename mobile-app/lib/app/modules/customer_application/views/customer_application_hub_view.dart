import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../utils/view_load_state.dart';
import '../../../widgets/approval_bottom_sheet.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/listing_approval_timeline.dart';
import '../../../widgets/listing_status_chip.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../controllers/customer_application_hub_controller.dart';

class CustomerApplicationHubView extends GetView<CustomerApplicationHubController> {
  const CustomerApplicationHubView({super.key});

  @override
  Widget build(BuildContext context) {
    final tabs = controller.showApprovalsTab ? 2 : 1;
    return DefaultTabController(
      length: tabs,
      child: Scaffold(
        appBar: CustomAppBar(
          title: 'Applications',
          subtitle: 'Customer onboarding',
          bottom: tabs > 1
              ? const TabBar(
                  tabs: [
                    Tab(text: 'All'),
                    Tab(text: 'Pending'),
                  ],
                )
              : null,
          actions: [
            IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: controller.refresh),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            final ok = await Get.toNamed<bool>(AppRoutes.customerApplicationNew);
            if (ok == true) controller.refresh();
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('New'),
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
          if (tabs > 1) {
            return TabBarView(
              children: [
                _AllTab(listings: controller.listings, onRefresh: controller.refresh),
                _PendingTab(controller: controller),
              ],
            );
          }
          return _AllTab(listings: controller.listings, onRefresh: controller.refresh);
        }),
      ),
    );
  }
}

class _AllTab extends StatelessWidget {
  const _AllTab({required this.listings, required this.onRefresh});

  final RxList<CustomerListingModel> listings;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (listings.isEmpty) {
        return const EmptyState(
          title: 'No applications',
          message: 'Tap New to submit a customer application.',
          icon: Icons.assignment_outlined,
        );
      }
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 88),
          itemCount: listings.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, i) => _ApplicationCard(listing: listings[i]),
        ),
      );
    });
  }
}

class _PendingTab extends StatelessWidget {
  const _PendingTab({required this.controller});

  final CustomerApplicationHubController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final list = controller.approvals;
      if (list.isEmpty) {
        return const EmptyState(title: 'Nothing pending', icon: Icons.task_alt_outlined);
      }
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: list.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, i) {
          final listing = list[i];
          return Material(
            color: Colors.white,
            borderRadius: AppRadii.card,
            child: InkWell(
              borderRadius: AppRadii.card,
              onTap: () async {
                final action = await showListingApprovalSheet(listing);
                if (action != null) {
                  await controller.actOnApproval(listing.id, action);
                }
              },
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: _ApplicationCard(listing: listing, showTimeline: true),
              ),
            ),
          );
        },
      );
    });
  }
}

class _ApplicationCard extends StatelessWidget {
  const _ApplicationCard({required this.listing, this.showTimeline = false});

  final CustomerListingModel listing;
  final bool showTimeline;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDecorations.surfaceCard(),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(listing.name, style: AppTextStyles.titleMedium)),
              ListingStatusChip(status: listing.status),
            ],
          ),
          const SizedBox(height: 4),
          Text(listing.mobile, style: AppTextStyles.bodyMedium),
          if (showTimeline) ListingApprovalTimeline(status: listing.status),
        ],
      ),
    );
  }
}
