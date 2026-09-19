import 'package:get/get.dart';
import '../models/user_model.dart';
import '../models/lead_model.dart';
import '../models/loan_model.dart';
import '../models/customer_model.dart';
import '../models/dashboard_stats.dart';
import '../models/attendance_model.dart';
import '../models/customer_listing_model.dart';
import '../models/enums/app_enums.dart';
import 'api_constants.dart';
import 'dummy_api_service.dart';
import 'remote_api_service.dart';

/// Single entry point — remote ya dummy API switch yahan hota hai.
/// ApiConstants.useRemoteApi = true → Express backend
/// ApiConstants.useRemoteApi = false → offline dummy data
class NdfaApiService extends GetxService {
  dynamic get _api => ApiConstants.useRemoteApi
      ? Get.find<RemoteApiService>()
      : Get.find<DummyApiService>();

  Future<UserModel?> login(String mobile, String password, UserRole role) =>
      _api.login(mobile, password, role);

  Future<void> sendOtp(String mobile) async {
    if (ApiConstants.useRemoteApi) {
      await Get.find<RemoteApiService>().sendOtp(mobile);
    }
  }

  Future<UserModel?> verifyOtp(String mobile, String otp, UserRole role) async {
    if (ApiConstants.useRemoteApi) {
      return Get.find<RemoteApiService>().verifyOtp(mobile, otp, role);
    }
    if (otp != '123456') throw Exception('Invalid OTP');
    return login(mobile, 'ndfa1234', role);
  }

  Future<DashboardStats> getDashboardStats() => _api.getDashboardStats();
  Future<List<LeadModel>> getLeads({LeadStatus? status, String? search}) =>
      _api.getLeads(status: status, search: search);
  Future<LeadModel> acceptLead(String leadId) => _api.acceptLead(leadId);
  Future<LeadModel> getLeadById(String id) => _api.getLeadById(id);

  Future<List<LoanModel>> getAllLoans({LoanStatus? status, String? search}) async {
    if (ApiConstants.useRemoteApi) {
      return Get.find<RemoteApiService>().getAllLoans(status: status, search: search);
    }
    return Get.find<DummyApiService>().localLoans;
  }

  Future<LoanModel> submitLoan(LoanModel loan) => _api.submitLoan(loan);
  Future<LoanModel> saveVerification(LoanModel loan, {bool submit = false}) =>
      _api.saveVerification(loan, submit: submit);
  Future<LoanModel> processApproval(String loanId, ApprovalAction action) =>
      _api.processApproval(loanId, action);
  Future<List<LoanModel>> getLoansForApproval({LoanStatus? status}) =>
      _api.getLoansForApproval(status: status);

  List<LoanModel> get localLoans =>
      ApiConstants.useRemoteApi ? [] : Get.find<DummyApiService>().localLoans;

  Future<List<CustomerModel>> getCustomers({String? search}) =>
      _api.getCustomers(search: search);
  Future<CustomerModel> getCustomerById(String id) => _api.getCustomerById(id);

  Future<AttendanceModel> markAttendance({
    required bool isCheckIn,
    required double lat,
    required double lng,
  }) => _api.markAttendance(isCheckIn: isCheckIn, lat: lat, lng: lng);

  Future<List<AttendanceModel>> getAttendanceHistory() => _api.getAttendanceHistory();

  Future<CustomerListingModel> submitCustomerListing(CustomerListingModel listing) =>
      _api.submitCustomerListing(listing);
  Future<List<CustomerListingModel>> getCustomerListings({
    CustomerListingStatus? status,
    String? search,
  }) => _api.getCustomerListings(status: status, search: search);
  Future<CustomerListingModel> getListingById(String id) => _api.getListingById(id);
  Future<List<CustomerListingModel>> getListingsForApproval({CustomerListingStatus? status}) =>
      _api.getListingsForApproval(status: status);
  Future<CustomerListingModel> processListingApproval(String id, ApprovalAction action) =>
      _api.processListingApproval(id, action);

  Future<CustomerListingModel> assignListingOfficer(
    String listingId, {
    required String employeeId,
    required String employeeName,
  }) async {
    if (!ApiConstants.useRemoteApi) throw Exception('Assign requires online API');
    return Get.find<RemoteApiService>().assignListingOfficer(
      listingId,
      employeeId: employeeId,
      employeeName: employeeName,
    );
  }

  Future<List<Map<String, dynamic>>> getUsers() async {
    if (!ApiConstants.useRemoteApi) return [];
    return Get.find<RemoteApiService>().getUsers();
  }

  Future<Map<String, dynamic>> getUsersPermissionSchema() async {
    if (!ApiConstants.useRemoteApi) {
      return {'canCreateRoles': ['fieldOfficer'], 'keys': []};
    }
    return Get.find<RemoteApiService>().getUsersPermissionSchema();
  }

  Future<List<Map<String, dynamic>>> getBranches() async {
    if (!ApiConstants.useRemoteApi) return [];
    return Get.find<RemoteApiService>().getBranches();
  }

  Future<void> createUser(Map<String, dynamic> payload) async {
    if (!ApiConstants.useRemoteApi) throw Exception('Create user requires online API');
    await Get.find<RemoteApiService>().createUser(payload);
  }

  List<CustomerListingModel> get localListings =>
      ApiConstants.useRemoteApi ? [] : Get.find<DummyApiService>().localListings;

  Future<double> getTrackingTodayKm() async {
    final data = await getTrackingToday();
    return (data['totalKm'] ?? 0).toDouble();
  }

  Future<Map<String, dynamic>> getTrackingToday() async {
    if (!ApiConstants.useRemoteApi) {
      return {'totalKm': 0, 'routePoints': []};
    }
    return Get.find<RemoteApiService>().getTrackingToday();
  }

  Future<Map<String, dynamic>> syncRoutePoints(List<Map<String, dynamic>> points) async {
    if (!ApiConstants.useRemoteApi || points.isEmpty) {
      return {'totalKm': 0, 'routePoints': points};
    }
    return Get.find<RemoteApiService>().syncRoutePoints(points);
  }

  Future<List<Map<String, dynamic>>> fetchCallLogs() async {
    if (!ApiConstants.useRemoteApi) return [];
    return Get.find<RemoteApiService>().getCallLogs();
  }

  Future<void> syncCallLog(Map<String, dynamic> data) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().logCall(data);
  }

  Future<void> changePassword(String oldPass, String newPass) async {
    if (ApiConstants.useRemoteApi) {
      await Get.find<RemoteApiService>().changePassword(oldPass, newPass);
      return;
    }
    if (oldPass.length < 4 || newPass.length < 4) throw Exception('Invalid password');
  }

  Future<void> updateProfile({String? photoUrl}) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().updateProfile(photoUrl: photoUrl);
  }

}
