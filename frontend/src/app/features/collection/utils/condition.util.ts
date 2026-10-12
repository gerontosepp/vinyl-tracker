/**
 * Utility to extract short Goldmine condition codes (e.g. "VG+", "NM", "VG", "M", "G+", "G", "F", "P").
 */
export function getConditionShortCode(condition?: string | null): string {
  if (!condition) return '';
  const trimmed = condition.trim();
  const match = trimmed.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    // If format like "Near Mint (NM or M-)", returns "NM"
    return match[1].split(' ')[0] || match[1];
  }
  return trimmed;
}
