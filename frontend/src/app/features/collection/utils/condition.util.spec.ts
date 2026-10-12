import { getConditionShortCode } from './condition.util';

describe('condition.util', () => {
  it('should return empty string for null, undefined or empty input', () => {
    expect(getConditionShortCode(null)).toBe('');
    expect(getConditionShortCode(undefined)).toBe('');
    expect(getConditionShortCode('')).toBe('');
    expect(getConditionShortCode('   ')).toBe('');
  });

  it('should extract short codes from Goldmine format', () => {
    expect(getConditionShortCode('Mint (M)')).toBe('M');
    expect(getConditionShortCode('Near Mint (NM or M-)')).toBe('NM');
    expect(getConditionShortCode('Very Good Plus (VG+)')).toBe('VG+');
    expect(getConditionShortCode('Very Good (VG)')).toBe('VG');
    expect(getConditionShortCode('Good Plus (G+)')).toBe('G+');
    expect(getConditionShortCode('Good (G)')).toBe('G');
    expect(getConditionShortCode('Fair (F)')).toBe('F');
    expect(getConditionShortCode('Poor (P)')).toBe('P');
  });

  it('should return raw condition if no parentheses present', () => {
    expect(getConditionShortCode('VG+')).toBe('VG+');
    expect(getConditionShortCode('NM')).toBe('NM');
  });
});
