import 'package:get/get.dart';
import 'bindings/customer_application_form_binding.dart';
import 'views/customer_application_view.dart';

/// Opens new-application wizard (reliable vs nested named routes).
class CustomerApplicationNavigation {
  CustomerApplicationNavigation._();

  static Future<bool?> openNewForm() async {
    final result = await Get.to<bool>(
      () => const CustomerApplicationView(),
      binding: CustomerApplicationFormBinding(),
      preventDuplicates: false,
    );
    return result;
  }
}
