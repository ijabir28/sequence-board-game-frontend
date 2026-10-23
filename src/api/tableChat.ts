import { getSocket } from './socket';

// The table's chat and quick reactions (see the backend's docs/api.md, "Table chat is public"). Everything said at a
// table goes to everyone who has it open, players and spectators alike: there are no private messages, so nobody can
// pass hints about their hand. Nothing here takes a recipient.

export const MAX_MESSAGE_LENGTH = 200;

/** The quick reactions the server accepts, in the order the picker shows them. */
export const REACTIONS = [
  { id: 'thumbs_up', emoji: '👍', label: 'Thumbs up' },
  { id: 'clap', emoji: '👏', label: 'Applause' },
  { id: 'fire', emoji: '🔥', label: 'On fire' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'laugh', emoji: '😂', label: 'Ha ha' },
  { id: 'oops', emoji: '😅', label: 'Oops' },
  { id: 'party', emoji: '🎉', label: 'Party' },
  { id: 'gg', emoji: 'GG', label: 'Good game' },
] as const;

export type ReactionId = (typeof REACTIONS)[number]['id'];

export interface ChatAuthor {
  handle: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  text: string;
  at: number;
}

export interface ChatReaction {
  id: string;
  author: ChatAuthor;
  reaction: ReactionId;
  at: number;
}

export type SendResult = { ok: true } | { ok: false; message: string };

const OFFLINE = "You're offline, so it wasn't sent. It goes again once you reconnect: try once more.";
const NO_ANSWER = "The table didn't answer, so it may not have been sent. Try again.";
const ACK_TIMEOUT_MS = 8000;

function author(raw: unknown): ChatAuthor | null {
  const value = raw as { handle?: unknown; name?: unknown } | null | undefined;
  if (typeof value?.handle !== 'string' || !value.handle) return null;
  return { handle: value.handle, name: typeof value.name === 'string' && value.name.trim() ? value.name : value.handle };
}

function time(raw: unknown): number {
  const at = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isNaN(at) ? Date.now() : at;
}

export function sanitizeMessage(raw: unknown): ChatMessage | null {
  const value = raw as { id?: unknown; author?: unknown; text?: unknown; at?: unknown } | null | undefined;
  const who = author(value?.author);
  if (!who || typeof value?.id !== 'string' || typeof value.text !== 'string' || !value.text) return null;
  return { id: value.id, author: who, text: value.text.slice(0, MAX_MESSAGE_LENGTH), at: time(value.at) };
}

export function sanitizeReaction(raw: unknown): ChatReaction | null {
  const value = raw as { id?: unknown; author?: unknown; reaction?: unknown; at?: unknown } | null | undefined;
  const who = author(value?.author);
  const known = REACTIONS.find((r) => r.id === value?.reaction);
  if (!who || typeof value?.id !== 'string' || !known) return null;
  return { id: value.id, author: who, reaction: known.id, at: time(value.at) };
}

export function reactionEmoji(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)?.emoji ?? '';
}

export interface TableChatListeners {
  /** The table's last messages, oldest first: on opening, and again after every reconnect. */
  onHistory: (messages: ChatMessage[]) => void;
  onMessage: (message: ChatMessage) => void;
  onReaction: (reaction: ChatReaction) => void;
}

/**
 * Opens the table's chat (`open_table_chat`), again after every reconnect, until the returned function is called
 * (`close_table_chat`). Anyone with the table's link hears it; only signed-in players may speak.
 */
export function openTableChat(roomId: string, listeners: TableChatListeners): () => void {
  const s = getSocket();
  const open = () => s.emit('open_table_chat', { room_id: roomId });
  const onHistory = (data?: { room_id?: unknown; messages?: unknown }) => {
    if (data?.room_id !== roomId || !Array.isArray(data.messages)) return;
    listeners.onHistory(data.messages.map(sanitizeMessage).filter((m): m is ChatMessage => m !== null));
  };
  const onMessage = (data?: { room_id?: unknown; message?: unknown }) => {
    if (data?.room_id !== roomId) return;
    const message = sanitizeMessage(data.message);
    if (message) listeners.onMessage(message);
  };
  const onReaction = (data?: { room_id?: unknown; reaction?: unknown }) => {
    if (data?.room_id !== roomId) return;
    const reaction = sanitizeReaction(data.reaction);
    if (reaction) listeners.onReaction(reaction);
  };
  s.on('table_chat_history', onHistory);
  s.on('table_chat', onMessage);
  s.on('table_reaction', onReaction);
  if (s.connected) open();
  s.on('connect', open);
  return () => {
    s.off('connect', open);
    s.off('table_chat_history', onHistory);
    s.off('table_chat', onMessage);
    s.off('table_reaction', onReaction);
    s.emit('close_table_chat', { room_id: roomId });
  };
}

function send(event: string, payload: Record<string, unknown>): Promise<SendResult> {
  const s = getSocket();
  if (!s.connected) return Promise.resolve({ ok: false, message: OFFLINE });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, message: NO_ANSWER }), ACK_TIMEOUT_MS);
    s.emit(event, payload, (answer?: { ok?: unknown; message?: unknown }) => {
      clearTimeout(timer);
      if (answer?.ok === true) resolve({ ok: true });
      else resolve({ ok: false, message: typeof answer?.message === 'string' ? answer.message : NO_ANSWER });
    });
  });
}

/** Says `text` to everyone at the table. */
export function sendTableChat(roomId: string, text: string): Promise<SendResult> {
  return send('send_table_chat', { room_id: roomId, text });
}

/** Reacts at the table, for everyone to see. */
export function sendTableReaction(roomId: string, reaction: ReactionId): Promise<SendResult> {
  return send('send_table_reaction', { room_id: roomId, reaction });
}
