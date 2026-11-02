import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../data/models/customer_listing_model.dart';
import '../../../data/services/api_service.dart';
import '../../../data/services/gps_stamp_camera.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/maps_navigation_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/visit_sync_service.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/api_errors.dart';

/// Field-visit workflow: fresh camera evidence, live location and an offline-safe report queue.
class VisitListView extends StatefulWidget {
  const VisitListView({super.key});
  @override
  State<VisitListView> createState() => _VisitListViewState();
}

class _VisitListViewState extends State<VisitListView> {
  VisitSyncService get _sync => Get.find<VisitSyncService>();
  final _api = Get.find<ApiService>();
  final _storage = Get.find<StorageService>();
  late final GpsStampCamera _camera =
      GpsStampCamera(Get.find<LocationService>());
  List<Map<String, dynamic>> _records = [];
  bool _busy = false;
  String? _error;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<Map<String, dynamic>> get _pending => _sync.pending;

  DateTime? _scheduledAt(Map<String, dynamic> visit) =>
      DateTime.tryParse(visit['scheduledAt']?.toString() ?? '');

  DateTime? _followUp(Map<String, dynamic> visit) {
    final v = visit['verification'];
    if (v is! Map) return null;
    return DateTime.tryParse(v['nextFollowUpDate']?.toString() ?? '');
  }

  bool _isRevisit(Map<String, dynamic> visit) {
    final v = visit['verification'];
    if (v is Map && v['result']?.toString() == 'revisit_required') return true;
    final title = '${visit['title'] ?? ''} ${visit['purpose'] ?? ''}'.toLowerCase();
    return title.contains('revisit') || title.contains('follow');
  }

  bool _isToday(DateTime? d) {
    if (d == null) return false;
    final n = DateTime.now();
    final local = d.toLocal();
    return local.year == n.year && local.month == n.month && local.day == n.day;
  }

  bool _isOpen(Map<String, dynamic> visit) {
    final status = visit['status']?.toString() ?? 'scheduled';
    return status == 'scheduled' || status == 'in_progress';
  }

  List<Map<String, dynamic>> get _visible {
    final list = [..._records];
    list.sort((a, b) {
      final ad = _scheduledAt(a) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = _scheduledAt(b) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return ad.compareTo(bd);
    });
    switch (_filter) {
      case 'today':
        return list.where((v) => _isOpen(v) && _isToday(_scheduledAt(v))).toList();
      case 'upcoming':
        return list.where((v) {
          final d = _scheduledAt(v);
          return _isOpen(v) && d != null && d.toLocal().isAfter(DateTime.now());
        }).toList();
      case 'revisits':
        return list.where((v) {
          if (_isRevisit(v)) return true;
          final f = _followUp(v);
          return f != null && !f.toLocal().isAfter(DateTime.now().add(const Duration(days: 1)));
        }).toList();
      case 'done':
        return list.where((v) => !_isOpen(v)).toList();
      default:
        return list;
    }
  }

  Future<void> _load() async {
    if (mounted) setState(() => _busy = true);
    await _sync.sync();
    try {
      final response = await _api.get('/workspace/visits');
      final values = List<Map<String, dynamic>>.from(
          (response.data['data'] as List)
              .map((e) => Map<String, dynamic>.from(e)));
      _storage.writeList(_sync.cacheKey, values);
      if (mounted) {
        setState(() {
          _records = values;
          _error = null;
        });
      }
    } catch (e) {
      final cached = _storage.readList(_sync.cacheKey);
      if (mounted) {
        setState(() {
          _records = cached;
          _error = cached.isEmpty
              ? apiErrorMessage(e)
              : 'Offline: showing your last synced visits. Completed reports will upload automatically.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start(Map<String, dynamic> visit) async {
    setState(() => _busy = true);
    try {
      final photo =
          await _camera.capture(address: visit['location']?.toString() ?? '');
      if (photo == null) return;
      final position = _position(photo);
      try {
        await _api.post('/workspace/visits/${visit['id']}/start',
            data: {'position': position});
      } catch (_) {}
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => VisitCompletionPage(
              visit: visit, photo: photo, onQueuedOrSaved: _load)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Map<String, dynamic> _position(GpsPhotoCapture photo) => {
        'lat': photo.latitude,
        'lng': photo.longitude,
        if (photo.accuracy != null) 'accuracy': photo.accuracy,
        'capturedAt': photo.capturedAt.toUtc().toIso8601String()
      };

  @override
  Widget build(BuildContext context) {
    final todayCount = _records.where((v) => _isOpen(v) && _isToday(_scheduledAt(v))).length;
    final revisitCount = _records.where((v) => _isRevisit(v) || (_followUp(v) != null && !_followUp(v)!.toLocal().isAfter(DateTime.now().add(const Duration(days: 1))))).length;
    final openCount = _records.where(_isOpen).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My visits & revisits'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00695C), Color(0xFF26A69A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Scheduled field visits',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(
                    openCount == 0
                        ? 'No open visits right now. Pull to refresh when your branch assigns one.'
                        : '$openCount open · $todayCount today · $revisitCount revisit / follow-up',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                      label: 'All',
                      selected: _filter == 'all',
                      onTap: () => setState(() => _filter = 'all')),
                  _FilterChip(
                      label: 'Today',
                      count: todayCount,
                      selected: _filter == 'today',
                      onTap: () => setState(() => _filter = 'today')),
                  _FilterChip(
                      label: 'Upcoming',
                      selected: _filter == 'upcoming',
                      onTap: () => setState(() => _filter = 'upcoming')),
                  _FilterChip(
                      label: 'Revisits',
                      count: revisitCount,
                      selected: _filter == 'revisits',
                      accent: true,
                      onTap: () => setState(() => _filter = 'revisits')),
                  _FilterChip(
                      label: 'Completed',
                      selected: _filter == 'done',
                      onTap: () => setState(() => _filter = 'done')),
                ],
              ),
            ),
            if (_busy) const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(minHeight: 3),
            ),
            if (_pending.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Material(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  child: ListTile(
                    leading: const Icon(Icons.cloud_upload_outlined,
                        color: Color(0xFFC2410C)),
                    title: Text(
                        '${_pending.length} report(s) waiting for secure upload'),
                    subtitle: const Text(
                        'They upload automatically when internet is available.'),
                    trailing: IconButton(
                        icon: const Icon(Icons.sync),
                        onPressed: _busy ? null : _load),
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error))),
            ..._pending
                .where((p) => p['lastError'] != null)
                .map((p) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text('Pending report: ${p['lastError']}',
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    )),
            if (!_busy && _visible.isEmpty)
              const Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(
                      child: Text(
                          'Nothing in this view yet. Pull down to refresh.',
                          textAlign: TextAlign.center))),
            ..._visible.map(_visitCard),
          ],
        ),
      ),
    );
  }

  Widget _visitCard(Map<String, dynamic> visit) {
    final status = visit['status']?.toString() ?? 'scheduled';
    final scheduled = _scheduledAt(visit);
    final followUp = _followUp(visit);
    final revisit = _isRevisit(visit);
    final canStart = _isOpen(visit) &&
        (visit['recipientIds'] == null ||
            (visit['recipientIds'] as List).contains(_storage.getUser()?.id)) &&
        !_pending.any((p) => p['visitId'] == visit['id']);
    final accent = revisit ? const Color(0xFFEA580C) : AppColors.primary;

    return Container(
      margin: const EdgeInsets.only(top: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    revisit ? Icons.replay_circle_filled_outlined : Icons.event_available_rounded,
                    color: accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        visit['targetName']?.toString() ??
                            visit['title']?.toString() ??
                            'Field visit',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        revisit ? 'Revisit / follow-up' : 'Scheduled visit',
                        style: TextStyle(
                            color: accent,
                            fontWeight: FontWeight.w600,
                            fontSize: 12),
                      ),
                    ],
                  ),
                ),
                _StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 12),
            if (visit['targetMobile']?.toString().isNotEmpty == true)
              _MetaRow(
                  icon: Icons.phone_outlined,
                  text: visit['targetMobile'].toString()),
            _MetaRow(
                icon: Icons.place_outlined,
                text: visit['location']?.toString() ?? 'Location not specified'),
            if (scheduled != null)
              _MetaRow(
                  icon: Icons.schedule_outlined,
                  text:
                      'Scheduled ${DateFormat('dd MMM yyyy, hh:mm a').format(scheduled.toLocal())}'),
            if (followUp != null)
              _MetaRow(
                  icon: Icons.flag_outlined,
                  text:
                      'Follow-up ${DateFormat('dd MMM yyyy').format(followUp.toLocal())}',
                  highlight: true),
            if (_hasDestination(visit))
              TextButton.icon(
                  style: TextButton.styleFrom(
                      padding: EdgeInsets.zero, foregroundColor: accent),
                  onPressed: () => Get.find<MapsNavigationService>()
                      .openInGoogleMaps(
                          latitude:
                              (visit['destinationGps']['lat'] as num).toDouble(),
                          longitude:
                              (visit['destinationGps']['lng'] as num).toDouble(),
                          label: visit['targetName']?.toString()),
                  icon: const Icon(Icons.directions_outlined),
                  label: const Text('Open directions')),
            if (visit['verification'] is Map)
              _VerificationSummary(
                  data: Map<String, dynamic>.from(
                      visit['verification'] as Map)),
            if (canStart)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _busy ? null : () => _start(visit),
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: Text(status == 'in_progress'
                          ? 'Continue verified visit'
                          : revisit
                              ? 'Start revisit · GPS photo'
                              : 'Start visit · GPS photo')),
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _hasDestination(Map<String, dynamic> visit) {
    final destination = visit['destinationGps'];
    return destination is Map &&
        destination['lat'] is num &&
        destination['lng'] is num &&
        (destination['lat'] as num) != 0 &&
        (destination['lng'] as num) != 0;
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
    this.accent = false,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final color = accent ? const Color(0xFFEA580C) : AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(count == null ? label : '$label ($count)'),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: color.withValues(alpha: 0.18),
        labelStyle: TextStyle(
          color: selected ? color : AppColors.textSecondary,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
        side: BorderSide(color: selected ? color : AppColors.divider),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text, this.highlight = false});
  final IconData icon;
  final String text;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon,
                size: 16,
                color: highlight ? const Color(0xFFEA580C) : AppColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  color: highlight ? const Color(0xFF9A3412) : AppColors.textPrimary,
                  fontWeight: highlight ? FontWeight.w700 : FontWeight.w500,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      );
}

class VisitCompletionPage extends StatefulWidget {
  const VisitCompletionPage(
      {super.key,
      required this.visit,
      required this.photo,
      required this.onQueuedOrSaved});
  final Map<String, dynamic> visit;
  final GpsPhotoCapture photo;
  final Future<void> Function() onQueuedOrSaved;
  @override
  State<VisitCompletionPage> createState() => _VisitCompletionPageState();
}

class _VisitCompletionPageState extends State<VisitCompletionPage> {
  final _formKey = GlobalKey<FormState>();
  final _discussion = TextEditingController(),
      _amount = TextEditingController(),
      _remarks = TextEditingController();
  String _purpose = 'recovery', _result = 'completed';
  DateTime? _promiseDate, _followUpDate;
  bool _busy = false;
  @override
  void dispose() {
    _discussion.dispose();
    _amount.dispose();
    _remarks.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _position => {
        'lat': widget.photo.latitude,
        'lng': widget.photo.longitude,
        if (widget.photo.accuracy != null) 'accuracy': widget.photo.accuracy,
        'capturedAt': widget.photo.capturedAt.toUtc().toIso8601String()
      };
  String _date(DateTime? value) =>
      value == null ? 'Select date' : DateFormat('dd MMM yyyy').format(value);
  Future<void> _pickDate(bool promise) async {
    final value = await showDatePicker(
        context: context,
        firstDate: DateTime.now().subtract(const Duration(days: 1)),
        lastDate: DateTime.now().add(const Duration(days: 730)),
        initialDate: promise
            ? (_promiseDate ?? DateTime.now())
            : (_followUpDate ?? DateTime.now()));
    if (value != null && mounted) {
      setState(() {
        if (promise) {
          _promiseDate = value;
        } else {
          _followUpDate = value;
        }
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    final payload = <String, dynamic>{
      'discussion': _discussion.text.trim(),
      'purpose': _purpose,
      'result': _result,
      'remarks': _remarks.text.trim(),
      if (_promiseDate != null)
        'paymentPromiseDate': DateFormat('yyyy-MM-dd').format(_promiseDate!),
      if (_followUpDate != null)
        'nextFollowUpDate': DateFormat('yyyy-MM-dd').format(_followUpDate!),
      if (_amount.text.trim().isNotEmpty)
        'paymentAmount': double.tryParse(_amount.text.trim())
    };
    final sync = Get.find<VisitSyncService>();
    try {
      await sync.enqueue({
        'visitId': widget.visit['id'],
        'photoPath': widget.photo.filePath,
        'position': _position,
        'payload': payload,
        'queuedAt': DateTime.now().toIso8601String()
      });
      await sync.sync();
      final waiting =
          sync.pending.any((p) => p['visitId'] == widget.visit['id']);
      await widget.onQueuedOrSaved();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(waiting
              ? 'Report saved on this phone. Pending uploads are retried while the app is open or when reopened.'
              : 'Visit report submitted.')));
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Complete verified visit')),
      body: Form(
          key: _formKey,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Card(
                child: Column(children: [
              Image.file(File(widget.photo.filePath),
                  height: 180, width: double.infinity, fit: BoxFit.cover),
              ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: const Text('Fresh camera photo with GPS watermark'),
                  subtitle: Text(
                      '${widget.photo.latitude.toStringAsFixed(6)}, ${widget.photo.longitude.toStringAsFixed(6)}${widget.photo.accuracy == null ? '' : ' · ±${widget.photo.accuracy!.round()} m'} · ${DateFormat('dd MMM yyyy, hh:mm a').format(widget.photo.capturedAt)}'))
            ])),
            const SizedBox(height: 16),
            TextFormField(
                controller: _discussion,
                minLines: 3,
                maxLines: 6,
                maxLength: 4000,
                decoration: const InputDecoration(
                    labelText: 'What was discussed with the shopkeeper?'),
                validator: (v) => v == null || v.trim().length < 3
                    ? 'Please enter at least 3 characters'
                    : null),
            DropdownButtonFormField(
                initialValue: _purpose,
                decoration: const InputDecoration(labelText: 'Visit purpose'),
                items: const [
                  DropdownMenuItem(value: 'recovery', child: Text('Recovery')),
                  DropdownMenuItem(
                      value: 'shop_verification',
                      child: Text('Shop verification')),
                  DropdownMenuItem(
                      value: 'document_collection',
                      child: Text('Document collection')),
                  DropdownMenuItem(
                      value: 'customer_meeting',
                      child: Text('Customer meeting')),
                  DropdownMenuItem(value: 'other', child: Text('Other'))
                ],
                onChanged: (v) => setState(() => _purpose = v!)),
            const SizedBox(height: 12),
            DropdownButtonFormField(
                initialValue: _result,
                decoration: const InputDecoration(labelText: 'Visit result'),
                items: const [
                  DropdownMenuItem(
                      value: 'completed', child: Text('Work completed')),
                  DropdownMenuItem(
                      value: 'customer_unavailable',
                      child: Text('Customer not available')),
                  DropdownMenuItem(
                      value: 'shop_closed', child: Text('Shop closed')),
                  DropdownMenuItem(
                      value: 'payment_promised',
                      child: Text('Payment promised')),
                  DropdownMenuItem(
                      value: 'revisit_required',
                      child: Text('Revisit required'))
                ],
                onChanged: (v) => setState(() => _result = v!)),
            if (_result == 'payment_promised') ...[
              const SizedBox(height: 12),
              TextFormField(
                  controller: _amount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Promised payment amount (₹)'),
                  validator: (value) => value != null &&
                          value.isNotEmpty &&
                          (double.tryParse(value) == null ||
                              !double.parse(value).isFinite ||
                              double.parse(value) < 0)
                      ? 'Enter a valid amount'
                      : null),
              ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Promised payment date'),
                  subtitle: Text(_date(_promiseDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _pickDate(true))
            ],
            if (_result == 'revisit_required')
              const Padding(
                padding: EdgeInsets.only(top: 8, bottom: 4),
                child: Text(
                  'Set the next follow-up date so this revisit appears clearly in My visits.',
                  style: TextStyle(color: Color(0xFF9A3412), fontWeight: FontWeight.w600),
                ),
              ),
            ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_result == 'revisit_required'
                    ? 'Revisit / follow-up date'
                    : 'Next follow-up date'),
                subtitle: Text(_date(_followUpDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _pickDate(false)),
            TextFormField(
                controller: _remarks,
                minLines: 2,
                maxLines: 4,
                maxLength: 2000,
                decoration: const InputDecoration(
                    labelText: 'Additional remarks (optional)')),
            const SizedBox(height: 16),
            FilledButton.icon(
                onPressed: _busy ? null : _submit,
                icon: const Icon(Icons.verified_outlined),
                label: Text(_busy ? 'Saving...' : 'Complete verified visit')),
          ])));
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final colors = switch (status) {
      'completed' => (const Color(0xFFDCFCE7), const Color(0xFF166534)),
      'in_progress' => (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)),
      'cancelled' => (const Color(0xFFFEE2E2), const Color(0xFFB91C1C)),
      _ => (const Color(0xFFCCFBF1), const Color(0xFF0F766E)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
            color: colors.$2, fontWeight: FontWeight.w800, fontSize: 11),
      ),
    );
  }
}

class _VerificationSummary extends StatelessWidget {
  const _VerificationSummary({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final result = data['result']?.toString().replaceAll('_', ' ') ?? 'completed';
    final follow = data['nextFollowUpDate']?.toString();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          follow == null || follow.isEmpty
              ? 'Report submitted · $result'
              : 'Report submitted · $result · follow-up $follow',
          style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35),
        ),
      ),
    );
  }
}
