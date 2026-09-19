import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  final double height;
  final bool showTagline;

  const AppLogo({super.key, this.height = 120, this.showTagline = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Image.asset(
            'assets/images/logo.png',
            height: height,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Icon(Icons.account_balance, size: height * 0.7, color: const Color(0xFF00897B)),
          ),
        ),
        if (showTagline) ...[
          const SizedBox(height: 8),
          const Text(
            'Nirmaldhara Micro Foundation',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Color(0xFF6B7280), fontWeight: FontWeight.w500),
          ),
        ],
      ],
    );
  }
}
