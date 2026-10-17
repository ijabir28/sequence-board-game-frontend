import type { FormEvent, ReactNode } from 'react';
import { Chip } from '../components/Chip';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

/** The page around the account screens: the three chips, then a card that is a form when `onSubmit` is given. */
export function AuthShell({ onSubmit, children }: { onSubmit?: (event: FormEvent) => void; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={own.mark} aria-hidden="true">
        <span><Chip team={0} /></span>
        <span><Chip team={1} /></span>
        <span><Chip team={2} /></span>
      </div>
      {onSubmit ? (
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          {children}
        </form>
      ) : (
        <div className={styles.card}>{children}</div>
      )}
    </div>
  );
}
