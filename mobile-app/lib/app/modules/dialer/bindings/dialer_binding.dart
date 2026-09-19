import 'package:get/get.dart';
import '../controllers/dialer_controller.dart';

class DialerBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DialerController>(() => DialerController());
  }
}
