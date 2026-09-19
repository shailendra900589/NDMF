import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../widgets/photo_image.dart';
import '../../../theme/app_colors.dart';
import '../../../data/models/customer_listing_model.dart';
import '../../../data/models/enums/app_enums.dart';

class GpsPhotoTile extends StatelessWidget {
  final String label;
  final GpsPhotoCapture? capture;
  final VoidCallback onCapture;
  final VoidCallback? onPreview;

  const GpsPhotoTile({
    super.key,
    required this.label,
    this.capture,
    required this.onCapture,
    this.onPreview,
  });

  @override
  Widget build(BuildContext context) {
    final hasPhoto = capture != null;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: hasPhoto
                  ? PhotoImage(path: capture!.filePath, width: 64, height: 64)
                  : Container(
                      width: 64,
                      height: 64,
                      color: AppColors.divider,
                      child: const Icon(Icons.camera_alt, color: AppColors.textSecondary),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 4),
                  Text(
                    hasPhoto ? 'Live GPS captured' : 'Tap to capture live photo',
                    style: TextStyle(fontSize: 12, color: hasPhoto ? AppColors.success : AppColors.textSecondary),
                  ),
                  if (hasPhoto) ...[
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('dd/MM/yyyy HH:mm').format(capture!.capturedAt),
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                    Text(
                      'Lat: ${capture!.latitude.toStringAsFixed(5)}, Lng: ${capture!.longitude.toStringAsFixed(5)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              children: [
                if (hasPhoto && onPreview != null)
                  IconButton(icon: const Icon(Icons.visibility, color: AppColors.primary), onPressed: onPreview),
                IconButton(
                  icon: Icon(hasPhoto ? Icons.refresh : Icons.add_a_photo, color: AppColors.accent),
                  onPressed: onCapture,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerListingStatusChip extends StatelessWidget {
  final CustomerListingStatus status;
  final bool compact;
  const CustomerListingStatusChip({super.key, required this.status, this.compact = false});

  Color get _color {
    switch (status) {
      case CustomerListingStatus.draft:
        return AppColors.textSecondary;
      case CustomerListingStatus.branchPending:
        return Colors.blue;
      case CustomerListingStatus.adminPending:
        return Colors.purple;
      case CustomerListingStatus.listed:
        return AppColors.success;
      case CustomerListingStatus.rejected:
        return AppColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _color.withValues(alpha: 0.4)),
      ),
      child: Text(
        compact ? status.chipLabel : status.label,
        style: TextStyle(color: _color, fontSize: compact ? 10 : 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
