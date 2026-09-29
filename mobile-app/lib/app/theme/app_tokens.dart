import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Layout & visual tokens (Material 3 fintech field app).
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double minTouch = 48;
}

class AppRadii {
  AppRadii._();

  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double pill = 24;

  static BorderRadius get card => BorderRadius.circular(md);
  static BorderRadius get button => BorderRadius.circular(sm);
  static BorderRadius get input => BorderRadius.circular(sm);
}

class AppShadows {
  AppShadows._();

  static List<BoxShadow> card = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> elevated = [
    BoxShadow(
      color: AppColors.primary.withValues(alpha: 0.18),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];
}

class AppDecorations {
  AppDecorations._();

  static BoxDecoration surfaceCard({Color? borderColor}) => BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: borderColor ?? AppColors.divider.withValues(alpha: 0.6)),
        boxShadow: AppShadows.card,
      );

  static BoxDecoration primaryGradient({BorderRadius? radius}) => BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryDark, AppColors.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: radius ?? AppRadii.card,
      );

  static InputDecoration field({
    required String label,
    String? hint,
    String? subtitleEn,
    Widget? prefix,
    Widget? suffix,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      helperText: subtitleEn,
      helperMaxLines: 2,
      prefixIcon: prefix,
      suffixIcon: suffix,
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 14),
      border: OutlineInputBorder(borderRadius: AppRadii.input),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadii.input,
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadii.input,
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
    );
  }
}
