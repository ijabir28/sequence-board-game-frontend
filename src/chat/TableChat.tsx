import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  MAX_MESSAGE_LENGTH,
  REACTIONS,
  openTableChat,
  reactionEmoji,
  sendTableChat,
  sendTableReaction,
  type ChatMessage,
  type ReactionId,
} from '../api/tableChat';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { appendMessage, countUnseen, mergeHistory } from './chatLog';
import styles from './TableChat.module.css';

/** How long a reaction (or, with the chat closed, a message) floats over the chat button. */
const BURST_MS = 3500;
/** At most this many float at once; older ones make way. */
const MAX_BURSTS = 5;

interface Burst {
  id: string;
  name: string;
  emoji?: string;
  text?: string;
}

interface TableChatProps {
  roomId: string;
  /** The signed-in player's handle, or null: anyone may read along, only signed-in players speak. */
  you: string | null;
  /** Game screens keep the button clear of the hand strip on phones. */
  placement?: 'page' | 'game';
}

/**
 * The table's public chat and quick reactions, for its lobby and its game. Everyone with the table open sees every
 * message and reaction (players and spectators alike): there are no private messages, so nobody can pass hints
 * about their hand. The panel floats over the page, so the game goes on while it is open.
 */
export function TableChat({ roomId, you, placement = 'page' }: TableChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  // The listeners read these through a ref, so the chat isn't reopened whenever they change.
  const latest = useRef({ open, you, messages });
  latest.current = { open, you, messages };

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const float = (burst: Burst) => {
      setBursts((current) => [...current, burst].slice(-MAX_BURSTS));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setBursts((current) => current.filter((b) => b.id !== burst.id));
      }, BURST_MS);
      timers.add(timer);
    };
    const close = openTableChat(roomId, {
      onHistory: (history) => {
        const { open, you, messages } = latest.current;
        // The first history is the table's backlog, already read or not: only what arrives after counts as unread.
        if (!open && messages.length > 0) setUnread((n) => n + countUnseen(messages, history, you));
        setMessages((current) => mergeHistory(current, history));
      },
      onMessage: (message) => {
        const { open, you } = latest.current;
        setMessages((current) => appendMessage(current, message));
        if (open || message.author.handle === you) return;
        setUnread((n) => n + 1);
        float({ id: message.id, name: message.author.name, text: message.text });
      },
      onReaction: (reaction) => {
        float({ id: reaction.id, name: reaction.author.handle === latest.current.you ? 'You' : reaction.author.name, emoji: reactionEmoji(reaction.reaction) });
      },
    });
    return () => {
      close();
      timers.forEach(clearTimeout);
    };
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const result = await sendTableChat(roomId, text);
    setSending(false);
    if (result.ok) setDraft('');
    else setError(result.message);
    inputRef.current?.focus();
  };

  const onReact = async (reaction: ReactionId) => {
    setError(null);
    const result = await sendTableReaction(roomId, reaction);
    if (!result.ok) setError(result.message);
  };

  const signedIn = you !== null;

  return (
    <div className={[styles.root, placement === 'game' ? styles.game : ''].join(' ')}>
      <div className={styles.bursts} aria-live="polite">
        {bursts.map((burst) => (
          <p key={burst.id} className={[styles.burst, burst.emoji ? styles.reaction : ''].join(' ')}>
            {burst.emoji && <span className={styles.burstEmoji}>{burst.emoji}</span>}
            <span className={styles.burstText}>
              <strong>{burst.name}</strong>
              {burst.text && <span>{burst.text}</span>}
            </span>
          </p>
        ))}
      </div>

      {open && (
        <section
          id={panelId}
          className={styles.panel}
          aria-label="Table chat"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <header className={styles.header}>
            <div>
              <h2>Table chat</h2>
              <p className={styles.public}>
                <Icon name="eye" size={12} />
                Everyone at this table sees every message. There are no private messages.
              </p>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close the chat" {...tipProps('Close the chat (Esc)', 'bottom', 'end')}>
              <Icon name="close" size={18} />
            </button>
          </header>

          <ol className={styles.list} ref={listRef}>
            {messages.length === 0 && <li className={styles.empty}>No messages yet. Say hello to the table!</li>}
            {messages.map((message) => {
              const mine = message.author.handle === you;
              return (
                <li key={message.id} className={[styles.message, mine ? styles.mine : ''].join(' ')}>
                  <span className={styles.meta}>
                    <strong>{mine ? 'You' : message.author.name}</strong>
                    <time dateTime={new Date(message.at).toISOString()}>
                      {new Date(message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </span>
                  <span className={styles.text}>{message.text}</span>
                </li>
              );
            })}
          </ol>

          {signedIn ? (
            <div className={styles.compose}>
              <div className={styles.reactions} role="group" aria-label="Quick reactions">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.id}
                    type="button"
                    className={styles.reactionButton}
                    onClick={() => void onReact(reaction.id)}
                    aria-label={reaction.label}
                    {...tipProps(`${reaction.label}: everyone at the table sees it`, 'top')}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <form className={styles.form} onSubmit={onSubmit}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Message everyone at the table"
                  aria-label="Message everyone at the table"
                  autoComplete="off"
                  enterKeyHint="send"
                />
                <button type="submit" className={styles.send} disabled={!draft.trim() || sending} aria-label="Send to everyone" {...tipProps('Send to everyone at the table', 'top', 'end')}>
                  <Icon name="send" size={18} />
                </button>
              </form>
            </div>
          ) : (
            <p className={styles.signIn}>
              <Link to="/signin" state={{ from: window.location.pathname }}>
                Sign in
              </Link>{' '}
              to chat and react. You can read along without an account.
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread > 0 ? `Table chat, ${unread} unread` : 'Table chat'}
        {...tipProps(open ? 'Close the table chat' : 'Open the table chat: messages and reactions everyone at the table sees', 'top', 'start')}
      >
        <Icon name="chat" size={22} />
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  );
}
