import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../data/models/customer_model.dart';
import '../../../data/services/maps_navigation_service.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../tracking/views/map_view.dart';
import '../../tracking/bindings/tracking_binding.dart';
import '../controllers/customers_controller.dart';
import '../../../data/services/api_constants.dart';
import '../../../widgets/streaming_recording_player.dart';

class CustomerDetailView extends GetView<CustomersController> {
  const CustomerDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    final customer = Get.arguments as CustomerModel;
    final mapsNav = Get.find<MapsNavigationService>();

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: const CustomAppBar(title: 'Customer', subtitle: 'Profile'),
        body: Column(
          children: [
            Container(
              margin: const EdgeInsets.all(AppSpacing.md),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppRadii.card,
                  boxShadow: AppShadows.card),
              child: Column(
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor:
                            AppColors.primary.withValues(alpha: 0.14),
                        child: Text(
                            customer.name.isEmpty ? '?' : customer.name[0],
                            style: const TextStyle(
                                fontSize: 24,
                                color: AppColors.primaryDark,
                                fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(customer.name,
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w800)),
                            Text(customer.mobile,
                                style: const TextStyle(
                                    color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text('Customer',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accentDark)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          controller.whatsappCustomer(customer.mobile),
                      icon: const Icon(Icons.chat_rounded),
                      label: const Text('WhatsApp'),
                    ),
                  ),
                ],
              ),
            ),
            const TabBar(
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              indicatorColor: AppColors.primary,
              tabs: [
                Tab(text: 'Details'),
                Tab(text: 'Verification'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _detailsTab(customer, mapsNav),
                  _applicationsTab(customer),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailsTab(CustomerModel customer, MapsNavigationService mapsNav) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        _infoSection('Personal Info', [
          _row('Full Name', customer.name),
          _row('Mobile', customer.mobile),
          _row('Address', customer.address.isEmpty ? '—' : customer.address),
          _row('Aadhaar', customer.aadhaar.isEmpty ? '—' : customer.aadhaar),
          _row('PAN', customer.pan.isEmpty ? '—' : customer.pan),
          _row('Created', DateFormat('dd MMM yyyy').format(customer.createdAt)),
        ]),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () {
            if (customer.latitude != null && customer.longitude != null) {
              Get.to(
                () => MapView.customer(
                    lat: customer.latitude!,
                    lng: customer.longitude!,
                    name: customer.name),
                binding: TrackingBinding(),
              );
            } else {
              Get.snackbar('Location', 'Customer location not available');
            }
          },
          icon: const Icon(Icons.map_rounded),
          label: const Text('View on map'),
        ),
        if (Platform.isAndroid)
          OutlinedButton.icon(
            onPressed: () {
              if (customer.latitude != null && customer.longitude != null) {
                mapsNav.openInGoogleMaps(
                  latitude: customer.latitude!,
                  longitude: customer.longitude!,
                  label: customer.name,
                );
              }
            },
            icon: const Icon(Icons.navigation_rounded),
            label: const Text('Navigate'),
          ),
      ],
    );
  }

  Widget _applicationsTab(CustomerModel customer) {
    final verification = customer.verification;
    final photos = verification['photos'] is List
        ? verification['photos'] as List
        : <dynamic>[];
    final neighbors = verification['neighbors'] is List
        ? verification['neighbors'] as List
        : <dynamic>[];
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text(
          verification['status'] == 'listed'
              ? 'Approved customer verification'
              : 'Saved customer documents',
          style: const TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 12),
      if (photos.isEmpty)
        const Text('No verification photos were saved for this customer.'),
      for (final item in photos.whereType<Map>()) ...[
        Text('${item['label'] ?? 'Document'}',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        if (_uploadUrl(item['media']) case final String url)
          InkWell(
              onTap: () => Get.dialog(Dialog(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                            onPressed: Get.back, child: const Text('Close'))),
                    Flexible(
                        child: InteractiveViewer(
                            child: Image.network(url,
                                fit: BoxFit.contain,
                                errorBuilder: (_, __, ___) => const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Text(
                                        'Unable to load document. Reopen customer to refresh access.'))))),
                  ]))),
              child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Image.network(url,
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Text(
                          'Document unavailable. Reopen customer to refresh.'))))
        else
          const Text('Document unavailable'),
        const SizedBox(height: 16),
      ],
      const Text('Neighbor verification',
          style: TextStyle(fontWeight: FontWeight.bold)),
      if (neighbors.isEmpty) const Text('No neighbor notes recorded.'),
      for (final neighbor in neighbors.whereType<Map>())
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${neighbor['shopName'] ?? 'Neighbor'}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text('${neighbor['remarks'] ?? ''}'),
              if (_uploadUrl(neighbor['voiceRecordingPath'])
                  case final String url)
                StreamingRecordingPlayer(recordingUrl: url),
            ])),
    ]);
  }

  String? _uploadUrl(dynamic media) {
    final value = media is Map ? media['filePath'] : media;
    if (value is! String) return null;
    final index = value.indexOf('/uploads/');
    if (index < 0) return null;
    return '${Uri.parse(ApiConstants.baseUrl).origin}${value.substring(index)}';
  }

  Widget _infoSection(String title, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: AppRadii.card,
          boxShadow: AppShadows.card),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 110,
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 13))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13))),
        ],
      ),
    );
  }
}
