import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'app/bindings/app_initializer.dart';
import 'app/bindings/initial_binding.dart';
import 'app/routes/app_pages.dart';
import 'app/theme/app_colors.dart';
import 'app/theme/app_theme.dart';
import 'app/data/services/app_update_service.dart';

void main() {
  runZonedGuarded(_startApp, (error, stackTrace) {
    // A native plugin or persisted-state issue must never cause an Android
    // launch loop. The app still opens and deferred services can retry later.
    debugPrint('Unhandled startup error: $error\n$stackTrace');
  });
}

Future<void> _startApp() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await GetStorage.init();
  } catch (error, stackTrace) {
    debugPrint('Local storage initialization failed: $error\n$stackTrace');
  }

  try {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  } catch (error, stackTrace) {
    debugPrint('Orientation setup failed: $error\n$stackTrace');
  }

  // Keep platform initialization fail-safe. A slow or unsupported device must
  // reach the sign-in screen even when an optional native service is unavailable.
  try {
    await AppInitializer.initCritical();
  } catch (error, stackTrace) {
    debugPrint('Critical service initialization failed: $error\n$stackTrace');
  }

  runApp(const MyStaffSmartApp());

  WidgetsBinding.instance.addPostFrameCallback((_) {
    unawaited(_startDeferredServices());
  });
}

Future<void> _startDeferredServices() async {
  try {
    await AppInitializer.initDeferred();
  } catch (error, stackTrace) {
    debugPrint('Deferred service initialization failed: $error\n$stackTrace');
  }
}

class MyStaffSmartApp extends StatefulWidget {
  const MyStaffSmartApp({super.key});

  @override
  State<MyStaffSmartApp> createState() => _MyStaffSmartAppState();
}

class _MyStaffSmartAppState extends State<MyStaffSmartApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        Get.isRegistered<AppUpdateService>()) {
      unawaited(Get.find<AppUpdateService>().enforceRequiredUpdate());
    }
  }

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'MyStaff Smart',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialBinding: InitialBinding(),
      initialRoute: AppPages.initial,
      getPages: AppPages.routes,
      defaultTransition: Transition.cupertino,
      builder: (context, child) {
        final media = MediaQuery.of(context);
        final width = media.size.width > 520 ? 520.0 : media.size.width;
        final page = child ?? const SizedBox.shrink();
        return MediaQuery(
          data: media.copyWith(
            textScaler: media.textScaler
                .clamp(minScaleFactor: 0.85, maxScaleFactor: 1.15),
          ),
          child: ColoredBox(
            color: AppColors.background,
            child: Align(
              alignment: Alignment.topCenter,
              child: SizedBox(
                width: width,
                height: media.size.height,
                child: page,
              ),
            ),
          ),
        );
      },
    );
  }
}
