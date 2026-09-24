import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../controllers/payslips_controller.dart';

class PayslipFormView extends GetView<PayslipsController> {
  const PayslipFormView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(controller.editId == null ? 'New pay slip' : 'Edit pay slip')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _field(controller.nameCtrl, 'Employee name'),
            _field(controller.empNoCtrl, 'Employee ID'),
            _field(controller.deptCtrl, 'Department'),
            _field(controller.desigCtrl, 'Designation'),
            _field(controller.bankCtrl, 'Bank name'),
            _field(controller.acCtrl, 'Account number'),
            _field(controller.monthCtrl, 'Month (YYYY-MM)'),
            const SizedBox(height: 12),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Earnings', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primaryDark)),
            ),
            _field(controller.basicCtrl, 'Basic salary', number: true),
            _field(controller.hraCtrl, 'HRA', number: true),
            _field(controller.convCtrl, 'Conveyance', number: true),
            _field(controller.medCtrl, 'Medical', number: true),
            _field(controller.specCtrl, 'Special', number: true),
            const SizedBox(height: 12),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Deductions', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primaryDark)),
            ),
            _field(controller.epfCtrl, 'EPF', number: true),
            _field(controller.hiCtrl, 'Health insurance', number: true),
            _field(controller.ptCtrl, 'Professional tax', number: true),
            _field(controller.tdsCtrl, 'TDS', number: true),
            const SizedBox(height: 20),
            Obx(() => SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: controller.isSaving.value ? null : controller.save,
                    child: controller.isSaving.value
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save pay slip'),
                  ),
                )),
            const SizedBox(height: 8),
            const Text(
              'Multi-month PDF: use web admin Pay Slips for 3/6/custom months.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, {bool number = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: c,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      ),
    );
  }
}
