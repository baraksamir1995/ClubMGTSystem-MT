import 'dart:io';

/// Converts raw exceptions into user-friendly messages.
String friendlyError(Object e) {
  if (e is SocketException || _isHostLookupError(e)) {
    return 'No internet connection. Please check your network and try again.';
  }
  return e.toString();
}

bool _isHostLookupError(Object e) {
  final msg = e.toString().toLowerCase();
  return msg.contains('failed host lookup') ||
      msg.contains('socketexception') ||
      msg.contains('clientexception') ||
      msg.contains('no address associated');
}
