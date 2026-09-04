import { describe, expect, it } from 'vitest';

import {
  isSensitiveFieldName,
  isSensitiveInputElement,
  stringifyConsoleArgument
} from './sanitize.js';

describe('isSensitiveFieldName', () => {
  it.each(['password', 'apiKey', 'api_key', 'authToken', 'cardNumber', 'cvv', 'ssn'])(
    'flags %s as sensitive',
    (name) => {
      expect(isSensitiveFieldName(name)).toBe(true);
    }
  );

  it('does not flag ordinary field names', () => {
    expect(isSensitiveFieldName('region')).toBe(false);
  });
});

describe('isSensitiveInputElement', () => {
  it('flags password and hidden inputs', () => {
    const password = document.createElement('input');
    password.type = 'password';
    expect(isSensitiveInputElement(password)).toBe(true);

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    expect(isSensitiveInputElement(hidden)).toBe(true);
  });

  it('does not flag an ordinary text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'region';
    expect(isSensitiveInputElement(input)).toBe(false);
  });
});

describe('stringifyConsoleArgument', () => {
  it('stringifies errors as their stack', () => {
    const error = new Error('boom');
    expect(stringifyConsoleArgument(error)).toContain('boom');
  });

  it('does not throw on circular objects', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => stringifyConsoleArgument(circular)).not.toThrow();
  });

  it('redacts sensitive keys inside objects', () => {
    expect(stringifyConsoleArgument({ password: 'hunter2' })).not.toContain('hunter2');
  });
});
