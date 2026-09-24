import 'dart:async';
import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/call_log_model.dart';
import '../models/enums/app_enums.dart';
import '../../widgets/call_summary_sheet.dart';
import 'voice_recording_service.dart';
import 'upload_service.dart';
import 'storage_service.dart';
import 'ndfa_api_service.dart';
import 'sync_service.dart';
import 'telephony_call_reader.dart';
import 'api_constants.dart';

/// Calls from dialer: system call log verifies talk time; mic recording uploads to backend dashboard.
class CallService extends GetxService with WidgetsBindingObserver {
  VoiceRecordingService get _recorder => Get.find<VoiceRecordingService>();
  UploadService get _upload => Get.find<UploadService>();
  StorageService get _storage => Get.find<StorageService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();

  static const bool recordingMandatory = true;

  final isCallActive = false.obs;
  final isRecording = false.obs;
  final recentLogs = <CallLogModel>[].obs;
  final lastCompletedCall = Rxn<CallLogModel>();

  bool _sessionActive = false;
  DateTime? _callStartedAt;
  Timer? _resumeFinishTimer;
  String _pendingName = '';
  String _pendingMobile = '';
  String? _pendingLeadId;

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    loadRecentLogs();
  }

  @override
  void onClose() {
    _resumeFinishTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_sessionActive) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _resumeFinishTimer?.cancel();
      return;
    }
    if (state == AppLifecycleState.resumed) {
      _resumeFinishTimer?.cancel();
      // Avoid ending session when dialer opens; wait until user returns after the call.
      _resumeFinishTimer = Timer(const Duration(milliseconds: 2000), () {
        if (_sessionActive) unawaited(_finishCallSession());
      });
    }
  }

  String formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  int durationToSeconds(Duration d) => d.inSeconds;

  Future<bool> _ensurePermissions() async {
    final phone = await Permission.phone.request();
    final mic = await Permission.microphone.request();
    await TelephonyCallReader.ensurePermission();
    return phone.isGranted && mic.isGranted;
  }

  /// True when phone + mic permissions are granted (required before customer call).
  Future<bool> ensureRecordingReady() async => _ensurePermissions();

  /// Customer calls only — recording must start before the system phone UI opens.
  Future<void> placeCustomerCall({
    required String mobile,
    required String customerName,
    String? leadId,
  }) async {
    if (mobile.replaceAll(RegExp(r'\D'), '').length < 10) {
      Get.snackbar('Invalid', 'Enter valid 10-digit mobile number');
      return;
    }

    if (!await _ensurePermissions()) {
      Get.snackbar(
        'Recording required',
        'Phone, call log & microphone permissions are mandatory for customer calls',
      );
      return;
    }

    if (recordingMandatory) {
      final started = await _recorder.startRecording();
      if (!started) {
        Get.snackbar(
          'Cannot call',
          'Call recording failed to start. Customer calls are blocked until recording works.',
        );
        return;
      }
      isRecording.value = true;
    }

    _pendingName = customerName;
    final digits = mobile.replaceAll(RegExp(r'\D'), '');
    _pendingMobile = digits.length >= 10 ? digits.substring(digits.length - 10) : digits;
    _pendingLeadId = leadId;
    _callStartedAt = DateTime.now();
    _sessionActive = true;
    isCallActive.value = true;

    Get.snackbar(
      'NDFA customer call',
      'Recording ON • log & summary will sync after call',
      duration: const Duration(seconds: 3),
    );

    try {
      await FlutterPhoneDirectCaller.callNumber(_pendingMobile);
    } catch (_) {
      await _finishCallSession();
      Get.snackbar('Call Failed', 'Could not place call');
    }
  }

  @Deprecated('Use placeCustomerCall')
  Future<void> placeCall({
    required String mobile,
    String customerName = '',
    String? leadId,
  }) =>
      placeCustomerCall(mobile: mobile, customerName: customerName, leadId: leadId);

  Future<void> _finishCallSession() async {
    if (!_sessionActive) return;
    _sessionActive = false;
    isCallActive.value = false;

    final placedAt = _callStartedAt ?? DateTime.now();

    final telephony = await TelephonyCallReader.matchRecentOutgoing(
      mobile: _pendingMobile,
      placedAt: placedAt,
      maxAttempts: 15,
      attemptDelay: const Duration(milliseconds: 900),
    );

    String? rawRecordingPath;
    if (isRecording.value) {
      rawRecordingPath = await _recorder.stopRecording();
      isRecording.value = false;
    }

    final wallDuration = DateTime.now().difference(placedAt);
    var recordingSeconds = durationToSeconds(wallDuration);
    if (rawRecordingPath != null && rawRecordingPath.isNotEmpty) {
      try {
        final bytes = await File(rawRecordingPath).length();
        // Rough AAC @64kbps — prefer wall clock if file looks truncated.
        final estimated = (bytes / 8000).round();
        if (estimated > recordingSeconds) recordingSeconds = estimated;
      } catch (_) {}
    }
    recordingSeconds = recordingSeconds.clamp(0, 15 * 60);

    Duration talkDuration;
    int talkSeconds;
    String callStatus;
    if (telephony.verified) {
      talkSeconds = telephony.durationSeconds;
      talkDuration = Duration(seconds: talkSeconds);
      callStatus = telephony.callStatus;
    } else {
      talkSeconds = durationToSeconds(wallDuration);
      talkDuration = wallDuration;
      callStatus = talkSeconds > 3 ? 'connected' : 'unknown';
    }

    String? serverRecordingUrl;
    String? localRecordingPath;

    if (rawRecordingPath != null && rawRecordingPath.isNotEmpty) {
      if (ApiConstants.useRemoteApi) {
        try {
          serverRecordingUrl = await _upload.uploadVoiceFile(rawRecordingPath);
          if (serverRecordingUrl != null && !serverRecordingUrl!.contains('/uploads/')) {
            localRecordingPath = rawRecordingPath;
            serverRecordingUrl = null;
          }
        } catch (_) {
          localRecordingPath = rawRecordingPath;
        }
      } else if (await File(rawRecordingPath).exists()) {
        localRecordingPath = rawRecordingPath;
      }
    }

    final durationLabel = formatDuration(talkDuration);
    final requireSummary = callStatus == 'connected' && talkSeconds >= 5;

    String summary = '';
    for (var attempt = 0; attempt < 3 && summary.isEmpty; attempt++) {
      final entered = await CallSummarySheet.show(
        customerLabel: _pendingName.isNotEmpty ? _pendingName : _pendingMobile,
        mobile: _pendingMobile,
        durationLabel: durationLabel,
        callStatus: callStatus,
        requireDetailedSummary: requireSummary,
      );
      summary = (entered ?? '').trim();
    }
    if (summary.isEmpty) {
      summary = requireSummary
          ? 'Call completed — summary to be updated'
          : (callStatus == 'connected' ? 'Brief call' : 'No conversation');
    }

    final user = _storage.getUser();
    final now = DateTime.now();
    var log = CallLogModel(
      id: 'CALL_${now.millisecondsSinceEpoch}',
      customerName: _pendingName.isNotEmpty ? _pendingName : _pendingMobile,
      mobile: _pendingMobile,
      date: now,
      time: DateFormat('hh:mm a').format(now),
      duration: durationLabel,
      durationSeconds: talkSeconds,
      recordingDurationSeconds: recordingSeconds,
      callStatus: callStatus,
      callSummary: summary,
      telephonyVerified: telephony.verified,
      type: CallType.outgoing,
      leadId: _pendingLeadId,
      recordingUrl: serverRecordingUrl,
      localRecordingPath: localRecordingPath,
      employeeId: user?.employeeId,
      employeeName: user?.name,
      synced: false,
    );

    _storage.appendToList(ApiConstants.callLogsKey, log.toJson());

    if (ApiConstants.useRemoteApi) {
      final synced = await _trySyncLog(log);
      if (synced) {
        log = log.copyWith(synced: true);
        _updateStoredLog(log);
      } else if (Get.isRegistered<SyncService>()) {
        await Get.find<SyncService>().queuePendingCallLog(log);
      }
    } else {
      log = log.copyWith(synced: true);
    }

    recentLogs.insert(0, log);
    if (recentLogs.length > 80) recentLogs.removeRange(80, recentLogs.length);
    lastCompletedCall.value = log;

    _pendingName = '';
    _pendingMobile = '';
    _pendingLeadId = null;
    _callStartedAt = null;

    final verified = telephony.verified ? ' • Phone log verified' : ' • Log pending permission';
    final recLabel = log.hasOnlineRecording
        ? ' • Recording uploaded'
        : log.hasRecording
            ? ' • Recording saved locally'
            : '';
    Get.snackbar('Synced', '$durationLabel talk$verified$recLabel');
  }

  Future<bool> _trySyncLog(CallLogModel log) async {
    var payload = log;
    if (!log.hasOnlineRecording && log.localRecordingPath != null) {
      try {
        final url = await _upload.uploadVoiceFile(log.localRecordingPath!);
        if (url.contains('/uploads/')) {
          payload = log.copyWith(recordingUrl: url, localRecordingPath: null);
        } else {
          return false;
        }
      } catch (_) {
        return false;
      }
    }
    try {
      await _api.syncCallLog(payload.toJson(forServer: true));
      return true;
    } catch (_) {
      return false;
    }
  }

  void _updateStoredLog(CallLogModel log) {
    final list = _storage.readList(ApiConstants.callLogsKey);
    final idx = list.indexWhere((e) => e['id'] == log.id);
    if (idx >= 0) {
      list[idx] = log.toJson();
      _storage.writeList(ApiConstants.callLogsKey, list);
    }
  }

  void loadRecentLogs() {
    recentLogs.value = _storage
        .readList(ApiConstants.callLogsKey)
        .map((e) => CallLogModel.fromJson(e))
        .toList()
        .reversed
        .toList();
  }

  Future<void> refreshFromServer() async {
    if (!ApiConstants.useRemoteApi) {
      loadRecentLogs();
      return;
    }
    try {
      final data = await _api.fetchCallLogs();
      if (data.isEmpty) return;
      final serverLogs = data.map(CallLogModel.fromJson).toList();
      final local = _storage.readList(ApiConstants.callLogsKey);
      final byId = {for (final e in local) e['id']: e};
      for (final log in serverLogs) {
        byId[log.id] = log.copyWith(synced: true).toJson();
      }
      _storage.writeList(ApiConstants.callLogsKey, byId.values.toList());
      loadRecentLogs();
    } catch (_) {
      loadRecentLogs();
    }
  }

  Future<List<CallLogModel>> fetchFromServer() async {
    await refreshFromServer();
    return recentLogs;
  }
}
