import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response;
import '../models/user_model.dart';
import '../models/lead_model.dart';
import '../models/loan_model.dart';
import '../models/customer_model.dart';
import '../models/dashboard_stats.dart';
import '../models/attendance_model.dart';
import '../models/customer_listing_model.dart';
import 'api_constants.dart';
import 'api_service.dart';
import 'storage_service.dart';

/// Real backend API — Express server se connect karta hai.
/// Response format: { success, message, data }
class RemoteApiService extends GetxService {
  ApiService get _http => Get.find<ApiService>();
  StorageService get _storage => Get.find<StorageService>();

  Never _fail(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        throw Exception(data['message'].toString());
      }
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          throw Exception('Connection timeout. Check internet and try again.');
        case DioExceptionType.connectionError:
          throw Exception('Cannot reach server. Check internet and try again.');
        default:
          throw Exception('Request failed. Please try again.');
      }
    }
    throw e is Exception ? e : Exception(e.toString());
  }

  dynamic _unwrap(Response res) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body['success'] == true) return body['data'];
      throw Exception(body['message'] ?? 'Request failed');
    }
    throw Exception('Invalid server response');
  }

  List<Map<String, dynamic>> _unwrapList(Response res) {
    final data = _unwrap(res);
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Map<String, dynamic> _unwrapMap(Response res) {
    final data = _unwrap(res);
    return Map<String, dynamic>.from(data as Map);
  }

  // ─── Auth ───

  Future<UserModel?> login(String loginId, String password) async {
    try {
      final res = await _http.post(ApiConstants.login, data: {
        'loginId': loginId,
        'password': password,
      });
      final user = UserModel.fromJson(_unwrapMap(res));
      _storage.saveUser(user);
      return user;
    } catch (e) {
      _fail(e);
    }
  }

  Future<void> sendOtp(String loginId) async {
    try {
      await _http.post(ApiConstants.otpSend, data: {'loginId': loginId});
    } catch (e) {
      _fail(e);
    }
  }

  Future<UserModel?> verifyOtp(String loginId, String otp) async {
    try {
      final res = await _http.post(ApiConstants.otpVerify, data: {
        'loginId': loginId,
        'otp': otp,
      });
      final user = UserModel.fromJson(_unwrapMap(res));
      _storage.saveUser(user);
      return user;
    } catch (e) {
      _fail(e);
    }
  }

  // ─── Dashboard ───

  Future<DashboardStats> getDashboardStats() async {
    final res = await _http.get(ApiConstants.dashboard);
    return DashboardStats.fromJson(_unwrapMap(res));
  }

  // Lead/Loan modules removed from product — stubs keep app compiling.

  Future<List<LeadModel>> getLeads({LeadStatus? status, String? search}) async => [];

  Future<LeadModel> acceptLead(String leadId) async {
    throw Exception('Lead module is not available');
  }

  Future<LeadModel> getLeadById(String id) async {
    throw Exception('Lead module is not available');
  }

  Future<List<LoanModel>> getAllLoans({LoanStatus? status, String? search}) async => [];

  Future<LoanModel> submitLoan(LoanModel loan) async {
    throw Exception('Loan module is not available');
  }

  Future<LoanModel> saveVerification(LoanModel loan, {bool submit = false}) async {
    throw Exception('Loan module is not available');
  }

  Future<LoanModel> processApproval(String loanId, ApprovalAction action) async {
    throw Exception('Loan module is not available');
  }

  Future<List<LoanModel>> getLoansForApproval({LoanStatus? status}) async => [];

  List<LoanModel> get localLoans => [];

  // ─── Customers ───

  Future<List<CustomerModel>> getCustomers({String? search}) async {
    final res = await _http.get(ApiConstants.customers, queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _unwrapList(res).map(CustomerModel.fromJson).toList();
  }

  Future<CustomerModel> getCustomerById(String id) async {
    final res = await _http.get('${ApiConstants.customers}/$id');
    return CustomerModel.fromJson(_unwrapMap(res));
  }

  // ─── Attendance ───

  Future<AttendanceModel> markAttendance({
    required bool isCheckIn,
    required double lat,
    required double lng,
  }) async {
    final path = isCheckIn ? ApiConstants.attendanceCheckIn : ApiConstants.attendanceCheckOut;
    final res = await _http.post(path, data: {'lat': lat, 'lng': lng});
    return AttendanceModel.fromJson(_unwrapMap(res));
  }

  Future<List<AttendanceModel>> getAttendanceHistory() async {
    final res = await _http.get(ApiConstants.attendanceHistory);
    return _unwrapList(res).map(AttendanceModel.fromJson).toList();
  }

  // ─── Customer Listing ───

  Future<CustomerListingModel> submitCustomerListing(CustomerListingModel listing) async {
    final res = await _http.post(ApiConstants.customerListings, data: listing.toJson());
    return CustomerListingModel.fromJson(_unwrapMap(res));
  }

  Future<List<CustomerListingModel>> getCustomerListings({
    CustomerListingStatus? status,
    String? search,
  }) async {
    final res = await _http.get(ApiConstants.customerListings, queryParameters: {
      if (status != null) 'status': status.name,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _unwrapList(res).map(CustomerListingModel.fromJson).toList();
  }

  Future<CustomerListingModel> getListingById(String id) async {
    final res = await _http.get('${ApiConstants.customerListings}/$id');
    return CustomerListingModel.fromJson(_unwrapMap(res));
  }

  Future<List<CustomerListingModel>> getListingsForApproval({CustomerListingStatus? status}) async {
    final res = await _http.get(ApiConstants.customerListingsApproval, queryParameters: {
      if (status != null) 'status': status.name,
    });
    return _unwrapList(res).map(CustomerListingModel.fromJson).toList();
  }

  Future<CustomerListingModel> processListingApproval(String id, ApprovalAction action) async {
    final res = await _http.post(ApiConstants.approveListing, data: {
      'id': id,
      'action': action.name,
    });
    return CustomerListingModel.fromJson(_unwrapMap(res));
  }

  Future<CustomerListingModel> assignListingOfficer(
    String listingId, {
    required String employeeId,
    required String employeeName,
  }) async {
    final res = await _http.put(
      '${ApiConstants.assignListing}/$listingId/assign',
      data: {'employeeId': employeeId, 'employeeName': employeeName},
    );
    return CustomerListingModel.fromJson(_unwrapMap(res));
  }

  List<CustomerListingModel> get localListings => [];

  // ─── Users & branches (BM / Admin) ───

  Future<List<Map<String, dynamic>>> getUsers() async {
    final res = await _http.get(ApiConstants.users);
    return _unwrapList(res);
  }

  Future<Map<String, dynamic>> getUsersPermissionSchema() async {
    final res = await _http.get(ApiConstants.usersPermissionSchema);
    return _unwrapMap(res);
  }

  Future<List<Map<String, dynamic>>> getBranches() async {
    final res = await _http.get(ApiConstants.branches);
    return _unwrapList(res);
  }

  Future<Map<String, dynamic>> createUser(Map<String, dynamic> payload) async {
    final res = await _http.post(ApiConstants.users, data: payload);
    return _unwrapMap(res);
  }

  // ─── Tracking ───

  Future<Map<String, dynamic>> syncRoutePoints(List<Map<String, dynamic>> routePoints) async {
    final res = await _http.post(ApiConstants.trackingRoutePoints, data: {'routePoints': routePoints});
    return _unwrapMap(res);
  }

  Future<Map<String, dynamic>> getTrackingToday() async {
    final res = await _http.get(ApiConstants.trackingToday);
    final data = _unwrap(res);
    return data is Map ? Map<String, dynamic>.from(data) : {'totalKm': 0, 'routePoints': []};
  }

  Future<List<Map<String, dynamic>>> getTrackingHistory() async {
    final res = await _http.get(ApiConstants.trackingHistory);
    return _unwrapList(res);
  }

  // ─── Call Logs ───

  Future<void> logCall(Map<String, dynamic> callData) async {
    await _http.post(ApiConstants.callLogs, data: callData);
  }

  Future<List<Map<String, dynamic>>> getCallLogs() async {
    final res = await _http.get(ApiConstants.callLogs);
    return _unwrapList(res);
  }

  // ─── Profile ───

  Future<void> changePassword(String oldPassword, String newPassword) async {
    await _http.put(ApiConstants.changePassword, data: {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    });
  }

  Future<UserModel> updateProfile({String? name, String? photoUrl}) async {
    final res = await _http.put(ApiConstants.updateProfile, data: {
      if (name != null) 'name': name,
      if (photoUrl != null) 'photoUrl': photoUrl,
    });
    final user = UserModel.fromJson(_unwrapMap(res));
    _storage.saveUser(user);
    return user;
  }

}
