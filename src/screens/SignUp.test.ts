import { describe, expect, it } from 'vitest';
import { validateSignUp } from './SignUp';

describe('validateSignUp', () => {
  it('accepts a valid account, normalising the handle like the server', () => {
    expect(validateSignUp('  New_Player ', 'New', ' new@example.com ', 'long enough')).toBeNull();
  });

  it('allows display names of up to 10 characters', () => {
    expect(validateSignUp('player', ' ' + 'x'.repeat(10) + ' ', 'p@example.com', 'long enough')).toBeNull();
    expect(validateSignUp('player', 'x'.repeat(11), 'p@example.com', 'long enough')?.text).toMatch(/up to 10 characters/);
  });

  it.each([
    ['ab', 'Name', 'p@example.com', 'long enough', 'handle'],
    ['has space', 'Name', 'p@example.com', 'long enough', 'handle'],
    ['a'.repeat(21), 'Name', 'p@example.com', 'long enough', 'handle'],
    ['player', '   ', 'p@example.com', 'long enough', 'name'],
    ['player', 'x'.repeat(11), 'p@example.com', 'long enough', 'name'],
    ['player', 'Name', '', 'long enough', 'email'],
    ['player', 'Name', 'no-at-sign.com', 'long enough', 'email'],
    ['player', 'Name', 'p@example.com', 'short', 'password'],
  ])('flags %j / %j / %j / %j on the %s field', (handle, name, email, password, field) => {
    expect(validateSignUp(handle, name, email, password)?.field).toBe(field);
  });
});
