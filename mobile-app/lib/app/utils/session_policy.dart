/// A module permission failure must not sign out an otherwise valid session.
bool isCurrentSessionRequest(String? authorization, String? token) =>
    token != null && token.isNotEmpty && authorization == 'Bearer $token';

bool shouldExpireSession(int? status, String path, String message) {
  if (path.contains('/auth/login') || path.contains('/auth/otp/')) return false;
  if (path.contains('/auth/change-password') &&
      message.toLowerCase().contains('current password')) {
    return false;
  }
  if (status == 401) return true;
  return status == 403 &&
      (message.toLowerCase().contains('account disabled') ||
          message.toLowerCase().contains('company is suspended'));
}
