import 'enums/app_enums.dart';

class LeadModel {
  final String id;
  final String name;
  final String mobile;
  final String address;
  final String source;
  final LeadStatus status;
  final DateTime createdAt;
  final String? assignedTo;
  final String? notes;

  LeadModel({
    required this.id,
    required this.name,
    required this.mobile,
    required this.address,
    required this.source,
    required this.status,
    required this.createdAt,
    this.assignedTo,
    this.notes,
  });

  factory LeadModel.fromJson(Map<String, dynamic> json) {
    return LeadModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      address: json['address'] ?? '',
      source: json['source'] ?? 'Walk-in',
      status: LeadStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => LeadStatus.newLead,
      ),
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      assignedTo: json['assignedTo'],
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'address': address,
        'source': source,
        'status': status.name,
        'createdAt': createdAt.toIso8601String(),
        'assignedTo': assignedTo,
        'notes': notes,
      };

  LeadModel copyWith({LeadStatus? status, String? assignedTo, String? notes}) {
    return LeadModel(
      id: id,
      name: name,
      mobile: mobile,
      address: address,
      source: source,
      status: status ?? this.status,
      createdAt: createdAt,
      assignedTo: assignedTo ?? this.assignedTo,
      notes: notes ?? this.notes,
    );
  }
}
