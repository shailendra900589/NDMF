import 'loan_model.dart';

class CustomerModel {
  final String id;
  final String name;
  final String mobile;
  final String address;
  final String aadhaar;
  final String pan;
  final double? latitude;
  final double? longitude;
  final String? listingId;
  final List<String> documentPaths;
  final List<LoanModel> loanHistory;
  final DateTime createdAt;

  CustomerModel({
    required this.id,
    required this.name,
    required this.mobile,
    required this.address,
    required this.aadhaar,
    required this.pan,
    this.latitude,
    this.longitude,
    this.listingId,
    this.documentPaths = const [],
    this.loanHistory = const [],
    required this.createdAt,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      address: json['address'] ?? '',
      aadhaar: json['aadhaar'] ?? '',
      pan: json['pan'] ?? '',
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      listingId: json['listingId'],
      documentPaths: List<String>.from(json['documentPaths'] ?? []),
      loanHistory: (json['loanHistory'] as List<dynamic>?)
              ?.map((e) => LoanModel.fromJson(e))
              .toList() ??
          [],
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'address': address,
        'aadhaar': aadhaar,
        'pan': pan,
        'latitude': latitude,
        'longitude': longitude,
        'listingId': listingId,
        'documentPaths': documentPaths,
        'loanHistory': loanHistory.map((e) => e.toJson()).toList(),
        'createdAt': createdAt.toIso8601String(),
      };
}
