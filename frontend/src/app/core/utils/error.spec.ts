import { HttpErrorResponse } from '@angular/common/http';
import { getErrorMessage } from './error';

describe('Error Utils', () => {
  it('should return fallback message for unknown error types', () => {
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getErrorMessage('some string', 'Fallback')).toBe('Fallback');
  });

  it('should return message from Error instance', () => {
    const err = new Error('Custom error message');
    expect(getErrorMessage(err, 'Fallback')).toBe('Custom error message');
  });

  it('should return message from HttpErrorResponse error payload', () => {
    const errorResponse = new HttpErrorResponse({
      error: { message: 'Api message' }
    });
    expect(getErrorMessage(errorResponse, 'Fallback')).toBe('Api message');
  });

  it('should return error field from HttpErrorResponse error payload', () => {
    const errorResponse = new HttpErrorResponse({
      error: { error: 'Api error' }
    });
    expect(getErrorMessage(errorResponse, 'Fallback')).toBe('Api error');
  });

  it('should return detail field from HttpErrorResponse error payload', () => {
    const errorResponse = new HttpErrorResponse({
      error: { detail: 'Api detail' }
    });
    expect(getErrorMessage(errorResponse, 'Fallback')).toBe('Api detail');
  });

  it('should return raw string from HttpErrorResponse error if it is a string', () => {
    const errorResponse = new HttpErrorResponse({
      error: 'Raw string error'
    });
    expect(getErrorMessage(errorResponse, 'Fallback')).toBe('Raw string error');
  });

  it('should return message from HttpErrorResponse if error payload lacks message', () => {
    const errorResponse = new HttpErrorResponse({});
    Object.defineProperty(errorResponse, 'message', {
      value: 'HTTP failure response'
    });
    expect(getErrorMessage(errorResponse, 'Fallback')).toBe('HTTP failure response');
  });
});
