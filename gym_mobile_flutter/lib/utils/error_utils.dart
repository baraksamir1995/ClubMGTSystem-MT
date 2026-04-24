import 'dart:async';
import 'dart:io';
import '../services/api_service.dart';

/// Converts raw exceptions into user-friendly messages.
String friendlyError(Object e) {
  if (e is SocketException || _isHostLookupError(e)) {
    return 'No internet connection. Please check your network and try again.';
  }
  if (e is TimeoutException) {
    return 'Request timed out. Please try again.';
  }
  if (e is ApiException) {
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

bool _isHostLookupError(Object e) {
  final msg = e.toString().toLowerCase();
  return msg.contains('failed host lookup') ||
      msg.contains('socketexception') ||
      msg.contains('clientexception') ||
      msg.contains('no address associated');
}
