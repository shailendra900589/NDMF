import 'enums/app_enums.dart';

class GpsPhotoCapture {
  final String filePath;
  final double latitude;
  final double longitude;
  final DateTime capturedAt;
  final String address;

  GpsPhotoCapture({
    required this.filePath,
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    this.address = '',
  });

  Map<String, dynamic> toJson() => {
        'filePath': filePath,
        'latitude': latitude,
        'longitude': longitude,
        'capturedAt': capturedAt.toIso8601String(),
        'address': address,
      };

  factory GpsPhotoCapture.fromJson(Map<String, dynamic> json) {
    return GpsPhotoCapture(
      filePath: json['filePath'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      capturedAt: DateTime.tryParse(json['capturedAt'] ?? '') ?? DateTime.now(),
      address: json['address'] ?? '',
    );
  }
}

class NeighborVerification {
  String shopName;
  String remarks;
  String? voiceRecordingPath;

  NeighborVerification({
    this.shopName = '',
    this.remarks = '',
    this.voiceRecordingPath,
  });

  Map<String, dynamic> toJson() => {
        'shopName': shopName,
        'remarks': remarks,
        'voiceRecordingPath': voiceRecordingPath,
      };

  factory NeighborVerification.fromJson(Map<String, dynamic> json) {
    return NeighborVerification(
      shopName: json['shopName'] ?? '',
      remarks: json['remarks'] ?? '',
      voiceRecordingPath: json['voiceRecordingPath'],
    );
  }
}

class CustomerListingModel {
  final String id;
  String name;
  String mobile;
  String aadhaar;
  String pan;
  GpsPhotoCapture? customerPhoto;
  GpsPhotoCapture? aadhaarFront;
  GpsPhotoCapture? aadhaarBack;
  GpsPhotoCapture? panFront;
  GpsPhotoCapture? shopPhoto1;
  GpsPhotoCapture? shopPhoto2;
  GpsPhotoCapture? shopPhoto3;
  GpsPhotoCapture? shopPhoto4;
  String shopFullAddress;
  double shopLatitude;
  double shopLongitude;
  List<NeighborVerification> neighbors;
  CustomerListingStatus status;
  DateTime createdAt;
  DateTime? listedAt;
  bool isSynced;
  String? createdBy;
  String? assignedToEmployeeId;
  String? assignedToName;

  CustomerListingModel({
    required this.id,
    this.name = '',
    this.mobile = '',
    this.aadhaar = '',
    this.pan = '',
    this.customerPhoto,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panFront,
    this.shopPhoto1,
    this.shopPhoto2,
    this.shopPhoto3,
    this.shopPhoto4,
    this.shopFullAddress = '',
    this.shopLatitude = 0,
    this.shopLongitude = 0,
    this.neighbors = const [],
    this.status = CustomerListingStatus.draft,
    required this.createdAt,
    this.listedAt,
    this.isSynced = false,
    this.createdBy,
    this.assignedToEmployeeId,
    this.assignedToName,
  });

  List<GpsPhotoCapture> get allPhotos => [
        if (customerPhoto != null) customerPhoto!,
        if (aadhaarFront != null) aadhaarFront!,
        if (aadhaarBack != null) aadhaarBack!,
        if (panFront != null) panFront!,
        if (shopPhoto1 != null) shopPhoto1!,
        if (shopPhoto2 != null) shopPhoto2!,
        if (shopPhoto3 != null) shopPhoto3!,
        if (shopPhoto4 != null) shopPhoto4!,
      ];

  bool get hasShopLocation => shopLatitude != 0 && shopLongitude != 0;

  bool get isReadyToSubmit =>
      name.isNotEmpty &&
      mobile.length >= 10 &&
      customerPhoto != null &&
      aadhaarFront != null &&
      aadhaarBack != null &&
      panFront != null &&
      shopPhoto1 != null &&
      shopPhoto2 != null &&
      shopPhoto3 != null &&
      shopPhoto4 != null &&
      shopFullAddress.isNotEmpty &&
      hasShopLocation &&
      neighbors.where((n) => n.shopName.isNotEmpty && n.remarks.isNotEmpty).length >= 2;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'aadhaar': aadhaar,
        'pan': pan,
        'customerPhoto': customerPhoto?.toJson(),
        'aadhaarFront': aadhaarFront?.toJson(),
        'aadhaarBack': aadhaarBack?.toJson(),
        'panFront': panFront?.toJson(),
        'shopPhoto1': shopPhoto1?.toJson(),
        'shopPhoto2': shopPhoto2?.toJson(),
        'shopPhoto3': shopPhoto3?.toJson(),
        'shopPhoto4': shopPhoto4?.toJson(),
        'shopFullAddress': shopFullAddress,
        'shopLatitude': shopLatitude,
        'shopLongitude': shopLongitude,
        'neighbors': neighbors.map((e) => e.toJson()).toList(),
        'status': status.name,
        'createdAt': createdAt.toIso8601String(),
        'listedAt': listedAt?.toIso8601String(),
        'isSynced': isSynced,
        if (createdBy != null) 'createdBy': createdBy,
        if (assignedToEmployeeId != null) 'assignedToEmployeeId': assignedToEmployeeId,
        if (assignedToName != null) 'assignedToName': assignedToName,
      };

  factory CustomerListingModel.fromJson(Map<String, dynamic> json) {
    GpsPhotoCapture? photo(Map<String, dynamic>? m) =>
        m != null ? GpsPhotoCapture.fromJson(m) : null;

    return CustomerListingModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      aadhaar: json['aadhaar'] ?? '',
      pan: json['pan'] ?? '',
      customerPhoto: photo(json['customerPhoto']),
      aadhaarFront: photo(json['aadhaarFront']),
      aadhaarBack: photo(json['aadhaarBack']),
      panFront: photo(json['panFront']),
      shopPhoto1: photo(json['shopPhoto1']),
      shopPhoto2: photo(json['shopPhoto2']),
      shopPhoto3: photo(json['shopPhoto3']),
      shopPhoto4: photo(json['shopPhoto4']),
      shopFullAddress: json['shopFullAddress'] ?? '',
      shopLatitude: (json['shopLatitude'] ?? 0).toDouble(),
      shopLongitude: (json['shopLongitude'] ?? 0).toDouble(),
      neighbors: (json['neighbors'] as List<dynamic>?)
              ?.map((e) => NeighborVerification.fromJson(e))
              .toList() ??
          [],
      status: CustomerListingStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => CustomerListingStatus.draft,
      ),
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      listedAt: json['listedAt'] != null ? DateTime.tryParse(json['listedAt']) : null,
      isSynced: json['isSynced'] ?? false,
      createdBy: json['createdBy']?.toString(),
      assignedToEmployeeId: json['assignedToEmployeeId']?.toString(),
      assignedToName: json['assignedToName']?.toString(),
    );
  }

  CustomerListingModel copyWith({
    CustomerListingStatus? status,
    DateTime? listedAt,
    bool? isSynced,
    String? assignedToEmployeeId,
    String? assignedToName,
  }) {
    return CustomerListingModel(
      id: id,
      name: name,
      mobile: mobile,
      aadhaar: aadhaar,
      pan: pan,
      customerPhoto: customerPhoto,
      aadhaarFront: aadhaarFront,
      aadhaarBack: aadhaarBack,
      panFront: panFront,
      shopPhoto1: shopPhoto1,
      shopPhoto2: shopPhoto2,
      shopPhoto3: shopPhoto3,
      shopPhoto4: shopPhoto4,
      shopFullAddress: shopFullAddress,
      shopLatitude: shopLatitude,
      shopLongitude: shopLongitude,
      neighbors: neighbors,
      status: status ?? this.status,
      createdAt: createdAt,
      listedAt: listedAt ?? this.listedAt,
      isSynced: isSynced ?? this.isSynced,
      createdBy: createdBy,
      assignedToEmployeeId: assignedToEmployeeId ?? this.assignedToEmployeeId,
      assignedToName: assignedToName ?? this.assignedToName,
    );
  }
}
