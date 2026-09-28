import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../controllers/payslips_controller.dart';

class PayslipsListView extends GetView<PayslipsController> {
  const PayslipsListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Pay slips', subtitle: 'Admin payroll'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          controller.startCreate();
          Get.toNamed(AppRoutes.payslipForm);
        },
        icon: const Icon(Icons.add),
        label: const Text('New pay slip'),
      ),
      body: Obx(() {
        if (controller.isLoading.value) return const ListSkeleton();
        if (controller.slips.isEmpty) {
          return const EmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'No pay slips',
            message: 'Tap New pay slip to create (admin).',
          );
        }
        return RefreshIndicator(
          onRefresh: controller.loadList,
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: controller.slips.length,
            itemBuilder: (_, i) {
              final p = controller.slips[i];
              return Card(
                child: ListTile(
                  title: Text(p['employeeName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${p['employeeNo']} • ${p['month']} • Net ₹${p['netPay'] ?? 0}'),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) {
                      if (v == 'edit') {
                        controller.startEdit(p);
                        Get.toNamed(AppRoutes.payslipForm);
                      } else if (v == 'delete') {
                        controller.remove(p['id']?.toString() ?? '');
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'edit', child: Text('Edit')),
                      PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      }),
    );
  }
}
