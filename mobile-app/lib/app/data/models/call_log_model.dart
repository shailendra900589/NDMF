import 'enums/app_enums.dart';

class CallLogModel {
  final String id;
  final String customerName;
  final String mobile;
  final DateTime date;
  final String time;
  final String duration;
  final CallType type;
  final String? leadId;
  final String? recordingUrl;
  final String? localRecordingPath;
  final String? employeeId;
  final String? employeeName;
  final bool synced;
  final int durationSeconds;
  final int recordingDurationSeconds;
  final String callStatus;
  final String? callSummary;
  final bool telephonyVerified;

  CallLogModel({
    required this.id,
    required this.customerName,
    required this.mobile,
    required this.date,
    required this.time,
    required this.duration,
    required this.type,
    this.leadId,
    this.recordingUrl,
    this.localRecordingPath,
    this.employeeId,
    this.employeeName,
    this.synced = true,
    this.durationSeconds = 0,
    this.recordingDurationSeconds = 0,
    this.callStatus = 'unknown',
    this.callSummary,
    this.telephonyVerified = false,
  });

  bool get isConnected => callStatus == 'connected' && durationSeconds > 0;

  bool get hasRecording =>
      (recordingUrl != null && recordingUrl!.contains('/uploads/')) ||
      (localRecordingPath != null && localRecordingPath!.isNotEmpty);

  bool get hasOnlineRecording => recordingUrl != null && recordingUrl!.contains('/uploads/');

  factory CallLogModel.fromJson(Map<String, dynamic> json) {
    return CallLogModel(
      id: json['id']?.toString() ?? '',
      customerName: json['customerName'] ?? '',
      mobile: json['mobile'] ?? '',
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      time: json['time'] ?? '',
      duration: json['duration'] ?? '0:00',
      type: CallType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => CallType.outgoing,
      ),
      leadId: json['leadId'],
      recordingUrl: json['recordingUrl'],
      localRecordingPath: json['localRecordingPath'],
      employeeId: json['employeeId'],
      employeeName: json['employeeName'],
      synced: json['synced'] ?? true,
      durationSeconds: (json['durationSeconds'] is num)
          ? (json['durationSeconds'] as num).toInt()
          : int.tryParse('${json['durationSeconds'] ?? 0}') ?? 0,
      recordingDurationSeconds: (json['recordingDurationSeconds'] is num)
          ? (json['recordingDurationSeconds'] as num).toInt()
          : int.tryParse('${json['recordingDurationSeconds'] ?? 0}') ?? 0,
      callStatus: json['callStatus']?.toString() ?? 'unknown',
      callSummary: json['callSummary']?.toString(),
      telephonyVerified: json['telephonyVerified'] == true,
    );
  }

  Map<String, dynamic> toJson({bool forServer = false}) => {
        'id': id,
        'customerName': customerName,
        'mobile': mobile,
        'date': date.toIso8601String(),
        'time': time,
        'duration': duration,
        'durationSeconds': durationSeconds,
        'recordingDurationSeconds': recordingDurationSeconds,
        'callStatus': callStatus,
        if (callSummary != null && callSummary!.isNotEmpty) 'callSummary': callSummary,
        'telephonyVerified': telephonyVerified,
        'type': type.name,
        if (leadId != null) 'leadId': leadId,
        if (recordingUrl != null && recordingUrl!.contains('/uploads/')) 'recordingUrl': recordingUrl,
        if (!forServer && localRecordingPath != null) 'localRecordingPath': localRecordingPath,
        if (employeeId != null) 'employeeId': employeeId,
        if (employeeName != null) 'employeeName': employeeName,
        if (!forServer) 'synced': synced,
      };

  CallLogModel copyWith({
    String? recordingUrl,
    String? localRecordingPath,
    bool? synced,
    String? callSummary,
    int? durationSeconds,
    String? duration,
    String? callStatus,
    bool? telephonyVerified,
    int? recordingDurationSeconds,
  }) {
    return CallLogModel(
      id: id,
      customerName: customerName,
      mobile: mobile,
      date: date,
      time: time,
      duration: duration ?? this.duration,
      type: type,
      leadId: leadId,
      recordingUrl: recordingUrl ?? this.recordingUrl,
      localRecordingPath: localRecordingPath ?? this.localRecordingPath,
      employeeId: employeeId,
      employeeName: employeeName,
      synced: synced ?? this.synced,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      recordingDurationSeconds: recordingDurationSeconds ?? this.recordingDurationSeconds,
      callStatus: callStatus ?? this.callStatus,
      callSummary: callSummary ?? this.callSummary,
      telephonyVerified: telephonyVerified ?? this.telephonyVerified,
    );
  }
}
