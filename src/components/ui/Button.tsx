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
  /**
   * While disabled or busy, stay focusable (aria-disabled, clicks ignored) instead of `disabled`, which drops keyboard
   * focus to the page. For buttons that change state under someone, such as when a live update fills a team.
   */
  keepFocus?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', busy = false, tip, tipSide, tipAlign, keepFocus = false, className, children, disabled, ...rest }: ButtonProps) {
  const blocked = Boolean(disabled || busy);
  const soft = keepFocus && blocked;
  const button = (
    <button
      type="button"
      {...rest}
      disabled={blocked && !keepFocus}
      aria-disabled={soft || undefined}
      // preventDefault also stops a submit button submitting its form, from a click or Enter in a field.
      onClick={soft ? (event) => event.preventDefault() : rest.onClick}
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
