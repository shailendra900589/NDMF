import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/form_widgets.dart';
import '../controllers/customer_listing_form_controller.dart';
import '../widgets/gps_photo_tile.dart';

class NewCustomerListingView extends GetView<CustomerListingFormController> {
  const NewCustomerListingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Customer Listing')),
      body: Obx(() => Column(
            children: [
              _stepBar(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _stepContent(context),
                ),
              ),
              _navButtons(),
            ],
          )),
    );
  }

  Widget _stepBar() {
    const steps = ['Info', 'KYC', 'Shop Photos', 'Address & GPS', 'Neighbors', 'Submit'];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      color: AppColors.primary.withValues(alpha: 0.06),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: List.generate(steps.length, (i) {
            final active = i <= controller.currentStep.value;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: active ? AppColors.primary : AppColors.divider,
                    child: Text('${i + 1}', style: TextStyle(fontSize: 11, color: active ? Colors.white : AppColors.textSecondary)),
                  ),
                  Text(steps[i], style: TextStyle(fontSize: 9, color: active ? AppColors.primary : AppColors.textSecondary)),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _stepContent(BuildContext context) {
    switch (controller.currentStep.value) {
      case 0:
        return Column(
          children: [
            AppTextField(label: 'Customer Name *', controller: controller.nameCtrl),
            const SizedBox(height: 12),
            AppTextField(label: 'Mobile Number *', controller: controller.mobileCtrl, keyboardType: TextInputType.phone),
            const SizedBox(height: 12),
            AppTextField(label: 'Aadhaar Number', controller: controller.aadhaarCtrl, keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            AppTextField(label: 'PAN Number', controller: controller.panCtrl),
          ],
        );
      case 1:
        return GetBuilder<CustomerListingFormController>(
          id: 'photos',
          builder: (_) => Column(
            children: [
              const Text('All photos via Live GPS Camera only', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const SizedBox(height: 8),
              GpsPhotoTile(
                label: 'Customer Photo *',
                capture: controller.listing.customerPhoto,
                onCapture: () => controller.capturePhoto((p) => controller.listing.customerPhoto = p, 'Customer Photo'),
              ),
              GpsPhotoTile(
                label: 'Aadhaar Front *',
                capture: controller.listing.aadhaarFront,
                onCapture: () => controller.capturePhoto((p) => controller.listing.aadhaarFront = p, 'Aadhaar Front'),
              ),
              GpsPhotoTile(
                label: 'Aadhaar Back *',
                capture: controller.listing.aadhaarBack,
                onCapture: () => controller.capturePhoto((p) => controller.listing.aadhaarBack = p, 'Aadhaar Back'),
              ),
              GpsPhotoTile(
                label: 'PAN Card Front *',
                capture: controller.listing.panFront,
                onCapture: () => controller.capturePhoto((p) => controller.listing.panFront = p, 'PAN Front'),
              ),
            ],
          ),
        );
      case 2:
        return GetBuilder<CustomerListingFormController>(
          id: 'photos',
          builder: (_) => Column(
            children: [
              GpsPhotoTile(label: 'Shop Photo 1 *', capture: controller.listing.shopPhoto1,
                  onCapture: () => controller.capturePhoto((p) => controller.listing.shopPhoto1 = p, 'Shop 1')),
              GpsPhotoTile(label: 'Shop Photo 2 *', capture: controller.listing.shopPhoto2,
                  onCapture: () => controller.capturePhoto((p) => controller.listing.shopPhoto2 = p, 'Shop 2')),
              GpsPhotoTile(label: 'Shop Photo 3 *', capture: controller.listing.shopPhoto3,
                  onCapture: () => controller.capturePhoto((p) => controller.listing.shopPhoto3 = p, 'Shop 3')),
              GpsPhotoTile(label: 'Shop Photo 4 *', capture: controller.listing.shopPhoto4,
                  onCapture: () => controller.capturePhoto((p) => controller.listing.shopPhoto4 = p, 'Shop 4')),
            ],
          ),
        );
      case 3:
        return GetBuilder<CustomerListingFormController>(
          id: 'gps',
          builder: (_) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppTextField(label: 'Shop Full Address *', controller: controller.shopAddressCtrl, maxLines: 3),
              const SizedBox(height: 16),
              Obx(() => controller.isCapturingGps.value
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton.icon(
                      onPressed: controller.captureShopGps,
                      icon: const Icon(Icons.my_location),
                      label: const Text('Capture Shop GPS Location'),
                    )),
              const SizedBox(height: 16),
              if (controller.listing.hasShopLocation) ...[
                _infoTile('Latitude', controller.listing.shopLatitude.toStringAsFixed(6)),
                _infoTile('Longitude', controller.listing.shopLongitude.toStringAsFixed(6)),
                const Text('Location saved permanently for future directions',
                    style: TextStyle(fontSize: 12, color: AppColors.success)),
              ],
            ],
          ),
        );
      case 4:
        return GetBuilder<CustomerListingFormController>(
          id: 'neighbors',
          builder: (_) => Column(
            children: List.generate(3, (i) => _neighborCard(i)),
          ),
        );
      default:
        return Column(
          children: [
            const Icon(Icons.check_circle_outline, size: 72, color: AppColors.success),
            const SizedBox(height: 12),
            const Text('Review & Submit', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Customer will go to Branch Approval → Admin Approval → Listed'),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Name: ${controller.nameCtrl.text}'),
                    Text('Mobile: ${controller.mobileCtrl.text}'),
                    Text('Shop: ${controller.shopAddressCtrl.text}'),
                    Text('Photos: ${controller.listing.allPhotos.length} captured'),
                  ],
                ),
              ),
            ),
          ],
        );
    }
  }

  Widget _infoTile(String label, String value) {
    return Card(
      child: ListTile(title: Text(label, style: const TextStyle(fontSize: 12)), subtitle: Text(value)),
    );
  }

  Widget _neighborCard(int index) {
    final n = controller.listing.neighbors[index];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Neighbor Shop ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary)),
            const SizedBox(height: 8),
            TextFormField(
              initialValue: n.shopName,
              decoration: const InputDecoration(labelText: 'Shop Name'),
              onChanged: (v) => n.shopName = v,
            ),
            const SizedBox(height: 8),
            TextFormField(
              initialValue: n.remarks,
              decoration: const InputDecoration(labelText: 'What did they say about customer?'),
              maxLines: 3,
              onChanged: (v) => n.remarks = v,
            ),
            const SizedBox(height: 8),
            Obx(() {
              final recording = controller.recordingNeighborIndex.value == index;
              return Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () => controller.toggleNeighborRecording(index),
                    icon: Icon(recording ? Icons.stop : Icons.mic),
                    label: Text(recording ? 'Stop Recording' : 'Voice Record'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: recording ? AppColors.error : AppColors.accent,
                    ),
                  ),
                  if (n.voiceRecordingPath != null) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.check_circle, color: AppColors.success, size: 20),
                    const Text(' Saved', style: TextStyle(fontSize: 12, color: AppColors.success)),
                  ],
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _navButtons() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          if (controller.currentStep.value > 0)
            Expanded(child: OutlinedButton(onPressed: controller.previousStep, child: const Text('Back'))),
          if (controller.currentStep.value > 0) const SizedBox(width: 12),
          Expanded(
            child: Obx(() {
              final last = controller.currentStep.value == 5;
              return ElevatedButton(
                onPressed: controller.isLoading.value ? null : (last ? controller.submitListing : controller.nextStep),
                child: controller.isLoading.value
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(last ? 'Submit for Approval' : 'Next'),
              );
            }),
          ),
        ],
      ),
    );
  }
}
