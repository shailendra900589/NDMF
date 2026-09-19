import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/animated_entrance.dart';
import '../../../widgets/app_page_header.dart';
import '../../../utils/access_control.dart';
import '../controllers/customer_listing_list_controller.dart';
import '../widgets/gps_photo_tile.dart';

class CustomerListingListView extends GetView<CustomerListingListController> {
  const CustomerListingListView({super.key});

  static const _filters = <MapEntry<CustomerListingStatus?, String>>[
    MapEntry(null, 'All'),
    MapEntry(CustomerListingStatus.draft, 'Draft'),
    MapEntry(CustomerListingStatus.branchPending, 'Branch'),
    MapEntry(CustomerListingStatus.adminPending, 'Admin'),
    MapEntry(CustomerListingStatus.listed, 'Listed'),
    MapEntry(CustomerListingStatus.rejected, 'Rejected'),
  ];

  @override
  Widget build(BuildContext context) {
    final canManageTeam = AccessControl.canManageTeam;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Customer Listing'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        actions: [
          if (canManageTeam)
            IconButton(
              tooltip: 'Team & roles',
              icon: const Icon(Icons.groups_outlined),
              onPressed: () => Get.toNamed(AppRoutes.team),
            ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New listing',
            onPressed: () => Get.toNamed(AppRoutes.customerListingNew),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Get.toNamed(AppRoutes.customerListingNew),
        icon: const Icon(Icons.person_add),
        label: const Text('New Listing'),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AppGradientBanner(
            icon: Icons.storefront_outlined,
            title: 'Field customer listings',
            subtitle: 'GPS shop visit • assign to FO • create roles from Team (BM/Admin)',
          ),
          if (canManageTeam)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: OutlinedButton.icon(
                onPressed: () => Get.toNamed(AppRoutes.team),
                icon: const Icon(Icons.badge_outlined),
                label: const Text('Team — create role & assign branch'),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              onChanged: controller.onSearch,
              decoration: InputDecoration(
                hintText: 'Search by name, mobile or shop…',
                prefixIcon: const Icon(Icons.search, color: AppColors.primary),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Text('Filter by status', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppColors.textSecondary)),
          ),
          Obx(() {
            final selected = controller.selectedStatus.value;
            return SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: _filters.map((entry) {
                  final isSelected = selected == entry.key;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8, bottom: 8),
                    child: GestureDetector(
                      onTap: () => controller.filterByStatus(entry.key),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : Colors.white,
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.divider,
                            width: 1.5,
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          child: Text(
                            entry.value,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            );
          }),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) return const AppLoading(message: 'Loading listings…');
              if (controller.listings.isEmpty) {
                return const AppEmptyState(
                  icon: Icons.person_search_outlined,
                  title: 'No customer listings yet',
                  subtitle: 'Tap New Listing to add a shop visit with GPS photos.',
                );
              }
              return RefreshIndicator(
                onRefresh: controller.loadListings,
                color: AppColors.primary,
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: controller.listings.length,
                  itemBuilder: (_, i) {
                    final item = controller.listings[i];
                    return FadeSlideIn(
                      index: i.clamp(0, 8),
                      child: Card(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                            child: Text(
                              item.name.isNotEmpty ? item.name[0].toUpperCase() : '?',
                              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(
                            '${item.mobile}\n'
                            '${item.shopFullAddress.isNotEmpty ? item.shopFullAddress : '—'}'
                            '${item.assignedToName != null ? '\nAssigned: ${item.assignedToName}' : ''}',
                            maxLines: 4,
                            overflow: TextOverflow.ellipsis,
                          ),
                          isThreeLine: true,
                          trailing: CustomerListingStatusChip(status: item.status, compact: true),
                          onTap: () => controller.openDetail(item),
                        ),
                      ),
                    );
                  },
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
