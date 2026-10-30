import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_constants.dart';

/// Checks the signed public release manifest. A newer published build is a
/// mandatory update: route/API changes are not allowed to run on old clients.
class AppUpdateService extends GetxService {
  final RxBool updateRequired = false.obs;
  String? _downloadUrl;
  String? _publishedVersion;
  bool _dialogOpen = false;

  Future<AppUpdateService> init() async => this;

  Future<bool> checkForRequiredUpdate() async {
    try {
      final local = await PackageInfo.fromPlatform();
      final localCode = int.tryParse(local.buildNumber) ?? 0;
      final response = await Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        headers: const {'Cache-Control': 'no-cache'},
      )).get(ApiConstants.releaseManifestUrl,
          options: Options(extra: const {'bypassSessionExpiry': true}));
      final json = response.data;
      if (json is! Map) return false;
      final remoteCode = int.tryParse('${json['versionCode'] ?? 0}') ?? 0;
      final file = '${json['file'] ?? ''}';
      if (remoteCode <= localCode ||
          !RegExp(r'^mystaff-smart-[0-9]+\.[0-9]+\.[0-9]+\.apk$')
              .hasMatch(file)) {
        updateRequired.value = false;
        return false;
      }
      _publishedVersion = '${json['version'] ?? remoteCode}';
      _downloadUrl = '${ApiConstants.publicSiteUrl}/downloads/$file';
      updateRequired.value = true;
      return true;
    } catch (_) {
      // An offline employee must not be locked out only because the version
      // server is temporarily unreachable. The next launch/resume rechecks.
      return updateRequired.value;
    }
  }

  Future<void> enforceRequiredUpdate() async {
    final required = await checkForRequiredUpdate();
    if (!required || _dialogOpen || Get.overlayContext == null) return;
    _dialogOpen = true;
    await Get.dialog<void>(
      PopScope(
        canPop: false,
        child: AlertDialog(
          title: const Text('Update required'),
          content: Text(
            'MyStaff Smart $_publishedVersion is ready. Update now to continue securely with attendance, GPS and visits.',
          ),
          actions: [
            FilledButton.icon(
              onPressed: () async {
                final url = _downloadUrl;
                if (url != null)
                  await launchUrl(Uri.parse(url),
                      mode: LaunchMode.externalApplication);
              },
              icon: const Icon(Icons.system_update_alt),
              label: const Text('Download update'),
            ),
          ],
        ),
      ),
      barrierDismissible: false,
    );
    _dialogOpen = false;
  }
}
