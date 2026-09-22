import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../models/lead_model.dart';
import '../models/loan_model.dart';
import '../models/customer_model.dart';
import '../models/dashboard_stats.dart';
import '../models/attendance_model.dart';
import '../models/enums/app_enums.dart';
import '../models/customer_listing_model.dart';
import '../models/call_log_model.dart';
import 'storage_service.dart';
import 'api_constants.dart';

class DummyApiService extends GetxService {
  final List<LeadModel> _leads = [];
  final List<LoanModel> _loans = [];
  final List<CustomerModel> _customers = [];
  final List<CustomerListingModel> _listings = [];

  @override
  void onInit() {
    super.onInit();
    _seedData();
    _seedCallLogs();
    _loadListingsFromStorage();
  }

  void _seedData() {
    _leads.addAll([
      LeadModel(
        id: '1',
        name: 'Rajesh Kumar',
        mobile: '9876543210',
        address: '123 MG Road, Delhi',
        source: 'Referral',
        status: LeadStatus.newLead,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      LeadModel(
        id: '2',
        name: 'Priya Sharma',
        mobile: '9876543211',
        address: '45 Nehru Place, Delhi',
        source: 'Walk-in',
        status: LeadStatus.newLead,
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      ),
      LeadModel(
        id: '3',
        name: 'Amit Patel',
        mobile: '9876543212',
        address: '78 Connaught Place, Delhi',
        source: 'Campaign',
        status: LeadStatus.accepted,
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        assignedTo: 'FO001',
      ),
      LeadModel(
        id: '4',
        name: 'Sunita Devi',
        mobile: '9876543213',
        address: '12 Karol Bagh, Delhi',
        source: 'Referral',
        status: LeadStatus.newLead,
        createdAt: DateTime.now(),
      ),
    ]);

    _customers.addAll([
      CustomerModel(
        id: 'C001',
        name: 'Rajesh Kumar',
        mobile: '9876543210',
        address: '123 MG Road, Delhi',
        aadhaar: '123456789012',
        pan: 'ABCDE1234F',
        latitude: 28.6139,
        longitude: 77.2090,
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
      CustomerModel(
        id: 'C002',
        name: 'Priya Sharma',
        mobile: '9876543211',
        address: '45 Nehru Place, Delhi',
        aadhaar: '123456789013',
        pan: 'ABCDE1235F',
        latitude: 28.6200,
        longitude: 77.2100,
        createdAt: DateTime.now().subtract(const Duration(days: 15)),
      ),
    ]);

    _loans.addAll([
      LoanModel(
        id: 'LOAN_000',
        customer: CustomerDetails(
          name: 'Sunita Devi',
          mobile: '9876543213',
          dob: '10/08/1988',
          gender: 'Female',
          aadhaar: '123456789014',
          pan: 'ABCDE1236F',
          address: '12 Karol Bagh, Delhi',
        ),
        business: BusinessDetails(
          businessType: 'Retail',
          shopName: 'Sunita Kirana Store',
          shopAddress: 'Karol Bagh',
          monthlyIncome: 35000,
          monthlySales: 70000,
          loanAmount: 80000,
          loanPurpose: 'Stock Purchase',
        ),
        guarantor: GuarantorDetails(name: 'Ramesh Devi', mobile: '9876543297', relation: 'Husband'),
        documents: LoanDocuments(),
        location: GpsLocation(latitude: 28.6519, longitude: 77.1909, address: 'Karol Bagh, Delhi'),
        verification: VerificationData(),
        status: LoanStatus.verificationPending,
        createdAt: DateTime.now(),
      ),
      LoanModel(
        id: 'LOAN_001',
        customer: CustomerDetails(
          gender: 'Male',
          aadhaar: '123456789012',
          pan: 'ABCDE1234F',
          address: '123 MG Road, Delhi',
        ),
        business: BusinessDetails(
          businessType: 'Retail',
          shopName: 'Rajesh General Store',
          shopAddress: 'MG Road',
          monthlyIncome: 45000,
          monthlySales: 120000,
          loanAmount: 150000,
          loanPurpose: 'Inventory Purchase',
        ),
        guarantor: GuarantorDetails(name: 'Suresh Kumar', mobile: '9876543299', relation: 'Brother'),
        documents: LoanDocuments(),
        location: GpsLocation(latitude: 28.6139, longitude: 77.2090, address: 'Delhi'),
        verification: VerificationData(remarks: 'Verified on site', riskRating: 'Low', recommendedAmount: 150000),
        status: LoanStatus.branchPending,
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      LoanModel(
        id: 'LOAN_002',
        customer: CustomerDetails(
          name: 'Priya Sharma',
          mobile: '9876543211',
          dob: '20/03/1990',
          gender: 'Female',
          aadhaar: '123456789013',
          pan: 'ABCDE1235F',
          address: '45 Nehru Place, Delhi',
        ),
        business: BusinessDetails(
          businessType: 'Services',
          shopName: 'Priya Beauty Parlour',
          shopAddress: 'Nehru Place',
          monthlyIncome: 60000,
          monthlySales: 90000,
          loanAmount: 200000,
          loanPurpose: 'Equipment Purchase',
        ),
        guarantor: GuarantorDetails(name: 'Anita Sharma', mobile: '9876543298', relation: 'Sister'),
        documents: LoanDocuments(),
        location: GpsLocation(latitude: 28.6200, longitude: 77.2100, address: 'Delhi'),
        verification: VerificationData(remarks: 'Good business profile', riskRating: 'Low', recommendedAmount: 200000),
        status: LoanStatus.adminPending,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
    ]);
  }

  void _seedCallLogs() {
    final storage = Get.find<StorageService>();
    if (storage.readList(ApiConstants.callLogsKey).isNotEmpty) return;

    final now = DateTime.now();
    final logs = [
      CallLogModel(
        id: 'CALL_001',
        customerName: 'Rajesh Kumar',
        mobile: '9876543210',
        date: now.subtract(const Duration(hours: 2)),
        time: DateFormat('hh:mm a').format(now.subtract(const Duration(hours: 2))),
        duration: '3:45',
        type: CallType.outgoing,
      ),
      CallLogModel(
        id: 'CALL_002',
        customerName: 'Priya Sharma',
        mobile: '9876543211',
        date: now.subtract(const Duration(days: 1)),
        time: DateFormat('hh:mm a').format(now.subtract(const Duration(days: 1))),
        duration: '1:20',
        type: CallType.incoming,
      ),
      CallLogModel(
        id: 'CALL_003',
        customerName: 'Amit Patel',
        mobile: '9876543212',
        date: now.subtract(const Duration(days: 2)),
        time: '10:15 AM',
        duration: '0:00',
        type: CallType.missed,
      ),
    ];
    storage.writeList(ApiConstants.callLogsKey, logs.map((e) => e.toJson()).toList());
  }

  Future<UserModel?> login(String loginId, String password) async {
    await Future.delayed(const Duration(milliseconds: 400));

    if (loginId.trim().length < 3 || password.length < 4) {
      throw Exception('Invalid Login ID or password');
    }

    final id = loginId.trim().toUpperCase();
    final role = id.startsWith('ADM')
        ? UserRole.admin
        : id.startsWith('BM')
            ? UserRole.branchManager
            : UserRole.fieldOfficer;

    final user = UserModel(
      id: 'U001',
      name: role == UserRole.admin
          ? 'Admin User'
          : role == UserRole.branchManager
              ? 'Branch Manager'
              : 'Field Officer',
      mobile: loginId.length >= 10 ? loginId : '9000000003',
      employeeId: role == UserRole.admin
          ? 'ADM001'
          : role == UserRole.branchManager
              ? 'BM001'
              : 'FO001',
      branch: 'Delhi Main Branch',
      role: role,
      token: 'dummy_token_${DateTime.now().millisecondsSinceEpoch}',
    );

    Get.find<StorageService>().saveUser(user);
    return user;
  }

  Future<DashboardStats> getDashboardStats() async {
    await Future.delayed(const Duration(milliseconds: 800));
    return DashboardStats(
      pendingCustomerListing: _listings
              .where((l) =>
                  l.status == CustomerListingStatus.branchPending ||
                  l.status == CustomerListingStatus.adminPending ||
                  l.status == CustomerListingStatus.draft)
              .length,
      totalCustomers: _customers.length,
      totalListings: _listings.length,
      attendanceStatus: 'Checked In',
      distanceCoveredToday: 12.5,
      totalCallsToday: 3,
      totalCallsWithRecording: 2,
      teamMembers: 4,
      branch: 'Delhi Main Branch',
    );
  }

  Future<List<LeadModel>> getLeads({LeadStatus? status, String? search}) async {
    await Future.delayed(const Duration(milliseconds: 500));
    var result = List<LeadModel>.from(_leads);
    if (status != null) {
      result = result.where((l) => l.status == status).toList();
    }
    if (search != null && search.isNotEmpty) {
      result = result
          .where((l) =>
              l.name.toLowerCase().contains(search.toLowerCase()) ||
              l.mobile.contains(search))
          .toList();
    }
    return result;
  }

  Future<LeadModel> acceptLead(String leadId) async {
    await Future.delayed(const Duration(milliseconds: 500));
    final index = _leads.indexWhere((l) => l.id == leadId);
    if (index == -1) throw Exception('Lead not found');
    _leads[index] = _leads[index].copyWith(
      status: LeadStatus.accepted,
      assignedTo: 'FO001',
    );
    return _leads[index];
  }

  Future<LeadModel> getLeadById(String id) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return _leads.firstWhere((l) => l.id == id);
  }

  Future<LoanModel> submitLoan(LoanModel loan) async {
    await Future.delayed(const Duration(seconds: 1));
    final index = _loans.indexWhere((l) => l.id == loan.id);
    if (index >= 0) {
      _loans[index] = loan.copyWith(status: LoanStatus.verificationPending, isSynced: true);
      return _loans[index];
    }
    final newLoan = loan.copyWith(status: LoanStatus.verificationPending, isSynced: true);
    _loans.add(newLoan);
    return newLoan;
  }

  Future<LoanModel> saveVerification(LoanModel loan, {bool submit = false}) async {
    await Future.delayed(const Duration(milliseconds: 800));
    final status = submit ? LoanStatus.branchPending : LoanStatus.verificationPending;
    final updated = loan.copyWith(status: status);
    final index = _loans.indexWhere((l) => l.id == loan.id);
    if (index >= 0) {
      _loans[index] = updated;
    } else {
      _loans.add(updated);
    }
    return updated;
  }

  Future<LoanModel> processApproval(String loanId, ApprovalAction action) async {
    await Future.delayed(const Duration(milliseconds: 800));
    final index = _loans.indexWhere((l) => l.id == loanId);
    LoanStatus newStatus;
    switch (action) {
      case ApprovalAction.approve:
        newStatus = LoanStatus.adminPending;
        break;
      case ApprovalAction.reject:
        newStatus = LoanStatus.rejected;
        break;
      case ApprovalAction.rework:
        newStatus = LoanStatus.verificationPending;
        break;
      case ApprovalAction.finalApprove:
        newStatus = LoanStatus.approved;
        break;
      case ApprovalAction.finalReject:
        newStatus = LoanStatus.rejected;
        break;
    }
    if (index >= 0) {
      _loans[index] = _loans[index].copyWith(status: newStatus);
      return _loans[index];
    }
    throw Exception('Loan not found');
  }

  Future<List<LoanModel>> getLoansForApproval({LoanStatus? status}) async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (status != null) {
      return _loans.where((l) => l.status == status).toList();
    }
    return _loans
        .where((l) =>
            l.status == LoanStatus.branchPending ||
            l.status == LoanStatus.adminPending ||
            l.status == LoanStatus.verificationPending)
        .toList();
  }

  Future<List<CustomerModel>> getCustomers({String? search}) async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (search != null && search.isNotEmpty) {
      return _customers
          .where((c) =>
              c.name.toLowerCase().contains(search.toLowerCase()) ||
              c.mobile.contains(search))
          .toList();
    }
    return List.from(_customers);
  }

  Future<CustomerModel> getCustomerById(String id) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return _customers.firstWhere((c) => c.id == id);
  }

  Future<AttendanceModel> markAttendance({
    required bool isCheckIn,
    required double lat,
    required double lng,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));
    final now = DateTime.now();
    final storage = Get.find<StorageService>();
    final history = storage.readList(ApiConstants.attendanceKey);

    AttendanceModel attendance;
    if (isCheckIn) {
      attendance = AttendanceModel(
        id: 'ATT_${now.millisecondsSinceEpoch}',
        date: now,
        checkInTime: now,
        checkInLat: lat,
        checkInLng: lng,
        distanceFromBranch: 150,
        status: 'Present',
      );
    } else {
      if (history.isNotEmpty) {
        final last = AttendanceModel.fromJson(history.last);
        attendance = AttendanceModel(
          id: last.id,
          date: last.date,
          checkInTime: last.checkInTime,
          checkOutTime: now,
          checkInLat: last.checkInLat,
          checkInLng: last.checkInLng,
          checkOutLat: lat,
          checkOutLng: lng,
          distanceFromBranch: last.distanceFromBranch,
          status: 'Present',
        );
        history.removeLast();
      } else {
        attendance = AttendanceModel(
          id: 'ATT_${now.millisecondsSinceEpoch}',
          date: now,
          checkOutTime: now,
          checkOutLat: lat,
          checkOutLng: lng,
          status: 'Present',
        );
      }
    }

    history.add(attendance.toJson());
    storage.writeList(ApiConstants.attendanceKey, history);
    return attendance;
  }

  Future<List<AttendanceModel>> getAttendanceHistory() async {
    await Future.delayed(const Duration(milliseconds: 300));
    final storage = Get.find<StorageService>();
    return storage
        .readList(ApiConstants.attendanceKey)
        .map((e) => AttendanceModel.fromJson(e))
        .toList()
        .reversed
        .toList();
  }

  List<LoanModel> get localLoans => List.from(_loans);
  List<CustomerListingModel> get localListings => List.from(_listings);

  // ─── Customer Listing ───

  Future<CustomerListingModel> submitCustomerListing(CustomerListingModel listing) async {
    await Future.delayed(const Duration(seconds: 1));
    final submitted = listing.copyWith(
      status: CustomerListingStatus.branchPending,
      isSynced: true,
    );
    final index = _listings.indexWhere((l) => l.id == listing.id);
    if (index >= 0) {
      _listings[index] = submitted;
    } else {
      _listings.add(submitted);
    }
    _persistListings();
    return submitted;
  }

  Future<List<CustomerListingModel>> getCustomerListings({
    CustomerListingStatus? status,
    String? search,
  }) async {
    await Future.delayed(const Duration(milliseconds: 400));
    var result = List<CustomerListingModel>.from(_listings);
    if (status != null) {
      result = result.where((l) => l.status == status).toList();
    }
    if (search != null && search.isNotEmpty) {
      final q = search.toLowerCase();
      result = result
          .where((l) => l.name.toLowerCase().contains(q) || l.mobile.contains(q))
          .toList();
    }
    return result;
  }

  Future<CustomerListingModel> getListingById(String id) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return _listings.firstWhere((l) => l.id == id);
  }

  Future<List<CustomerListingModel>> getListingsForApproval({CustomerListingStatus? status}) async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (status != null) {
      return _listings.where((l) => l.status == status).toList();
    }
    return _listings
        .where((l) =>
            l.status == CustomerListingStatus.branchPending ||
            l.status == CustomerListingStatus.adminPending)
        .toList();
  }

  Future<CustomerListingModel> processListingApproval(String id, ApprovalAction action) async {
    await Future.delayed(const Duration(milliseconds: 600));
    final index = _listings.indexWhere((l) => l.id == id);
    if (index < 0) throw Exception('Listing not found');

    CustomerListingStatus newStatus;
    switch (action) {
      case ApprovalAction.approve:
        newStatus = CustomerListingStatus.adminPending;
        break;
      case ApprovalAction.reject:
        newStatus = CustomerListingStatus.rejected;
        break;
      case ApprovalAction.rework:
        newStatus = CustomerListingStatus.draft;
        break;
      case ApprovalAction.finalApprove:
        newStatus = CustomerListingStatus.listed;
        _addListedCustomer(_listings[index]);
        break;
      case ApprovalAction.finalReject:
        newStatus = CustomerListingStatus.rejected;
        break;
    }

    _listings[index] = _listings[index].copyWith(
      status: newStatus,
      listedAt: newStatus == CustomerListingStatus.listed ? DateTime.now() : null,
    );
    _persistListings();
    return _listings[index];
  }

  void _addListedCustomer(CustomerListingModel listing) {
    if (_customers.any((c) => c.mobile == listing.mobile)) return;
    _customers.add(CustomerModel(
      id: 'C_${listing.id}',
      name: listing.name,
      mobile: listing.mobile,
      address: listing.shopFullAddress,
      aadhaar: listing.aadhaar,
      pan: listing.pan,
      latitude: listing.shopLatitude,
      longitude: listing.shopLongitude,
      listingId: listing.id,
      documentPaths: listing.allPhotos.map((p) => p.filePath).toList(),
      createdAt: DateTime.now(),
    ));
  }

  void _persistListings() {
    Get.find<StorageService>().writeList(
      ApiConstants.customerListingsKey,
      _listings.map((e) => e.toJson()).toList(),
    );
  }

  void _loadListingsFromStorage() {
    final data = Get.find<StorageService>().readList(ApiConstants.customerListingsKey);
    if (data.isNotEmpty) {
      _listings.addAll(data.map((e) => CustomerListingModel.fromJson(e)));
    }
  }
}
