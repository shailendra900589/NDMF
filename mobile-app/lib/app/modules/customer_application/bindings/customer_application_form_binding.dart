import 'package:get/get.dart';
import '../controllers/customer_application_controller.dart';

/// Fresh controller per new-application screen (form fields must not be disposed).
class CustomerApplicationFormBinding extends Bindings {
  @override
  void dependencies() {
    if (Get.isRegistered<CustomerApplicationController>()) {
      Get.delete<CustomerApplicationController>(force: true);
    }
    Get.put(CustomerApplicationController());
  }
}
