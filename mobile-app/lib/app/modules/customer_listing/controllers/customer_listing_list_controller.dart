import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../routes/app_routes.dart';
import '../../../data/repositories/customer_listing_repository.dart';
import '../../../utils/access_control.dart';

class CustomerListingListController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();
  final NdfaApiService _api = Get.find<NdfaApiService>();

  final listings = <CustomerListingModel>[].obs;
  final fieldOfficers = <Map<String, dynamic>>[].obs;
  final isLoading = false.obs;
  final isAssigning = false.obs;
  final searchQuery = ''.obs;
  final selectedStatus = Rxn<CustomerListingStatus>();

  bool get canAssign => AccessControl.canManageTeam;

  @override
  void onInit() {
    super.onInit();
    loadListings();
    if (canAssign) loadFieldOfficers();
  }

  Future<void> loadListings() async {
    isLoading.value = true;
    try {
      listings.value = await _repo.getListings(
        status: selectedStatus.value,
        search: searchQuery.value.isEmpty ? null : searchQuery.value,
      );
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadFieldOfficers() async {
    try {
      final all = await _api.getUsers();
      fieldOfficers.value =
          all.where((u) => u['role'] == 'fieldOfficer' && u['isActive'] != false).toList();
    } catch (_) {
      fieldOfficers.clear();
    }
  }

  void onSearch(String q) {
    searchQuery.value = q;
    loadListings();
  }

  void filterByStatus(CustomerListingStatus? status) {
    selectedStatus.value = status;
    loadListings();
  }

  void openDetail(CustomerListingModel listing) {
    Get.toNamed(AppRoutes.customerListingDetail, arguments: listing);
  }

  Future<CustomerListingModel?> assignOfficer(
    CustomerListingModel listing, {
    required String employeeId,
    required String employeeName,
  }) async {
    isAssigning.value = true;
    try {
      final updated = await _repo.assignOfficer(
        listing.id,
        employeeId: employeeId,
        employeeName: employeeName,
      );
      final idx = listings.indexWhere((e) => e.id == listing.id);
      if (idx >= 0) listings[idx] = updated;
      Get.snackbar('Assigned', 'Listing assigned to $employeeName');
      return updated;
    } catch (e) {
      Get.snackbar('Assign failed', e.toString());
      return null;
    } finally {
      isAssigning.value = false;
    }
  }
}
