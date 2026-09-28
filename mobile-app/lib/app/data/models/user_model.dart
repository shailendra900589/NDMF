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
  final bool faceEnrollmentComplete;
  /// Org policy from admin — when false, no face enrollment gate or check-in verify.
  final bool faceAttendanceRequired;

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
    this.faceEnrollmentComplete = false,
    this.faceAttendanceRequired = true,
  }) : permissions = permissions ?? AppPermissions.defaultsForRole(role);

  bool get isFieldOrBranch =>
      role == UserRole.fieldOfficer || role == UserRole.branchManager;

  bool get needsFaceEnrollment => isFieldOrBranch;

  /// Show mandatory enrollment flow after login.
  bool get shouldPromptFaceEnrollment =>
      faceAttendanceRequired && needsFaceEnrollment && !faceEnrollmentComplete;

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
      faceEnrollmentComplete: json['faceEnrollmentComplete'] == true,
      faceAttendanceRequired: json['faceAttendanceRequired'] != false,
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
        'faceEnrollmentComplete': faceEnrollmentComplete,
        'faceAttendanceRequired': faceAttendanceRequired,
      };

  UserModel copyWith({
    String? name,
    String? mobile,
    String? branch,
    String? photoUrl,
    String? token,
    Map<String, bool>? permissions,
    bool? faceEnrollmentComplete,
    bool? faceAttendanceRequired,
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
      faceEnrollmentComplete: faceEnrollmentComplete ?? this.faceEnrollmentComplete,
      faceAttendanceRequired: faceAttendanceRequired ?? this.faceAttendanceRequired,
    );
  }
}
