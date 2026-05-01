/// Shared country list for phone-number inputs across the app.
/// Egypt is first because that's the dominant local market; a small
/// MENA-heavy + global selection covers everything members are likely
/// to use.
class Country {
  final String name;
  final String dialCode; // includes leading '+'
  final String flag;
  const Country(this.name, this.dialCode, this.flag);
}

const List<Country> kCountries = [
  Country('Egypt',         '+20',  '🇪🇬'),
  Country('Saudi Arabia',  '+966', '🇸🇦'),
  Country('UAE',           '+971', '🇦🇪'),
  Country('Kuwait',        '+965', '🇰🇼'),
  Country('Qatar',         '+974', '🇶🇦'),
  Country('Bahrain',       '+973', '🇧🇭'),
  Country('Oman',          '+968', '🇴🇲'),
  Country('Jordan',        '+962', '🇯🇴'),
  Country('Lebanon',       '+961', '🇱🇧'),
  Country('Iraq',          '+964', '🇮🇶'),
  Country('Morocco',       '+212', '🇲🇦'),
  Country('Tunisia',       '+216', '🇹🇳'),
  Country('Algeria',       '+213', '🇩🇿'),
  Country('Libya',         '+218', '🇱🇾'),
  Country('Sudan',         '+249', '🇸🇩'),
  Country('Turkey',        '+90',  '🇹🇷'),
  Country('USA / Canada',  '+1',   '🇺🇸'),
  Country('UK',            '+44',  '🇬🇧'),
  Country('Germany',       '+49',  '🇩🇪'),
  Country('France',        '+33',  '🇫🇷'),
];

/// Compose an E.164-ish phone string: dial code + digits typed by the
/// user, with any leading 0 stripped (common in EG/MENA where members
/// write 0100 even though +20 makes the leading 0 redundant).
String composePhone({required String dialCode, required String typed}) {
  var digits = typed.trim().replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  return '$dialCode$digits';
}
