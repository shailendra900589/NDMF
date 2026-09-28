import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/repositories/customer_listing_repository.dart';
import '../../../utils/access_control.dart';
import '../../../utils/api_errors.dart';
import '../../../utils/view_load_state.dart';

class CustomerApplicationHubController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();

  final listings = <CustomerListingModel>[].obs;
  final approvals = <CustomerListingModel>[].obs;
  final loadState = ViewLoadState.initial.obs;
  final isApproving = false.obs;

  bool get showApprovalsTab => AccessControl.isAdmin || AccessControl.isBranchManager;

  @override
  void onInit() {
    super.onInit();
    refresh();
  }

  @override
  Future<void> refresh() async {
    loadState.value = ViewLoadState.loading;
    try {
      listings.value = await _repo.getListings();
      if (showApprovalsTab) {
        approvals.value = await _repo.getForApproval();
      } else {
        approvals.clear();
      }
      if (listings.isEmpty && (!showApprovalsTab || approvals.isEmpty)) {
        loadState.value = ViewLoadState.empty;
      } else {
        loadState.value = ViewLoadState.success;
      }
    } catch (e) {
      loadState.value = ViewLoadState.error;
      Get.snackbar('Error', '${apiErrorMessage(e)}\nPull to refresh or tap Retry on screen.');
    }
  }

  Future<void> actOnApproval(String id, ApprovalAction action) async {
    isApproving.value = true;
    try {
      await _repo.processApproval(id, action);
      Get.snackbar('Done', 'Application updated');
      await refresh();
    } catch (e) {
      Get.snackbar('Error', apiErrorMessage(e));
    } finally {
      isApproving.value = false;
    }
  }
}
