import 'dart:io';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/skeleton_loaders.dart';

class DeviceInfoView extends StatefulWidget {
  const DeviceInfoView({super.key});

  @override
  State<DeviceInfoView> createState() => _DeviceInfoViewState();
}

class _DeviceInfoViewState extends State<DeviceInfoView> {
  Map<String, String> info = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _loadInfo();
  }

  Future<void> _loadInfo() async {
    final deviceInfo = DeviceInfoPlugin();
    final packageInfo = await PackageInfo.fromPlatform();
    final localAuth = LocalAuthentication();
    var biometricStatus = 'Not available';

    try {
      final canCheck = await localAuth.canCheckBiometrics;
      final supported = await localAuth.isDeviceSupported();
      if (canCheck && supported) {
        final types = await localAuth.getAvailableBiometrics();
        biometricStatus = types.isEmpty ? 'Supported (not enrolled)' : types.join(', ');
      }
    } catch (_) {
      biometricStatus = 'Check failed';
    }

    if (Platform.isAndroid) {
      final android = await deviceInfo.androidInfo;
      info = {
        'Device': '${android.brand} ${android.model}',
        'Android Version': android.version.release,
        'SDK': '${android.version.sdkInt}',
        'Manufacturer': android.manufacturer,
        'App Version': packageInfo.version,
        'Build Number': packageInfo.buildNumber,
        'Screenshot Protection': 'Toggle from Profile screen',
        'Biometric Auth': biometricStatus,
      };
    }

    setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Device info', subtitle: 'Diagnostics'),
      body: loading
          ? const ListSkeleton(itemCount: 5)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: info.entries
                  .map((e) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: AppRadii.card,
                          boxShadow: AppShadows.card,
                        ),
                        child: ListTile(
                          title: Text(e.key, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          subtitle: Text(e.value, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ))
                  .toList(),
            ),
    );
  }
}
