import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/app_loading.dart';
import '../controllers/payslips_controller.dart';

class PayslipsListView extends GetView<PayslipsController> {
  const PayslipsListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Slips'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          controller.startCreate();
          Get.toNamed(AppRoutes.payslipForm);
        },
        icon: const Icon(Icons.add),
        label: const Text('New pay slip'),
      ),
      body: Obx(() {
        if (controller.isLoading.value) return const AppLoading(message: 'Loading pay slips…');
        if (controller.slips.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No pay slips yet.\nTap New pay slip to create (admin).',
                textAlign: TextAlign.center,
              ),
            ),
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
