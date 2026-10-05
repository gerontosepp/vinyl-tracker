import { CollectionRelease } from '../../../core/types';

/**
 * Determines the format type ('cd' | 'double_lp' | 'lp') for a given collection release.
 */
export function getFormatType(release: CollectionRelease): 'cd' | 'double_lp' | 'lp' {
  const basic = release?.basic_information;
  if (!basic) return 'lp';

  const formatStr = (basic.format || '').toLowerCase();
  if (
    formatStr.includes('double') ||
    formatStr.includes('2xlp') ||
    formatStr.includes('2lp') ||
    formatStr.includes('2 x lp') ||
    formatStr.includes('2 x vinyl')
  ) {
    return 'double_lp';
  }
  if (formatStr.includes('cd')) {
    return 'cd';
  }

  if (basic.formats && basic.formats.length > 0) {
    for (const f of basic.formats) {
      const name = (f.name || '').toLowerCase();
      const qty = parseInt(f.qty || '1', 10);
      const descs = (f.descriptions || []).map((d) => d.toLowerCase());
      const has2x = descs.some(
        (d) =>
          d.includes('2xlp') ||
          d.includes('2 x lp') ||
          d.includes('double lp') ||
          d.includes('2lp') ||
          d.includes('2 x vinyl')
      );

      if (name.includes('cd') || descs.some((d) => d === 'cd')) {
        return 'cd';
      }
      if (
        name.includes('vinyl') ||
        descs.some((d) => d.includes('lp') || d.includes('album') || d.includes('vinyl'))
      ) {
        if (qty >= 2 || has2x) {
          return 'double_lp';
        }
      } else if (has2x || qty >= 2) {
        return 'double_lp';
      }
    }
  }

  return 'lp';
}
