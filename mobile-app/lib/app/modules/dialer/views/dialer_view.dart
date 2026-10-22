import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../data/services/call_service.dart';
import '../../../widgets/animated_entrance.dart';
import '../../../widgets/ndfa_segment_bar.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/dialer_controller.dart';

class DialerView extends GetView<DialerController> {
  const DialerView({super.key});

  @override
  Widget build(BuildContext context) {
    final callService = Get.find<CallService>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(
        title: 'Dialer',
        subtitle: 'Call stays in this app',
      ),
      body: SafeArea(
        child: Column(
          children: [
            Obx(() => Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        callService.isRecording.value ? 'Recording' : 'Recording starts with the call',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primaryDark),
                      ),
                    ),
                  ),
                )),
            Obx(() => NdfaSegmentBar(
                  labels: const ['Keypad', 'Recent'],
                  selectedIndex: controller.topSegment.value,
                  onSelected: controller.setTopSegment,
                )),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: TextField(
                controller: controller.searchTextController,
                onChanged: controller.onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search customer name or mobile…',
                  prefixIcon: const Icon(Icons.search, color: AppColors.primary),
                  suffixIcon: Obx(() => controller.searchQuery.value.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.close, size: 20), onPressed: controller.clear)
                      : const SizedBox.shrink()),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
            ),
            Expanded(
              child: Obx(() {
                if (controller.isSearching.value && controller.searchResults.isNotEmpty) {
                  return _searchResults();
                }
                if (controller.topSegment.value == 1) {
                  return _recentCalls(callService);
                }
                return _keypadPage(callService);
              }),
            ),
          ],
        ),
      ),
    );
  }

  Widget _searchResults() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      itemCount: controller.searchResults.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final c = controller.searchResults[i];
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: ListTile(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            leading: CircleAvatar(
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              child: Text(
                c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            subtitle: Text(c.mobile, style: const TextStyle(fontSize: 12)),
            trailing: IconButton(
              icon: const Icon(Icons.call, color: AppColors.success),
              onPressed: () => controller.callNumber(number: c.mobile, name: c.name),
            ),
            onTap: () => controller.selectCustomer(c),
          ),
        );
      },
    );
  }

  Widget _keypadPage(CallService callService) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Column(
        children: [
          _numberHeader(),
          Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: _dialPad(64),
            ),
          ),
          _callActions(callService),
        ],
      ),
    );
  }

  Widget _numberHeader() {
    return Obx(() {
      final customer = controller.matchedCustomer.value;
      final number = controller.dialedNumber.value;
      return SizedBox(
        height: 70,
        width: double.infinity,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              customer?.name ?? (number.isEmpty ? 'Enter number' : number),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: customer != null ? 20 : (number.isEmpty ? 16 : 28),
                fontWeight: FontWeight.w700,
                color: AppColors.primaryDark,
                letterSpacing: customer == null && number.isNotEmpty ? 1.4 : 0,
              ),
            ),
            if (customer != null)
              Text(customer.mobile, style: const TextStyle(color: AppColors.textSecondary)),
            if (number.isNotEmpty && customer == null)
              const Text(
                'Unregistered number',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
          ],
        ),
      );
    });
  }

  Widget _callActions(CallService callService) {
    return Obx(() {
      final canCall = controller.canPlaceCustomerCall;
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _roundAction(Icons.backspace_outlined, controller.backspace),
          PressScale(
            onTap: canCall ? () => controller.callNumber() : null,
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: canCall
                      ? [AppColors.success, const Color(0xFF2E7D32)]
                      : [Colors.grey.shade400, Colors.grey.shade500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(36),
                boxShadow: [
                  if (canCall)
                    BoxShadow(
                      color: AppColors.success.withValues(alpha: 0.45),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                ],
              ),
              child: const Icon(Icons.call, color: Colors.white, size: 32),
            ),
          ),
          _roundAction(Icons.clear, controller.clear),
        ],
      );
    });
  }

  Widget _roundAction(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(width: 52, height: 52, child: Icon(icon, size: 26, color: AppColors.textSecondary)),
      ),
    );
  }

  Widget _dialPad(double keySize) {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ];
    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: row.map((k) => _dialKey(k, keySize)).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _dialKey(String key, double size) {
    return PressScale(
      onTap: () {
        if (RegExp(r'^\d$').hasMatch(key)) controller.appendDigit(key);
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(key, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w500)),
      ),
    );
  }

  Widget _recentCalls(CallService callService) {
    return Obx(() {
      if (callService.recentLogs.isEmpty) {
        return const Center(
          child: Text('No recent calls yet', style: TextStyle(color: AppColors.textSecondary)),
        );
      }
      final logs = callService.recentLogs.take(20).toList();
      return ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        children: [
          const Text('Recent customer calls', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          ...logs.map((log) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    child: const Icon(Icons.history, color: AppColors.primary, size: 20),
                  ),
                  title: Text(log.customerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  subtitle: Text('${log.mobile} • ${log.duration}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.call, color: AppColors.success),
                    onPressed: () => controller.callNumber(number: log.mobile, name: log.customerName),
                  ),
                ),
              )),
        ],
      );
    });
  }
}
