import 'package:flutter/material.dart';
import '../theme/app_tokens.dart';
import 'logout_app_bar_button.dart';
import 'profile_app_bar_button.dart';

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
    this.showProfile = false,
    this.showLogout = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  final bool centerTitle;
  final bool showProfile;
  final bool showLogout;

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
          ? Text(title, maxLines: 1, overflow: TextOverflow.ellipsis)
          : Column(
              crossAxisAlignment: centerTitle ? CrossAxisAlignment.center : CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                ),
                Text(
                  subtitle!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.85)),
                ),
              ],
            ),
      actions: [
        ...?actions,
        if (showProfile) const ProfileAppBarButton(),
        if (showLogout) const LogoutAppBarButton(),
      ],
      bottom: bottom,
      flexibleSpace: Container(decoration: AppDecorations.primaryGradient()),
    );
  }
}

