import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../api/tableChat';
import { KEPT_MESSAGES, appendMessage, countUnseen, mergeHistory } from './chatLog';

function message(id: string, at: number, handle = 'ada'): ChatMessage {
  return { id, author: { handle, name: handle }, text: id, at };
}

describe('chat log', () => {
  it('merges a history into what the page has, oldest first and without repeats', () => {
    const current = [message('a', 1), message('b', 2)];
    expect(mergeHistory(current, [message('b', 2), message('c', 3)]).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only as many messages as the server does', () => {
    const many = Array.from({ length: KEPT_MESSAGES + 3 }, (_, i) => message(`m${i}`, i));
    expect(mergeHistory([], many)).toHaveLength(KEPT_MESSAGES);
    expect(appendMessage(many.slice(0, KEPT_MESSAGES), message('new', 999)).at(-1)?.id).toBe('new');
  });

  it('appends a message once', () => {
    const current = [message('a', 1)];
    expect(appendMessage(current, message('a', 1))).toBe(current);
  });

  it('counts the history messages that are new and from someone else', () => {
    const current = [message('a', 1)];
    expect(countUnseen(current, [message('a', 1), message('b', 2, 'ben'), message('c', 3, 'ada')], 'ada')).toBe(1);
  });
});
