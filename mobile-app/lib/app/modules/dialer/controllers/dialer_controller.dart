import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/models/customer_model.dart';
import '../../../data/repositories/customer_repository.dart';
import '../../../data/services/call_service.dart';

class DialerController extends GetxController {
  final CallService _call = Get.find<CallService>();
  final CustomerRepository _customerRepo = CustomerRepository();

  final dialedNumber = ''.obs;
  final searchQuery = ''.obs;
  final searchResults = <CustomerModel>[].obs;
  final isSearching = false.obs;
  final keypadVisible = true.obs;
  final matchedCustomer = Rxn<CustomerModel>();

  List<CustomerModel> _allCustomers = [];
  late final TextEditingController searchTextController;

  @override
  void onInit() {
    super.onInit();
    searchTextController = TextEditingController();
    _loadCustomers();
    debounce(searchQuery, (_) => _filterCustomers(), time: const Duration(milliseconds: 280));
  }

  @override
  void onClose() {
    searchTextController.dispose();
    super.onClose();
  }

  Future<void> _loadCustomers() async {
    try {
      _allCustomers = await _customerRepo.getCustomers();
      _filterCustomers();
    } catch (_) {
      _allCustomers = [];
    }
  }

  void toggleKeypad() => keypadVisible.toggle();

  CustomerModel? resolveCustomer(String mobile) {
    final d = mobile.replaceAll(RegExp(r'\D'), '');
    if (d.length < 10) return null;
    final last10 = d.substring(d.length - 10);
    for (final c in _allCustomers) {
      final cm = c.mobile.replaceAll(RegExp(r'\D'), '');
      if (cm.length >= 10 && cm.substring(cm.length - 10) == last10) return c;
    }
    return null;
  }

  void _syncMatchedCustomer() {
    matchedCustomer.value = resolveCustomer(dialedNumber.value);
  }

  bool get canPlaceCustomerCall {
    final digits = dialedNumber.value.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 10;
  }

  void _filterCustomers() {
    final q = searchQuery.value.trim().toLowerCase();
    if (q.isEmpty) {
      searchResults.clear();
      isSearching.value = false;
      return;
    }
    isSearching.value = true;
    final qDigits = q.replaceAll(RegExp(r'\D'), '');
    searchResults.value = _allCustomers.where((c) {
      final name = c.name.toLowerCase();
      final mobile = c.mobile.replaceAll(RegExp(r'\D'), '');
      return name.contains(q) ||
          c.mobile.contains(q) ||
          (qDigits.isNotEmpty && mobile.contains(qDigits));
    }).take(8).toList();
  }

  void onSearchChanged(String value) {
    searchQuery.value = value;
    if (value.trim().isEmpty) {
      searchResults.clear();
      isSearching.value = false;
    }
  }

  void selectCustomer(CustomerModel customer) {
    final d = customer.mobile.replaceAll(RegExp(r'\D'), '');
    dialedNumber.value = d.length >= 10 ? d.substring(d.length - 10) : d;
    matchedCustomer.value = customer;
    searchQuery.value = customer.name;
    searchTextController.text = customer.name;
    searchResults.clear();
    isSearching.value = false;
  }

  void appendDigit(String d) {
    if (dialedNumber.value.length < 15) dialedNumber.value += d;
    _syncMatchedCustomer();
  }

  void backspace() {
    if (dialedNumber.value.isNotEmpty) {
      dialedNumber.value = dialedNumber.value.substring(0, dialedNumber.value.length - 1);
      _syncMatchedCustomer();
    }
  }

  void clear() {
    dialedNumber.value = '';
    searchQuery.value = '';
    searchTextController.clear();
    searchResults.clear();
    isSearching.value = false;
    matchedCustomer.value = null;
  }

  Future<void> callNumber({String? number, String name = '', String? leadId}) async {
    final mobile = number ?? dialedNumber.value;
    final digits = mobile.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) {
      Get.snackbar('Invalid', 'Enter a valid 10-digit number');
      return;
    }
    final last10 = digits.length >= 10 ? digits.substring(digits.length - 10) : digits;

    final customer = resolveCustomer(mobile) ?? matchedCustomer.value;
    final displayName = customer?.name ??
        (name.isNotEmpty ? name : (matchedCustomer.value?.name ?? 'Contact $last10'));

    if (!await _call.ensureRecordingReady()) {
      Get.snackbar(
        'Recording required',
        'Allow phone, call log & microphone to call from NDFA app.',
      );
      return;
    }

    await _call.placeCustomerCall(
      mobile: last10,
      customerName: displayName,
      leadId: leadId,
    );
  }
}
