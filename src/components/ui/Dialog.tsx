import { useEffect, useId, useRef, type ReactNode } from 'react';
import { NO_ESC_KEY, useMediaQuery } from '../../game/useMediaQuery';
import { Icon } from './Icon';
import { tipProps } from './TooltipLayer';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons shown at the bottom. */
  actions?: ReactNode;
  /** `wide` gives forms more room. */
  size?: 'normal' | 'wide';
}

/**
 * Native modal <dialog>: focus trapping, Escape to close and inert background come for free. Mark the field to
 * start in with data-autofocus; otherwise the panel itself takes focus, so the close button isn't left focused (and
 * showing its tip) on every open.
 */
export function Dialog({ open, title, onClose, children, actions, size = 'normal' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noEsc = useMediaQuery(NO_ESC_KEY);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The content is mounted while closed, so autoFocus can't work; a field marked data-autofocus gets focus
      // instead of the close button, and with none the panel does.
      (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog).focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, size === 'wide' && styles.wide].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      tabIndex={-1}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close" {...tipProps(noEsc ? null : 'Close (Esc)', 'bottom', 'end')}>
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {actions && <footer className={styles.actions}>{actions}</footer>}
      </div>
    </dialog>
  );
}

