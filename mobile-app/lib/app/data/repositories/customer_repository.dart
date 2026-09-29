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

  Future<CustomerModel> createCustomer({
    required String name,
    required String mobile,
    String address = '',
    String aadhaar = '',
    String pan = '',
    double? latitude,
    double? longitude,
  }) {
    return _api.createCustomer(
      name: name,
      mobile: mobile,
      address: address,
      aadhaar: aadhaar,
      pan: pan,
      latitude: latitude,
      longitude: longitude,
    );
  }
}
