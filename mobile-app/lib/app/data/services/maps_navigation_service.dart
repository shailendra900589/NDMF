import 'package:url_launcher/url_launcher.dart';
import 'package:get/get.dart';

class MapsNavigationService extends GetxService {
  Future<void> openInGoogleMaps({
    required double latitude,
    required double longitude,
    String? label,
  }) async {
    final uri = Uri.parse(
      'google.navigation:q=$latitude,$longitude&mode=d',
    );
    final webUri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude',
    );

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (await canLaunchUrl(webUri)) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    } else {
      Get.snackbar('Maps', 'Could not open Google Maps');
    }
  }

  Future<void> showLocationOnMap({
    required double latitude,
    required double longitude,
  }) async {
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$latitude,$longitude');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
