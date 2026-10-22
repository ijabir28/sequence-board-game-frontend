import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import styles from './GameScreen.module.css';

/** The link anyone can open to watch a table's game live, signed in or not. */
export function watchLink(roomId: string): string {
  return `${window.location.origin}/watch/${encodeURIComponent(roomId)}`;
}

/** Copies the table's watch link. A header icon button, like the game's other options. */
export function ShareWatchLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState<boolean | 'failed'>(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(watchLink(roomId));
      setCopied(true);
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const tip =
    copied === 'failed'
      ? `Your browser blocked copying. The link is ${watchLink(roomId)}`
      : copied
        ? 'Watch link copied'
        : 'Copy a link anyone can open to watch this game live. They see the board, never a hand.';
  return (
    <Tooltip text={tip} align="end">
      <button type="button" className={styles.iconButton} onClick={copy} aria-label="Copy watch link">
        <Icon name={copied === true ? 'check' : 'eye'} />
        <span className="visually-hidden" aria-live="polite">
          {copied === true ? 'Watch link copied' : ''}
        </span>
      </button>
    </Tooltip>
  );
}
