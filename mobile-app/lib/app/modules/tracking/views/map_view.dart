import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../theme/app_colors.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/maps_navigation_service.dart';
import '../../../data/services/tracking_service.dart';

class MapView extends StatefulWidget {
  final double? customerLat;
  final double? customerLng;
  final String? customerName;

  const MapView({
    super.key,
    this.customerLat,
    this.customerLng,
    this.customerName,
  });

  const MapView.customer({
    super.key,
    required double lat,
    required double lng,
    required String name,
  })  : customerLat = lat,
        customerLng = lng,
        customerName = name;

  @override
  State<MapView> createState() => _MapViewState();
}

class _MapViewState extends State<MapView> {
  GoogleMapController? _mapController;
  double _lat = LocationService.branchLat;
  double _lng = LocationService.branchLng;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadLocation();
    Get.find<TrackingService>().refreshTodayFromServer();
  }

  Future<void> _loadLocation() async {
    if (widget.customerLat != null && widget.customerLng != null) {
      setState(() {
        _lat = widget.customerLat!;
        _lng = widget.customerLng!;
        _loading = false;
      });
      return;
    }
    final loc = await Get.find<LocationService>().getCurrentLocation();
    if (loc != null) {
      setState(() {
        _lat = loc.latitude;
        _lng = loc.longitude;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  void _fitRoute(List<LatLng> points) {
    if (_mapController == null || points.length < 2) return;
    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLng = points.first.longitude;
    for (final p in points) {
      minLat = minLat < p.latitude ? minLat : p.latitude;
      maxLat = maxLat > p.latitude ? maxLat : p.latitude;
      minLng = minLng < p.longitude ? minLng : p.longitude;
      maxLng = maxLng > p.longitude ? maxLng : p.longitude;
    }
    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat, minLng),
          northeast: LatLng(maxLat, maxLng),
        ),
        48,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tracking = Get.find<TrackingService>();
    final mapsNav = Get.find<MapsNavigationService>();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.customerName ?? 'Route map'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primaryDark, AppColors.primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Obx(() {
              final points = tracking.routePoints;
              final polylinePoints =
                  points.map((p) => LatLng(p.latitude, p.longitude)).toList();
              if (polylinePoints.length >= 2) {
                WidgetsBinding.instance.addPostFrameCallback((_) => _fitRoute(polylinePoints));
              }

              return Stack(
                children: [
                  GoogleMap(
                    onMapCreated: (c) => _mapController = c,
                    initialCameraPosition: CameraPosition(
                      target: polylinePoints.isNotEmpty
                          ? polylinePoints.last
                          : LatLng(_lat, _lng),
                      zoom: 14,
                    ),
                    markers: {
                      if (polylinePoints.isNotEmpty)
                        Marker(
                          markerId: const MarkerId('route_start'),
                          position: polylinePoints.first,
                          infoWindow: const InfoWindow(title: 'Route start'),
                          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
                        ),
                      if (polylinePoints.length > 1)
                        Marker(
                          markerId: const MarkerId('route_end'),
                          position: polylinePoints.last,
                          infoWindow: const InfoWindow(title: 'Latest position'),
                          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
                        ),
                      Marker(
                        markerId: const MarkerId('branch'),
                        position: const LatLng(LocationService.branchLat, LocationService.branchLng),
                        infoWindow: const InfoWindow(title: 'Branch office'),
                        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
                      ),
                      if (widget.customerLat != null && widget.customerLng != null)
                        Marker(
                          markerId: const MarkerId('customer'),
                          position: LatLng(widget.customerLat!, widget.customerLng!),
                          infoWindow: InfoWindow(title: widget.customerName ?? 'Customer'),
                        ),
                    },
                    polylines: polylinePoints.length >= 2
                        ? {
                            Polyline(
                              polylineId: const PolylineId('route'),
                              points: polylinePoints,
                              color: AppColors.primary,
                              width: 5,
                              geodesic: true,
                            ),
                          }
                        : {},
                    myLocationEnabled: widget.customerLat == null,
                    myLocationButtonEnabled: widget.customerLat == null,
                    zoomControlsEnabled: true,
                  ),
                  Positioned(
                    bottom: 16,
                    left: 16,
                    right: 16,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${tracking.totalKmToday.value.toStringAsFixed(2)} KM • ${points.length} points',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            Text(
                              tracking.isTracking.value
                                  ? 'Live tracking (on duty)'
                                  : 'Tracking paused — check in again tomorrow',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () async {
                                      await tracking.refreshTodayFromServer();
                                      await _loadLocation();
                                    },
                                    icon: const Icon(Icons.refresh, size: 18),
                                    label: const Text('Refresh'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => mapsNav.openInGoogleMaps(
                                      latitude: _lat,
                                      longitude: _lng,
                                      label: widget.customerName,
                                    ),
                                    icon: const Icon(Icons.navigation, size: 18),
                                    label: const Text('Navigate'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            }),
    );
  }
}
