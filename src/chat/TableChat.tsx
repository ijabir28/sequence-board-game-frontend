import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
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
import { useMediaQuery } from '../game/useMediaQuery';
import { appendMessage, countUnseen, mergeHistory } from './chatLog';
import { currentLane, currentRise, type Lane, type Rise } from './safeLane';
import styles from './TableChat.module.css';

/** How long a reaction (or, with the chat closed, a message) floats in its lane. */
const BURST_MS = 3500;
/** At most this many float at once; older ones make way. */
const MAX_BURSTS = 4;
/** How long the chat button shows a reaction when there is no lane for it. */
const POP_MS = 1800;
/** How long a reaction takes to rise off a phone's screen (the animation in TableChat.module.css). */
const RISE_MS = 3200;
/** Steps along the board's top edge between one rising reaction and the next (the golden ratio spreads them evenly). */
const RISE_STEP = 0.618034;

/** One tap sends these to the table, like any message. */
export const QUICK_PHRASES = [
  'Hi!',
  'Good luck!',
  'Nice move',
  'Well played',
  'Play fast',
  'Thinking…',
  'Unlucky',
  'Sorry!',
  'Oops',
  'Thanks',
  'Good game',
  'Rematch?',
];

interface Burst {
  id: string;
  name: string;
  emoji?: string;
  text?: string;
}

interface Rising extends Rise {
  id: string;
  name: string;
  emoji: string;
}

type Tab = 'quick' | 'messages';

interface TableChatProps {
  roomId: string;
  /** The signed-in player's handle, or null: anyone may read along, only signed-in players speak. */
  you: string | null;
  /** On a game screen, the game makes room for the chat button (see GameScreen.module.css). */
  placement?: 'page' | 'game';
}

/**
 * The table's public chat and quick reactions, for its lobby and its game. Everyone with the table open sees every
 * message and reaction (players and spectators alike): there are no private messages, so nobody can pass hints
 * about their hand.
 *
 * A round button (bottom-left on wide screens, bottom-right on phones) opens a panel over the page: quick phrases and
 * reactions, which send with one tap and close it again, and the messages with a box to type in. Reactions from the
 * table float in a lane clear of the board, the hand and the turn panel (see safeLane.ts), or pop on the button. On a
 * phone's game they rise from the board's top edge and off the screen instead, with the sender's name beside them only
 * while they pass through the blank space between the board and the turn container.
 */
export function TableChat({ roomId, you, placement = 'page' }: TableChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('quick');
  const [unread, setUnread] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [lane, setLane] = useState<Lane | null>(null);
  const [pop, setPop] = useState<{ id: string; emoji: string } | null>(null);
  const [rising, setRising] = useState<Rising[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const phone = useMediaQuery('(max-width: 600px)');
  // The listeners read these through a ref, so the chat isn't reopened whenever they change.
  const latest = useRef({ open, you, messages, phone });
  latest.current = { open, you, messages, phone };

  // Lets the page make room for the chat button.
  useEffect(() => {
    document.body.dataset.tableChat = placement;
    return () => {
      delete document.body.dataset.tableChat;
    };
  }, [placement]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    let rises = 0;
    const float = (burst: Burst) => {
      // A phone's game: a reaction rises from the board's top edge, whoever sent it.
      if (burst.emoji && latest.current.phone) {
        const rise = currentRise((rises++ * RISE_STEP) % 1);
        if (rise) {
          const emoji = burst.emoji;
          setRising((current) => [...current, { ...rise, id: burst.id, name: burst.name, emoji }].slice(-MAX_BURSTS * 2));
          later(() => setRising((current) => current.filter((r) => r.id !== burst.id)), RISE_MS);
          return;
        }
      }
      // Measured each time: the board and the hand move as the window and the game change. Only the game and the chat
      // button count, not the panel (the lane is drawn over it), so a reaction lands in the same place whoever sent it
      // and whether or not this player has the panel open.
      const avoid = rootRef.current ? [...rootRef.current.querySelectorAll('[data-chat-self]')] : [];
      const found = currentLane(latest.current.phone ? 'right' : 'left', avoid);
      if (!found) {
        // Nowhere to float without covering the game: the button shows a reaction, and a message only counts as unread.
        if (burst.emoji) {
          setPop({ id: burst.id, emoji: burst.emoji });
          later(() => setPop((current) => (current?.id === burst.id ? null : current)), POP_MS);
        }
        return;
      }
      setLane(found);
      setBursts((current) => [...current, burst].slice(-MAX_BURSTS));
      later(() => setBursts((current) => current.filter((b) => b.id !== burst.id)), BURST_MS);
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
    if (!open || tab !== 'messages') return;
    setUnread(0);
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, tab, messages]);

  useEffect(() => {
    // Phones don't pop the keyboard up over the board unasked.
    if (open && tab === 'messages' && !phone) inputRef.current?.focus();
  }, [open, tab, phone]);

  // Escape closes the panel wherever the focus is (on a game it also clears the selected card, as before).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = () => {
    if (!open) {
      // Unread messages open on the conversation; otherwise the panel opens where it was left.
      if (unread > 0 || you === null) setTab('messages');
      setError(null);
    }
    setOpen(!open);
  };

  const say = async (text: string) => {
    setSending(true);
    setError(null);
    const result = await sendTableChat(roomId, text);
    setSending(false);
    if (!result.ok) setError(result.message);
    return result.ok;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    if (await say(text)) setDraft('');
    inputRef.current?.focus();
  };

  // A quick phrase is one tap and closes the panel again, so the board is back in view. Reactions leave it open, so
  // several can go in a row.
  const onPhrase = async (text: string) => {
    if (sending) return;
    if (await say(text)) setOpen(false);
  };

  const onReact = async (reaction: ReactionId) => {
    setError(null);
    const result = await sendTableReaction(roomId, reaction);
    if (!result.ok) setError(result.message);
  };

  const signedIn = you !== null;
  const laneStyle: CSSProperties | undefined = lane ? { left: lane.left, top: lane.top, width: lane.width, height: lane.height } : undefined;

  return (
    <div ref={rootRef} className={[styles.root, placement === 'game' ? styles.game : ''].join(' ')}>
      {bursts.length > 0 && lane && (
        <div className={[styles.lane, lane.direction === 'row' ? styles.band : styles.column].join(' ')} style={laneStyle} aria-live="polite">
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
      )}

      {rising.length > 0 && (
        <div className={styles.rising} aria-live="polite">
          {rising.map((rise) => (
            <span
              key={rise.id}
              className={styles.riseEmoji}
              style={{ left: rise.x, top: rise.start, '--rise': `${rise.distance}px` } as CSSProperties}
            >
              <span aria-hidden="true">{rise.emoji}</span>
              <span className="visually-hidden">{rise.name} reacted {rise.emoji}</span>
            </span>
          ))}
        </div>
      )}
      {/* The names ride with their emoji, but in a layer cut to the space between the turn container and the board, so
          they show only there: above it, only the emoji goes on rising. */}
      {rising.map((rise) =>
        rise.gapHeight > 0 ? (
          <div key={`${rise.id}-name`} className={styles.nameGap} style={{ top: rise.gapTop, height: rise.gapHeight }} aria-hidden="true">
            <span className={styles.riseName} style={{ left: rise.x, top: rise.start - rise.gapTop, '--rise': `${rise.distance}px` } as CSSProperties}>
              {rise.name}
            </span>
          </div>
        ) : null,
      )}

      {open && (
        <section
          id={panelId}
          className={styles.panel}
          aria-label="Table chat"
        >
          <header className={styles.header}>
            <div className={styles.tabs} role="tablist" aria-label="Table chat">
              <button type="button" role="tab" aria-selected={tab === 'quick'} className={styles.tab} onClick={() => setTab('quick')}>
                Quick
              </button>
              <button type="button" role="tab" aria-selected={tab === 'messages'} className={styles.tab} onClick={() => setTab('messages')}>
                Messages
                {unread > 0 && <span className={styles.tabCount}>{unread > 9 ? '9+' : unread}</span>}
              </button>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close the chat" {...tipProps('Close the chat (Esc)', 'bottom', 'end')}>
              <Icon name="close" size={18} />
            </button>
          </header>
          <p className={styles.public}>
            <Icon name="eye" size={12} />
            Everyone at this table sees every message. There are no private messages.
          </p>

          {tab === 'quick' ? (
            signedIn ? (
              <div className={styles.quick}>
                <div className={styles.phrases}>
                  {QUICK_PHRASES.map((phrase) => (
                    <button key={phrase} type="button" className={styles.phrase} onClick={() => void onPhrase(phrase)} disabled={sending}>
                      {phrase}
                    </button>
                  ))}
                </div>
                <div className={styles.reactions} role="group" aria-label="Quick reactions">
                  {REACTIONS.map((reaction) => (
                    <button
                      key={reaction.id}
                      type="button"
                      className={styles.reactionButton}
                      onClick={() => void onReact(reaction.id)}
                      aria-label={reaction.label}
                      // A plain title, not a tooltip: a tooltip opens on a long press, and a held emoji should just send.
                      title={reaction.label}
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
              </div>
            ) : (
              <SignInNote />
            )
          ) : (
            <>
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
                <SignInNote />
              )}
            </>
          )}
        </section>
      )}

      <button
        type="button"
        className={[styles.launcher, pop ? styles.popping : ''].join(' ')}
        data-chat-self
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread > 0 ? `Table chat, ${unread} unread` : 'Table chat'}
        {...tipProps(open ? 'Close the table chat' : 'Chat and react: everyone at the table sees it', 'top', phone ? 'end' : 'start')}
      >
        {pop ? (
          <span key={pop.id} className={styles.popEmoji} aria-hidden="true">
            {pop.emoji}
          </span>
        ) : (
          <Icon name={open ? 'close' : 'chat'} size={22} />
        )}
        {unread > 0 && !open && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  );
}

function SignInNote() {
  return (
    <p className={styles.signIn}>
      <Link to="/signin" state={{ from: window.location.pathname }}>
        Sign in
      </Link>{' '}
      to chat and react. You can read along without an account.
    </p>
  );
}
