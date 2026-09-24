import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../widgets/app_logo.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/api_constants.dart';
import '../../../routes/app_routes.dart';

class SplashView extends StatefulWidget {
  const SplashView({super.key});

  @override
  State<SplashView> createState() => _SplashViewState();
}

class _SplashViewState extends State<SplashView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _fade = CurvedAnimation(parent: _anim, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.92, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: Curves.easeOutBack),
    );
    _anim.forward();
    _navigate();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 450));
    if (!mounted) return;
    final storage = Get.find<StorageService>();
    if (storage.isLoggedIn) {
      if (ApiConstants.useRemoteApi && Get.isRegistered<NdfaApiService>()) {
        try {
          await Get.find<NdfaApiService>().syncSession();
        } catch (_) {
          storage.clearAuthSession();
          Get.offAllNamed(AppRoutes.login);
          return;
        }
      }
      if (storage.hasPin) {
        Get.offAllNamed(AppRoutes.appLock);
      } else {
        Get.offAllNamed(AppRoutes.home);
      }
    } else {
      storage.clearAuthSession();
      Get.offAllNamed(AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF071512), Color(0xFF1A4A42), Color(0xFF0F766E)],
          ),
        ),
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const AppLogo(height: 110),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Nirmaldhara',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Field force · Live sync',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 40),
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
