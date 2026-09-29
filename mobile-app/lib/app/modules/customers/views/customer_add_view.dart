import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/customers_controller.dart';

class CustomerAddView extends GetView<CustomersController> {
  const CustomerAddView({super.key});

  Future<void> _captureGps() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition();
      controller.addLatitude.value = pos.latitude;
      controller.addLongitude.value = pos.longitude;
      Get.snackbar('GPS', 'Location captured');
    } catch (e) {
      Get.snackbar('GPS', 'Could not get location');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Add customer', subtitle: 'Master list entry'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: controller.addNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name *'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.addMobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Mobile *',
                counterText: '',
                prefixText: '+91 ',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.addAddressCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Address / City'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.addAadhaarCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Aadhaar (optional)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.addPanCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'PAN (optional)'),
            ),
            const SizedBox(height: 16),
            Obx(() {
              final lat = controller.addLatitude.value;
              final lng = controller.addLongitude.value;
              return OutlinedButton.icon(
                onPressed: _captureGps,
                icon: const Icon(Icons.my_location_rounded),
                label: Text(
                  lat != null && lng != null
                      ? 'GPS: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}'
                      : 'Capture live GPS (optional)',
                ),
              );
            }),
            const SizedBox(height: 24),
            Obx(() => FilledButton(
                  onPressed: controller.isSavingCustomer.value ? null : controller.createCustomer,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    minimumSize: const Size(double.infinity, 52),
                  ),
                  child: controller.isSavingCustomer.value
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save customer', style: TextStyle(fontWeight: FontWeight.w800)),
                )),
          ],
        ),
      ),
    );
  }
}
