import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/models/customer_listing_model.dart';
import '../data/services/upload_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import 'listing_approval_timeline.dart';
import 'status_badge.dart';

class ApplicationDetailSheet {
  static void show(CustomerListingModel listing) {
    Get.bottomSheet(
      DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scroll) {
          return Material(
            color: AppColors.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(listing.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    ),
                    StatusBadge.listing(listing.status),
                  ],
                ),
                const SizedBox(height: 6),
                Text(listing.id, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 16),
                ListingApprovalTimeline(status: listing.status),
                const SizedBox(height: 12),
                _section('Customer', [
                  _row('Name', listing.name),
                  _row('Mobile', listing.mobile),
                  _row('Aadhaar', listing.aadhaar.isEmpty ? '—' : listing.aadhaar),
                  _row('PAN', listing.pan.isEmpty ? '—' : listing.pan),
                  _row('Created', DateFormat('dd MMM yyyy, HH:mm').format(listing.createdAt)),
                  if (listing.listedAt != null)
                    _row('Listed', DateFormat('dd MMM yyyy, HH:mm').format(listing.listedAt!)),
                ]),
                const SizedBox(height: 12),
                _section('Shop', [
                  _row('Address', listing.shopFullAddress.isEmpty ? '—' : listing.shopFullAddress),
                  _row(
                    'GPS',
                    listing.hasShopLocation
                        ? '${listing.shopLatitude.toStringAsFixed(6)}, ${listing.shopLongitude.toStringAsFixed(6)}'
                        : '—',
                  ),
                ]),
                if (listing.hasShopLocation) ...[
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse(
                        'https://www.google.com/maps/search/?api=1&query=${listing.shopLatitude},${listing.shopLongitude}',
                      ),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('View map'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse(
                        'https://www.google.com/maps/dir/?api=1&destination=${listing.shopLatitude},${listing.shopLongitude}',
                      ),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.directions_rounded),
                    label: const Text('Get directions'),
                  ),
                ],
                const SizedBox(height: 16),
                const Text('Photos and documents', style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                _photo('Customer photo', listing.customerPhoto),
                _photo('Aadhaar front', listing.aadhaarFront),
                _photo('Aadhaar back', listing.aadhaarBack),
                _photo('PAN front', listing.panFront),
                _photo('Shop photo 1', listing.shopPhoto1),
                _photo('Shop photo 2', listing.shopPhoto2),
                _photo('Shop photo 3', listing.shopPhoto3),
                _photo('Shop photo 4', listing.shopPhoto4),
                const SizedBox(height: 8),
                const Text('Neighbor shops', style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                if (listing.neighbors.isEmpty)
                  const Text('No neighbor notes', style: TextStyle(color: AppColors.textSecondary))
                else
                  ...listing.neighbors.map(_neighbor),
              ],
            ),
          );
        },
      ),
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
    );
  }

  static Widget _neighbor(NeighborVerification n) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(n.shopName.isEmpty ? 'Shop' : n.shopName, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(n.remarks.isEmpty ? '—' : n.remarks),
          if (n.voiceRecordingPath != null && n.voiceRecordingPath!.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Voice note saved', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

  static Widget _photo(String label, GpsPhotoCapture? photo) {
    if (photo == null || photo.filePath.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(aspectRatio: 16 / 10, child: _image(photo.filePath)),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  '${photo.latitude.toStringAsFixed(6)}, ${photo.longitude.toStringAsFixed(6)} · ${DateFormat('dd MMM yyyy HH:mm').format(photo.capturedAt)}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static Widget _image(String path) {
    if (path.startsWith('http') || path.startsWith('/uploads')) {
      final url = path.startsWith('http') ? path : Get.find<UploadService>().fullUrl(path);
      return Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined));
    }
    return Image.file(File(path), fit: BoxFit.cover);
  }

  static Widget _section(String title, List<Widget> rows) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          ...rows,
        ],
      ),
    );
  }

  static Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 88, child: Text(k, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        ],
      ),
    );
  }
}
