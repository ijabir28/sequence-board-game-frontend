import { describe, expect, it } from 'vitest';
import { validateNewPassword } from './ResetPassword';

describe('validateNewPassword', () => {
  it('accepts a long enough password typed twice', () => {
    expect(validateNewPassword('long enough', 'long enough')).toBeNull();
  });

  it('flags a short or long password before a mismatch', () => {
    expect(validateNewPassword('short', 'other')?.field).toBe('password');
    expect(validateNewPassword('x'.repeat(201), 'x'.repeat(201))?.field).toBe('password');
  });

  it('flags a repeat that does not match', () => {
    expect(validateNewPassword('long enough', 'long enougH')).toEqual({ text: "The two passwords don't match.", field: 'confirm' });
  });
});
