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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Critical only — show UI immediately (no network wait).
  await AppInitializer.initCritical();
  runApp(const NirmaldharaApp());

  // Sync / tracking / notifications after first frame.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    unawaited(AppInitializer.initDeferred());
  });
}

class NirmaldharaApp extends StatelessWidget {
  const NirmaldharaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'Nirmaldhara',
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
            textScaler: media.textScaler.clamp(minScaleFactor: 0.85, maxScaleFactor: 1.15),
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
