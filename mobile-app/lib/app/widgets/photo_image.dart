import 'dart:io';
import 'package:flutter/material.dart';
import '../data/services/api_constants.dart';

/// Local file ya server URL dono se photo dikhata hai.
class PhotoImage extends StatelessWidget {
  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;

  const PhotoImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  bool get _isNetwork => path.startsWith('http') || path.startsWith('/uploads');

  @override
  Widget build(BuildContext context) {
    if (_isNetwork) {
      final origin = ApiConstants.baseUrl.replaceAll('/api/v1', '');
      final url = path.startsWith('http') ? path : '$origin$path';
      return Image.network(
        url,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _placeholder(),
      );
    }
    return Image.file(
      File(path),
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, __, ___) => _placeholder(),
    );
  }

  Widget _placeholder() => Container(
        width: width,
        height: height,
        color: Colors.grey.shade200,
        child: const Icon(Icons.broken_image),
      );
}
