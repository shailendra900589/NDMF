import 'package:get/get.dart';
import '../controllers/customer_application_controller.dart';
import '../controllers/customer_application_hub_controller.dart';

class CustomerApplicationBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerApplicationHubController>(() => CustomerApplicationHubController());
    Get.lazyPut<CustomerApplicationController>(() => CustomerApplicationController());
  }
}
