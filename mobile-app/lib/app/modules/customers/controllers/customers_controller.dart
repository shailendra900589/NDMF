import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../data/models/customer_model.dart';
import '../../../data/models/call_log_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/repositories/customer_repository.dart';
import '../../../data/services/call_service.dart';
import '../../../routes/app_routes.dart';

enum CustomerFilter { all, recent, withLocation }

enum CallLogFilter { all, outgoing, incoming, missed }

class CustomersController extends GetxController {
  final CustomerRepository _repo = CustomerRepository();
  final CallService _callService = Get.find<CallService>();

  final customers = <CustomerModel>[].obs;
  final callLogs = <CallLogModel>[].obs;
  final isLoading = false.obs;
  final isLoadingLogs = false.obs;
  final searchQuery = ''.obs;
  final selectedFilter = CustomerFilter.all.obs;
  final callLogFilter = CallLogFilter.all.obs;
  final isSavingCustomer = false.obs;
  List<CustomerModel> _allCustomers = [];

  final addNameCtrl = TextEditingController();
  final addMobileCtrl = TextEditingController();
  final addAddressCtrl = TextEditingController();
  final addAadhaarCtrl = TextEditingController();
  final addPanCtrl = TextEditingController();
  final RxnDouble addLatitude = RxnDouble();
  final RxnDouble addLongitude = RxnDouble();

  @override
  void onClose() {
    addNameCtrl.dispose();
    addMobileCtrl.dispose();
    addAddressCtrl.dispose();
    addAadhaarCtrl.dispose();
    addPanCtrl.dispose();
    super.onClose();
  }

  void resetAddCustomerForm() {
    addNameCtrl.clear();
    addMobileCtrl.clear();
    addAddressCtrl.clear();
    addAadhaarCtrl.clear();
    addPanCtrl.clear();
    addLatitude.value = null;
    addLongitude.value = null;
  }

  Future<void> createCustomer() async {
    final name = addNameCtrl.text.trim();
    final mobile = addMobileCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (name.isEmpty) {
      Get.snackbar('Validation', 'Customer name required');
      return;
    }
    if (mobile.length < 10) {
      Get.snackbar('Validation', 'Enter valid 10-digit mobile');
      return;
    }
    isSavingCustomer.value = true;
    try {
      final customer = await _repo.createCustomer(
        name: name,
        mobile: mobile.length > 10 ? mobile.substring(mobile.length - 10) : mobile,
        address: addAddressCtrl.text.trim(),
        aadhaar: addAadhaarCtrl.text.trim(),
        pan: addPanCtrl.text.trim().toUpperCase(),
        latitude: addLatitude.value,
        longitude: addLongitude.value,
      );
      Get.back();
      resetAddCustomerForm();
      await loadCustomers();
      Get.snackbar('Success', '${customer.name} added');
    } catch (e) {
      Get.snackbar('Error', e.toString().replaceFirst('Exception: ', ''));
    } finally {
      isSavingCustomer.value = false;
    }
  }

  @override
  void onInit() {
    super.onInit();
    loadCustomers();
    loadCallLogs();
    ever<List<CallLogModel>>(_callService.recentLogs, (_) {
      if (!isLoadingLogs.value) _refreshFromCallService();
    });
    ever<CallLogModel?>(_callService.lastCompletedCall, (log) {
      if (log != null && !isLoadingLogs.value) _refreshFromCallService();
    });
  }

  void _refreshFromCallService() {
    final next = List<CallLogModel>.from(_callService.recentLogs);
    if (callLogs.length == next.length &&
        callLogs.isNotEmpty &&
        callLogs.first.id == next.first.id) {
      return;
    }
    callLogs.assignAll(next);
  }

  Future<void> loadCustomers() async {
    isLoading.value = true;
    try {
      _allCustomers = await _repo.getCustomers(
        search: searchQuery.value.isEmpty ? null : searchQuery.value,
      );
      _applyFilter();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isLoading.value = false;
    }
  }

  void setFilter(CustomerFilter filter) {
    selectedFilter.value = filter;
    _applyFilter();
  }

  void _applyFilter() {
    var result = List<CustomerModel>.from(_allCustomers);
    switch (selectedFilter.value) {
      case CustomerFilter.recent:
        final cutoff = DateTime.now().subtract(const Duration(days: 30));
        result = result.where((c) => c.createdAt.isAfter(cutoff)).toList();
        break;
      case CustomerFilter.withLocation:
        result = result.where((c) => c.latitude != null && c.longitude != null).toList();
        break;
      case CustomerFilter.all:
        break;
    }
    customers.value = result;
  }

  void onSearch(String query) {
    searchQuery.value = query;
    loadCustomers();
  }

  void viewCustomer(CustomerModel customer) {
    Get.toNamed(AppRoutes.customerDetail, arguments: customer);
  }

  Future<void> callCustomer(String name, String mobile) async {
    if (!await _callService.ensureRecordingReady()) {
      Get.snackbar('Recording required', 'Grant phone & microphone permissions to call customers.');
      return;
    }
    await _callService.placeCustomerCall(mobile: mobile, customerName: name);
  }

  Future<void> whatsappCustomer(String mobile) async {
    final uri = Uri.parse('https://wa.me/91$mobile');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> smsCustomer(String mobile) async {
    final uri = Uri(scheme: 'sms', path: mobile);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  List<CallLogModel> get filteredCallLogs {
    switch (callLogFilter.value) {
      case CallLogFilter.outgoing:
        return callLogs.where((l) => l.type == CallType.outgoing).toList();
      case CallLogFilter.incoming:
        return callLogs.where((l) => l.type == CallType.incoming).toList();
      case CallLogFilter.missed:
        return callLogs.where((l) => l.type == CallType.missed).toList();
      case CallLogFilter.all:
        return callLogs.toList();
    }
  }

  Future<void> saveCallNotes(CallLogModel log, String summary) async {
    final ok = await _callService.updateCallSummary(log.id, summary);
    if (!ok) {
      Get.snackbar('Error', 'Could not save notes');
      return;
    }
    await loadCallLogs();
    Get.snackbar('Saved', 'Call notes updated');
  }

  List<CallLogModel> callLogsForCustomer(String mobile) {
    final m = mobile.trim();
    return filteredCallLogs.where((l) => l.mobile.trim() == m).toList();
  }

  Future<void> loadCallLogs() async {
    isLoadingLogs.value = true;
    try {
      final serverLogs = await _callService.fetchFromServer();
      callLogs.assignAll(serverLogs);
    } catch (_) {
      _callService.loadRecentLogs();
      callLogs.assignAll(_callService.recentLogs);
    } finally {
      isLoadingLogs.value = false;
    }
  }
}
