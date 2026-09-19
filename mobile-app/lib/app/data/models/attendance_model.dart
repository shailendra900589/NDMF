class AttendanceModel {
  final String id;
  final DateTime date;
  final DateTime? checkInTime;
  final DateTime? checkOutTime;
  final double? checkInLat;
  final double? checkInLng;
  final double? checkOutLat;
  final double? checkOutLng;
  final double distanceFromBranch;
  final String status;

  AttendanceModel({
    required this.id,
    required this.date,
    this.checkInTime,
    this.checkOutTime,
    this.checkInLat,
    this.checkInLng,
    this.checkOutLat,
    this.checkOutLng,
    this.distanceFromBranch = 0,
    this.status = 'Absent',
  });

  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['id']?.toString() ?? '',
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      checkInTime: json['checkInTime'] != null ? DateTime.tryParse(json['checkInTime']) : null,
      checkOutTime: json['checkOutTime'] != null ? DateTime.tryParse(json['checkOutTime']) : null,
      checkInLat: json['checkInLat']?.toDouble(),
      checkInLng: json['checkInLng']?.toDouble(),
      checkOutLat: json['checkOutLat']?.toDouble(),
      checkOutLng: json['checkOutLng']?.toDouble(),
      distanceFromBranch: (json['distanceFromBranch'] ?? 0).toDouble(),
      status: json['status'] ?? 'Absent',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date.toIso8601String(),
        'checkInTime': checkInTime?.toIso8601String(),
        'checkOutTime': checkOutTime?.toIso8601String(),
        'checkInLat': checkInLat,
        'checkInLng': checkInLng,
        'checkOutLat': checkOutLat,
        'checkOutLng': checkOutLng,
        'distanceFromBranch': distanceFromBranch,
        'status': status,
      };

  bool get isCheckedIn => checkInTime != null;
  bool get isCheckedOut => checkOutTime != null;
}
