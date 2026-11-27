import 'dart:convert';

/// base64url without (or with) padding → bytes, null if malformed.
List<int>? decodeBase64Url(String s) {
  try {
    final padded = s.padRight((s.length + 3) ~/ 4 * 4, '=');
    return base64Url.decode(padded);
  } catch (_) {
    return null;
  }
}

/// Unpadded base64url.
String encodeBase64UrlNoPad(List<int> bytes) =>
    base64Url.encode(bytes).replaceAll('=', '');

/// Nesting depth of JSON containers (objects / arrays); scalars are 0.
int jsonContainerDepth(Object? v) {
  if (v is Map) {
    var m = 0;
    for (final x in v.values) {
      final d = jsonContainerDepth(x);
      if (d > m) m = d;
    }
    return 1 + m;
  }
  if (v is List) {
    var m = 0;
    for (final x in v) {
      final d = jsonContainerDepth(x);
      if (d > m) m = d;
    }
    return 1 + m;
  }
  return 0;
}

/// Mirrors the server's `json_decode($raw, true, 4, …)`: PHP returns null
/// once containers nest 4 deep (verified: `[[[1]]]` decodes, `[[[[1]]]]`
/// does not), so such a text is "not a v2 QR" there. Returns null when
/// [raw] isn't JSON or is too deep.
Object? decodeJsonPhpDepth4(String raw) {
  try {
    final j = jsonDecode(raw);
    return jsonContainerDepth(j) >= 4 ? null : j;
  } catch (_) {
    return null;
  }
}
