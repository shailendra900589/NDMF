import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import 'api_constants.dart';

/// Checks the public release manifest and installs newer APKs inside the app.
class AppUpdateService extends GetxService {
  static const _installChannel =
      MethodChannel('com.nirmaldhara.microfinance/app_update');

  final RxBool updateRequired = false.obs;
  final RxDouble downloadProgress = 0.0.obs;
  final RxBool isDownloading = false.obs;

  String? _downloadUrl;
  String? _publishedVersion;
  String? _expectedFileName;
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
      _expectedFileName = file;
      _downloadUrl = '${ApiConstants.publicSiteUrl}/downloads/$file';
      updateRequired.value = true;
      return true;
    } catch (_) {
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
          content: Obx(() {
            if (isDownloading.value) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Downloading MyStaff Smart $_publishedVersion…',
                  ),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(value: downloadProgress.value),
                  const SizedBox(height: 8),
                  Text(
                    '${(downloadProgress.value * 100).round()}%',
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            }
            return Text(
              'MyStaff Smart $_publishedVersion is ready. Update now to continue with attendance, live GPS and visits.',
            );
          }),
          actions: [
            Obx(() {
              if (isDownloading.value) return const SizedBox.shrink();
              return FilledButton.icon(
                onPressed: () async {
                  final ok = await _downloadAndInstall();
                  if (!ok && Get.isDialogOpen == true) {
                    Get.snackbar(
                      'Update failed',
                      'Check internet and storage, then tap Update now again.',
                    );
                  }
                },
                icon: const Icon(Icons.system_update_alt),
                label: const Text('Update now'),
              );
            }),
          ],
        ),
      ),
      barrierDismissible: false,
    );
    _dialogOpen = false;
  }

  Future<bool> _downloadAndInstall() async {
    final url = _downloadUrl;
    final name = _expectedFileName;
    if (url == null || name == null) return false;
    if (!Platform.isAndroid) return false;

    isDownloading.value = true;
    downloadProgress.value = 0.0;
    try {
      final storage = await getExternalStorageDirectory();
      final dir = Directory(
        storage != null
            ? '${storage.path}/apk_updates'
            : '${(await getApplicationDocumentsDirectory()).path}/apk_updates',
      );
      await dir.create(recursive: true);
      final file = File('${dir.path}/$name');
      await Dio().download(
        url,
        file.path,
        options: Options(
          receiveTimeout: const Duration(minutes: 20),
          headers: const {'Cache-Control': 'no-cache'},
        ),
        onReceiveProgress: (received, total) {
          if (total > 0) downloadProgress.value = received / total;
        },
      );
      if (!file.existsSync() || file.lengthSync() < 1024) return false;

      final installed = await _installChannel.invokeMethod<bool>(
            'installApk',
            {'path': file.path},
          ) ??
          false;
      return installed;
    } catch (_) {
      return false;
    } finally {
      isDownloading.value = false;
    }
  }
}
