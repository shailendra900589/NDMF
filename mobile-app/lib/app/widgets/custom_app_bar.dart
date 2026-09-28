import 'package:flutter/material.dart';
import '../theme/app_tokens.dart';

/// Gradient app bar used across feature modules (M3).
class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CustomAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.leading,
    this.bottom,
    this.centerTitle = true,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  final bool centerTitle;

  @override
  Size get preferredSize => Size.fromHeight(
        kToolbarHeight + (subtitle != null ? 20 : 0) + (bottom?.preferredSize.height ?? 0),
      );

  @override
  Widget build(BuildContext context) {
    return AppBar(
      centerTitle: centerTitle,
      leading: leading,
      title: subtitle == null
          ? Text(title)
          : Column(
              crossAxisAlignment: centerTitle ? CrossAxisAlignment.center : CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                Text(
                  subtitle!,
                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.85)),
                ),
              ],
            ),
      actions: actions,
      bottom: bottom,
      flexibleSpace: Container(decoration: AppDecorations.primaryGradient()),
    );
  }
}

/// Home shell app bar with optional dialer + profile avatar.
class HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  const HomeAppBar({
    super.key,
    required this.onProfile,
    this.onDialer,
    this.showDialer = false,
  });

  final VoidCallback onProfile;
  final VoidCallback? onDialer;
  final bool showDialer;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: const Text(
        'Nirmaldhara',
        style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.3),
      ),
      flexibleSpace: Container(decoration: AppDecorations.primaryGradient()),
      actions: [
        if (showDialer && onDialer != null)
          IconButton(
            icon: const Icon(Icons.dialpad_rounded),
            tooltip: 'Dialer',
            onPressed: onDialer,
          ),
        Padding(
          padding: const EdgeInsets.only(right: AppSpacing.sm),
          child: Material(
            color: Colors.white.withValues(alpha: 0.18),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onProfile,
              child: const SizedBox(
                width: AppSpacing.minTouch,
                height: AppSpacing.minTouch,
                child: Icon(Icons.person_rounded, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
