import 'package:get/get.dart';
import '../models/customer_model.dart';
import '../services/ndfa_api_service.dart';

class CustomerRepository {
  NdfaApiService get _api => Get.find<NdfaApiService>();

  Future<List<CustomerModel>> getCustomers({String? search}) {
    return _api.getCustomers(search: search);
  }

  Future<CustomerModel> getCustomerById(String id) {
    return _api.getCustomerById(id);
  }
}
