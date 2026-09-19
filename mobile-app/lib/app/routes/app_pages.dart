import 'package:get/get.dart';
import '../modules/auth/bindings/auth_binding.dart';
import '../modules/auth/views/splash_view.dart';
import '../modules/auth/views/login_view.dart';
import '../modules/dashboard/bindings/dashboard_binding.dart';
import '../modules/dashboard/views/home_view.dart';
import '../modules/attendance/bindings/attendance_binding.dart';
import '../modules/attendance/views/attendance_view.dart';
import '../modules/tracking/bindings/tracking_binding.dart';
import '../modules/tracking/views/tracking_view.dart';
import '../modules/customers/bindings/customers_binding.dart';
import '../modules/customers/views/call_history_view.dart';
import '../modules/customers/views/customer_detail_view.dart';
import '../modules/customers/views/customers_list_view.dart';
import '../modules/profile/bindings/profile_binding.dart';
import '../modules/profile/views/change_password_view.dart';
import '../modules/profile/views/device_info_view.dart';
import '../modules/profile/views/profile_view.dart';
import '../modules/security/bindings/security_binding.dart';
import '../modules/security/views/app_lock_view.dart';
import '../modules/tracking/views/map_view.dart';
import '../modules/customer_listing/bindings/customer_listing_binding.dart';
import '../modules/customer_listing/views/customer_listing_list_view.dart';
import '../modules/customer_listing/views/new_customer_listing_view.dart';
import '../modules/customer_listing/views/customer_listing_detail_view.dart';
import '../modules/dialer/bindings/dialer_binding.dart';
import '../modules/dialer/views/dialer_view.dart';
import '../modules/team/bindings/team_binding.dart';
import '../modules/team/views/team_list_view.dart';
import '../modules/team/views/team_create_view.dart';
import 'app_routes.dart';

class AppPages {
  AppPages._();

  static const initial = AppRoutes.splash;

  static final routes = [
    GetPage(name: AppRoutes.splash, page: () => const SplashView()),
    GetPage(name: AppRoutes.login, page: () => const LoginView(), binding: AuthBinding()),
    GetPage(name: AppRoutes.appLock, page: () => const AppLockView(), binding: SecurityBinding()),
    GetPage(name: AppRoutes.home, page: () => const HomeView(), binding: DashboardBinding()),
    GetPage(name: AppRoutes.attendance, page: () => const AttendanceView(), binding: AttendanceBinding()),
    GetPage(name: AppRoutes.tracking, page: () => const TrackingView(), binding: TrackingBinding()),
    GetPage(name: AppRoutes.customers, page: () => const CustomersListView(), binding: CustomersBinding()),
    GetPage(name: AppRoutes.customerDetail, page: () => const CustomerDetailView(), binding: CustomersBinding()),
    GetPage(name: AppRoutes.callHistory, page: () => const CallHistoryView(), binding: CustomersBinding()),
    GetPage(name: AppRoutes.profile, page: () => const ProfileView(), binding: ProfileBinding()),
    GetPage(name: AppRoutes.changePassword, page: () => const ChangePasswordView(), binding: ProfileBinding()),
    GetPage(name: AppRoutes.deviceInfo, page: () => const DeviceInfoView(), binding: ProfileBinding()),
    GetPage(name: AppRoutes.mapView, page: () => const MapView(), binding: TrackingBinding()),
    GetPage(name: AppRoutes.customerListing, page: () => const CustomerListingListView(), binding: CustomerListingBinding()),
    GetPage(name: AppRoutes.customerListingNew, page: () => const NewCustomerListingView(), binding: CustomerListingBinding()),
    GetPage(name: AppRoutes.customerListingDetail, page: () => const CustomerListingDetailView(), binding: CustomerListingBinding()),
    GetPage(name: AppRoutes.dialer, page: () => const DialerView(), binding: DialerBinding()),
    GetPage(name: AppRoutes.team, page: () => const TeamListView(), binding: TeamBinding()),
    GetPage(name: AppRoutes.teamCreate, page: () => const TeamCreateView(), binding: TeamBinding()),
  ];
}
