/**
 * Parses a numeric text field. Mobile keyboards may produce a decimal comma
 * ("72,5") depending on locale, so that is accepted too. Empty input is
 * NaN (never 0), so a blank required field always fails validation.
 */
export function parseDecimal(value: string): number {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "" ? Number.NaN : Number(trimmed);
}
