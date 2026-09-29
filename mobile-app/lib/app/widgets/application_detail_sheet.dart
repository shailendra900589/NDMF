import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../data/models/customer_listing_model.dart';
import '../data/models/enums/app_enums.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import 'listing_approval_timeline.dart';
import 'status_badge.dart';

class ApplicationDetailSheet {
  static void show(CustomerListingModel listing) {
    Get.bottomSheet(
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(listing.id, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    ),
                    StatusBadge.listing(listing.status),
                  ],
                ),
                const SizedBox(height: 16),
                _section('Customer', [
                  _row('Name', listing.name),
                  _row('Mobile', listing.mobile),
                  _row('City', listing.shopFullAddress.isNotEmpty ? listing.shopFullAddress.split(',').first : '—'),
                ]),
                const SizedBox(height: 12),
                _section('Application', [
                  _row('Status', listing.status.label),
                  _row('Created', DateFormat('dd MMM yyyy').format(listing.createdAt)),
                  if (listing.listedAt != null) _row('Listed', DateFormat('dd MMM yyyy').format(listing.listedAt!)),
                ]),
                const SizedBox(height: 12),
                ListingApprovalTimeline(status: listing.status),
              ],
            ),
          ),
        ),
      ),
      backgroundColor: AppColors.background,
      isScrollControlled: true,
    );
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
        children: [
          SizedBox(width: 100, child: Text(k, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        ],
      ),
    );
  }
}
