import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../data/models/customer_model.dart';
import '../../../data/models/call_log_model.dart';
import '../../../data/repositories/customer_repository.dart';
import '../../../data/services/call_service.dart';
import '../../../routes/app_routes.dart';

enum CustomerFilter { all, recent, withLocation }

class CustomersController extends GetxController {
  final CustomerRepository _repo = CustomerRepository();
  final CallService _callService = Get.find<CallService>();

  final customers = <CustomerModel>[].obs;
  final callLogs = <CallLogModel>[].obs;
  final isLoading = false.obs;
  final isLoadingLogs = false.obs;
  final searchQuery = ''.obs;
  final selectedFilter = CustomerFilter.all.obs;
  List<CustomerModel> _allCustomers = [];

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
