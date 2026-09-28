import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import 'animated_entrance.dart';

/// KPI metric card for dashboard grid.
class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.color,
    this.onTap,
    this.animationIndex = 0,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color? color;
  final VoidCallback? onTap;
  final int animationIndex;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? AppColors.primary;
    return FadeSlideIn(
      index: animationIndex,
      child: PressScale(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadii.card,
            color: AppColors.surface,
            boxShadow: AppShadows.card,
            border: Border.all(color: accent.withValues(alpha: 0.12)),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: AppRadii.card,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                      ),
                      child: Icon(icon, color: accent, size: 22),
                    ),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(value, style: AppTextStyles.headlineMedium.copyWith(fontSize: 22)),
                    ),
                    Text(title, style: AppTextStyles.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
