import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../data/models/customer_listing_model.dart';
import '../../../data/services/api_service.dart';
import '../../../data/services/gps_stamp_camera.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/visit_sync_service.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<Map<String, dynamic>> get _pending => _sync.pending;

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
      // This opens the physical camera; gallery selection is deliberately never offered.
      final photo =
          await _camera.capture(address: visit['location']?.toString() ?? '');
      if (photo == null) return;
      final position = _position(photo);
      try {
        await _api.post('/workspace/visits/${visit['id']}/start',
            data: {'position': position});
      } catch (_) {
        // The photo is already in application storage and the completion queue will retry start first.
      }
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
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('My visit schedules')),
        body: RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (_busy) const LinearProgressIndicator(),
              if (_pending.isNotEmpty)
                Card(
                    child: ListTile(
                        leading: const Icon(Icons.cloud_upload_outlined),
                        title: Text(
                            '${_pending.length} report(s) waiting for secure upload'),
                        subtitle: const Text(
                            'They will upload automatically when internet is available.'),
                        trailing: IconButton(
                            icon: const Icon(Icons.sync),
                            onPressed: _busy ? null : _load))),
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
              if (!_busy && _records.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                        child: Text(
                            'No planned visits yet. Pull down to refresh.'))),
              ..._records.map(_visitCard),
            ])),
      );

  Widget _visitCard(Map<String, dynamic> visit) {
    final status = visit['status']?.toString() ?? 'scheduled';
    final scheduled = DateTime.tryParse(visit['scheduledAt']?.toString() ?? '');
    final canStart = (status == 'scheduled' || status == 'in_progress') &&
        (visit['recipientIds'] == null ||
            (visit['recipientIds'] as List).contains(_storage.getUser()?.id)) &&
        !_pending.any((p) => p['visitId'] == visit['id']);
    return Card(
        margin: const EdgeInsets.only(top: 12),
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                    child: Text(visit['title']?.toString() ?? 'Field visit',
                        style: Theme.of(context).textTheme.titleLarge)),
                _StatusChip(status: status)
              ]),
              const SizedBox(height: 8),
              Text(visit['targetName']?.toString() ??
                  visit['location']?.toString() ??
                  ''),
              Text('Location: ${visit['location'] ?? 'Not specified'}'),
              if (scheduled != null)
                Text(
                    'Scheduled: ${DateFormat('dd MMM yyyy, hh:mm a').format(scheduled.toLocal())}'),
              if (visit['verification'] is Map)
                _VerificationSummary(
                    data: Map<String, dynamic>.from(
                        visit['verification'] as Map)),
              if (canStart)
                Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: FilledButton.icon(
                        onPressed: _busy ? null : () => _start(visit),
                        icon: const Icon(Icons.camera_alt_outlined),
                        label: Text(status == 'in_progress'
                            ? 'Continue verified visit'
                            : 'Start visit & take GPS photo'))),
            ])));
  }
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
      // Persist before networking so process interruption cannot discard the report.
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
            ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Next follow-up date'),
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
  Widget build(BuildContext context) =>
      Chip(label: Text(status.replaceAll('_', ' ')));
}

class _VerificationSummary extends StatelessWidget {
  const _VerificationSummary({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Text(
          'Report submitted · ${data['result']?.toString().replaceAll('_', ' ') ?? 'completed'}',
          style: const TextStyle(fontWeight: FontWeight.w600)));
}
