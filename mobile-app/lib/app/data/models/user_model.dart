import 'enums/app_enums.dart';
import '../../utils/app_permissions.dart';

class UserModel {
  final String id;
  final String name;
  final String mobile;
  final String employeeId;
  final String branch;
  final UserRole role;
  final String? photoUrl;
  final String token;
  final Map<String, bool> permissions;

  UserModel({
    required this.id,
    required this.name,
    required this.mobile,
    required this.employeeId,
    required this.branch,
    required this.role,
    this.photoUrl,
    required this.token,
    Map<String, bool>? permissions,
  }) : permissions = permissions ?? AppPermissions.defaultsForRole(role);

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final role = UserRole.values.firstWhere(
      (e) => e.name == json['role'],
      orElse: () => UserRole.fieldOfficer,
    );
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      mobile: json['mobile']?.toString() ?? '',
      employeeId: json['employeeId']?.toString() ?? '',
      branch: json['branch']?.toString() ?? '',
      role: role,
      photoUrl: json['photoUrl'],
      token: json['token']?.toString() ?? '',
      permissions: AppPermissions.merge(
        role,
        json['permissions'] is Map ? Map<String, dynamic>.from(json['permissions'] as Map) : null,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobile': mobile,
        'employeeId': employeeId,
        'branch': branch.isEmpty ? null : branch,
        'role': role.name,
        'photoUrl': photoUrl,
        'token': token,
        'permissions': permissions,
      };

  UserModel copyWith({
    String? name,
    String? mobile,
    String? branch,
    String? photoUrl,
    String? token,
    Map<String, bool>? permissions,
  }) {
    return UserModel(
      id: id,
      name: name ?? this.name,
      mobile: mobile ?? this.mobile,
      employeeId: employeeId,
      branch: branch ?? this.branch,
      role: role,
      photoUrl: photoUrl ?? this.photoUrl,
      token: token ?? this.token,
      permissions: permissions ?? this.permissions,
    );
  }
}
