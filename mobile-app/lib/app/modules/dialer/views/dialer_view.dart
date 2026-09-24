import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../data/services/call_service.dart';
import '../../../widgets/animated_entrance.dart';
import '../../../widgets/app_page_header.dart';
import '../controllers/dialer_controller.dart';

class DialerView extends GetView<DialerController> {
  const DialerView({super.key});

  @override
  Widget build(BuildContext context) {
    final callService = Get.find<CallService>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Customer Dialer'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        actions: [
          Obx(() => Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.fiber_manual_record,
                            size: 10,
                            color: callService.isRecording.value ? Colors.redAccent : Colors.white70),
                        const SizedBox(width: 6),
                        Text(
                          callService.isRecording.value ? 'REC' : 'Auto REC',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const AppGradientBanner(
              icon: Icons.mic,
              title: 'Recorded outbound calls',
              subtitle: 'Any valid number • registered or new • recording starts before call',
              accent: AppColors.error,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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
            Obx(() {
              if (!controller.isSearching.value || controller.searchResults.isEmpty) {
                return const SizedBox.shrink();
              }
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                constraints: const BoxConstraints(maxHeight: 180),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  itemCount: controller.searchResults.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
                  itemBuilder: (_, i) {
                    final c = controller.searchResults[i];
                    return ListTile(
                      dense: true,
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
                    );
                  },
                ),
              );
            }),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Obx(() {
                      final customer = controller.matchedCustomer.value;
                      final number = controller.dialedNumber.value;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customer?.name ?? (number.isEmpty ? 'Enter customer number' : number),
                            style: TextStyle(
                              fontSize: customer != null ? 20 : (number.isEmpty ? 16 : 28),
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryDark,
                              letterSpacing: customer == null && number.isNotEmpty ? 2 : 0,
                            ),
                          ),
                          if (customer != null)
                            Text(customer.mobile, style: const TextStyle(color: AppColors.textSecondary)),
                          if (number.isNotEmpty && customer == null)
                            const Text(
                              'New / unregistered number — call allowed with recording',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                        ],
                      );
                    }),
                  ),
                  Obx(() => IconButton(
                        tooltip: controller.keypadVisible.value ? 'Hide keypad' : 'Show keypad',
                        onPressed: controller.toggleKeypad,
                        icon: AnimatedRotation(
                          turns: controller.keypadVisible.value ? 0 : 0.5,
                          duration: const Duration(milliseconds: 200),
                          child: const Icon(Icons.dialpad, color: AppColors.primary, size: 28),
                        ),
                      )),
                ],
              ),
            ),
            Expanded(
              child: Obx(() {
                return Column(
                  children: [
                    AnimatedCrossFade(
                      firstCurve: Curves.easeOutCubic,
                      secondCurve: Curves.easeInCubic,
                      crossFadeState: controller.keypadVisible.value
                          ? CrossFadeState.showFirst
                          : CrossFadeState.showSecond,
                      duration: const Duration(milliseconds: 280),
                      sizeCurve: Curves.easeInOut,
                      firstChild: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _dialPad(),
                            const SizedBox(height: 12),
                            _callActions(callService),
                          ],
                        ),
                      ),
                      secondChild: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Icon(Icons.dialpad_outlined, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 8),
                            Text(
                              'Keypad hidden',
                              style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Tap dialpad icon to show keys',
                              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 20),
                            _callActions(callService),
                          ],
                        ),
                      ),
                    ),
                    Expanded(child: _recentCalls(callService)),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
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

  Widget _dialPad() {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ];
    return Column(
      children: keys.asMap().entries.map((rowEntry) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: rowEntry.value.map((k) => _dialKey(k)).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _dialKey(String key) {
    return PressScale(
      onTap: () {
        if (RegExp(r'^\d$').hasMatch(key)) controller.appendDigit(key);
      },
      child: Container(
        width: 64,
        height: 64,
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
      if (callService.recentLogs.isEmpty) return const SizedBox.shrink();
      final logs = callService.recentLogs.take(4).toList();
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
