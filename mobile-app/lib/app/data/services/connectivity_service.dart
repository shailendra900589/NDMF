import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:get/get.dart';

class ConnectivityService extends GetxService {
  final Connectivity _connectivity = Connectivity();
  final RxBool isOnline = true.obs;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  Future<ConnectivityService> init() async {
    final result = await _connectivity.checkConnectivity();
    isOnline.value = _hasConnection(result);
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      isOnline.value = _hasConnection(results);
    });
    return this;
  }

  bool _hasConnection(List<ConnectivityResult> results) {
    return results.any((r) =>
        r == ConnectivityResult.mobile ||
        r == ConnectivityResult.wifi ||
        r == ConnectivityResult.ethernet);
  }

  @override
  void onClose() {
    _subscription?.cancel();
    super.onClose();
  }
}
