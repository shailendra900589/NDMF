import 'dart:io';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AppTextField extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int maxLines;
  final Widget? suffix;
  final void Function(String)? onChanged;
  final bool readOnly;
  final VoidCallback? onTap;

  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.validator,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
    this.suffix,
    this.onChanged,
    this.readOnly = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      obscureText: obscureText,
      maxLines: maxLines,
      onChanged: onChanged,
      readOnly: readOnly,
      onTap: onTap,
      decoration: InputDecoration(
        labelText: label,
        suffix: suffix,
      ),
    );
  }
}

class AppDropdown<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final void Function(T?) onChanged;

  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: items,
      onChanged: onChanged,
      borderRadius: BorderRadius.circular(12),
      dropdownColor: Colors.white,
    );
  }
}

class PhotoCaptureTile extends StatelessWidget {
  final String label;
  final String? imagePath;
  final VoidCallback onCapture;
  final VoidCallback? onPreview;

  const PhotoCaptureTile({
    super.key,
    required this.label,
    this.imagePath,
    required this.onCapture,
    this.onPreview,
  });

  @override
  Widget build(BuildContext context) {
    final hasImage = imagePath != null && imagePath!.isNotEmpty;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: hasImage ? AppColors.primary.withValues(alpha: 0.1) : AppColors.divider,
            borderRadius: BorderRadius.circular(8),
          ),
          child: hasImage
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(
                    File(imagePath!),
                    fit: BoxFit.cover,
                    width: 48,
                    height: 48,
                    errorBuilder: (_, __, ___) =>
                        const Icon(Icons.check_circle, color: AppColors.success),
                  ),
                )
              : const Icon(Icons.camera_alt, color: AppColors.textSecondary),
        ),
        title: Text(label, style: const TextStyle(fontSize: 14)),
        subtitle: Text(hasImage ? 'Captured' : 'Tap to capture', style: const TextStyle(fontSize: 12)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasImage && onPreview != null)
              IconButton(
                icon: const Icon(Icons.visibility, color: AppColors.primary),
                onPressed: onPreview,
              ),
            IconButton(
              icon: Icon(hasImage ? Icons.refresh : Icons.add_a_photo, color: AppColors.accent),
              onPressed: onCapture,
            ),
          ],
        ),
      ),
    );
  }
}
