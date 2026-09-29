import 'package:get/get.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/repositories/customer_listing_repository.dart';
import '../../../utils/access_control.dart';
import '../../../utils/api_errors.dart';
import '../../../utils/view_load_state.dart';

enum ListingUiFilter { all, newApp, inProgress, approved, pending }

class CustomerApplicationHubController extends GetxController {
  final CustomerListingRepository _repo = CustomerListingRepository();

  final listings = <CustomerListingModel>[].obs;
  final approvals = <CustomerListingModel>[].obs;
  final loadState = ViewLoadState.initial.obs;
  final isApproving = false.obs;
  final listingFilter = ListingUiFilter.all.obs;
  final searchQuery = ''.obs;

  bool get showApprovalsTab => AccessControl.isAdmin || AccessControl.isBranchManager;

  List<CustomerListingModel> get visibleListings {
    Iterable<CustomerListingModel> list = listings;
    if (listingFilter.value == ListingUiFilter.pending && showApprovalsTab) {
      list = approvals;
    } else {
      switch (listingFilter.value) {
        case ListingUiFilter.newApp:
          list = list.where((l) => l.status == CustomerListingStatus.draft);
          break;
        case ListingUiFilter.inProgress:
          list = list.where((l) =>
              l.status == CustomerListingStatus.branchPending ||
              l.status == CustomerListingStatus.adminPending);
          break;
        case ListingUiFilter.approved:
          list = list.where((l) => l.status == CustomerListingStatus.listed);
          break;
        case ListingUiFilter.pending:
          list = approvals;
          break;
        case ListingUiFilter.all:
          break;
      }
    }
    final q = searchQuery.value.trim().toLowerCase();
    if (q.isEmpty) return list.toList();
    return list
        .where((l) =>
            l.name.toLowerCase().contains(q) ||
            l.mobile.contains(q) ||
            l.id.toLowerCase().contains(q))
        .toList();
  }

  List<String> get filterLabels {
    final base = ['All', 'New', 'In Progress', 'Approved'];
    if (showApprovalsTab) return [...base, 'Pending'];
    return base;
  }

  void setFilterIndex(int index) {
    final labels = filterLabels;
    if (index < 0 || index >= labels.length) return;
    switch (labels[index]) {
      case 'New':
        listingFilter.value = ListingUiFilter.newApp;
        break;
      case 'In Progress':
        listingFilter.value = ListingUiFilter.inProgress;
        break;
      case 'Approved':
        listingFilter.value = ListingUiFilter.approved;
        break;
      case 'Pending':
        listingFilter.value = ListingUiFilter.pending;
        break;
      default:
        listingFilter.value = ListingUiFilter.all;
    }
  }

  int get filterIndex {
    switch (listingFilter.value) {
      case ListingUiFilter.newApp:
        return 1;
      case ListingUiFilter.inProgress:
        return 2;
      case ListingUiFilter.approved:
        return 3;
      case ListingUiFilter.pending:
        return showApprovalsTab ? 4 : 0;
      case ListingUiFilter.all:
        return 0;
    }
  }

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
