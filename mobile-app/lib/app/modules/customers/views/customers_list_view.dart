import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/ndfa_search_field.dart';
import '../../../widgets/ndfa_segment_bar.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../theme/app_tokens.dart';
import '../../../routes/app_routes.dart';
import '../controllers/customers_controller.dart';

class CustomersListView extends GetView<CustomersController> {
  const CustomersListView({super.key});

  static const _segmentLabels = ['All', 'Leads', 'Verified', 'Converted'];

  int _segmentIndex(CustomerFilter f) {
    switch (f) {
      case CustomerFilter.all:
        return 0;
      case CustomerFilter.recent:
        return 1;
      case CustomerFilter.withLocation:
        return 2;
    }
  }

  CustomerFilter _filterForIndex(int i) {
    switch (i) {
      case 1:
        return CustomerFilter.recent;
      case 2:
        return CustomerFilter.withLocation;
      case 3:
        return CustomerFilter.recent;
      default:
        return CustomerFilter.all;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: 'Customers',
        subtitle: 'Master list',
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_rounded),
            tooltip: 'Add customer',
            onPressed: () {
              controller.resetAddCustomerForm();
              Get.toNamed(AppRoutes.customerAdd);
            },
          ),
          IconButton(
            icon: const Icon(Icons.history_rounded),
            onPressed: () => Get.toNamed(AppRoutes.callHistory),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          controller.resetAddCustomerForm();
          Get.toNamed(AppRoutes.customerAdd);
        },
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add customer', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          Obx(() => NdfaSegmentBar(
                labels: _segmentLabels,
                selectedIndex: _segmentIndex(controller.selectedFilter.value),
                onSelected: (i) => controller.setFilter(_filterForIndex(i)),
              )),
          NdfaSearchField(
            hint: 'Search name or mobile…',
            onChanged: controller.onSearch,
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) return const ListSkeleton();
              if (controller.customers.isEmpty) {
                return EmptyState(
                  title: 'No customers',
                  message: 'Try another search or tap Add customer.',
                  icon: Icons.people_outline,
                  actionLabel: 'Add customer',
                  onAction: () {
                    controller.resetAddCustomerForm();
                    Get.toNamed(AppRoutes.customerAdd);
                  },
                );
              }
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 24),
                itemCount: controller.customers.length,
                itemBuilder: (context, index) {
                  final customer = controller.customers[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: AppShadows.card,
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      leading: Hero(
                        tag: 'customer_${customer.id}',
                        child: CircleAvatar(
                          backgroundColor: AppColors.primary.withValues(alpha: 0.14),
                          child: Text(
                            customer.name[0],
                            style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                      title: Text(customer.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text('${customer.mobile} • ${customer.address.isNotEmpty ? customer.address.split(',').first : '—'}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text('Lead', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.accentDark)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.phone_rounded, color: AppColors.success),
                            onPressed: () => controller.callCustomer(customer.name, customer.mobile),
                          ),
                        ],
                      ),
                      onTap: () => controller.viewCustomer(customer),
                    ),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }
}
