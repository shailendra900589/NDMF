import 'enums/app_enums.dart';

class CustomerDetails {
  String name;
  String mobile;
  String dob;
  String gender;
  String aadhaar;
  String pan;
  String address;

  CustomerDetails({
    this.name = '',
    this.mobile = '',
    this.dob = '',
    this.gender = 'Male',
    this.aadhaar = '',
    this.pan = '',
    this.address = '',
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'mobile': mobile,
        'dob': dob,
        'gender': gender,
        'aadhaar': aadhaar,
        'pan': pan,
        'address': address,
      };

  factory CustomerDetails.fromJson(Map<String, dynamic> json) {
    return CustomerDetails(
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      dob: json['dob'] ?? '',
      gender: json['gender'] ?? 'Male',
      aadhaar: json['aadhaar'] ?? '',
      pan: json['pan'] ?? '',
      address: json['address'] ?? '',
    );
  }

  bool get isValid =>
      name.isNotEmpty &&
      mobile.length >= 10 &&
      dob.isNotEmpty &&
      aadhaar.length >= 12 &&
      address.isNotEmpty;
}

class BusinessDetails {
  String businessType;
  String shopName;
  String shopAddress;
  double monthlyIncome;
  double monthlySales;
  double loanAmount;
  String loanPurpose;

  BusinessDetails({
    this.businessType = '',
    this.shopName = '',
    this.shopAddress = '',
    this.monthlyIncome = 0,
    this.monthlySales = 0,
    this.loanAmount = 0,
    this.loanPurpose = '',
  });

  Map<String, dynamic> toJson() => {
        'businessType': businessType,
        'shopName': shopName,
        'shopAddress': shopAddress,
        'monthlyIncome': monthlyIncome,
        'monthlySales': monthlySales,
        'loanAmount': loanAmount,
        'loanPurpose': loanPurpose,
      };

  factory BusinessDetails.fromJson(Map<String, dynamic> json) {
    return BusinessDetails(
      businessType: json['businessType'] ?? '',
      shopName: json['shopName'] ?? '',
      shopAddress: json['shopAddress'] ?? '',
      monthlyIncome: (json['monthlyIncome'] ?? 0).toDouble(),
      monthlySales: (json['monthlySales'] ?? 0).toDouble(),
      loanAmount: (json['loanAmount'] ?? 0).toDouble(),
      loanPurpose: json['loanPurpose'] ?? '',
    );
  }

  bool get isValid =>
      businessType.isNotEmpty &&
      shopName.isNotEmpty &&
      loanAmount > 0 &&
      loanPurpose.isNotEmpty;
}

class GuarantorDetails {
  String name;
  String mobile;
  String relation;

  GuarantorDetails({
    this.name = '',
    this.mobile = '',
    this.relation = '',
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'mobile': mobile,
        'relation': relation,
      };

  factory GuarantorDetails.fromJson(Map<String, dynamic> json) {
    return GuarantorDetails(
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      relation: json['relation'] ?? '',
    );
  }

  bool get isValid => name.isNotEmpty && mobile.length >= 10 && relation.isNotEmpty;
}

class LoanDocuments {
  String? aadhaarPhoto;
  String? panPhoto;
  String? customerPhoto;
  String? shopFront;
  String? shopInside;
  String? businessActivity;

  LoanDocuments({
    this.aadhaarPhoto,
    this.panPhoto,
    this.customerPhoto,
    this.shopFront,
    this.shopInside,
    this.businessActivity,
  });

  Map<String, dynamic> toJson() => {
        'aadhaarPhoto': aadhaarPhoto,
        'panPhoto': panPhoto,
        'customerPhoto': customerPhoto,
        'shopFront': shopFront,
        'shopInside': shopInside,
        'businessActivity': businessActivity,
      };

  factory LoanDocuments.fromJson(Map<String, dynamic> json) {
    return LoanDocuments(
      aadhaarPhoto: json['aadhaarPhoto'],
      panPhoto: json['panPhoto'],
      customerPhoto: json['customerPhoto'],
      shopFront: json['shopFront'],
      shopInside: json['shopInside'],
      businessActivity: json['businessActivity'],
    );
  }

  bool get isValid =>
      aadhaarPhoto != null &&
      panPhoto != null &&
      customerPhoto != null &&
      shopFront != null;
}

class GpsLocation {
  double latitude;
  double longitude;
  String address;

  GpsLocation({
    this.latitude = 0,
    this.longitude = 0,
    this.address = '',
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
      };

  factory GpsLocation.fromJson(Map<String, dynamic> json) {
    return GpsLocation(
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      address: json['address'] ?? '',
    );
  }

  bool get isValid => latitude != 0 && longitude != 0;
}

class VerificationData {
  String remarks;
  String riskRating;
  double recommendedAmount;
  VerificationStatus status;

  VerificationData({
    this.remarks = '',
    this.riskRating = 'Low',
    this.recommendedAmount = 0,
    this.status = VerificationStatus.pending,
  });

  Map<String, dynamic> toJson() => {
        'remarks': remarks,
        'riskRating': riskRating,
        'recommendedAmount': recommendedAmount,
        'status': status.name,
      };

  factory VerificationData.fromJson(Map<String, dynamic> json) {
    return VerificationData(
      remarks: json['remarks'] ?? '',
      riskRating: json['riskRating'] ?? 'Low',
      recommendedAmount: (json['recommendedAmount'] ?? 0).toDouble(),
      status: VerificationStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => VerificationStatus.pending,
      ),
    );
  }
}

class LoanModel {
  final String id;
  CustomerDetails customer;
  BusinessDetails business;
  GuarantorDetails guarantor;
  LoanDocuments documents;
  GpsLocation location;
  VerificationData verification;
  LoanStatus status;
  DateTime createdAt;
  DateTime? updatedAt;
  bool isSynced;
  String? leadId;

  LoanModel({
    required this.id,
    required this.customer,
    required this.business,
    required this.guarantor,
    required this.documents,
    required this.location,
    required this.verification,
    this.status = LoanStatus.draft,
    required this.createdAt,
    this.updatedAt,
    this.isSynced = false,
    this.leadId,
  });

  factory LoanModel.fromJson(Map<String, dynamic> json) {
    return LoanModel(
      id: json['id']?.toString() ?? '',
      customer: CustomerDetails.fromJson(json['customer'] ?? {}),
      business: BusinessDetails.fromJson(json['business'] ?? {}),
      guarantor: GuarantorDetails.fromJson(json['guarantor'] ?? {}),
      documents: LoanDocuments.fromJson(json['documents'] ?? {}),
      location: GpsLocation.fromJson(json['location'] ?? {}),
      verification: VerificationData.fromJson(json['verification'] ?? {}),
      status: LoanStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => LoanStatus.draft,
      ),
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt']) : null,
      isSynced: json['isSynced'] ?? false,
      leadId: json['leadId'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customer': customer.toJson(),
        'business': business.toJson(),
        'guarantor': guarantor.toJson(),
        'documents': documents.toJson(),
        'location': location.toJson(),
        'verification': verification.toJson(),
        'status': status.name,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt?.toIso8601String(),
        'isSynced': isSynced,
        'leadId': leadId,
      };

  LoanModel copyWith({LoanStatus? status, bool? isSynced, VerificationData? verification}) {
    return LoanModel(
      id: id,
      customer: customer,
      business: business,
      guarantor: guarantor,
      documents: documents,
      location: location,
      verification: verification ?? this.verification,
      status: status ?? this.status,
      createdAt: createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
      isSynced: isSynced ?? this.isSynced,
      leadId: leadId,
    );
  }
}
