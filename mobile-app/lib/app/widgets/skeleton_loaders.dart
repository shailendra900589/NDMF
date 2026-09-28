import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';

class _ShimmerBox extends StatefulWidget {
  const _ShimmerBox({required this.height, required this.width, this.radius = AppRadii.sm});

  final double height;
  final double width;
  final double radius;

  @override
  State<_ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<_ShimmerBox> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        return Container(
          height: widget.height,
          width: widget.width,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(-1 + t * 2, 0),
              end: Alignment(1 + t * 2, 0),
              colors: [
                AppColors.divider.withValues(alpha: 0.5),
                AppColors.divider.withValues(alpha: 0.25),
                AppColors.divider.withValues(alpha: 0.5),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Skeleton placeholder for list rows.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.md),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, __) => Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: AppDecorations.surfaceCard(),
        child: const Row(
          children: [
            _ShimmerBox(height: 48, width: 48, radius: 24),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ShimmerBox(height: 14, width: double.infinity),
                  SizedBox(height: 8),
                  _ShimmerBox(height: 12, width: 120),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton for dashboard KPI grid.
class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: [
          const _ShimmerBox(height: 120, width: double.infinity, radius: AppRadii.lg),
          const SizedBox(height: AppSpacing.md),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacing.sm,
            crossAxisSpacing: AppSpacing.sm,
            childAspectRatio: 1.3,
            children: const [
              _ShimmerBox(height: 100, width: double.infinity, radius: AppRadii.md),
              _ShimmerBox(height: 100, width: double.infinity, radius: AppRadii.md),
              _ShimmerBox(height: 100, width: double.infinity, radius: AppRadii.md),
              _ShimmerBox(height: 100, width: double.infinity, radius: AppRadii.md),
            ],
          ),
        ],
      ),
    );
  }
}
