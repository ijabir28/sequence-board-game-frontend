import { describe, expect, it } from 'vitest';
import { validateSignUp } from './SignUp';

describe('validateSignUp', () => {
  it('accepts a valid account, normalising the handle like the server', () => {
    expect(validateSignUp('  New_Player ', 'New', 'long enough')).toBeNull();
  });

  it('allows display names of up to 10 characters', () => {
    expect(validateSignUp('player', ' ' + 'x'.repeat(10) + ' ', 'long enough')).toBeNull();
    expect(validateSignUp('player', 'x'.repeat(11), 'long enough')?.text).toMatch(/up to 10 characters/);
  });

  it.each([
    ['ab', 'Name', 'long enough', 'handle'],
    ['has space', 'Name', 'long enough', 'handle'],
    ['a'.repeat(21), 'Name', 'long enough', 'handle'],
    ['player', '   ', 'long enough', 'name'],
    ['player', 'x'.repeat(11), 'long enough', 'name'],
    ['player', 'Name', 'short', 'password'],
  ])('flags %j / %j / %j on the %s field', (handle, name, password, field) => {
    expect(validateSignUp(handle, name, password)?.field).toBe(field);
  });
});
