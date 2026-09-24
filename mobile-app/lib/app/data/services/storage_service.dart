import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/enums/app_enums.dart';
import '../../utils/app_permissions.dart';
import 'api_constants.dart';

class StorageService extends GetxService {
  late GetStorage _box;
  late SharedPreferences _prefs;

  Future<StorageService> init() async {
    _box = GetStorage();
    _prefs = await SharedPreferences.getInstance();
    return this;
  }

  // Token
  void saveToken(String token) => _box.write(ApiConstants.tokenKey, token);
  String? getToken() {
    final t = _box.read(ApiConstants.tokenKey);
    if (t != null && t.toString().isNotEmpty) return t.toString();
    return getUser()?.token;
  }

  void removeToken() => _box.remove(ApiConstants.tokenKey);

  // User
  void saveUser(UserModel user) {
    final token = user.token.isNotEmpty ? user.token : (getToken() ?? '');
    final merged = user.token.isEmpty && token.isNotEmpty ? user.copyWith(token: token) : user;
    _box.write(ApiConstants.userKey, merged.toJson());
    _box.write(ApiConstants.roleKey, merged.role.name);
    _box.write(ApiConstants.permissionsKey, merged.permissions);
    if (token.isNotEmpty) saveToken(token);
  }

  Map<String, bool> getPermissions() {
    final user = getUser();
    if (user != null) return user.permissions;
    final role = getRole() ?? UserRole.fieldOfficer;
    final stored = _box.read(ApiConstants.permissionsKey);
    if (stored is Map) {
      return AppPermissions.merge(role, Map<String, dynamic>.from(stored));
    }
    return AppPermissions.defaultsForRole(role);
  }

  UserModel? getUser() {
    final data = _box.read(ApiConstants.userKey);
    if (data == null) return null;
    return UserModel.fromJson(Map<String, dynamic>.from(data));
  }

  UserRole? getRole() {
    final role = _box.read(ApiConstants.roleKey);
    if (role == null) return null;
    return UserRole.values.firstWhere(
      (e) => e.name == role,
      orElse: () => UserRole.fieldOfficer,
    );
  }

  void removeUser() {
    _box.remove(ApiConstants.userKey);
    _box.remove(ApiConstants.roleKey);
    _box.remove(ApiConstants.permissionsKey);
    removeToken();
  }

  /// Sign out API session only (keeps PIN / local prefs).
  void clearAuthSession() => removeUser();

  bool get isLoggedIn {
    final token = getToken();
    return token != null && token.isNotEmpty && getUser() != null;
  }

  // Remember me
  void setRememberMe(bool value) => _prefs.setBool(ApiConstants.rememberMeKey, value);
  bool get rememberMe => _prefs.getBool(ApiConstants.rememberMeKey) ?? false;

  // App PIN
  void savePin(String pin) => _box.write(ApiConstants.pinKey, pin);
  String? getPin() => _box.read(ApiConstants.pinKey);
  bool get hasPin => getPin() != null;

  // Generic storage
  void write(String key, dynamic value) => _box.write(key, value);
  T? read<T>(String key) => _box.read<T>(key);
  void remove(String key) => _box.remove(key);

  // List storage helpers
  List<Map<String, dynamic>> readList(String key) {
    final data = _box.read(key);
    if (data == null) return [];
    return List<Map<String, dynamic>>.from(
      (data as List).map((e) => Map<String, dynamic>.from(e)),
    );
  }

  void writeList(String key, List<Map<String, dynamic>> items) {
    _box.write(key, items);
  }

  void appendToList(String key, Map<String, dynamic> item) {
    final list = readList(key);
    list.add(item);
    writeList(key, list);
  }

  // Logout all sessions
  Future<void> logoutAllSessions() async {
    clearAuthSession();
    _box.erase();
    await _prefs.clear();
  }
}
