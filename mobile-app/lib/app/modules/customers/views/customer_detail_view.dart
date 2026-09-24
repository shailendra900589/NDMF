import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/customer_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/maps_navigation_service.dart';
import '../../tracking/views/map_view.dart';
import '../../tracking/bindings/tracking_binding.dart';
import '../controllers/customers_controller.dart';

class CustomerDetailView extends GetView<CustomersController> {
  const CustomerDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    final customer = Get.arguments as CustomerModel;
    final mapsNav = Get.find<MapsNavigationService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Customer Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      child: Text(customer.name[0], style: const TextStyle(fontSize: 32, color: AppColors.primary)),
                    ),
                    const SizedBox(height: 12),
                    Text(customer.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                    Text(customer.mobile, style: const TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _actionBtn(Icons.phone, 'Call', AppColors.success,
                            () => controller.callCustomer(customer.name, customer.mobile)),
                        _actionBtn(Icons.message, 'WhatsApp', Colors.green,
                            () => controller.whatsappCustomer(customer.mobile)),
                        _actionBtn(Icons.sms, 'SMS', AppColors.primary,
                            () => controller.smsCustomer(customer.mobile)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _infoSection('Personal Info', [
              _row('Address', customer.address),
              _row('Aadhaar', customer.aadhaar),
              _row('PAN', customer.pan),
            ]),
            _infoSection('Location', [
              if (customer.latitude != null) _row('Latitude', '${customer.latitude}'),
              if (customer.longitude != null) _row('Longitude', '${customer.longitude}'),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        if (customer.latitude != null && customer.longitude != null) {
                          Get.to(
                            () => MapView.customer(
                              lat: customer.latitude!,
                              lng: customer.longitude!,
                              name: customer.name,
                            ),
                            binding: TrackingBinding(),
                          );
                        } else {
                          Get.snackbar('Location', 'Customer location not available');
                        }
                      },
                      icon: const Icon(Icons.map),
                      label: const Text('View Map'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: customer.latitude != null && customer.longitude != null
                          ? () => mapsNav.openInGoogleMaps(
                                latitude: customer.latitude!,
                                longitude: customer.longitude!,
                                label: customer.name,
                              )
                          : null,
                      icon: const Icon(Icons.directions),
                      label: const Text('Directions'),
                    ),
                  ),
                ],
              ),
            ]),
            _infoSection('Loan History', [
              if (customer.loanHistory.isEmpty)
                const Text('No loan history', style: TextStyle(color: AppColors.textSecondary))
              else
                ...customer.loanHistory.map((l) => ListTile(
                      title: Text('₹${l.business.loanAmount.toStringAsFixed(0)}'),
                      subtitle: Text(l.status.label),
                    )),
            ]),
            _infoSection('Documents', [
              if (customer.documentPaths.isEmpty)
                const Text('No documents uploaded', style: TextStyle(color: AppColors.textSecondary))
              else
                SizedBox(
                  height: 80,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: customer.documentPaths.length,
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          File(customer.documentPaths[i]),
                          width: 80,
                          height: 80,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 80,
                            color: AppColors.divider,
                            child: const Icon(Icons.image),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _actionBtn(IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 12, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _infoSection(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: AppColors.primary)),
            const Divider(),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 80, child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
