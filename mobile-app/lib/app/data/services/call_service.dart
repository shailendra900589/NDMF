import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
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
import 'telephony_bridge.dart';
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
  bool _finishing = false;
  bool _appPaused = false;
  DateTime? _callStartedAt;
  Timer? _callMonitorTimer;
  bool _sawOffhook = false;
  int _idlePollStreak = 0;

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
    _stopCallMonitor();
    WidgetsBinding.instance.removeObserver(this);
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_sessionActive) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _appPaused = true;
      return;
    }
    if (state == AppLifecycleState.resumed) {
      _appPaused = false;
      unawaited(_recorder.maintainRecordingDuringCall());
      unawaited(_checkCallEndedAfterReturn());
    }
  }

  Future<void> _checkCallEndedAfterReturn() async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
    if (!_sessionActive || _finishing || _appPaused) return;
    final state = await TelephonyBridge.getCallState();
    if (state == 'offhook' || state == 'ringing') {
      _sawOffhook = true;
      return;
    }
    final elapsed = DateTime.now().difference(_callStartedAt ?? DateTime.now());
    if (!_sawOffhook && elapsed < const Duration(seconds: 12)) return;
    await _finishCallSession();
  }

  void _startCallMonitor() {
    _stopCallMonitor();
    _sawOffhook = false;
    _idlePollStreak = 0;
    _callMonitorTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_tickCallMonitor());
    });
  }

  void _stopCallMonitor() {
    _callMonitorTimer?.cancel();
    _callMonitorTimer = null;
  }

  Future<void> _tickCallMonitor() async {
    if (!_sessionActive || _finishing) return;
    final placedAt = _callStartedAt;
    if (placedAt == null) return;

    final elapsed = DateTime.now().difference(placedAt);
    if (elapsed > VoiceRecordingService.maxRecordingDuration) {
      await _finishCallSession();
      return;
    }

    await _recorder.maintainRecordingDuringCall();
    if (_appPaused) return;

    final state = await TelephonyBridge.getCallState();
    if (state == 'offhook') _sawOffhook = true;
    if (state == 'idle') {
      _idlePollStreak++;
    } else {
      _idlePollStreak = 0;
    }

    if (elapsed < const Duration(seconds: 8)) return;

    if (_sawOffhook && state == 'idle' && _idlePollStreak >= 4) {
      await _finishCallSession();
      return;
    }
    if (!_sawOffhook && state == 'idle' && _idlePollStreak >= 8 && elapsed > const Duration(seconds: 45)) {
      await _finishCallSession();
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

  Future<bool> ensureRecordingReady() async => _ensurePermissions();

  Future<void> _cancelFailedStart() async {
    _sessionActive = false;
    _finishing = false;
    _appPaused = false;
    _stopCallMonitor();
    isCallActive.value = false;
    isRecording.value = false;
    await _recorder.cancelRecording();
    _pendingName = '';
    _pendingMobile = '';
    _pendingLeadId = null;
    _callStartedAt = null;
  }

  Future<void> endActiveCall() async {
    await TelephonyBridge.hangUp();
    if (_sessionActive) {
      await _finishCallSession();
    }
  }

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

    final digits = mobile.replaceAll(RegExp(r'\D'), '');
    final number = digits.length >= 10 ? digits.substring(digits.length - 10) : digits;

    final alreadyDialer = await TelephonyBridge.isDefaultDialer();
    if (!alreadyDialer) {
      final proceed = await _confirmInAppPhoneRole();
      if (!proceed) return;
    }

    if (alreadyDialer && recordingMandatory) {
      final started = await _recorder.startRecording();
      if (!started) {
        Get.snackbar('Cannot call', 'Microphone did not start. Allow it and try again.');
        return;
      }
      isRecording.value = true;
    }

    final status = await TelephonyBridge.placeInApp(number);
    if (status != 'placed') {
      if (isRecording.value) await _cancelFailedStart();
      await _showInAppSetup();
      return;
    }

    if (!isRecording.value && recordingMandatory) {
      final started = await _recorder.startRecording();
      if (!started) {
        await TelephonyBridge.hangUp();
        Get.snackbar('Cannot call', 'Recording did not start, so the call was ended.');
        return;
      }
      isRecording.value = true;
    }

    _pendingName = customerName;
    _pendingMobile = number;
    _pendingLeadId = leadId;
    _callStartedAt = DateTime.now();
    _sessionActive = true;
    _finishing = false;
    _appPaused = false;
    _sawOffhook = false;
    isCallActive.value = true;
    _startCallMonitor();
  }

  Future<bool> _confirmInAppPhoneRole() async {
    final allow = await Get.dialog<bool>(
      AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Keep this call in Nirmaldhara'),
        content: const Text(
          'A mobile call stays inside this app only when Nirmaldhara is the Phone app. Android asks this once.\n\n'
          'If a message says access was denied, tap Close. Then use Open settings, tap the ⋮ menu, and choose Allow restricted settings. Call again and select Nirmaldhara.\n\n'
          'The other Phone app is not opened.',
        ),
        actions: [
          TextButton(onPressed: () => Get.back(result: false), child: const Text('Not now')),
          ElevatedButton(onPressed: () => Get.back(result: true), child: const Text('Continue')),
        ],
      ),
      barrierDismissible: false,
    );
    return allow == true;
  }

  Future<void> _showInAppSetup() async {
    await Get.dialog<void>(
      AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('One-time Phone setup'),
        content: const Text(
          'Android blocked the in-app call because this app was installed from a file.\n\n'
          '1. Tap Open settings\n'
          '2. Tap the ⋮ menu at the top\n'
          '3. Tap Allow restricted settings\n'
          '4. Come back and tap Call\n'
          '5. Choose Nirmaldhara\n\n'
          'After that, the call and recording stay on this screen.',
        ),
        actions: [
          TextButton(onPressed: () => Get.back(), child: const Text('Close')),
          ElevatedButton(
            onPressed: () {
              Get.back();
              TelephonyBridge.openAppSettings();
            },
            child: const Text('Open settings'),
          ),
        ],
      ),
      barrierDismissible: false,
    );
  }

  @Deprecated('Use placeCustomerCall')
  Future<void> placeCall({
    required String mobile,
    String customerName = '',
    String? leadId,
  }) =>
      placeCustomerCall(mobile: mobile, customerName: customerName, leadId: leadId);

  Future<void> _finishCallSession() async {
    if (!_sessionActive || _finishing) return;
    _finishing = true;
    _sessionActive = false;
    _stopCallMonitor();
    isCallActive.value = false;

    final placedAt = _callStartedAt ?? DateTime.now();

    final telephony = await TelephonyCallReader.matchRecentOutgoing(
      mobile: _pendingMobile,
      placedAt: placedAt,
      maxAttempts: 20,
      attemptDelay: const Duration(milliseconds: 800),
    );

    String? rawRecordingPath;
    if (isRecording.value || _recorder.hasActiveSession) {
      rawRecordingPath = await _recorder.stopRecording();
      isRecording.value = false;
    }

    final wallDuration = DateTime.now().difference(placedAt);
    var recordingSeconds = durationToSeconds(wallDuration);
    if (rawRecordingPath != null && rawRecordingPath.isNotEmpty) {
      recordingSeconds = await _recorder.estimateSecondsFromFile(rawRecordingPath, recordingSeconds);
    }
    recordingSeconds = recordingSeconds.clamp(0, 60 * 60);

    Duration talkDuration;
    int talkSeconds;
    String callStatus;
    if (telephony.verified && telephony.durationSeconds > recordingSeconds) {
      talkSeconds = telephony.durationSeconds;
      talkDuration = Duration(seconds: talkSeconds);
      callStatus = telephony.callStatus;
    } else {
      talkSeconds = recordingSeconds > 3 ? recordingSeconds : durationToSeconds(wallDuration);
      talkDuration = Duration(seconds: talkSeconds);
      callStatus = talkSeconds > 3 ? 'connected' : 'unknown';
    }

    String? serverRecordingUrl;
    String? localRecordingPath;
    if (rawRecordingPath != null && rawRecordingPath.isNotEmpty) {
      if (await _recorder.isValidRecordingFile(rawRecordingPath)) {
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

    final recordingPathForUpload = localRecordingPath;
    if (recordingPathForUpload != null && ApiConstants.useRemoteApi) {
      serverRecordingUrl = await _upload.uploadVoiceFileWithRetry(recordingPathForUpload);
      if (serverRecordingUrl != null && serverRecordingUrl.contains('/uploads/')) {
        log = log.copyWith(recordingUrl: serverRecordingUrl, localRecordingPath: null);
        localRecordingPath = null;
      }
    }

    _storage.appendToList(ApiConstants.callLogsKey, log.toJson());

    if (ApiConstants.useRemoteApi) {
      final synced = await _trySyncLog(log);
      if (synced) {
        log = log.copyWith(synced: true);
        _updateStoredLog(log);
      } else if (Get.isRegistered<SyncService>()) {
        await Get.find<SyncService>().queuePendingCallLog(log);
        unawaited(Get.find<SyncService>().syncPendingRecords(silent: true));
      }
      if (!log.hasOnlineRecording && log.localRecordingPath != null) {
        Get.snackbar(
          'Recording pending',
          'Call saved — recording will upload when network is stable',
          duration: const Duration(seconds: 4),
        );
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
    _finishing = false;

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
        final url = await _upload.uploadVoiceFileWithRetry(log.localRecordingPath!);
        if (url != null && url.contains('/uploads/')) {
          payload = log.copyWith(recordingUrl: UploadService.normalizeUploadPath(url), localRecordingPath: null);
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

  Future<bool> updateCallSummary(String id, String summary) async {
    final list = _storage.readList(ApiConstants.callLogsKey);
    final idx = list.indexWhere((e) => e['id'] == id);
    if (idx < 0) return false;
    final log = CallLogModel.fromJson(list[idx]).copyWith(callSummary: summary);
    _updateStoredLog(log);
    final i = recentLogs.indexWhere((l) => l.id == id);
    if (i >= 0) recentLogs[i] = log;
    if (ApiConstants.useRemoteApi) {
      try {
        await _api.updateCallLog(id, {'callSummary': summary});
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  Future<List<CallLogModel>> fetchFromServer() async {
    await refreshFromServer();
    return recentLogs;
  }
}
