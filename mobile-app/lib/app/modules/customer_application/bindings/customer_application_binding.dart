import 'package:get/get.dart';
import '../controllers/customer_application_controller.dart';

class CustomerApplicationBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerApplicationController>(() => CustomerApplicationController());
  }
}
