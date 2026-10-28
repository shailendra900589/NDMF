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
import 'storage_service.dart';

/// Single entry point — remote ya dummy API switch yahan hota hai.
/// ApiConstants.useRemoteApi = true → Express backend
/// ApiConstants.useRemoteApi = false → offline dummy data
class NdfaApiService extends GetxService {
  dynamic get _api => ApiConstants.useRemoteApi
      ? Get.find<RemoteApiService>()
      : Get.find<DummyApiService>();

  Future<UserModel?> login(String loginId, String password) =>
      _api.login(loginId, password);

  Future<UserModel?> syncSession() async {
    if (!ApiConstants.useRemoteApi) return Get.find<StorageService>().getUser();
    return Get.find<RemoteApiService>().syncSession();
  }

  Future<void> sendOtp(String loginId) async {
    if (ApiConstants.useRemoteApi) {
      await Get.find<RemoteApiService>().sendOtp(loginId);
    }
  }

  Future<UserModel?> verifyOtp(String loginId, String otp) async {
    if (ApiConstants.useRemoteApi) {
      return Get.find<RemoteApiService>().verifyOtp(loginId, otp);
    }
    if (otp != '123456') throw Exception('Invalid OTP');
    return login(loginId, 'ndfa1234');
  }

  Future<DashboardStats> getDashboardStats() => _api.getDashboardStats();
  Future<List<LeadModel>> getLeads({LeadStatus? status, String? search}) =>
      _api.getLeads(status: status, search: search);
  Future<LeadModel> acceptLead(String leadId) => _api.acceptLead(leadId);
  Future<LeadModel> getLeadById(String id) => _api.getLeadById(id);

  Future<List<LoanModel>> getAllLoans(
      {LoanStatus? status, String? search}) async {
    if (ApiConstants.useRemoteApi) {
      return Get.find<RemoteApiService>()
          .getAllLoans(status: status, search: search);
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

  Future<CustomerModel> createCustomer({
    required String name,
    required String mobile,
    String address = '',
    String aadhaar = '',
    String pan = '',
    double? latitude,
    double? longitude,
    String? branch,
  }) async {
    if (!ApiConstants.useRemoteApi) {
      throw Exception('Create customer requires online API');
    }
    final user = Get.find<StorageService>().getUser();
    final userBranch = user?.branch.trim() ?? '';
    final resolvedBranch = (branch != null && branch.trim().isNotEmpty)
        ? branch.trim()
        : (userBranch.isNotEmpty
            ? userBranch
            : (address.trim().isNotEmpty ? address.trim() : 'All branches'));
    return Get.find<RemoteApiService>().createCustomer({
      'name': name,
      'mobile': mobile,
      'address': address,
      'aadhaar': aadhaar,
      'pan': pan,
      'branch': resolvedBranch,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });
  }

  Future<AttendanceModel> markAttendance({
    required bool isCheckIn,
    required double lat,
    required double lng,
    bool faceVerified = false,
    double? accuracy,
    String? gpsRecordedAt,
    bool mocked = false,
  }) =>
      _api.markAttendance(
          isCheckIn: isCheckIn,
          lat: lat,
          lng: lng,
          faceVerified: faceVerified,
          accuracy: accuracy,
          gpsRecordedAt: gpsRecordedAt,
          mocked: mocked);

  Future<List<AttendanceModel>> getAttendanceHistory() =>
      _api.getAttendanceHistory();

  Future<bool> verifyAttendanceFace(String imagePath,
      {String purpose = 'checkin'}) async {
    if (!ApiConstants.useRemoteApi) return true;
    return Get.find<RemoteApiService>()
        .verifyAttendanceFace(imagePath, purpose: purpose);
  }

  Future<Map<String, dynamic>> requestFaceChallenge(String purpose) =>
      Get.find<RemoteApiService>().requestFaceChallenge(purpose);
  Future<Map<String, dynamic>> checkFaceCapture(
          String neutral, String? action, String id) =>
      Get.find<RemoteApiService>().checkFaceCapture(neutral, action, id);
  Future<Map<String, dynamic>> verifyLiveAttendanceFace(
          String neutral, String? action, String id, String purpose) =>
      Get.find<RemoteApiService>()
          .verifyLiveAttendanceFace(neutral, action, id, purpose);

  Future<Map<String, dynamic>> getFaceEnrollmentStatus() async {
    if (!ApiConstants.useRemoteApi) return {'complete': true, 'count': 3};
    return Get.find<RemoteApiService>().getFaceEnrollmentStatus();
  }

  Future<void> saveFaceEnrollmentUrls(List<String> urls) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().saveFaceEnrollmentUrls(urls);
  }

  Future<void> resetFaceEnrollment() async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().resetFaceEnrollment();
  }

  Future<bool> setFaceAttendanceRequired(bool enabled) async {
    if (!ApiConstants.useRemoteApi) return enabled;
    return Get.find<RemoteApiService>().setFaceAttendanceRequired(enabled);
  }

  /// One GPS fix: lat, lng, accuracy (m), speed (m/s), heading, recordedAt, mocked.
  Future<Map<String, dynamic>> sendLiveTrackingPing(
      Map<String, dynamic> fix) async {
    if (!ApiConstants.useRemoteApi) return {'totalKm': 0};
    return Get.find<RemoteApiService>().sendLiveTrackingPing(fix);
  }

  Future<CustomerListingModel> submitCustomerListing(
          CustomerListingModel listing,
          {String? branch}) =>
      _api.submitCustomerListing(listing, branch: branch);
  Future<List<CustomerListingModel>> getCustomerListings({
    CustomerListingStatus? status,
    String? search,
  }) =>
      _api.getCustomerListings(status: status, search: search);
  Future<CustomerListingModel> getListingById(String id) =>
      _api.getListingById(id);
  Future<List<CustomerListingModel>> getListingsForApproval(
          {CustomerListingStatus? status}) =>
      _api.getListingsForApproval(status: status);
  Future<CustomerListingModel> processListingApproval(
          String id, ApprovalAction action) =>
      _api.processListingApproval(id, action);

  Future<CustomerListingModel> assignListingOfficer(
    String listingId, {
    required String employeeId,
    required String employeeName,
  }) async {
    if (!ApiConstants.useRemoteApi)
      throw Exception('Assign requires online API');
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
      return {
        'canCreateRoles': ['fieldOfficer'],
        'keys': []
      };
    }
    return Get.find<RemoteApiService>().getUsersPermissionSchema();
  }

  Future<List<Map<String, dynamic>>> getBranches() async {
    if (!ApiConstants.useRemoteApi) return [];
    return Get.find<RemoteApiService>().getBranches();
  }

  Future<Map<String, dynamic>> createBranch({
    required String name,
    String city = '',
    String state = '',
    String address = '',
  }) async {
    if (!ApiConstants.useRemoteApi)
      throw Exception('Create branch requires online API');
    return Get.find<RemoteApiService>().createBranch({
      'name': name,
      'city': city,
      'state': state,
      'address': address,
    });
  }

  Future<void> createUser(Map<String, dynamic> payload) async {
    if (!ApiConstants.useRemoteApi)
      throw Exception('Create user requires online API');
    await Get.find<RemoteApiService>().createUser(payload);
  }

  Future<void> updateUser(String id, Map<String, dynamic> payload) async {
    if (!ApiConstants.useRemoteApi)
      throw Exception('Update user requires online API');
    await Get.find<RemoteApiService>().updateUser(id, payload);
  }

  Future<List<Map<String, dynamic>>> getPayslips({String? search}) async {
    if (!ApiConstants.useRemoteApi) return [];
    return Get.find<RemoteApiService>().getPayslips(search: search);
  }

  Future<Map<String, dynamic>> savePayslip(Map<String, dynamic> payload,
      {String? id}) async {
    if (!ApiConstants.useRemoteApi)
      throw Exception('Pay slips require online API');
    if (id != null && id.isNotEmpty) {
      return Get.find<RemoteApiService>().updatePayslip(id, payload);
    }
    return Get.find<RemoteApiService>().createPayslip(payload);
  }

  Future<void> deletePayslip(String id) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().deletePayslip(id);
  }

  List<CustomerListingModel> get localListings => ApiConstants.useRemoteApi
      ? []
      : Get.find<DummyApiService>().localListings;

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

  Future<Map<String, dynamic>> syncRoutePoints(
      List<Map<String, dynamic>> points) async {
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

  Future<void> updateCallLog(String id, Map<String, dynamic> data) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().updateCallLog(id, data);
  }

  Future<void> changePassword(String oldPass, String newPass) async {
    if (ApiConstants.useRemoteApi) {
      await Get.find<RemoteApiService>().changePassword(oldPass, newPass);
      return;
    }
    if (oldPass.length < 4 || newPass.length < 4)
      throw Exception('Invalid password');
  }

  Future<void> updateProfile({String? photoUrl}) async {
    if (!ApiConstants.useRemoteApi) return;
    await Get.find<RemoteApiService>().updateProfile(photoUrl: photoUrl);
  }
}
