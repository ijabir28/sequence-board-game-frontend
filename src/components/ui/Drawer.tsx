import { useEffect, useId, useRef, type ReactNode } from 'react';
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
 * Escape or a tap on the backdrop closes it.
 */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const drawer = ref.current;
    if (!drawer) return;
    if (open && !drawer.open) drawer.showModal();
    if (!open && drawer.open) drawer.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close menu" {...tipProps('Close the menu (Esc)', 'bottom', 'end')}>
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
