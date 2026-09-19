import 'enums/app_enums.dart';

class UserModel {
  final String id;
  final String name;
  final String mobile;
  final String employeeId;
  final String branch;
  final UserRole role;
  final String? photoUrl;
  final String token;

  UserModel({
    required this.id,
    required this.name,
    required this.mobile,
    required this.employeeId,
    required this.branch,
    required this.role,
    this.photoUrl,
    required this.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      mobile: json['mobile'] ?? '',
      employeeId: json['employeeId'] ?? '',
      branch: json['branch'] ?? '',
      role: UserRole.values.firstWhere(
        (e) => e.name == json['role'],
        orElse: () => UserRole.fieldOfficer,
      ),
      photoUrl: json['photoUrl'],
      token: json['token'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'employeeId': employeeId,
        'branch': branch,
        'role': role.name,
        'photoUrl': photoUrl,
        'token': token,
      };

  UserModel copyWith({
    String? name,
    String? mobile,
    String? branch,
    String? photoUrl,
  }) {
    return UserModel(
      id: id,
      name: name ?? this.name,
      mobile: mobile ?? this.mobile,
      employeeId: employeeId,
      branch: branch ?? this.branch,
      role: role,
      photoUrl: photoUrl ?? this.photoUrl,
      token: token,
    );
  }
}
