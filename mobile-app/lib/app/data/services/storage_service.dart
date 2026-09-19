import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/enums/app_enums.dart';
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
  String? getToken() => _box.read(ApiConstants.tokenKey);
  void removeToken() => _box.remove(ApiConstants.tokenKey);

  // User
  void saveUser(UserModel user) {
    _box.write(ApiConstants.userKey, user.toJson());
    _box.write(ApiConstants.roleKey, user.role.name);
    saveToken(user.token);
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
    removeToken();
  }

  bool get isLoggedIn => getToken() != null && getUser() != null;

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
    removeUser();
    _box.erase();
    await _prefs.clear();
  }
}
