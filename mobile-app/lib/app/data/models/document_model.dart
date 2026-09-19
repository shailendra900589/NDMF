class DocumentModel {
  final String id;
  final String loanId;
  final String customerId;
  final String type;
  final String filePath;
  final DateTime capturedAt;
  final double? latitude;
  final double? longitude;
  final bool isSynced;

  DocumentModel({
    required this.id,
    required this.loanId,
    required this.customerId,
    required this.type,
    required this.filePath,
    required this.capturedAt,
    this.latitude,
    this.longitude,
    this.isSynced = false,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id']?.toString() ?? '',
      loanId: json['loanId'] ?? '',
      customerId: json['customerId'] ?? '',
      type: json['type'] ?? '',
      filePath: json['filePath'] ?? '',
      capturedAt: DateTime.tryParse(json['capturedAt'] ?? '') ?? DateTime.now(),
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      isSynced: json['isSynced'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'loanId': loanId,
        'customerId': customerId,
        'type': type,
        'filePath': filePath,
        'capturedAt': capturedAt.toIso8601String(),
        'latitude': latitude,
        'longitude': longitude,
        'isSynced': isSynced,
      };
}
