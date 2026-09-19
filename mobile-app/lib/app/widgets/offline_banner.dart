import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../theme/app_colors.dart';
import '../data/services/connectivity_service.dart';
import '../data/services/sync_service.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final connectivity = Get.find<ConnectivityService>();
    final sync = Get.find<SyncService>();

    return Obx(() {
      if (connectivity.isOnline.value && sync.pendingCount.value == 0) {
        return const SizedBox.shrink();
      }

      return Material(
        color: connectivity.isOnline.value ? AppColors.warning : AppColors.error,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(
                  connectivity.isOnline.value ? Icons.sync : Icons.cloud_off,
                  color: Colors.white,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    connectivity.isOnline.value
                        ? '${sync.pendingCount.value} record(s) pending sync'
                        : 'Offline mode — changes saved locally',
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
                if (connectivity.isOnline.value && sync.pendingCount.value > 0)
                  TextButton(
                    onPressed: sync.syncPendingRecords,
                    child: const Text('Sync Now', style: TextStyle(color: Colors.white)),
                  ),
              ],
            ),
          ),
        ),
      );
    });
  }
}
