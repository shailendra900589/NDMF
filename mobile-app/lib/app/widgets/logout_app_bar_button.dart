import 'package:flutter/material.dart';
import '../utils/app_logout.dart';

class LogoutAppBarButton extends StatelessWidget {
  const LogoutAppBarButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Logout',
      visualDensity: VisualDensity.compact,
      onPressed: () => AppLogout.confirmAndRun(),
      icon: const Icon(Icons.logout_rounded, color: Colors.white),
    );
  }
}
