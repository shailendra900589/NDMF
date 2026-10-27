import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/services/api_service.dart';
import '../data/services/notification_service.dart';
import '../data/services/storage_service.dart';
import '../utils/api_errors.dart';
import '../utils/access_control.dart';
import 'package:intl/intl.dart';
import 'my_salary_slips.dart';
import '../routes/app_routes.dart';

/// Refreshes notices while the app is open. Acknowledgement is always explicit.
class TeamInboxButton extends StatefulWidget {
  const TeamInboxButton({super.key});
  @override
  State<TeamInboxButton> createState() => _TeamInboxButtonState();
}

class _TeamInboxButtonState extends State<TeamInboxButton>
    with WidgetsBindingObserver {
  Timer? timer;
  int pending = 0;
  bool fetching = false;
  final seen = <String>{};
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refresh();
    timer = Timer.periodic(const Duration(seconds: 60), (_) => refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  Future<void> refresh() async {
    if (fetching || !mounted || !AccessControl.canAccess('notices')) return;
    fetching = true;
    try {
      final response = await Get.find<ApiService>().get('/workspace/notices');
      final records = List<Map<String, dynamic>>.from(
          (response.data['data'] as List)
              .map((e) => Map<String, dynamic>.from(e)));
      final uid = Get.find<StorageService>().getUser()?.id;
      final unread = records
          .where((r) =>
              r['acknowledgedAt'] == null &&
              (r['acknowledgements'] as Map?)?[uid] == null &&
              (r['recipientIds'] == null ||
                  (r['recipientIds'] as List).contains(uid)))
          .toList();
      if (mounted) setState(() => pending = unread.length);
      for (final notice in unread) {
        if (seen.add(notice['id'].toString()) &&
            Get.isRegistered<NotificationService>()) {
          try {
            await Get.find<NotificationService>().showNotification(
                id: notice['id'].toString().hashCode & 0x7fffffff,
                title: notice['title'].toString(),
                body: notice['important'] == true
                    ? 'Important notice · open Notices to acknowledge'
                    : notice['description'].toString());
          } catch (_) {
            /* Inbox remains available if notifications are denied. */
          }
        }
      }
    } catch (_) {
      /* Retry on resume; disabled modules must not block home. */
    } finally {
      fetching = false;
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(spacing: 12, children: [
        if (AccessControl.canAccess('notices'))
          TextButton.icon(
              onPressed: () async {
                await Get.to(() => const TeamInboxPage(kind: 'notices'));
                refresh();
              },
              icon: const Icon(Icons.notifications_outlined),
              label: Text('Notices${pending > 0 ? ' ($pending)' : ''}')),
        if (AccessControl.canAccess('visits'))
          TextButton.icon(
              onPressed: () => Get.toNamed(AppRoutes.visits),
              icon: const Icon(Icons.event_available_outlined),
              label: const Text('My visits')),
        TextButton.icon(
            onPressed: () => Get.to(() => const MySalarySlips()),
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Text('Salary slips')),
      ]));
}

class TeamInboxPage extends StatefulWidget {
  final String kind;
  const TeamInboxPage({super.key, required this.kind});
  @override
  State<TeamInboxPage> createState() => _TeamInboxPageState();
}

class _TeamInboxPageState extends State<TeamInboxPage> {
  List<Map<String, dynamic>> records = [];
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (mounted) setState(() => busy = true);
    try {
      final r = await Get.find<ApiService>().get('/workspace/${widget.kind}');
      if (mounted)
        setState(() {
          records = List<Map<String, dynamic>>.from((r.data['data'] as List)
              .map((e) => Map<String, dynamic>.from(e)));
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> action(Map<String, dynamic> r) async {
    String? note;
    if (widget.kind == 'visits') {
      final input = TextEditingController();
      note = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
                  title: const Text('Visit completion notes'),
                  content: TextField(
                      controller: input, maxLength: 2000, maxLines: 4),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel')),
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, input.text),
                        child: const Text('Complete visit'))
                  ]));
      input.dispose();
      if (note == null) return;
    }
    if (mounted) setState(() => busy = true);
    try {
      final api = Get.find<ApiService>();
      if (widget.kind == 'notices') {
        await api.post('/workspace/notices/${r['id']}/acknowledge');
      } else {
        await api.put('/workspace/visits/${r['id']}',
            data: {'status': 'completed', 'completionNote': note});
      }
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notices = widget.kind == 'notices',
        uid = Get.find<StorageService>().getUser()?.id;
    return Scaffold(
        appBar: AppBar(
            title:
                Text(notices ? 'Notice & Announcement' : 'My visit schedules')),
        body: RefreshIndicator(
            onRefresh: load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (busy) const LinearProgressIndicator(),
              if (error != null)
                Text(error!, style: const TextStyle(color: Colors.red)),
              if (!busy && records.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('Nothing here yet. Pull down to refresh.')),
              ...records.map((r) {
                final acknowledged = r['acknowledgedAt'] != null ||
                    (r['acknowledgements'] as Map?)?[uid] != null;
                return Card(
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (r['important'] == true)
                                const Text('IMPORTANT',
                                    style:
                                        TextStyle(fontWeight: FontWeight.bold)),
                              Text(r['title'].toString(),
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              const SizedBox(height: 8),
                              Text(r['description'].toString()),
                              if (!notices) ...[
                                const SizedBox(height: 8),
                                Text('Location: ${r['location']}'),
                                Text(
                                    'Scheduled: ${DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(r['scheduledAt']).toUtc().add(const Duration(hours: 5, minutes: 30)))} IST'),
                                Text('Status: ${r['status']}'),
                                Text(r['completionNote']?.toString() ?? '')
                              ],
                              if (notices &&
                                  (r['recipientIds'] == null ||
                                      (r['recipientIds'] as List)
                                          .contains(uid)))
                                TextButton(
                                    onPressed: busy || acknowledged
                                        ? null
                                        : () => action(r),
                                    child: Text(acknowledged
                                        ? 'Acknowledged'
                                        : 'I have read this notice')),
                              if (!notices && r['status'] == 'scheduled')
                                TextButton(
                                    onPressed: busy ? null : () => action(r),
                                    child: const Text('Mark visit completed')),
                            ])));
              }),
            ])));
  }
}
