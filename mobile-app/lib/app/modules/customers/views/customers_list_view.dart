import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../theme/app_tokens.dart';
import '../../../routes/app_routes.dart';
import '../controllers/customers_controller.dart';

class CustomersListView extends GetView<CustomersController> {
  const CustomersListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8F4F8),
      appBar: CustomAppBar(
        title: 'Customers',
        subtitle: 'Master data',
        actions: [
          IconButton(
            icon: const Icon(Icons.history_rounded),
            onPressed: () => Get.toNamed(AppRoutes.callHistory),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search customers...',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: controller.onSearch,
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                const _CustomerFilterChip('All', CustomerFilter.all),
                const _CustomerFilterChip('Recent', CustomerFilter.recent),
                const _CustomerFilterChip('With Location', CustomerFilter.withLocation),
              ],
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) return const ListSkeleton();
              if (controller.customers.isEmpty) {
                return const EmptyState(title: 'No customers', message: 'Try another search.', icon: Icons.people_outline);
              }
              return ListView.builder(
                itemCount: controller.customers.length,
                itemBuilder: (context, index) {
                  final customer = controller.customers[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF0277BD).withValues(alpha: 0.15),
                        child: Text(customer.name[0], style: const TextStyle(color: Color(0xFF0277BD))),
                      ),
                      title: Text(customer.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(customer.mobile),
                      trailing: IconButton(
                        icon: const Icon(Icons.phone, color: AppColors.success),
                        onPressed: () => controller.callCustomer(customer.name, customer.mobile),
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

class _CustomerFilterChip extends GetView<CustomersController> {
  final String label;
  final CustomerFilter filter;
  const _CustomerFilterChip(this.label, this.filter);

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final selected = controller.selectedFilter.value == filter;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: FilterChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => controller.setFilter(filter),
          selectedColor: AppColors.primary.withValues(alpha: 0.2),
        ),
      );
    });
  }
}
