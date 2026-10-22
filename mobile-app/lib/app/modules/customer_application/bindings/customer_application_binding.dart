import 'package:get/get.dart';
import '../controllers/customer_application_hub_controller.dart';

class CustomerApplicationBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerApplicationHubController>(
      () => CustomerApplicationHubController(),
      fenix: true,
    );
  }
}
