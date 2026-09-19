import 'package:get/get.dart';
import '../controllers/customer_listing_form_controller.dart';
import '../controllers/customer_listing_list_controller.dart';

class CustomerListingBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerListingListController>(() => CustomerListingListController());
    Get.lazyPut<CustomerListingFormController>(() => CustomerListingFormController());
  }
}
