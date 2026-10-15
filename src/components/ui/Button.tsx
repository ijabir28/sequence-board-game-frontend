import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
import { Tooltip } from './Tooltip';
import type { TipAlign, TipSide } from './TooltipLayer';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  busy?: boolean;
  /** What the button does, shown as a tip on hover, keyboard focus or a long press. */
  tip?: string;
  tipSide?: TipSide;
  tipAlign?: TipAlign;
}

export function Button({ variant = 'secondary', size = 'md', busy = false, tip, tipSide, tipAlign, className, children, disabled, ...rest }: ButtonProps) {
  const button = (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
  return tip ? (
    <Tooltip text={tip} side={tipSide} align={tipAlign}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
