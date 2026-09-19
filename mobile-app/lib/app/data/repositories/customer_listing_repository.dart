import 'package:get/get.dart';
import '../models/customer_listing_model.dart';
import '../models/enums/app_enums.dart';
import '../services/ndfa_api_service.dart';

class CustomerListingRepository {
  NdfaApiService get _api => Get.find<NdfaApiService>();

  Future<CustomerListingModel> submit(CustomerListingModel listing) =>
      _api.submitCustomerListing(listing);

  Future<List<CustomerListingModel>> getListings({
    CustomerListingStatus? status,
    String? search,
  }) =>
      _api.getCustomerListings(status: status, search: search);

  Future<CustomerListingModel> getById(String id) => _api.getListingById(id);

  Future<List<CustomerListingModel>> getForApproval({CustomerListingStatus? status}) =>
      _api.getListingsForApproval(status: status);

  Future<CustomerListingModel> processApproval(String id, ApprovalAction action) =>
      _api.processListingApproval(id, action);

  Future<CustomerListingModel> assignOfficer(
    String listingId, {
    required String employeeId,
    required String employeeName,
  }) =>
      _api.assignListingOfficer(listingId, employeeId: employeeId, employeeName: employeeName);
}
