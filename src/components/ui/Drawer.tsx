import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useMediaQuery } from '../../game/useMediaQuery';
import { Icon } from './Icon';
import { tipProps } from './TooltipLayer';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides in from the right edge. A native modal <dialog>, like Dialog, so focus stays inside it and
 * Escape or a tap on the backdrop closes it. Opening focuses the panel itself rather than its first control, so the
 * close button isn't left focused (and showing its tip) on every open.
 */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Touch screens have no Escape key to mention, and the button's icon and label already say what it does.
  const touch = useMediaQuery('(pointer: coarse)');

  useEffect(() => {
    const drawer = ref.current;
    if (!drawer) return;
    if (open && !drawer.open) {
      drawer.showModal();
      drawer.focus();
    }
    if (!open && drawer.open) drawer.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={titleId}
      tabIndex={-1}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close menu" {...tipProps(touch ? null : 'Close the menu (Esc)', 'bottom', 'end')}>
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
