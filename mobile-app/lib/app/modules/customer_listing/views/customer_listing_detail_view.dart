import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../widgets/photo_image.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/services/maps_navigation_service.dart';
import '../../../utils/access_control.dart';
import '../../tracking/views/map_view.dart';
import '../../tracking/bindings/tracking_binding.dart';
import '../controllers/customer_listing_list_controller.dart';
import '../widgets/gps_photo_tile.dart';

class CustomerListingDetailView extends StatefulWidget {
  const CustomerListingDetailView({super.key});

  @override
  State<CustomerListingDetailView> createState() => _CustomerListingDetailViewState();
}

class _CustomerListingDetailViewState extends State<CustomerListingDetailView> {
  late CustomerListingModel listing;
  final player = AudioPlayer();

  @override
  void initState() {
    super.initState();
    listing = Get.arguments as CustomerListingModel;
  }

  @override
  void dispose() {
    player.dispose();
    super.dispose();
  }

  Future<void> _showAssignSheet() async {
    final listCtrl = Get.find<CustomerListingListController>();
    if (listCtrl.fieldOfficers.isEmpty) await listCtrl.loadFieldOfficers();
    if (listCtrl.fieldOfficers.isEmpty) {
      Get.snackbar('No officers', 'Create a Field Officer from Team & Roles first');
      return;
    }

    final selected = await Get.bottomSheet<Map<String, dynamic>>(
      SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Assign Field Officer', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text(
                'Listing will be linked to this FO for follow-up.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              ...listCtrl.fieldOfficers.map((fo) {
                final name = fo['name']?.toString() ?? '';
                final empId = fo['employeeId']?.toString() ?? '';
                final mobile = fo['mobile']?.toString() ?? '';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: const TextStyle(color: AppColors.primary),
                    ),
                  ),
                  title: Text(name),
                  subtitle: Text('$empId • $mobile'),
                  onTap: () => Get.back(result: fo),
                );
              }),
            ],
          ),
        ),
      ),
      isScrollControlled: true,
    );

    if (selected == null) return;
    final updated = await listCtrl.assignOfficer(
      listing,
      employeeId: selected['employeeId']?.toString() ?? '',
      employeeName: selected['name']?.toString() ?? '',
    );
    if (updated != null && mounted) setState(() => listing = updated);
  }

  @override
  Widget build(BuildContext context) {
    final mapsNav = Get.find<MapsNavigationService>();
    final canAssign = AccessControl.canManageTeam;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Listing Details'),
        actions: [
          if (canAssign)
            IconButton(
              tooltip: 'Assign FO',
              icon: const Icon(Icons.person_add_alt_1),
              onPressed: _showAssignSheet,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: CustomerListingStatusChip(status: listing.status)),
            const SizedBox(height: 12),
            if (canAssign)
              Card(
                color: AppColors.primary.withValues(alpha: 0.06),
                child: ListTile(
                  leading: const Icon(Icons.assignment_ind, color: AppColors.primary),
                  title: Text(
                    listing.assignedToName?.isNotEmpty == true
                        ? 'Assigned: ${listing.assignedToName}'
                        : 'Not assigned yet',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    listing.assignedToEmployeeId != null
                        ? 'Employee ID: ${listing.assignedToEmployeeId}'
                        : 'Tap Assign to give this listing to a Field Officer',
                  ),
                  trailing: ElevatedButton(
                    onPressed: _showAssignSheet,
                    child: Text(listing.assignedToName == null ? 'Assign' : 'Reassign'),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(listing.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _row(Icons.phone, listing.mobile),
                    _row(Icons.badge, 'Aadhaar: ${listing.aadhaar}'),
                    _row(Icons.credit_card, 'PAN: ${listing.pan}'),
                    _row(Icons.store, listing.shopFullAddress),
                    if (listing.assignedToName != null) ...[
                      const SizedBox(height: 6),
                      _row(Icons.person_pin, 'FO: ${listing.assignedToName}'),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _action(Icons.phone, 'Call', AppColors.success, () async {
                          final uri = Uri(scheme: 'tel', path: listing.mobile);
                          if (await canLaunchUrl(uri)) launchUrl(uri);
                        }),
                        _action(Icons.message, 'WhatsApp', Colors.green, () async {
                          final uri = Uri.parse('https://wa.me/91${listing.mobile}');
                          if (await canLaunchUrl(uri)) {
                            launchUrl(uri, mode: LaunchMode.externalApplication);
                          }
                        }),
                        _action(Icons.sms, 'SMS', AppColors.primary, () async {
                          final uri = Uri(scheme: 'sms', path: listing.mobile);
                          if (await canLaunchUrl(uri)) launchUrl(uri);
                        }),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            _section('Documents & Photos', [
              if (listing.customerPhoto != null) _photoCard('Customer Photo', listing.customerPhoto!),
              if (listing.aadhaarFront != null) _photoCard('Aadhaar Front', listing.aadhaarFront!),
              if (listing.aadhaarBack != null) _photoCard('Aadhaar Back', listing.aadhaarBack!),
              if (listing.panFront != null) _photoCard('PAN Front', listing.panFront!),
              if (listing.shopPhoto1 != null) _photoCard('Shop Photo 1', listing.shopPhoto1!),
              if (listing.shopPhoto2 != null) _photoCard('Shop Photo 2', listing.shopPhoto2!),
              if (listing.shopPhoto3 != null) _photoCard('Shop Photo 3', listing.shopPhoto3!),
              if (listing.shopPhoto4 != null) _photoCard('Shop Photo 4', listing.shopPhoto4!),
            ]),
            _section('Shop Location (Saved Permanently)', [
              _row(Icons.location_on, 'Lat: ${listing.shopLatitude.toStringAsFixed(6)}'),
              _row(Icons.location_on, 'Lng: ${listing.shopLongitude.toStringAsFixed(6)}'),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: listing.hasShopLocation
                          ? () => Get.to(
                                () => MapView.customer(
                                  lat: listing.shopLatitude,
                                  lng: listing.shopLongitude,
                                  name: listing.name,
                                ),
                                binding: TrackingBinding(),
                              )
                          : null,
                      icon: const Icon(Icons.map),
                      label: const Text('View Map'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: listing.hasShopLocation
                          ? () => mapsNav.openInGoogleMaps(
                                latitude: listing.shopLatitude,
                                longitude: listing.shopLongitude,
                                label: listing.name,
                              )
                          : null,
                      icon: const Icon(Icons.directions),
                      label: const Text('Get Directions'),
                    ),
                  ),
                ],
              ),
            ]),
            _section('Neighbor Shop Verification', [
              ...listing.neighbors.asMap().entries.map((e) {
                final n = e.value;
                if (n.shopName.isEmpty && n.remarks.isEmpty) return const SizedBox.shrink();
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(n.shopName.isEmpty ? 'Neighbor ${e.key + 1}' : n.shopName),
                    subtitle: Text(n.remarks),
                    trailing: n.voiceRecordingPath != null
                        ? IconButton(
                            icon: const Icon(Icons.play_circle, color: AppColors.primary),
                            onPressed: () async {
                              await player.play(DeviceFileSource(n.voiceRecordingPath!));
                            },
                          )
                        : null,
                  ),
                );
              }),
            ]),
            Text(
              'Created: ${DateFormat('dd MMM yyyy, hh:mm a').format(listing.createdAt)}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }

  Widget _row(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, Color color, VoidCallback onTap) {
    return Column(
      children: [
        IconButton(onPressed: onTap, icon: Icon(icon, color: color)),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  Widget _photoCard(String label, GpsPhotoCapture photo) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: PhotoImage(path: photo.filePath, width: 56, height: 56),
        ),
        title: Text(label),
        subtitle: Text(
          'GPS ${photo.latitude.toStringAsFixed(4)}, ${photo.longitude.toStringAsFixed(4)}',
          style: const TextStyle(fontSize: 11),
        ),
      ),
    );
  }
}
