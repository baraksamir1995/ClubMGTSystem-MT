/**
 * Escape one CSV cell for files opened in Excel / Google Sheets.
 *
 * Neutralises spreadsheet formula injection: a cell starting with = + - @
 * (or tab/CR, which some parsers strip back to those) is evaluated as a
 * formula — a member name like "=HYPERLINK(...)" would execute on open.
 * Prefixing with a single quote makes it literal text in both Excel and
 * Sheets. A leading "-" is only dangerous when it isn't just a negative
 * number, so plain negatives (e.g. an expired row's days-remaining) are
 * left numeric.
 */
export function escapeCsv(v: string | number): string {
  let s = String(v ?? '');
  const isNumeric = /^-?\d+(\.\d+)?$/.test(s);
  if (!isNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
