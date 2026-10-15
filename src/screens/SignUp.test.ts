import { describe, expect, it } from 'vitest';
import { validateSignUp } from './SignUp';

describe('validateSignUp', () => {
  it('accepts a valid account, normalising the handle like the server', () => {
    expect(validateSignUp('  New_Player ', 'New', 'long enough')).toBeNull();
  });

  it.each([
    ['ab', 'Name', 'long enough', 'handle'],
    ['has space', 'Name', 'long enough', 'handle'],
    ['a'.repeat(21), 'Name', 'long enough', 'handle'],
    ['player', '   ', 'long enough', 'name'],
    ['player', 'x'.repeat(51), 'long enough', 'name'],
    ['player', 'Name', 'short', 'password'],
  ])('flags %j / %j / %j on the %s field', (handle, name, password, field) => {
    expect(validateSignUp(handle, name, password)?.field).toBe(field);
  });
});
