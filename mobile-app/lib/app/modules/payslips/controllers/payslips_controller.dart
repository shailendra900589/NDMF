import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../utils/api_errors.dart';

class PayslipsController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();

  final slips = <Map<String, dynamic>>[].obs;
  final isLoading = false.obs;
  final isSaving = false.obs;

  final nameCtrl = TextEditingController();
  final empNoCtrl = TextEditingController();
  final deptCtrl = TextEditingController();
  final desigCtrl = TextEditingController();
  final bankCtrl = TextEditingController();
  final acCtrl = TextEditingController();
  final monthCtrl = TextEditingController();
  final basicCtrl = TextEditingController();
  final hraCtrl = TextEditingController();
  final convCtrl = TextEditingController();
  final medCtrl = TextEditingController();
  final specCtrl = TextEditingController();
  final epfCtrl = TextEditingController();
  final hiCtrl = TextEditingController();
  final ptCtrl = TextEditingController();
  final tdsCtrl = TextEditingController();

  String? editId;

  @override
  void onInit() {
    super.onInit();
    loadList();
  }

  @override
  void onClose() {
    nameCtrl.dispose();
    empNoCtrl.dispose();
    deptCtrl.dispose();
    desigCtrl.dispose();
    bankCtrl.dispose();
    acCtrl.dispose();
    monthCtrl.dispose();
    basicCtrl.dispose();
    hraCtrl.dispose();
    convCtrl.dispose();
    medCtrl.dispose();
    specCtrl.dispose();
    epfCtrl.dispose();
    hiCtrl.dispose();
    ptCtrl.dispose();
    tdsCtrl.dispose();
    super.onClose();
  }

  Future<void> loadList() async {
    isLoading.value = true;
    try {
      slips.value = await _api.getPayslips();
      slips.sort((a, b) => (b['month'] ?? '').toString().compareTo((a['month'] ?? '').toString()));
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    } finally {
      isLoading.value = false;
    }
  }

  void startCreate() {
    editId = null;
    nameCtrl.clear();
    empNoCtrl.clear();
    deptCtrl.clear();
    desigCtrl.clear();
    bankCtrl.clear();
    acCtrl.clear();
    final now = DateTime.now();
    monthCtrl.text = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    basicCtrl.clear();
    hraCtrl.clear();
    convCtrl.clear();
    medCtrl.clear();
    specCtrl.clear();
    epfCtrl.clear();
    hiCtrl.clear();
    ptCtrl.clear();
    tdsCtrl.clear();
  }

  void startEdit(Map<String, dynamic> slip) {
    editId = slip['id']?.toString();
    nameCtrl.text = slip['employeeName']?.toString() ?? '';
    empNoCtrl.text = slip['employeeNo']?.toString() ?? '';
    deptCtrl.text = slip['department']?.toString() ?? '';
    desigCtrl.text = slip['designation']?.toString() ?? '';
    bankCtrl.text = slip['bankName']?.toString() ?? '';
    acCtrl.text = slip['accountNo']?.toString() ?? '';
    monthCtrl.text = slip['month']?.toString() ?? '';
    final e = slip['earnings'] as Map? ?? {};
    final d = slip['deductions'] as Map? ?? {};
    basicCtrl.text = '${e['basic'] ?? ''}';
    hraCtrl.text = '${e['hra'] ?? ''}';
    convCtrl.text = '${e['conveyance'] ?? ''}';
    medCtrl.text = '${e['medical'] ?? ''}';
    specCtrl.text = '${e['special'] ?? ''}';
    epfCtrl.text = '${d['epf'] ?? ''}';
    hiCtrl.text = '${d['healthInsurance'] ?? ''}';
    ptCtrl.text = '${d['professionalTax'] ?? ''}';
    tdsCtrl.text = '${d['tds'] ?? ''}';
  }

  double _n(TextEditingController c) => double.tryParse(c.text.trim()) ?? 0;

  Map<String, dynamic> _payload() => {
        'employeeName': nameCtrl.text.trim(),
        'employeeNo': empNoCtrl.text.trim(),
        'department': deptCtrl.text.trim(),
        'designation': desigCtrl.text.trim(),
        'bankName': bankCtrl.text.trim(),
        'accountNo': acCtrl.text.trim(),
        'month': monthCtrl.text.trim(),
        'earnings': {
          'basic': _n(basicCtrl),
          'hra': _n(hraCtrl),
          'conveyance': _n(convCtrl),
          'medical': _n(medCtrl),
          'special': _n(specCtrl),
        },
        'deductions': {
          'epf': _n(epfCtrl),
          'healthInsurance': _n(hiCtrl),
          'professionalTax': _n(ptCtrl),
          'tds': _n(tdsCtrl),
        },
      };

  Future<void> save() async {
    if (nameCtrl.text.trim().isEmpty || empNoCtrl.text.trim().isEmpty) {
      Get.snackbar('Validation', 'Name and Employee ID required');
      return;
    }
    if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(monthCtrl.text.trim())) {
      Get.snackbar('Validation', 'Month must be YYYY-MM');
      return;
    }
    isSaving.value = true;
    try {
      await _api.savePayslip(_payload(), id: editId);
      Get.back();
      Get.snackbar('Saved', 'Pay slip saved');
      await loadList();
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> remove(String id) async {
    try {
      await _api.deletePayslip(id);
      await loadList();
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    }
  }
}
