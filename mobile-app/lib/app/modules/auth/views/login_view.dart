import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/app_logo.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../config/demo_credentials.dart';
import '../controllers/auth_controller.dart';

class LoginView extends GetView<AuthController> {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              const AppLogo(height: 120, showTagline: true),
              const SizedBox(height: 16),
              const Text(
                'Field Force Management',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Demo login', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 6),
                    Text(
                      DemoCredentials.helpText,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        TextButton(
                          onPressed: controller.fillFieldOfficerDemo,
                          child: const Text('Fill Field Officer'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Obx(() => DropdownButtonFormField<UserRole>(
                    value: controller.selectedRole.value,
                    decoration: const InputDecoration(labelText: 'Login As'),
                    items: UserRole.values
                        .map((r) => DropdownMenuItem(value: r, child: Text(r.label)))
                        .toList(),
                    onChanged: (v) => controller.selectedRole.value = v!,
                  )),
              const SizedBox(height: 16),
              TextFormField(
                controller: controller.mobileField,
                decoration: const InputDecoration(
                  labelText: 'Mobile Number',
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
                maxLength: 10,
              ),
              const SizedBox(height: 8),
              Obx(() => TextFormField(
                    controller: controller.passwordField,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock),
                      suffixIcon: IconButton(
                        icon: Icon(controller.obscurePassword.value
                            ? Icons.visibility_off
                            : Icons.visibility),
                        onPressed: controller.togglePasswordVisibility,
                      ),
                    ),
                    obscureText: controller.obscurePassword.value,
                  )),
              const SizedBox(height: 8),
              Row(
                children: [
                  Obx(() => Checkbox(
                        value: controller.rememberMe.value,
                        activeColor: AppColors.primary,
                        onChanged: (v) => controller.rememberMe.value = v ?? false,
                      )),
                  const Text('Remember me'),
                  const Spacer(),
                  TextButton(onPressed: controller.forgotPassword, child: const Text('Forgot Password?')),
                ],
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: controller.showOtpLogin,
                icon: const Icon(Icons.sms),
                label: const Text('Login with OTP'),
              ),
              const SizedBox(height: 24),
              Obx(() => ElevatedButton(
                    onPressed: controller.isLoading.value ? null : controller.login,
                    child: controller.isLoading.value
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Login'),
                  )),
            ],
          ),
        ),
      ),
    );
  }
}
