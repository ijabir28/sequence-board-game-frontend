import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_LENGTH, reactionEmoji, sanitizeMessage, sanitizeReaction } from './tableChat';

describe('sanitizeMessage', () => {
  it('reads a message, falling back to the handle for a missing name', () => {
    expect(sanitizeMessage({ id: 'a-1', author: { handle: 'ada', name: '' }, text: 'good luck', at: '2026-10-23T10:00:00.000Z' })).toEqual({
      id: 'a-1',
      author: { handle: 'ada', name: 'ada' },
      text: 'good luck',
      at: Date.parse('2026-10-23T10:00:00.000Z'),
    });
  });

  it('drops anything that is not a message, and trims overlong text', () => {
    expect(sanitizeMessage(null)).toBeNull();
    expect(sanitizeMessage({ id: 'a-1', text: 'no author' })).toBeNull();
    expect(sanitizeMessage({ id: 'a-1', author: { handle: 'ada' }, text: '' })).toBeNull();
    expect(sanitizeMessage({ id: 'a-1', author: { handle: 'ada' }, text: 'x'.repeat(500) })?.text).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});

describe('sanitizeReaction', () => {
  it('reads only the reactions the table knows', () => {
    expect(sanitizeReaction({ id: 'r-1', author: { handle: 'ben', name: 'Ben' }, reaction: 'clap', at: 'soon' })).toMatchObject({
      author: { handle: 'ben', name: 'Ben' },
      reaction: 'clap',
    });
    expect(sanitizeReaction({ id: 'r-1', author: { handle: 'ben' }, reaction: 'skull' })).toBeNull();
    expect(reactionEmoji('gg')).toBe('GG');
  });
});
