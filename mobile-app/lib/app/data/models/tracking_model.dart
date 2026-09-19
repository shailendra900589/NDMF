class RoutePoint {
  final double latitude;
  final double longitude;
  final DateTime timestamp;

  RoutePoint({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp.toIso8601String(),
      };

  factory RoutePoint.fromJson(Map<String, dynamic> json) {
    return RoutePoint(
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    );
  }
}

class TravelReport {
  final DateTime date;
  final double totalKm;
  final List<RoutePoint> routePoints;
  final DateTime? startTime;
  final DateTime? endTime;

  TravelReport({
    required this.date,
    this.totalKm = 0,
    this.routePoints = const [],
    this.startTime,
    this.endTime,
  });

  Map<String, dynamic> toJson() => {
        'date': date.toIso8601String(),
        'totalKm': totalKm,
        'routePoints': routePoints.map((e) => e.toJson()).toList(),
        'startTime': startTime?.toIso8601String(),
        'endTime': endTime?.toIso8601String(),
      };

  factory TravelReport.fromJson(Map<String, dynamic> json) {
    return TravelReport(
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      totalKm: (json['totalKm'] ?? 0).toDouble(),
      routePoints: (json['routePoints'] as List<dynamic>?)
              ?.map((e) => RoutePoint.fromJson(e))
              .toList() ??
          [],
      startTime: json['startTime'] != null ? DateTime.tryParse(json['startTime']) : null,
      endTime: json['endTime'] != null ? DateTime.tryParse(json['endTime']) : null,
    );
  }
}
