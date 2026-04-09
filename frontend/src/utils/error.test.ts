import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error';

describe('getErrorMessage', () => {
  it('returns message from Error', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns fallback for unknown error values', () => {
    expect(getErrorMessage({ not: 'an error' }, 'fallback')).toBe('fallback');
  });
});
