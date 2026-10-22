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
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
              child: Column(
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: AppColors.primary.withValues(alpha: 0.14),
                        child: Text(customer.name[0], style: const TextStyle(fontSize: 24, color: AppColors.primaryDark, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(customer.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                            Text(customer.mobile, style: const TextStyle(color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text('Lead', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.accentDark)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => controller.whatsappCustomer(customer.mobile),
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
                Tab(text: 'Listing'),
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
                () => MapView.customer(lat: customer.latitude!, lng: customer.longitude!, name: customer.name),
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
    return Center(
      child: Text(
        customer.listingId != null ? 'Listing ${customer.listingId}' : 'No linked customer listing',
        style: const TextStyle(color: AppColors.textSecondary),
      ),
    );
  }

  Widget _infoSection(String title, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
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
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        ],
      ),
    );
  }
}
