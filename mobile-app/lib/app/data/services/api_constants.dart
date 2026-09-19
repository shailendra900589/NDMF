import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  ApiConstants._();

  /// Production — ndclients.co.in
  static const String productionBaseUrl = 'https://ndclients.co.in/api/v1';

  /// true = live AWS (ndclients.co.in). false = local backend.
  static const bool useProduction = true;
  /// true = Android emulator (10.0.2.2). false = real phone on same WiFi as PC.
  static const bool useEmulatorHost = true;
  /// PC LAN IP — run `ipconfig` and set this when useEmulatorHost is false.
  static const String deviceHost = '192.168.1.19';

  static String get baseUrl {
    if (useProduction) return productionBaseUrl;
    if (!kIsWeb &&
        (Platform.isWindows || Platform.isLinux || Platform.isMacOS)) {
      return 'http://127.0.0.1:5000/api/v1';
    }
    return 'http://${useEmulatorHost ? '10.0.2.2' : deviceHost}:5000/api/v1';
  }

  static const bool useRemoteApi = true;

  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  static const String login = '/auth/login';
  static const String logout = '/auth/logout';
  static const String otpSend = '/auth/otp/send';
  static const String otpVerify = '/auth/otp/verify';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/change-password';
  static const String updateProfile = '/auth/profile';

  static const String customers = '/customers';
  static const String customerListings = '/customer-listings';
  static const String customerListingsApproval = '/customer-listings/approval';
  static const String approveListing = '/customer-listings/approve';
  static const String assignListing = '/customer-listings';
  static const String users = '/users';
  static const String usersPermissionSchema = '/users/permission-schema';
  static const String branches = '/branches';
  static const String dashboard = '/dashboard/stats';

  static const String attendanceCheckIn = '/attendance/check-in';
  static const String attendanceCheckOut = '/attendance/check-out';
  static const String attendanceHistory = '/attendance/history';

  static const String trackingRoutePoints = '/tracking/route-points';
  static const String trackingToday = '/tracking/today';
  static const String trackingHistory = '/tracking/history';

  static const String uploadSingle = '/uploads/single';
  static const String callLogs = '/call-logs';

  static const String tokenKey = 'auth_token';
  static const String userKey = 'user_data';
  static const String roleKey = 'user_role';
  static const String rememberMeKey = 'remember_me';
  static const String pinKey = 'app_pin';
  static const String pendingCallLogsKey = 'pending_call_logs';
  static const String callLogsKey = 'call_logs';
  static const String attendanceKey = 'attendance_history';
  static const String customerListingsKey = 'customer_listings';
  static const String routeHistoryKey = 'route_history';
}
