import type { ChatMessage } from '../api/tableChat';

/** As many messages as the server keeps for a table. */
export const KEPT_MESSAGES = 50;

/**
 * The table's history (sent on opening and after a reconnect) merged with what this page already has: messages the
 * history no longer holds stay, nothing appears twice, oldest first.
 */
export function mergeHistory(current: ChatMessage[], history: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...current, ...history]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-KEPT_MESSAGES);
}

/** A new message at the end of the log, unless it is already there. */
export function appendMessage(current: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (current.some((m) => m.id === message.id)) return current;
  return [...current, message].slice(-KEPT_MESSAGES);
}

/** How many of `history`'s messages are new to this page and from someone else: the unread ones. */
export function countUnseen(current: ChatMessage[], history: ChatMessage[], you: string | null): number {
  const seen = new Set(current.map((m) => m.id));
  return history.filter((m) => !seen.has(m.id) && m.author.handle !== you).length;
}
