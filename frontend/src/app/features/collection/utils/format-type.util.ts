import { CollectionRelease } from '../../../core/types';

export type FormatType = 'cd' | 'double_cd' | 'double_lp' | 'lp';

/**
 * Determines the format type ('cd' | 'double_cd' | 'double_lp' | 'lp') for a given collection release.
 */
export function getFormatType(release: CollectionRelease): FormatType {
  const basic = release?.basic_information;
  if (!basic) return 'lp';

  const formatStr = (basic.format || '').toLowerCase();
  const formats = basic.formats || [];

  // Determine if it is a CD
  const isCd =
    formatStr.includes('cd') ||
    formats.some(
      (f) =>
        (f.name || '').toLowerCase().includes('cd') ||
        (f.descriptions || []).some((d) => d.toLowerCase() === 'cd')
    );

  if (isCd) {
    // Check if it is a Double CD
    const hasDoubleCdInString =
      formatStr.includes('double cd') ||
      formatStr.includes('2xcd') ||
      formatStr.includes('2 x cd') ||
      formatStr.includes('2cd') ||
      formatStr.includes('2 cd') ||
      formatStr.includes('double');

    const hasDoubleCdInFormats = formats.some((f) => {
      const name = (f.name || '').toLowerCase();
      const qty = parseInt(f.qty || '1', 10);
      const descs = (f.descriptions || []).map((d) => d.toLowerCase());
      const isCdFormat = name.includes('cd') || descs.some((d) => d === 'cd');
      if (!isCdFormat) return false;
      return (
        qty >= 2 ||
        descs.some(
          (d) =>
            d.includes('2xcd') ||
            d.includes('2 x cd') ||
            d.includes('double cd') ||
            d.includes('2cd') ||
            d.includes('double album') ||
            d.includes('double')
        )
      );
    });

    if (hasDoubleCdInString || hasDoubleCdInFormats) {
      return 'double_cd';
    }
    return 'cd';
  }

  // Otherwise, it is Vinyl / LP
  const hasDoubleLpInString =
    formatStr.includes('double') ||
    formatStr.includes('2xlp') ||
    formatStr.includes('2lp') ||
    formatStr.includes('2 x lp') ||
    formatStr.includes('2 x vinyl');

  const hasDoubleLpInFormats = formats.some((f) => {
    const qty = parseInt(f.qty || '1', 10);
    const descs = (f.descriptions || []).map((d) => d.toLowerCase());
    const has2x = descs.some(
      (d) =>
        d.includes('2xlp') ||
        d.includes('2 x lp') ||
        d.includes('double lp') ||
        d.includes('2lp') ||
        d.includes('2 x vinyl') ||
        d.includes('double')
    );
    return qty >= 2 || has2x;
  });

  if (hasDoubleLpInString || hasDoubleLpInFormats) {
    return 'double_lp';
  }

  return 'lp';
}
